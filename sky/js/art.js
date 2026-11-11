// 하늘 로봇 — 그림 공장. 배경·기체·적 그림을 처음 한 번만 자세히 그려 두고(캔버스에 저장) 게임 중에는 붙이기만 한다.
// 그래서 휴대폰에서도 느려지지 않으면서 세밀하게 보인다.
window.Art = (() => {
'use strict';
const W = 540, TAU = Math.PI * 2, TH = 1600;   // 배경 한 장의 높이(위아래가 이어지게 그린다)
function rng(seed) {   // 늘 같은 배경이 나오게 하는 정해진 난수
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());

// ---------- 빛 방울(탄·불꽃·불빛에 쓴다) ----------
const toRgba = c => (c[0] === '#' ? `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},1)` : c);
function glow(color, r, core = '#fff') {
  color = toRgba(color);
  return once(`g${color}${r}${core}`, () => mk(r * 2, r * 2, g => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, core); gr.addColorStop(0.22, color); gr.addColorStop(0.55, color.replace(/[\d.]+\)$/, '0.25)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  }));
}
const fire = () => once('fire', () => mk(128, 128, g => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.2, 'rgba(255,220,120,.95)'); gr.addColorStop(0.45, 'rgba(255,120,40,.7)'); gr.addColorStop(0.75, 'rgba(160,40,20,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
}));
const smoke = () => once('smoke', () => mk(96, 96, g => {
  const gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  gr.addColorStop(0, 'rgba(70,70,80,.55)'); gr.addColorStop(0.6, 'rgba(50,50,60,.25)'); gr.addColorStop(1, 'rgba(40,40,50,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
}));

// ---------- 부드러운 덩어리 모양(섬·구름·바위) ----------
function blobPath(g, x, y, r, R, n = 20, rough = 0.32, sx = 1, sy = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, k = r * (1 - rough / 2 + rough * R()); pts.push([x + Math.cos(a) * k * sx, y + Math.sin(a) * k * sy]); }
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    i ? g.quadraticCurveTo(p[0], p[1], mx, my) : g.moveTo(mx, my);
  }
  g.closePath();
  return pts;
}
// 위아래로 이어지게: 같은 것을 한 장 위·아래에도 그린다
const wrap = (fn, y, span) => { fn(0); if (y < span) fn(TH); if (y > TH - span) fn(-TH); };

// ---------- 배경 먼 층(땅·바다·우주) ----------
function far(theme) {
  return once('far' + theme, () => mk(W, TH, (g, w, h) => {
    const R = rng(theme * 977 + 13);
    if (theme === 0) {   // 높은 하늘에서 내려다본 바다와 섬
      g.fillStyle = '#12639f'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { const x = R() * w, y = R() * h, r = 60 + R() * 160; wrap(dy => { g.fillStyle = R() < 0.5 ? 'rgba(10,40,90,.08)' : 'rgba(60,160,220,.08)'; g.beginPath(); g.arc(x, y + dy, r, 0, TAU); g.fill(); }, y, r); }
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1.5;
      for (let i = 0; i < 1100; i++) { const x = R() * w, y = R() * h, l = 4 + R() * 10; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2, x + l, y); g.stroke(); }
      for (let k = 0; k < 5; k++) {
        const x = 60 + R() * (w - 120), y = R() * h, r = 60 + R() * 90, seed = R() * 1e6;
        wrap(dy => {
          const r2 = rng(seed);
          g.fillStyle = 'rgba(70,200,225,.28)'; blobPath(g, x, y + dy, r * 1.55, r2, 22, 0.35); g.fill();
          g.fillStyle = 'rgba(120,225,235,.45)'; blobPath(g, x, y + dy, r * 1.25, r2, 22, 0.35); g.fill();
          g.fillStyle = '#ead89c'; blobPath(g, x, y + dy, r * 1.07, r2, 22, 0.35); g.fill();
          const land = g.createLinearGradient(x - r, y + dy - r, x + r, y + dy + r);
          land.addColorStop(0, '#8fcf62'); land.addColorStop(0.6, '#4d963f'); land.addColorStop(1, '#2f6a33');
          g.fillStyle = land; blobPath(g, x, y + dy, r, r2, 22, 0.35); g.fill();
          for (let i = 0; i < r * 1.6; i++) {   // 숲
            const a = r2() * TAU, d = r2() * r * 0.8, fx = x + Math.cos(a) * d, fy = y + dy + Math.sin(a) * d, fr = 3 + r2() * 6;
            g.fillStyle = 'rgba(25,70,35,.75)'; g.beginPath(); g.arc(fx + 1.5, fy + 2, fr, 0, TAU); g.fill();
            g.fillStyle = r2() < 0.5 ? '#3f8a3e' : '#57a346'; g.beginPath(); g.arc(fx, fy, fr, 0, TAU); g.fill();
          }
          for (let i = 0; i < 3; i++) {   // 바위산
            const mx = x + (r2() - 0.5) * r, my = y + dy + (r2() - 0.5) * r * 0.8, ms = 14 + r2() * 18;
            g.fillStyle = '#7b6a55'; g.beginPath(); g.moveTo(mx, my - ms); g.lineTo(mx + ms, my + ms * 0.6); g.lineTo(mx - ms, my + ms * 0.6); g.fill();
            g.fillStyle = '#5a4b3c'; g.beginPath(); g.moveTo(mx, my - ms); g.lineTo(mx + ms, my + ms * 0.6); g.lineTo(mx + ms * 0.15, my + ms * 0.6); g.fill();
            g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(mx, my - ms); g.lineTo(mx + ms * 0.3, my - ms * 0.5); g.lineTo(mx - ms * 0.3, my - ms * 0.5); g.fill();
          }
          const tx = x + (r2() - 0.5) * r * 0.5, ty = y + dy + r * 0.35;   // 작은 마을과 길
          g.strokeStyle = 'rgba(230,215,170,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + r * 0.4, ty - r * 0.3, x + r * 0.9, y + dy - r * 0.1); g.stroke();
          for (let i = 0; i < 12; i++) { g.fillStyle = ['#f4f1e8', '#e07a5f', '#f2cc8f', '#d8e2dc'][i % 4]; g.fillRect(tx + (r2() - 0.5) * 34, ty + (r2() - 0.5) * 22, 4, 3); }
        }, y, r * 1.6);
      }
    } else if (theme === 1) {   // 노을빛 사막 협곡
      const base = g.createLinearGradient(0, 0, w, 0); base.addColorStop(0, '#b8642f'); base.addColorStop(0.5, '#cf7a3f'); base.addColorStop(1, '#a9552a');
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {   // 모래 물결
        const y = R() * h, ph = R() * 6, a = R() < 0.5 ? 'rgba(255,210,150,.10)' : 'rgba(90,40,15,.10)';
        g.strokeStyle = a; g.lineWidth = 2 + R() * 3; g.beginPath();
        for (let x = -10; x <= w + 10; x += 15) g.lineTo(x, y + Math.sin(x * 0.02 + ph) * 8);
        g.stroke();
      }
      for (let k = 0; k < 4; k++) {   // 협곡 균열
        let x = R() * w, y = R() * h; const pts = [[x, y]];
        for (let i = 0; i < 40; i++) { x += (R() - 0.5) * 50; y += 18 + R() * 20; pts.push([x, y]); }
        wrap(dy => {
          for (const [lw, col] of [[16, 'rgba(60,25,10,.55)'], [8, 'rgba(35,12,5,.85)'], [2, 'rgba(255,170,110,.35)']]) {
            g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath();
            pts.forEach(([px, py], i) => (i ? g.lineTo(px, (py % TH) + dy) : g.moveTo(px, (py % TH) + dy)));
            g.stroke();
          }
        }, pts[0][1], 800);
      }
      for (let k = 0; k < 9; k++) {   // 평평한 바위산(메사)
        const x = R() * w, y = R() * h, r = 30 + R() * 70, seed = R() * 1e6;
        wrap(dy => {
          const r2 = rng(seed);
          g.fillStyle = 'rgba(50,18,8,.45)'; blobPath(g, x + 14, y + dy + 20, r, r2, 16, 0.4); g.fill();
          const r3 = rng(seed);
          g.fillStyle = '#8a3f1f'; blobPath(g, x + 5, y + dy + 7, r, r3, 16, 0.4); g.fill();
          const r4 = rng(seed), top = g.createLinearGradient(x - r, y + dy - r, x + r, y + dy + r);
          top.addColorStop(0, '#f0a868'); top.addColorStop(1, '#c86a35');
          g.fillStyle = top; blobPath(g, x, y + dy, r, r4, 16, 0.4); g.fill();
          g.strokeStyle = 'rgba(255,220,170,.5)'; g.lineWidth = 2; g.stroke();
          g.strokeStyle = 'rgba(120,50,20,.35)'; g.lineWidth = 1;
          for (let i = 1; i < 4; i++) { const r5 = rng(seed); blobPath(g, x, y + dy, r * (1 - i * 0.2), r5, 16, 0.4); g.stroke(); }
        }, y, r * 1.5);
      }
      for (let i = 0; i < 500; i++) { g.fillStyle = R() < 0.5 ? 'rgba(70,30,10,.5)' : 'rgba(255,220,180,.35)'; g.fillRect(R() * w, R() * h, 2, 2); }
    } else if (theme === 2) {   // 밤바다와 불 켜진 섬 도시
      g.fillStyle = '#061630'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 50; i++) { const x = R() * w, y = R() * h, r = 80 + R() * 160; wrap(dy => { g.fillStyle = 'rgba(30,80,140,.06)'; g.beginPath(); g.arc(x, y + dy, r, 0, TAU); g.fill(); }, y, r); }
      g.strokeStyle = 'rgba(150,200,255,.06)'; g.lineWidth = 1.2;
      for (let i = 0; i < 900; i++) { const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + R() * 8, y); g.stroke(); }
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const x = 60 + R() * (w - 120), y = R() * h, r = 55 + R() * 80, seed = R() * 1e6;
        wrap(dy => {
          const r2 = rng(seed);
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = 'rgba(40,90,130,.35)'; blobPath(g, x, y + dy, r * 1.25, r2, 20, 0.35); g.fill();
          const r3 = rng(seed);
          g.fillStyle = '#132538'; blobPath(g, x, y + dy, r, r3, 20, 0.35); g.fill();
          g.strokeStyle = 'rgba(120,170,210,.35)'; g.lineWidth = 2; g.stroke();
          g.globalCompositeOperation = 'lighter';
          for (let i = 0; i < r * 2.2; i++) {   // 도시 불빛
            const a = r2() * TAU, d = Math.sqrt(r2()) * r * 0.8, lx = x + Math.cos(a) * d, ly = y + dy + Math.sin(a) * d;
            const c = r2() < 0.7 ? 'rgba(255,200,110,1)' : 'rgba(150,220,255,1)';
            g.drawImage(glow(c, 6), lx - 6, ly - 6, 12, 12);
          }
          g.strokeStyle = 'rgba(255,190,100,.35)'; g.lineWidth = 1.5;
          for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - r * 0.7, y + dy + (r2() - 0.5) * r); g.lineTo(x + r * 0.7, y + dy + (r2() - 0.5) * r); g.stroke(); }
        }, y, r * 1.3);
      }
      for (let k = 0; k < 7; k++) {   // 배와 물결 자국
        const x = R() * w, y = R() * h;
        wrap(dy => {
          g.globalCompositeOperation = 'source-over';
          g.strokeStyle = 'rgba(200,230,255,.18)'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(x, y + dy); g.lineTo(x - 14, y + dy + 60); g.moveTo(x, y + dy); g.lineTo(x + 14, y + dy + 60); g.stroke();
          g.fillStyle = '#dfe8f2'; g.fillRect(x - 3, y + dy - 8, 6, 14);
          g.globalCompositeOperation = 'lighter';
          g.drawImage(glow('rgba(255,90,90,1)', 5), x - 5, y + dy - 12, 10, 10);
        }, y, 80);
      }
      g.globalCompositeOperation = 'source-over';
    } else {   // 우주: 성운과 별
      g.fillStyle = '#03040d'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 16; k++) {
        const x = R() * w, y = R() * h, r = 120 + R() * 260, c = ['rgba(120,60,200,', 'rgba(40,120,200,', 'rgba(200,60,140,', 'rgba(40,180,170,'][k % 4];
        wrap(dy => { const gr = g.createRadialGradient(x, y + dy, 0, x, y + dy, r); gr.addColorStop(0, c + '.22)'); gr.addColorStop(0.5, c + '.08)'); gr.addColorStop(1, c + '0)'); g.fillStyle = gr; g.fillRect(x - r, y + dy - r, r * 2, r * 2); }, y, r);
      }
      for (let i = 0; i < 900; i++) { const s = R(); g.fillStyle = `rgba(255,255,255,${0.3 + s * 0.6})`; g.fillRect(R() * w, R() * h, s < 0.9 ? 1 : 2, s < 0.9 ? 1 : 2); }
      for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h; wrap(dy => g.drawImage(glow(R() < 0.5 ? 'rgba(160,200,255,1)' : 'rgba(255,220,180,1)', 10), x - 10, y + dy - 10, 20, 20), y, 20); }
      g.globalCompositeOperation = 'source-over';
      const px = 120 + R() * 300, py = R() * h, pr = 70 + R() * 30;   // 행성
      wrap(dy => {
        const pg = g.createRadialGradient(px - pr * 0.4, py + dy - pr * 0.4, pr * 0.1, px, py + dy, pr);
        pg.addColorStop(0, '#d9b3ff'); pg.addColorStop(0.5, '#7a4bc4'); pg.addColorStop(1, '#1d0f3a');
        g.fillStyle = pg; g.beginPath(); g.arc(px, py + dy, pr, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(230,210,255,.45)'; g.lineWidth = 4; g.beginPath(); g.ellipse(px, py + dy, pr * 1.7, pr * 0.35, -0.35, 0, TAU); g.stroke();
      }, py, pr * 2);
    }
  }));
}

