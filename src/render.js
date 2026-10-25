// scenes.json から動画を書き出す
//
// 使い方:
//   node src/render.js videos/furusato/scenes.json              全場面を書き出す（meta.output に保存）
//   node src/render.js videos/furusato/scenes.json --scenes 1   指定した場面だけ書き出す（out/preview/ に保存）
//   node src/render.js videos/furusato/scenes.json --still 2.5  指定した秒数の静止画を書き出す（out/preview/ に保存）
//   node src/render.js videos/furusato/scenes.json --check      字幕の行数などの確認だけ行う

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const MAX_LINES = 2;

function parseArgs(argv) {
  const args = { scenesPath: null, scenes: null, still: null, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scenes") args.scenes = argv[++i].split(",").map(Number);
    else if (a === "--still") args.still = Number(argv[++i]);
    else if (a === "--check") args.check = true;
    else args.scenesPath = a;
  }
  if (!args.scenesPath) {
    console.error("scenes.json のパスを指定してください");
    process.exit(1);
  }
  return args;
}

// scenes.json の中身を確認する。問題があればメッセージの配列を返す
function validate(data, report) {
  const errors = [];
  data.scenes.forEach((s) => {
    s.subtitles.forEach((sub, i) => {
      if (!(sub.start >= 0 && sub.start < sub.end && sub.end <= s.duration)) {
        errors.push(`場面${s.id} 字幕${i + 1}：時間（${sub.start}〜${sub.end}秒）が場面の長さ ${s.duration}秒 に収まっていません`);
      }
    });
  });
  report.filter((r) => r.lines > MAX_LINES).forEach((r) => {
    errors.push(`場面${r.scene} 字幕${r.subtitle}：${r.lines}行になります（最大${MAX_LINES}行）「${r.text}」`);
  });
  return errors;
}

function startFfmpeg(fps, output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  return spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    output,
  ], { stdio: ["pipe", "inherit", "inherit"] });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = JSON.parse(fs.readFileSync(args.scenesPath, "utf8"));
  const { width, height, fps } = data.meta;
  const name = path.basename(data.meta.output, ".mp4");

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto("file://" + path.join(ROOT, "src/template.html"));

    // 日本語フォントが読み込めたかを最初に確認する。読み込めていなければ書き出さない
    const fontOk = await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('500 40px "Zen Maru Gothic"', "あ"),
        document.fonts.load('700 40px "Zen Maru Gothic"', "あ"),
      ]);
      return document.fonts.check('500 40px "Zen Maru Gothic"') && document.fonts.check('700 40px "Zen Maru Gothic"');
    });
    if (!fontOk) throw new Error("フォント Zen Maru Gothic を読み込めませんでした（assets/fonts を確認してください）");
    console.log("フォント：Zen Maru Gothic を読み込みました");

    const { totalDuration, report } = await page.evaluate((d) => window.init(d), data);
    report.filter((r) => r.lines).forEach((r) => console.log(`  場面${r.scene} 字幕${r.subtitle}：${r.lines}行`));
    report.filter((r) => r.warning).forEach((r) => console.log(`  注意：場面${r.scene} ${r.warning}`));
    // 場面や静止画の秒数を指定したときは、対象外の場面の問題は注意として表示するだけにする
    let targetIds = args.scenes;
    if (args.still !== null) {
      let start = 0;
      const hit = data.scenes.find((s) => (start += s.duration) > args.still) || data.scenes[data.scenes.length - 1];
      targetIds = [hit.id];
    }
    const target = (msg) => !targetIds || targetIds.some((id) => msg.startsWith(`場面${id} `));
    const errors = validate(data, report);
    errors.filter((e) => !target(e)).forEach((e) => console.log("  注意：" + e));
    if (errors.some(target)) throw new Error("scenes.json に問題があります\n" + errors.filter(target).map((e) => "  - " + e).join("\n"));
    console.log(`確認OK：全${data.scenes.length}場面、合計${totalDuration}秒`);
    if (args.check) return;

    if (args.still !== null) {
      const out = path.join(ROOT, "out/preview", `${name}_${String(args.still).replace(".", "_")}s.png`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.evaluate((t) => window.renderAt(t), args.still);
      await page.screenshot({ path: out });
      console.log("書き出し：" + path.relative(ROOT, out));
      return;
    }

    // 書き出す時間の範囲を決める（場面指定があればその場面だけ）
    let ranges = [[0, totalDuration]];
    let output = path.join(ROOT, data.meta.output);
    if (args.scenes) {
      let start = 0;
      ranges = [];
      data.scenes.forEach((s) => {
        if (args.scenes.includes(s.id)) ranges.push([start, start + s.duration]);
        start += s.duration;
      });
      output = path.join(ROOT, "out/preview", `${name}_s${args.scenes.join("_")}.mp4`);
    }

    const ffmpeg = startFfmpeg(fps, output);
    const done = new Promise((resolve, reject) =>
      ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg が終了コード ${code} で止まりました`)))));
    const totalFrames = ranges.reduce((n, [a, b]) => n + Math.round((b - a) * fps), 0);
    const startedAt = Date.now();
    let count = 0;
    for (const [a, b] of ranges) {
      const frames = Math.round((b - a) * fps);
      for (let i = 0; i < frames; i++) {
        await page.evaluate((t) => window.renderAt(t), a + i / fps);
        const png = await page.screenshot({ type: "png" });
        if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
        if (++count % (fps * 5) === 0) console.log(`  ${count}/${totalFrames} フレーム`);
      }
    }
    ffmpeg.stdin.end();
    await done;
    console.log(`書き出し：${path.relative(ROOT, output)}（${totalFrames}フレーム、${((Date.now() - startedAt) / 1000).toFixed(1)}秒）`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("エラー：" + e.message);
  process.exit(1);
});
