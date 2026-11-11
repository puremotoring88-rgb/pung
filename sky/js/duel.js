// 하늘 로봇 — 리듬 결투. 비행을 멈추고 4줄 리듬 게임에만 집중한다.
// 떨어지는 음표가 곧 음악의 가락이라, 소리를 들으며 박자에 맞춰 누르면 된다.
window.Duel = (() => {
'use strict';
const W = 540, H = 960, TAU = Math.PI * 2, LANES = 4;
const WIN = { p: 0.05, g: 0.1, o: 0.15 };        // PERFECT, GREAT, GOOD로 인정하는 어긋남(초)
const APPROACH = 1.35;                           // 음표가 위에서 판정선까지 오는 시간(초)
const COLORS = ['#ff6ad5', '#4cc9ff', '#ffd166', '#6ee37a'];
const KEYS = ['D', 'F', 'J', 'K'];
const NAMES = ['베이스 드롭', '비트 박스', '신스 웨이브', '드럼 머신', '하이햇 헌터', '서브 우퍼', '글리치 코어', '마스터 DJ'];
const TOP = 210, JUDGE_Y = H - 200, W_TOP = 150, W_BOT = W - 30;
let A, Art, d = null;

// 악보 만들기: 단계가 오를수록 음표가 빽빽해지고 엇박·동시 누르기가 늘어난다
function makeChart(level, beats) {
  const notes = [];
  let lane = (Math.random() * 4) | 0;
  const add = b => {
    const steps = [-1, 1, 1, -1, 2, -2, 0];
    lane = (lane + steps[(Math.random() * steps.length) | 0] + 4) % 4;
    if (notes.some(n => n.b === b && n.lane === lane)) lane = (lane + 1) % 4;
    notes.push({ b, lane });
    if (level >= 3 && Math.random() < 0.05 * level) notes.push({ b, lane: (lane + 2) % 4 });   // 두 줄 동시
  };
  for (let b = 0; b < beats; b++) {
    if (level <= 2 && b % 8 === 7) continue;   // 쉬어 가는 박
    if (Math.random() < Math.min(0.95, 0.6 + 0.06 * level)) add(b);
    if (level >= 2 && Math.random() < Math.min(0.55, 0.1 * level)) add(b + 0.5);
  }
  return notes.sort((a, b) => a.b - b.b);
}

function start(opt) {
  A = window.AudioKit; Art = window.Art;
  const level = Math.max(1, Math.min(8, opt.level | 0)), beats = 32, countIn = 4;
  const bpm = Math.min(164, 116 + level * 6), beat = 60 / bpm;
  const chart = makeChart(level, beats);
  const t0 = A.duel(chart, bpm, countIn);   // 0번째 박이 울리는 시각
  d = {
    level, bpm, beat, t0, countIn, name: NAMES[(level - 1) % NAMES.length], title: opt.title || 'RHYTHM DUEL',
    notes: chart.map(n => ({ t: t0 + n.b * beat, lane: n.lane, j: null, half: n.b % 1 !== 0 })),
    end: t0 + beats * beat + 0.6, cnt: { p: 0, g: 0, o: 0, m: 0 }, combo: 0, maxCombo: 0,
    judge: null, judgeT: 0, judgeLane: 0, flash: [0, 0, 0, 0], hits: [], done: false, resT: 0, onEnd: opt.onEnd, res: null,
  };
}

const now = () => A.clock().t;
function judgeOf(dt) { return dt <= WIN.p ? 'p' : dt <= WIN.g ? 'g' : dt <= WIN.o ? 'o' : null; }
function press(lane) {
  if (!d || d.done) return;
  d.flash[lane] = 1;
  const t = now();
  let best = null, bd = 9;
  for (const n of d.notes) { if (n.j || n.lane !== lane) continue; const dt = Math.abs(t - n.t); if (dt < bd) { bd = dt; best = n; } }
  const j = best ? judgeOf(bd) : null;
  if (!j) return;   // 박자가 아닐 때 누르면 아무 일 없음
  best.j = j; d.cnt[j]++; d.combo++; d.maxCombo = Math.max(d.maxCombo, d.combo);
  d.judge = { p: 'PERFECT', g: 'GREAT', o: 'GOOD' }[j]; d.judgeT = 0.45; d.judgeLane = lane;
  d.hits.push({ lane, t: 0, j });
  A.sfx(j === 'o' ? 'good' : 'perfect');
  if (navigator.vibrate && j === 'p') { try { navigator.vibrate(8); } catch (e) { /* 진동 없음 */ } }
}
function pressX(x) { press(Math.max(0, Math.min(3, Math.floor(x / (W / LANES))))); }

function result() {
  const c = d.cnt, total = d.notes.length || 1;
  const acc = (c.p + 0.7 * c.g + 0.4 * c.o) / total;
  const rank = acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D';
  return { rank, acc, p: c.p, g: c.g, o: c.o, m: c.m, maxCombo: d.maxCombo, total, level: d.level };
}

function update(dt) {
  if (!d) return;
  const t = now();
  for (const n of d.notes) if (!n.j && t - n.t > WIN.o) { n.j = 'm'; d.cnt.m++; d.combo = 0; d.judge = 'MISS'; d.judgeT = 0.4; d.judgeLane = n.lane; }
  for (let i = 0; i < 4; i++) d.flash[i] = Math.max(0, d.flash[i] - dt * 6);
  d.judgeT = Math.max(0, d.judgeT - dt);
  d.hits.forEach(h => { h.t += dt; }); d.hits = d.hits.filter(h => h.t < 0.35);
  if (!d.done && t > d.end) { d.done = true; d.res = result(); A.sfx(d.res.rank <= 'B' ? 'clear' : 'fail'); }
  if (d.done && (d.resT += dt) > 2.6) { const cb = d.onEnd, r = d.res; d = null; cb(r); }
}

// ---------- 그리기 ----------
const depth = y => (y - TOP) / (JUDGE_Y - TOP);                    // 0 = 멀리(위), 1 = 판정선
const widthAt = s => W_TOP + (W_BOT - W_TOP) * s;
const laneX = (lane, s, k = 0.5) => W / 2 - widthAt(s) / 2 + widthAt(s) * (lane + k) / LANES;
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function text(g, s, x, y, size, color, weight = 900, align = 'center') {
  g.font = `${weight} ${size}px sans-serif`; g.textAlign = align; g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = 'rgba(4,2,16,.85)';
  g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y);
}
function drawDJ(g, x, y, T, k) {
  const pulse = 1 + k * 0.12;
  for (const sx of [-1, 1]) {   // 스피커
    g.save(); g.translate(x + sx * 92, y + 6); g.scale(pulse, pulse);
    rr(g, -30, -36, 60, 72, 10); g.fillStyle = '#1b1530'; g.fill(); g.strokeStyle = '#ff6ad5'; g.lineWidth = 2; g.stroke();
    for (const [cy, r] of [[-14, 14], [18, 9]]) { g.beginPath(); g.arc(0, cy, r, 0, TAU); g.fillStyle = '#0b0818'; g.fill(); g.strokeStyle = '#4cc9ff'; g.stroke(); g.beginPath(); g.arc(0, cy, r * 0.35, 0, TAU); g.fillStyle = '#4cc9ff'; g.fill(); }
    g.restore();
  }
  g.save(); g.translate(x, y + Math.sin(T * 8) * 2);
  const body = g.createLinearGradient(-44, -50, 44, 50); body.addColorStop(0, '#5a4a9a'); body.addColorStop(1, '#1a1236');
  rr(g, -44, -40, 88, 80, 18); g.fillStyle = body; g.fill(); g.strokeStyle = '#ffd166'; g.lineWidth = 2.5; g.stroke();
  rr(g, -34, -26, 68, 26, 8); g.fillStyle = '#05030c'; g.fill();
  g.fillStyle = COLORS[Math.floor(T * 4) % 4]; for (let i = 0; i < 6; i++) g.fillRect(-28 + i * 10, -6 - Math.abs(Math.sin(T * 9 + i)) * 14 * (0.4 + k), 7, 3 + Math.abs(Math.sin(T * 9 + i)) * 14 * (0.4 + k));
  g.beginPath(); g.arc(0, -52, 34, Math.PI * 1.1, Math.PI * 1.9); g.strokeStyle = '#ffd166'; g.lineWidth = 6; g.stroke();   // 헤드폰
  for (const sx of [-1, 1]) { rr(g, sx * 34 - 8, -60, 16, 24, 6); g.fillStyle = '#ffd166'; g.fill(); }
  g.restore();
}
function draw(g, T) {
  if (!d) return;
  const t = now(), bp = ((t - d.t0) / d.beat % 1 + 1) % 1, kick = Math.max(0, 1 - bp * 3);
  g.fillStyle = 'rgba(5,2,18,.88)'; g.fillRect(0, 0, W, H);
  // 무대 불빛
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const a = Math.sin(T * 0.9 + i * 1.7) * 0.5;
    g.fillStyle = `rgba(${[255, 76, 255, 110][i]},${[106, 201, 209, 227][i]},${[213, 255, 102, 122][i]},${0.05 + kick * 0.05})`;
    g.beginPath(); g.moveTo(W / 2 - 20, 0); g.lineTo(W / 2 + 20, 0); g.lineTo(W / 2 + Math.sin(a) * 700 + 120, H); g.lineTo(W / 2 + Math.sin(a) * 700 - 120, H); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // 길(원근)
  for (let i = 0; i < LANES; i++) {
    g.beginPath();
    g.moveTo(laneX(i, 0, 0), TOP); g.lineTo(laneX(i, 0, 1), TOP); g.lineTo(laneX(i, 1.12, 1), JUDGE_Y + 90); g.lineTo(laneX(i, 1.12, 0), JUDGE_Y + 90); g.closePath();
    const gr = g.createLinearGradient(0, TOP, 0, JUDGE_Y + 90); gr.addColorStop(0, 'rgba(20,12,40,.3)'); gr.addColorStop(1, i % 2 ? 'rgba(40,26,80,.85)' : 'rgba(30,18,64,.85)');
    g.fillStyle = gr; g.fill();
    if (d.flash[i] > 0) { g.globalAlpha = d.flash[i] * 0.55; const fg = g.createLinearGradient(0, JUDGE_Y + 60, 0, TOP); fg.addColorStop(0, COLORS[i]); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fg; g.fill(); g.globalAlpha = 1; }
  }
  g.strokeStyle = 'rgba(200,170,255,.35)'; g.lineWidth = 2;
  for (let i = 0; i <= LANES; i++) { g.beginPath(); g.moveTo(laneX(0, 0, i), TOP); g.lineTo(laneX(0, 1.12, i), JUDGE_Y + 90); g.stroke(); }
  // 박자 줄(위에서 내려온다)
  for (let k = 0; k < 6; k++) {
    const bt = d.t0 + (Math.floor((t - d.t0) / d.beat) + k) * d.beat, s = 1 - (bt - t) / APPROACH;
    if (s < 0 || s > 1) continue;
    const y = TOP + (JUDGE_Y - TOP) * Math.pow(s, 1.6), ss = depth(y);
    g.strokeStyle = `rgba(255,255,255,${0.06 + 0.1 * s})`; g.lineWidth = 1 + s * 2; g.beginPath(); g.moveTo(laneX(0, ss, 0), y); g.lineTo(laneX(0, ss, 4), y); g.stroke();
  }
  // 판정선과 누르는 자리
  g.globalCompositeOperation = 'lighter';
  g.drawImage(Art.glow('#ff9df0', 40), 0, JUDGE_Y - 30, W, 60);
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(laneX(0, 1, 0), JUDGE_Y); g.lineTo(laneX(0, 1, 4), JUDGE_Y); g.stroke();
  for (let i = 0; i < LANES; i++) {
    const x0 = laneX(i, 1, 0.06), x1 = laneX(i, 1, 0.94), y = JUDGE_Y + 22;
    rr(g, x0, y, x1 - x0, 64, 14);
    const bg = g.createLinearGradient(0, y, 0, y + 64); bg.addColorStop(0, COLORS[i]); bg.addColorStop(1, 'rgba(20,10,40,.9)');
    g.globalAlpha = 0.35 + d.flash[i] * 0.65; g.fillStyle = bg; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = COLORS[i]; g.lineWidth = 2; g.stroke();
    text(g, KEYS[i], (x0 + x1) / 2, y + 42, 18, 'rgba(255,255,255,.75)', 800);
  }
  // 음표
  for (const n of d.notes) {
    if (n.j && n.j !== 'm') continue;
    const s = 1 - (n.t - t) / APPROACH;
    if (s < 0 || s > 1.18) continue;
    const y = TOP + (JUDGE_Y - TOP) * Math.pow(Math.max(0, s), 1.6), ss = depth(y);
    const x0 = laneX(n.lane, ss, 0.08), x1 = laneX(n.lane, ss, 0.92), h = 10 + 18 * ss;
    g.globalAlpha = n.j === 'm' ? 0.25 : 1;
    g.globalCompositeOperation = 'lighter';
    if (!n.j) g.drawImage(Art.glow(COLORS[n.lane], 40), x0 - 14, y - h - 10, x1 - x0 + 28, h * 2 + 20);
    g.globalCompositeOperation = 'source-over';
    rr(g, x0, y - h / 2, x1 - x0, h, h / 2);
    const ng = g.createLinearGradient(0, y - h / 2, 0, y + h / 2); ng.addColorStop(0, '#ffffff'); ng.addColorStop(0.35, COLORS[n.lane]); ng.addColorStop(1, '#2a1050');
    g.fillStyle = n.j === 'm' ? '#555' : ng; g.fill();
    if (n.half && !n.j) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    g.globalAlpha = 1;
  }
  // 맞힌 자리의 불꽃
  g.globalCompositeOperation = 'lighter';
  for (const h of d.hits) {
    const k = 1 - h.t / 0.35, x = laneX(h.lane, 1), r = 30 + (1 - k) * 50;
    g.globalAlpha = k; g.drawImage(Art.glow(h.j === 'p' ? '#ffffff' : COLORS[h.lane], 60), x - r, JUDGE_Y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // DJ 로봇과 체력
  const c = d.cnt, total = d.notes.length, dealt = (c.p + 0.7 * c.g + 0.4 * c.o) / total;
  drawDJ(g, W / 2, 112, T, kick);
  rr(g, 90, 176, W - 180, 12, 6); g.fillStyle = 'rgba(0,0,0,.6)'; g.fill();
  rr(g, 90, 176, (W - 180) * Math.max(0, 1 - dealt), 12, 6); g.fillStyle = '#ff5da2'; g.fill();
  text(g, `${d.title} · DJ 「${d.name}」 Lv ${d.level}`, W / 2, 168, 15, '#ffd6f5', 800);
  // 진행 줄
  const prog = Math.max(0, Math.min(1, (t - d.t0) / (d.end - d.t0)));
  g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, W, 5); g.fillStyle = '#ff6ad5'; g.fillRect(0, 0, W * prog, 5);
  // 카운트다운
  if (t < d.t0) {
    const left = Math.ceil((d.t0 - t) / d.beat);
    text(g, left > 3 ? 'READY' : String(left), W / 2, H * 0.48, left > 3 ? 54 : 96, '#ffffff');
    text(g, '음표가 흰 선에 닿을 때 그 줄을 누르세요', W / 2, H * 0.48 + 56, 18, '#e8d8ff', 700);
  }
  // 판정과 콤보
  if (d.judgeT > 0 && d.judge) {
    const col = { PERFECT: '#ffe066', GREAT: '#7fffd4', GOOD: '#9fd0ff', MISS: '#ff7a8a' }[d.judge];
    const sc = 1 + (d.judgeT / 0.45) * 0.3;
    g.save(); g.translate(W / 2, JUDGE_Y - 150); g.scale(sc, sc); text(g, d.judge, 0, 0, 38, col); g.restore();
  }
  if (d.combo >= 3) { text(g, String(d.combo), W / 2, H * 0.4, 64, '#ffffff'); text(g, 'COMBO', W / 2, H * 0.4 + 26, 16, '#ffd6f5', 800); }
  text(g, `${Math.round(dealt * 100)}%`, W - 20, 30, 18, '#ffd6f5', 900, 'right');
  // 결과
  if (d.done && d.res) {
    const r = d.res, k = Math.min(1, d.resT * 3);
    g.globalAlpha = k; g.fillStyle = 'rgba(5,2,18,.75)'; g.fillRect(0, 0, W, H);
    rr(g, 60, H * 0.3, W - 120, 330, 24); g.fillStyle = 'rgba(30,18,64,.95)'; g.fill(); g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.stroke();
    text(g, r.rank === 'D' ? 'DJ가 도망쳤다…' : 'DJ를 이겼다!', W / 2, H * 0.3 + 52, 28, '#ffd6f5');
    text(g, r.rank, W / 2, H * 0.3 + 160, 110, { S: '#ffe066', A: '#7fffd4', B: '#9fd0ff', C: '#d8c8ff', D: '#ff7a8a' }[r.rank]);
    text(g, `PERFECT ${r.p} · GREAT ${r.g} · GOOD ${r.o} · MISS ${r.m}`, W / 2, H * 0.3 + 230, 16, '#ffffff', 800);
    text(g, `정확도 ${Math.round(r.acc * 100)}% · 최고 콤보 ${r.maxCombo}`, W / 2, H * 0.3 + 262, 16, '#ffd6f5', 700);
    g.globalAlpha = 1;
  }
}

return {
  start, update, draw, press, pressX,
  get active() { return !!d; },
  peek: () => (d ? { notes: d.notes, now: now() } : null),   // 점검용
};
})();
