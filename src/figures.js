// 図の種類ごとの描画。scenes.json の figure.type と対応する
// 各関数は (params, 図のエリアの要素) を受け取り、{ update(場面内の秒数) } を返す

const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);   // 減速して止まる
const progress = (t, from, to) => Math.min(1, Math.max(0, (t - from) / (to - from)));

const svg = (w, h, inner) =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke="#3B6D11" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// pathLength="1" をつけた線を、p（0〜1）の割合まで描く
const drawLine = (el, p) => {
  el.style.strokeDasharray = 1;
  el.style.strokeDashoffset = 1 - p;
};

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
        <div class="title-text" style="font-size:84px;letter-spacing:0.02em">${params.text}</div>
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

  // 未実装の図：枠と種類名だけ表示する
  placeholder(params, root) {
    root.innerHTML = `<div class="card placeholder" style="top:300px;height:960px">図：${params.type}（未実装）</div>`;
    return { update() {} };
  },
};