// ---------- 배경 가까운 층(구름·먼지·소행성): 빨리 흘러가서 깊이가 느껴진다 ----------
function near(theme) {
  return once('near' + theme, () => mk(W, TH, (g, w, h) => {
    const R = rng(theme * 331 + 7);
    if (theme === 3) {   // 소행성
      for (let k = 0; k < 9; k++) {
        const x = R() * w, y = R() * h, r = 10 + R() * 26, seed = R() * 1e6;
        wrap(dy => {
          const r2 = rng(seed), rg = g.createLinearGradient(x - r, y + dy - r, x + r, y + dy + r);
          rg.addColorStop(0, '#8d8a93'); rg.addColorStop(1, '#2a272f');
          g.fillStyle = rg; blobPath(g, x, y + dy, r, r2, 12, 0.5); g.fill();
          g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.stroke();
          for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + (r2() - 0.5) * r, y + dy + (r2() - 0.5) * r, r * 0.15 + r2() * r * 0.15, 0, TAU); g.fill(); }
        }, y, r);
      }
      for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(180,170,220,.25)'; g.fillRect(R() * w, R() * h, 1, 3); }
      return;
    }
    const cfg = [
      { n: 7, col: [255, 255, 255], a: 0.85, shade: 'rgba(15,40,80,.18)', sy: 0.7 },
      { n: 8, col: [255, 196, 170], a: 0.6, shade: 'rgba(60,20,10,.18)', sy: 0.45 },
      { n: 6, col: [120, 150, 200], a: 0.18, shade: null, sy: 0.6 },
    ][theme];
    for (let k = 0; k < cfg.n; k++) {
      const x = R() * w, y = R() * h, r = 50 + R() * 70, seed = R() * 1e6;
      wrap(dy => {
        const puffs = (ox, oy, col) => {
          const r2 = rng(seed);
          for (let i = 0; i < 9; i++) {
            const px = x + ox + (r2() - 0.5) * r * 1.8, py = y + dy + oy + (r2() - 0.5) * r * cfg.sy, pr = r * (0.35 + r2() * 0.35);
            const gr = g.createRadialGradient(px - pr * 0.2, py - pr * 0.3, pr * 0.1, px, py, pr);
            if (col) { gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); }
            else { gr.addColorStop(0, `rgba(${cfg.col},${cfg.a})`); gr.addColorStop(0.7, `rgba(${cfg.col},${cfg.a * 0.6})`); gr.addColorStop(1, `rgba(${cfg.col},0)`); }
            g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
          }
        };
        if (cfg.shade) puffs(70, 110, cfg.shade);   // 구름 그림자(땅에 비친)
        puffs(0, 0, null);
      }, y, r * 2);
    }
  }));
}

