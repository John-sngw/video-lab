// 図の種類ごとの描画。scenes.json の figure.type と対応する
// 各関数は (params, 図のエリアの要素) を受け取り、{ update(場面内の秒数) } を返す
// カードの大きさは 920x960（画面の左右に 80px の余白）。カード内の座標はカードの左上が基準

const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);   // 減速して止まる
const progress = (t, from, to) => Math.min(1, Math.max(0, (t - from) / (to - from)));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const svg = (w, h, inner, vb = `0 0 ${w} ${h}`) =>
  `<svg width="${w}" height="${h}" viewBox="${vb}" fill="none" stroke="#3B6D11" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// 線画アイコン（200x200 の座標で描く）
const ICONS = {
  person: `<circle cx="100" cy="68" r="36"/><path d="M38 178 Q38 118 100 118 Q162 118 162 178"/>`,
  townhall: `<path d="M28 82 L100 34 L172 82 Z"/><path d="M42 82 V168 M158 82 V168 M24 170 H176"/><path d="M76 102 V148 M100 102 V148 M124 102 V148"/>`,
  gift: `<rect x="38" y="88" width="124" height="86" rx="10"/><rect x="28" y="62" width="144" height="30" rx="8"/><path d="M100 62 V174"/><path d="M100 62 C86 34 56 40 70 60 M100 62 C114 34 144 40 130 60"/>`,
  check: `<path d="M44 104 L86 144 L158 62"/>`,
};
const icon = (name, size) => svg(size, size, ICONS[name], "0 0 200 200");

// pathLength="1" をつけた線を、p（0〜1）の割合まで描く
const drawLine = (el, p) => {
  el.style.strokeDasharray = 1;
  el.style.strokeDashoffset = 1 - p;
};
// 下から浮き上がりながら表示する。dim（0〜1）で薄くする（説明が次に移ったとき用）
const appear = (el, p, dy = 24, dim = 0) => {
  el.style.opacity = p * (1 - 0.55 * dim);
  el.style.transform = `translateY(${(1 - p) * dy}px)`;
};

const CARD = `class="card" style="top:300px;height:960px"`;
const abs = (style) => `position:absolute;${style}`;

const FIGURES = {
  // 1. タイトル：家とハートの線画 ＋ タイトル文字
  title(params, root) {
    root.innerHTML = `
      <div class="card" style="top:300px;height:960px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:72px">
        ${svg(440, 400, `
          <path class="draw" pathLength="1" d="M70 200 L220 80 L370 200" />
          <path class="draw" pathLength="1" d="M110 170 L110 360 L330 360 L330 170" />
          <path class="draw" pathLength="1" d="M190 360 L190 270 Q190 250 210 250 L230 250 Q250 250 250 270 L250 360" />
          <path class="heart" d="M220 50 C200 20 160 30 165 62 C170 90 220 118 220 118 C220 118 270 90 275 62 C280 30 240 20 220 50 Z"
                fill="#EAF3DE" stroke-width="8" style="transform-origin:220px 80px" />
        `)}
        <div class="title-text" style="font-size:84px;letter-spacing:0.02em">${esc(params.text)}</div>
      </div>`;
    const card = root.querySelector(".card");
    const lines = root.querySelectorAll(".draw");
    const heart = root.querySelector(".heart");
    const text = root.querySelector(".title-text");
    return {
      update(t) {
        const c = ease(progress(t, 0, 0.7));
        card.style.opacity = c;
        card.style.transform = `translateY(${(1 - c) * 40}px)`;
        lines.forEach((l, i) => drawLine(l, ease(progress(t, 0.3 + i * 0.25, 1.1 + i * 0.25))));
        const h = ease(progress(t, 1.3, 1.8));
        heart.style.opacity = h;
        heart.style.transform = `translateY(${(1 - h) * 20}px) scale(${0.85 + 0.15 * h})`;
        const tx = ease(progress(t, 0.6, 1.2));
        text.style.opacity = tx;
        text.style.transform = `translateY(${(1 - tx) * 24}px)`;
      },
    };
  },

  // 2. 仕組み：あなた →（寄付）→ 自治体 →（返礼品）→ あなた
  flow(params, root) {
    const node = (cls, left, name, label) => `
      <div class="${cls}" style="${abs(`left:${left}px;top:260px;width:320px;text-align:center`)}">
        ${icon(name, 200)}
        <div style="font-size:48px;margin-top:16px">${esc(label)}</div>
      </div>`;
    root.innerHTML = `
      <div ${CARD}>
        ${node("from", 40, "person", params.from)}
        ${node("to", 560, "townhall", params.to)}
        <div style="${abs("left:0;top:0")}">${svg(920, 960, `
          <path class="give" pathLength="1" d="M370 330 H550 M520 300 L550 330 L520 360"/>
          <path class="receive" pathLength="1" d="M550 440 H370 M400 410 L370 440 L400 470"/>`)}</div>
        <div class="give-label" style="${abs("left:360px;width:200px;top:240px;text-align:center;font-size:48px;color:#3B6D11")}">${esc(params.give)}</div>
        <div class="gift" style="${abs("left:0;right:0;top:560px;text-align:center")}">
          ${icon("gift", 220)}
          <div style="font-size:56px;color:#3B6D11;margin-top:8px">${esc(params.receive)}</div>
        </div>
      </div>`;
    const q = (s) => root.querySelector(s);
    const at = params.receiveAt ?? 3;
    return {
      update(t) {
        appear(q(".card"), ease(progress(t, 0, 0.5)));
        appear(q(".from"), ease(progress(t, 0.2, 0.8)));
        appear(q(".to"), ease(progress(t, 0.5, 1.1)));
        drawLine(q(".give"), ease(progress(t, 1.0, 1.8)));
        appear(q(".give-label"), ease(progress(t, 1.4, 2.0)), 12);
        drawLine(q(".receive"), ease(progress(t, at, at + 0.8)));
        const g = ease(progress(t, at + 0.4, at + 1.2));
        q(".gift").style.opacity = g;
        q(".gift").style.transform = `translateX(${(1 - g) * 120}px)`;
      },
    };
  },

  // 3. お得の理由：寄付額の帯を「2,000円」と「超えた分」に分ける
  splitBar(params, root) {
    root.innerHTML = `
      <div ${CARD}>
        <div class="label" style="${abs("left:0;right:0;top:250px;text-align:center;font-size:60px")}">${esc(params.label)}</div>
        <div class="bar" style="${abs("left:80px;width:760px;top:400px;height:180px;border:8px solid #3B6D11;border-radius:36px;overflow:hidden;display:flex")}">
          <div class="self" style="width:220px;display:flex;align-items:center;justify-content:center;font-size:44px;border-right:8px dashed rgba(59,109,17,0)">${esc(params.self)}</div>
          <div class="rest" style="flex:1;position:relative;display:flex;align-items:center;justify-content:center">
            <div class="fill" style="${abs("inset:0;background:#3B6D11;opacity:0")}"></div>
            <div class="rest-text" style="position:relative;font-size:44px;color:#fff;opacity:0">${esc(params.rest)}</div>
          </div>
        </div>
        <div class="self-note" style="${abs("left:80px;width:220px;top:610px;text-align:center;font-size:40px;font-weight:500")}">${esc(params.selfNote)}</div>
        <div class="arrow" style="${abs("left:540px;top:600px")}">${svg(80, 140, `<path class="down" pathLength="1" d="M40 10 V120 M14 94 L40 120 L66 94"/>`)}</div>
        <div class="rest-note" style="${abs("left:300px;right:20px;top:760px;text-align:center;font-size:52px;color:#3B6D11")}">${esc(params.restNote)}</div>
      </div>`;
    const q = (s) => root.querySelector(s);
    const split = params.splitAt ?? 1.5, rest = params.restAt ?? 3;
    return {
      update(t) {
        appear(q(".card"), ease(progress(t, 0, 0.5)));
        appear(q(".label"), ease(progress(t, 0.2, 0.8)));
        const b = ease(progress(t, 0.4, 1.3));
        q(".bar").style.clipPath = `inset(0 ${(1 - b) * 100}% 0 0)`;
        const s = ease(progress(t, split, split + 0.6));
        q(".self").style.borderRightColor = `rgba(59,109,17,${s})`;
        q(".self").style.color = `rgba(39,80,10,${s})`;
        appear(q(".self-note"), s, 12);
        const r = ease(progress(t, rest, rest + 0.7));
        q(".fill").style.opacity = r;
        q(".rest-text").style.opacity = r;
        drawLine(q(".down"), ease(progress(t, rest + 0.5, rest + 1.1)));
        appear(q(".rest-note"), ease(progress(t, rest + 0.9, rest + 1.5)));
      },
    };
  },

  // 4. 計算例：寄付 → 控除 → 実質の負担 を上から順に表示する
  calc(params, root) {
    const top = (i) => 130 + i * 260;
    root.innerHTML = `
      <div ${CARD}>
        ${params.rows.map((r, i) => `
          <div class="row" style="${abs(`left:70px;right:70px;top:${top(i)}px;height:170px;display:flex;align-items:center;justify-content:space-between;padding:0 48px;border-radius:40px;${r.emphasis ? "background:#EAF3DE" : ""}`)}">
            <div style="font-size:52px">${esc(r.label)}</div>
            <div style="font-size:${r.emphasis ? 92 : 72}px;${r.emphasis ? "color:#3B6D11" : ""}">${esc(r.value)}</div>
          </div>
          ${i < params.rows.length - 1 ? `<div style="${abs(`left:420px;top:${top(i) + 170}px`)}">${svg(80, 90, `<path class="down" pathLength="1" d="M40 10 V76 M18 54 L40 76 L62 54"/>`)}</div>` : ""}
        `).join("")}
      </div>`;
    const rows = root.querySelectorAll(".row");
    const arrows = root.querySelectorAll(".down");
    return {
      update(t) {
        appear(root.querySelector(".card"), ease(progress(t, 0, 0.5)));
        params.rows.forEach((r, i) => {
          appear(rows[i], ease(progress(t, r.at, r.at + 0.6)));
          if (arrows[i]) drawLine(arrows[i], ease(progress(t, params.rows[i + 1].at - 0.5, params.rows[i + 1].at)));
        });
      },
    };
  },

  // 5. 注意点：上の段に「上限」のメーター、下の段に手続きの選択肢を並べる
  checklist(params, root) {
    const section = (s, i) => {
      const top = i === 0 ? 90 : 520;
      const head = `<div style="font-size:56px;margin-bottom:40px">${esc(s.title)}</div>`;
      if (s.kind === "limit") {
        return `
          <div class="section" style="${abs(`left:70px;right:70px;top:${top}px`)}">
            ${head}
            <div style="position:relative;height:200px">
              <div style="${abs("left:0;right:0;top:40px;height:80px;border-radius:40px;background:#EAF3DE")}"></div>
              <div class="gauge" style="${abs("left:0;top:40px;height:80px;width:0;border-radius:40px;background:#3B6D11")}"></div>
              <div class="cap" style="${abs("left:72%;top:0;height:160px;border-left:8px dashed #27500A")}"></div>
              <div class="cap-label" style="${abs("left:calc(72% + 20px);top:130px;font-size:44px")}">${esc(s.limitLabel)}</div>
            </div>
          </div>`;
      }
      return `
        <div class="section" style="${abs(`left:50px;right:50px;top:${top}px`)}">
          ${head.replace("margin-bottom:40px", "margin-bottom:40px;padding-left:20px")}
          <div style="display:flex;gap:40px">
            ${s.options.map((o) => `
              <div class="option" style="flex:1;height:220px;border:8px solid #3B6D11;border-radius:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
                <div style="font-size:44px">${esc(o.name)}</div>
                ${o.detail ? `<div style="font-size:36px;font-weight:500">${esc(o.detail)}</div>` : ""}
              </div>`).join("")}
          </div>
        </div>`;
    };
    root.innerHTML = `
      <div ${CARD}>
        ${params.sections.map(section).join("")}
        <div style="${abs("left:70px;right:70px;top:470px;border-top:4px solid #EAF3DE")}"></div>
      </div>`;
    const sections = root.querySelectorAll(".section");
    const options = root.querySelectorAll(".option");
    const gauge = root.querySelector(".gauge");
    return {
      update(t) {
        appear(root.querySelector(".card"), ease(progress(t, 0, 0.5)));
        params.sections.forEach((s, i) => {
          const next = params.sections[i + 1];
          appear(sections[i], ease(progress(t, s.at, s.at + 0.6)), 24, next ? ease(progress(t, next.at, next.at + 0.6)) : 0);
          if (s.kind === "limit") gauge.style.width = `${ease(progress(t, s.at + 0.6, s.at + 2.2)) * 72}%`;
          if (s.kind === "options") options.forEach((o, j) => appear(o, ease(progress(t, s.at + 0.4 + j * 0.4, s.at + 1.0 + j * 0.4)), 16));
        });
      },
    };
  },

  // 6. 最近の変更：縦の年表。いま説明している出来事を濃く、終わったものを薄く表示する
  timeline(params, root) {
    const top = (i) => 110 + i * 330;
    root.innerHTML = `
      <div ${CARD}>
        <div style="${abs("left:0;top:0")}">${svg(920, 960, `<path class="axis" pathLength="1" d="M120 140 V700" stroke-width="8"/>`)}</div>
        ${params.events.map((e, i) => `
          <div class="event" style="${abs(`left:80px;right:60px;top:${top(i)}px`)}">
            <div style="${abs("left:12px;top:14px;width:56px;height:56px;border-radius:50%;background:#fff;border:10px solid #3B6D11;box-sizing:border-box")}"></div>
            <div style="margin-left:120px">
              <div style="font-size:44px;color:#3B6D11">${esc(e.date)}</div>
              <div style="font-size:50px;margin-top:12px">${esc(e.title)}</div>
              <div style="font-size:34px;font-weight:500;margin-top:16px;line-height:1.5;word-break:auto-phrase">${esc(e.detail)}</div>
            </div>
          </div>`).join("")}
        ${params.footer ? `<div class="footer" style="${abs("left:60px;right:60px;top:790px;padding:28px 0;border-radius:999px;background:#EAF3DE;text-align:center;font-size:42px")}">${esc(params.footer.text)}</div>` : ""}
      </div>`;
    const events = root.querySelectorAll(".event");
    return {
      update(t) {
        appear(root.querySelector(".card"), ease(progress(t, 0, 0.5)));
        drawLine(root.querySelector(".axis"), ease(progress(t, 0.2, 1.4)));
        params.events.forEach((e, i) => {
          const next = params.events[i + 1];
          appear(events[i], ease(progress(t, e.at + 0.3, e.at + 0.9)), 24, next ? ease(progress(t, next.at, next.at + 0.6)) : 0);
        });
        if (params.footer) appear(root.querySelector(".footer"), ease(progress(t, params.footer.at, params.footer.at + 0.6)), 16);
      },
    };
  },

  // 7. まとめ：チェック項目に印をつけていく
  summary(params, root) {
    root.innerHTML = `
      <div ${CARD}>
        <div class="heading" style="${abs("left:0;right:0;top:120px;text-align:center")}">
          ${svg(220, 160, `<path d="M70 200 L220 80 L370 200 M110 170 V360 H330 V170 M190 360 V270 Q190 250 210 250 H230 Q250 250 250 270 V360"/>
            <path d="M220 50 C200 20 160 30 165 62 C170 90 220 118 220 118 C220 118 270 90 275 62 C280 30 240 20 220 50 Z" fill="#EAF3DE" stroke-width="8"/>`, "40 20 360 360")}
          <div style="font-size:52px;margin-top:20px">まとめ</div>
        </div>
        ${params.items.map((it, i) => `
          <div class="item" style="${abs(`left:110px;right:60px;top:${470 + i * 200}px;display:flex;align-items:center;gap:44px`)}">
            <div style="position:relative;width:120px;height:120px;border:8px solid #3B6D11;border-radius:28px;flex:none">
              <div style="${abs("left:-4px;top:-14px")}">${svg(120, 120, `<path class="tick" pathLength="1" d="M26 62 L52 88 L100 30" stroke-width="14"/>`)}</div>
            </div>
            <div style="font-size:64px">${esc(it.text)}</div>
          </div>`).join("")}
      </div>`;
    const items = root.querySelectorAll(".item");
    const ticks = root.querySelectorAll(".tick");
    return {
      update(t) {
        appear(root.querySelector(".card"), ease(progress(t, 0, 0.5)));
        appear(root.querySelector(".heading"), ease(progress(t, 0.1, 0.7)));
        params.items.forEach((it, i) => {
          appear(items[i], ease(progress(t, it.at, it.at + 0.6)));
          drawLine(ticks[i], ease(progress(t, it.at + 0.5, it.at + 1.1)));
        });
      },
    };
  },

  // 未実装の図：枠と種類名だけ表示する
  placeholder(params, root) {
    root.innerHTML = `<div class="card placeholder" style="top:300px;height:960px">図：${esc(params.type)}（未実装）</div>`;
    return { update() {} };
  },
};