// ---------- 기체(위에서 본 모습) ----------
const SHIP = 220, SS = 3;   // 그림 크기와 확대 배율(3배로 그려 두고 줄여서 쓴다)
function metal(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
function ship(id, color) {
  return once('ship' + id, () => mk(SHIP, SHIP, g => {
    g.translate(SHIP / 2, SHIP / 2); g.scale(SS, SS);
    g.lineJoin = 'round'; g.lineWidth = 1.4; g.strokeStyle = '#08111f';
    const line = (pts, w = 0.8, c = 'rgba(5,15,30,.55)') => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.strokeStyle = '#08111f'; g.lineWidth = 1.4; };
    if (id === 'falcon') {
      poly(g, [[-9, -4], [-31, 12], [-32, 19], [-12, 15], [-9, 20]]); g.fillStyle = metal(g, -32, 0, -8, 20, [[0, '#1d4f80'], [1, '#0d2440']]); g.fill(); g.stroke();
      poly(g, [[9, -4], [31, 12], [32, 19], [12, 15], [9, 20]]); g.fillStyle = metal(g, 32, 0, 8, 20, [[0, '#123a62'], [1, '#081a30']]); g.fill(); g.stroke();
      poly(g, [[0, -34], [8, -14], [10, 4], [8, 25], [-8, 25], [-10, 4], [-8, -14]]);
      g.fillStyle = metal(g, -10, 0, 10, 0, [[0, '#f2fbff'], [0.35, color], [0.7, '#2367a3'], [1, '#0c2744']]); g.fill(); g.stroke();
      poly(g, [[-30, 12], [-12, 8], [-10, 11], [-31, 16]]); g.fillStyle = 'rgba(230,248,255,.8)'; g.fill();
      poly(g, [[30, 12], [12, 8], [10, 11], [31, 16]]); g.fillStyle = 'rgba(160,220,255,.55)'; g.fill();
      line([[0, -30], [0, 22]], 0.6); line([[-8, 0], [8, 0]]); line([[-7, 12], [7, 12]]);
      for (const sx of [-1, 1]) { g.fillStyle = '#0a1626'; g.fillRect(sx * 9 - (sx > 0 ? 0 : 3), -2, 3, 9); }
      const cp = g.createLinearGradient(-4, -20, 4, -2); cp.addColorStop(0, '#e9fdff'); cp.addColorStop(0.5, '#5fd3ff'); cp.addColorStop(1, '#0d4a78');
      g.fillStyle = cp; g.beginPath(); g.ellipse(0, -11, 4.2, 9, 0, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(-1.2, -13, 1.5, 5, 0, -2.4, -0.6); g.stroke();
    } else if (id === 'turtle') {
      for (const sx of [-1, 1]) {
        g.fillStyle = metal(g, sx * 18, 0, sx * 36, 0, [[0, '#3f7a45'], [1, '#183a20']]);
        g.beginPath(); g.ellipse(sx * 27, 8, 9, 17, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#0d1a10'; g.fillRect(sx * 27 - 4, -9, 8, 5);
      }
      g.beginPath(); g.ellipse(0, 2, 25, 27, 0, 0, TAU);
      g.fillStyle = metal(g, -25, -25, 25, 25, [[0, '#e3ffd0'], [0.3, color], [0.75, '#2e6b36'], [1, '#132d17']]); g.fill(); g.stroke();
      g.save(); g.beginPath(); g.ellipse(0, 2, 24, 26, 0, 0, TAU); g.clip();
      g.strokeStyle = 'rgba(10,40,15,.55)'; g.lineWidth = 1;
      for (let row = -3; row <= 3; row++) for (let col = -3; col <= 3; col++) {
        const hx = col * 12 + (row % 2 ? 6 : 0), hy = row * 10 + 2;
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; g.lineTo(hx + Math.cos(a) * 6.5, hy + Math.sin(a) * 6.5); } g.closePath(); g.stroke();
      }
      g.restore();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(-8, -8, 10, 6, -0.6, 0, TAU); g.fill();
      g.fillStyle = metal(g, 0, -28, 0, -16, [[0, '#f1ffe6'], [1, '#4c8f52']]); g.beginPath(); g.ellipse(0, -21, 8, 6, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#0f2a3a'; g.fillRect(-6, -23, 12, 3);
    } else if (id === 'hornet') {
      g.save(); g.globalAlpha = 0.55;
      for (const sx of [-1, 1]) {
        for (const [oy, s] of [[-4, 1], [6, 0.75]]) {
          g.fillStyle = metal(g, 0, oy - 8, sx * 34, oy + 8, [[0, 'rgba(240,250,255,.9)'], [1, 'rgba(160,200,230,.5)']]);
          g.beginPath(); g.ellipse(sx * 18 * s + sx * 2, oy, 17 * s, 7 * s, sx * -0.3, 0, TAU); g.fill(); g.stroke();
          g.strokeStyle = 'rgba(40,60,90,.6)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(sx * 3, oy); g.lineTo(sx * 32 * s, oy - 3 * s); g.moveTo(sx * 10, oy + 2); g.lineTo(sx * 26 * s, oy + 5 * s); g.stroke(); g.strokeStyle = '#08111f'; g.lineWidth = 1.4;
        }
      }
      g.restore();
      g.beginPath(); g.ellipse(0, 9, 8.5, 15, 0, 0, TAU); g.fillStyle = metal(g, -9, 0, 9, 0, [[0, '#fff2b0'], [0.4, color], [1, '#8a5a00']]); g.fill(); g.stroke();
      g.save(); g.beginPath(); g.ellipse(0, 9, 8.5, 15, 0, 0, TAU); g.clip(); g.fillStyle = '#16120a'; for (const yy of [2, 9, 16]) g.fillRect(-10, yy, 20, 3.5); g.restore();
      g.beginPath(); g.ellipse(0, -9, 6.5, 8, 0, 0, TAU); g.fillStyle = metal(g, -6, 0, 6, 0, [[0, '#fff6c8'], [1, '#c78a12']]); g.fill(); g.stroke();
      for (const sx of [-1, 1]) { g.fillStyle = metal(g, sx * 2, -20, sx * 6, -12, [[0, '#ff9a9a'], [1, '#7a0f1a']]); g.beginPath(); g.ellipse(sx * 3.5, -16, 3.4, 4.6, 0, 0, TAU); g.fill(); g.stroke(); }
      g.fillStyle = '#2a1d05'; poly(g, [[-1.5, 23], [1.5, 23], [0, 29]]); g.fill();
    } else {
      for (const sx of [-1, 1]) {
        for (let f = 0; f < 4; f++) {
          const fg = g.createLinearGradient(sx * 6, -10, sx * 40, 20); fg.addColorStop(0, '#fff3a0'); fg.addColorStop(0.45, ['#ffb347', '#ff8a3c', '#ff6b3c', '#e8453c'][f]); fg.addColorStop(1, 'rgba(200,40,40,.15)');
          g.fillStyle = fg; g.beginPath(); g.moveTo(sx * 6, -6 + f * 4);
          g.quadraticCurveTo(sx * (40 - f * 4), -26 + f * 9, sx * (38 - f * 5), 14 + f * 4); g.quadraticCurveTo(sx * 22, 6 + f * 3, sx * 6, 12 + f * 2); g.closePath(); g.fill();
        }
      }
      poly(g, [[0, -32], [8, -8], [7, 24], [-7, 24], [-8, -8]]);
      g.fillStyle = metal(g, -8, 0, 8, 0, [[0, '#fff1c4'], [0.4, '#e3a93a'], [1, '#6e3b10']]); g.fill(); g.stroke();
      g.fillStyle = metal(g, -3, -20, 3, -4, [[0, '#ffd6d6'], [1, '#a5121f']]); g.beginPath(); g.ellipse(0, -12, 3.6, 7.5, 0, 0, TAU); g.fill(); g.stroke();
      line([[0, 0], [0, 22]], 0.6, 'rgba(90,40,10,.6)');
    }
  }));
}
function shipShadow(id, color) {
  return once('shadow' + id, () => mk(SHIP, SHIP, g => { g.drawImage(ship(id, color), 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, SHIP, SHIP); }));
}

// ---------- 적 ----------
const EN = 120, ES = 2;
function enemyBase(type) {
  return once('en' + type, () => mk(EN, EN, g => {
    g.translate(EN / 2, EN / 2); g.scale(ES, ES);
    g.lineJoin = 'round'; g.lineWidth = 1.3; g.strokeStyle = '#120a14';
    const eye = (x, y, r, c) => { g.drawImage(glow(c, r * 3), x - r * 3, y - r * 3, r * 6, r * 6); };
    if (type === 'scout') {
      poly(g, [[0, 18], [6, 2], [16, -8], [12, -12], [0, -6], [-12, -12], [-16, -8], [-6, 2]]);
      g.fillStyle = metal(g, -16, 0, 16, 0, [[0, '#ffb3b3'], [0.4, '#e04a5a'], [1, '#5a0f1c']]); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(40,0,10,.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 16); g.lineTo(0, -5); g.stroke();
      eye(0, 3, 2.2, 'rgba(255,230,120,1)');
    } else if (type === 'weaver') {
      g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fillStyle = metal(g, -15, -15, 15, 15, [[0, '#f0dcff'], [0.4, '#9a5ae0'], [1, '#2e1060']]); g.fill(); g.stroke();
      g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fillStyle = '#25103f'; g.fill(); g.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; eye(Math.cos(a) * 12, Math.sin(a) * 12, 1.3, 'rgba(220,170,255,1)'); }
      eye(0, 0, 3, 'rgba(255,120,240,1)');
    } else if (type === 'diver') {
      poly(g, [[0, 22], [9, 6], [18, -2], [12, -16], [5, -10], [-5, -10], [-12, -16], [-18, -2], [-9, 6]]);
      g.fillStyle = metal(g, -18, 0, 18, 0, [[0, '#ffe0b0'], [0.4, '#f08a2a'], [1, '#6a2a06']]); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(60,20,0,.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-9, 6); g.lineTo(0, 0); g.lineTo(9, 6); g.moveTo(0, 0); g.lineTo(0, 18); g.stroke();
      eye(0, -2, 2.6, 'rgba(255,255,200,1)');
    } else if (type === 'turret') {
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.lineTo(Math.cos(a) * 23, Math.sin(a) * 23); } g.closePath();
      g.fillStyle = metal(g, -23, -23, 23, 23, [[0, '#e8eef5'], [0.45, '#8693a2'], [1, '#2a323c']]); g.fill(); g.stroke();
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); } g.closePath(); g.strokeStyle = 'rgba(20,25,30,.5)'; g.stroke();
      g.fillStyle = '#c9d2dc'; for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.5; g.beginPath(); g.arc(Math.cos(a) * 19, Math.sin(a) * 19, 1.4, 0, TAU); g.fill(); }
    } else if (type === 'splitter') {
      poly(g, [[0, 22], [20, 0], [0, -22], [-20, 0]]);
      g.fillStyle = metal(g, -20, -20, 20, 20, [[0, '#d8ffdc'], [0.45, '#3fbf6a'], [1, '#0d4a25']]); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.25)'; poly(g, [[0, -22], [-20, 0], [0, 0]]); g.fill();
      g.fillStyle = 'rgba(0,40,15,.3)'; poly(g, [[0, 22], [20, 0], [0, 0]]); g.fill();
      g.strokeStyle = 'rgba(0,40,15,.6)'; g.beginPath(); g.moveTo(0, -22); g.lineTo(-4, -6); g.lineTo(5, 4); g.lineTo(0, 22); g.stroke();
      eye(0, 0, 2.4, 'rgba(180,255,190,1)');
    } else if (type === 'netter') {
      g.strokeStyle = 'rgba(120,255,230,.55)'; g.lineWidth = 0.8;
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); g.stroke(); }
      for (const rr of [10, 17, 24]) { g.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
      g.strokeStyle = '#120a14'; g.lineWidth = 1.3;
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 13, 0, 7, 12, sx * 0.3, 0, TAU); g.fillStyle = metal(g, sx * 6, -12, sx * 20, 12, [[0, '#7ff0dc'], [1, '#0d4a52']]); g.fill(); g.stroke(); }
      g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fillStyle = metal(g, -11, -11, 11, 11, [[0, '#e0fff8'], [0.5, '#2fb3a8'], [1, '#0b2f3a']]); g.fill(); g.stroke();
      eye(0, 2, 3, 'rgba(120,255,230,1)');
    } else if (type === 'tank') {
      for (const sx of [-1, 1]) { g.fillStyle = metal(g, sx * 22, 0, sx * 40, 0, [[0, '#59616e'], [1, '#1b2028']]); g.beginPath(); g.ellipse(sx * 30, 4, 10, 22, 0, 0, TAU); g.fill(); g.stroke(); eye(sx * 30, 22, 2.5, 'rgba(255,140,80,1)'); }
      g.beginPath(); g.roundRect ? g.roundRect(-24, -26, 48, 52, 9) : g.rect(-24, -26, 48, 52);
      g.fillStyle = metal(g, -24, -26, 24, 26, [[0, '#c4ccd8'], [0.45, '#6b7685'], [1, '#232a33']]); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(15,20,25,.55)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(-24, -8); g.lineTo(24, -8); g.moveTo(-24, 10); g.lineTo(24, 10); g.moveTo(-8, -26); g.lineTo(-8, -8); g.moveTo(8, 10); g.lineTo(8, 26); g.stroke();
      g.fillStyle = '#d6dde6'; for (const [px, py] of [[-19, -21], [19, -21], [-19, 21], [19, 21], [0, -17], [0, 17]]) { g.beginPath(); g.arc(px, py, 1.6, 0, TAU); g.fill(); }
      eye(0, 1, 4, 'rgba(255,120,80,1)');
    }
  }));
}
function enemy(type, flash) {
  if (!flash) return enemyBase(type);
  return once('enf' + type, () => mk(EN, EN, g => { g.drawImage(enemyBase(type), 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, 0, EN, EN); }));
}
function enemyShadow(type) {
  return once('ens' + type, () => mk(EN, EN, g => { g.drawImage(enemyBase(type), 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, EN, EN); }));
}

return { TH, glow, fire, smoke, far, near, ship, shipShadow, SHIP, SS, enemy, enemyShadow, EN, ES, metal };
})();
