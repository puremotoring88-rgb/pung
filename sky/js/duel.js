// 볼트윙(by motive) — 리듬 결투. 비행을 멈추고 4줄 리듬 게임에만 집중한다.
// 떨어지는 음표가 곧 음악의 가락이라, 소리를 들으며 박자에 맞춰 누르면 된다.
window.Duel = (() => {
'use strict';
const W = 540, H = 960, TAU = Math.PI * 2, LANES = 4;
const WIN = { p: 0.05, g: 0.09, o: 0.135 };      // PERFECT, GREAT, GOOD로 인정하는 어긋남(초) — 0.8에서 가볍게 즐기도록 넓힘
let APPROACH = 1.3;                              // 음표가 위에서 판정선까지 오는 시간(초). 단계가 오를수록 짧아진다(빨라짐)
const COLORS = ['#ff6ad5', '#4cc9ff', '#ffd166', '#6ee37a'];
const KEYS = ['D', 'F', 'J', 'K'];
const NAMES = ['베이스 드롭', '비트 박스', '신스 웨이브', '드럼 머신', '하이햇 헌터', '서브 우퍼', '글리치 코어', '마스터 DJ'];
const TOP = 210, JUDGE_Y = H - 200, W_TOP = 150, W_BOT = W - 30;
let A, Art, d = null;

// 악보 만들기: 한 마디(4박)마다 '무늬'를 하나 골라 채운다.
// 1단계부터 8분음표 흐름과 엇박, 2단계부터 길게 누르기·연타, 4단계부터 16분음표(트릴·계단)가 나온다.
const R = n => (Math.random() * n) | 0;
const PATTERNS = [
  { id: 'quarters', lv: 1, w: 1 }, { id: 'eighths', lv: 1, w: 3 }, { id: 'offbeat', lv: 1, w: 2 }, { id: 'chord', lv: 1, w: 2 },
  { id: 'hold', lv: 2, w: 3 }, { id: 'jack', lv: 2, w: 2 }, { id: 'gallop', lv: 3, w: 3 },
  { id: 'trill', lv: 4, w: 3 }, { id: 'stairs', lv: 4, w: 3 }, { id: 'holdRun', lv: 5, w: 3 }, { id: 'hand', lv: 5, w: 3 }, { id: 'chordRun', lv: 6, w: 3 }, { id: 'handRun', lv: 7, w: 2 },
];
function makeChart(level, beats) {
  const notes = [];
  let lane = R(4), prev = '';
  const busy = (ln, b) => notes.some(n => n.lane === ln && (Math.abs(n.b - b) < 0.2 || (n.len && b >= n.b - 0.1 && b <= n.b + n.len + 0.2)));
  const put = (b, ln, len) => { if (busy(ln, b) || (len && notes.some(n => n.lane === ln && n.b > b && n.b < b + len + 0.3))) return false; notes.push(len ? { b, lane: ln, len } : { b, lane: ln }); return true; };
  const step = () => { lane = (lane + [1, -1, 2, 1, -1, 3][R(6)] + 4) % 4; return lane; };
  const other = ln => (ln + 1 + R(3)) % 4;
  const opp = ln => (level >= 6 && R(3) === 0 ? other(ln) : (ln < 2 ? 2 : 0) + R(2));   // 0.45: 반대 손의 줄(길게 누르는 동안 같은 손이 꼬이지 않게), 0.46: 6단계부터 가끔 같은 손 다른 손가락
  const pair = () => R(2) * 2;   // 0.46: 한 손 동시 누르기(왼손 0+1 / 오른손 2+3)
  const fill = {
    quarters: B => { for (let i = 0; i < 4; i++) put(B + i, step()); },
    eighths: B => { for (let i = 0; i < 8; i++) if (level > 1 || i % 4 !== 3) put(B + i * 0.5, step()); },
    offbeat: B => { put(B, step()); for (let i = 0; i < 4; i++) put(B + i + 0.5, step()); if (level >= 3) put(B + 2, step()); },
    chord: B => { for (let i = 0; i < 4; i++) { const a = step(); put(B + i, a); if (i % 2 === 0 || level >= 5) put(B + i, level >= 5 && R(3) === 0 ? (a ^ 1) : (a + 2) % 4); if (level >= 3 && i % 2) put(B + i + 0.5, step()); } },
    hold: B => { const h = step(), len = level >= 5 ? 3 : 2; put(B, h, len); for (let i = 1; i < (level >= 4 ? 8 : 4); i++) { const b = B + i * (level >= 4 ? 0.5 : 1); if (b < B + len + 0.5) put(b, b < B + len ? opp(h) : other(h)); } },
    jack: B => { const j = step(); for (let i = 0; i < 3; i++) put(B + i * 0.5, j); for (let i = 3; i < 8; i++) put(B + i * 0.5, step()); },
    gallop: B => { for (let i = 0; i < 4; i++) { put(B + i, step()); put(B + i + 0.75, step()); } },
    trill: B => { const a = step(), b = (a + (R(2) ? 1 : 2)) % 4, k = level >= 6 ? 12 : 8; for (let i = 0; i < k; i++) put(B + i * 0.25, i % 2 ? b : a); for (let b2 = B + k * 0.25; b2 < B + 4; b2 += 0.5) put(b2, step()); },
    stairs: B => { for (let s = 0; s < 2; s++) { const dir = R(2) ? 1 : -1, st = R(4); for (let k = 0; k < 4; k++) put(B + s * 2 + k * 0.25, (st + dir * k + 8) % 4); put(B + s * 2 + 1.5, step()); } },
    holdRun: B => { const h = step(); put(B, h, 3.5); for (let i = 1; i < 14; i++) if (i % 4 !== 3 || level >= 7) put(B + i * 0.25 + 0.25, opp(h)); },
    hand: B => { for (let i = 0; i < 4; i++) { const a = pair(); put(B + i, a); put(B + i, a + 1); put(B + i + 0.5, step()); } },
    handRun: B => { for (let i = 0; i < 8; i++) { if (i % 2 === 0) { const a = pair(); put(B + i * 0.5, a); put(B + i * 0.5, a + 1); } else { const a = step(); put(B + i * 0.5, a); if (R(2)) put(B + i * 0.5, (a + 2) % 4); } } },
    chordRun: B => { for (let i = 0; i < 8; i++) { const a = step(); put(B + i * 0.5, a); if (i % 2 === 0) put(B + i * 0.5, (a + 2) % 4); } },
  };
  const pool = PATTERNS.filter(p => p.lv <= level).map(p => ({ id: p.id, w: p.w * (p.lv >= level - 1 ? 2 : 1) }));   // 새로 열린 무늬가 더 자주
  const pick = () => { let tot = pool.reduce((s, p) => s + (p.id === prev ? 0 : p.w), 0), x = Math.random() * tot; for (const p of pool) { if (p.id === prev) continue; if ((x -= p.w) < 0) return p.id; } return pool[0].id; };
  for (let m = 0; m < beats / 4; m++) {
    const id = m === 0 ? (level <= 3 ? 'quarters' : 'eighths') : pick();
    prev = id; fill[id](m * 4);
  }
  const last = beats - 1; put(last, 0); put(last, 3);   // 마지막은 양쪽 끝 동시에
  return notes.filter(n => n.b + (n.len || 0) < beats + 0.01).sort((a, b) => a.b - b.b || a.lane - b.lane);
}

function start(opt) {
  A = window.AudioKit; Art = window.Art;
  const level = Math.max(1, Math.min(8, opt.level | 0)), beats = 40, countIn = 2;   // 3·2·1(PRE) 뒤에 두 박 준비
  const song = (A.SONGS || []).find(s => s.id === opt.song) || (A.SONGS || [])[R((A.SONGS || [1]).length)] || null;
  const bpm = Math.round(Math.min(168, 112 + level * 6) * (song ? song.k : 1)), beat = 60 / bpm;
  APPROACH = Math.max(1.0, 1.45 - 0.05 * (level - 1)) / (opt.speed || 1);   // 내려오는 빠르기(설정)
  const chart = makeChart(level, beats);
  d = {
    level, bpm, beat, t0: Infinity, countIn, name: song ? song.name : NAMES[(level - 1) % NAMES.length], genre: song ? song.genre : '', song: song && song.id, sync: (opt.sync || 0) / 1000, dev: [], title: opt.title || 'RHYTHM DUEL',
    notes: [], end: Infinity, cnt: { p: 0, g: 0, o: 0, m: 0, x: 0 }, combo: 0, maxCombo: 0, down: [false, false, false, false],
    judge: null, judgeT: 0, judgeLane: 0, flash: [0, 0, 0, 0], hits: [], done: false, resT: 0, onEnd: opt.onEnd, res: null,
    fog: level >= 7,   // 7단계부터 '구름 구간': 음표가 중간에 잠깐 흐려진다
    parts: [], rings: [], mile: null, fever: false, feverT: 0, missT: 0, popT: 0,   // 0.46 연출: 불꽃 파편·빛 고리·콤보 축하·FEVER·놓침 흔들림
    pre: PRE, preN: 3, chart, beats,   // 0.45: 음악 전에 3, 2, 1 — 휴대폰을 내려놓고 양손 검지·중지를 올릴 시간
  };
}
const PRE = 3.2;
function begin() {   // 카운트다운이 끝나면 음악과 음표를 시작한다
  const t0 = A.duel(d.chart, d.bpm, d.countIn, (A.SONGS || []).find(s => s.id === d.song) || null);   // 0번째 박이 울리는 시각
  d.t0 = t0; d.pre = 0;
  d.notes = d.chart.map(n => ({ t: t0 + n.b * d.beat, lane: n.lane, j: null, half: n.b % 1 !== 0, end: n.len ? t0 + (n.b + n.len) * d.beat : 0, tail: null }));
  d.end = t0 + d.beats * d.beat + 0.6;
  d.total = d.notes.length + d.notes.filter(n => n.end).length;   // 길게 누르기는 끝까지 버텨야 1점 더
}

const now = () => { const c = A.clock(); return c.t - (c.lat || 0); };   // 기기 소리 지연만큼 늦춰서, 음표가 선에 닿는 때 = 소리가 들리는 때
function judgeOf(dt) { return dt <= WIN.p ? 'p' : dt <= WIN.g ? 'g' : dt <= WIN.o ? 'o' : null; }
function press(lane) {
  if (!d || d.done) return;
  d.flash[lane] = 1;
  const t = now() - d.sync;   // 싱크: 이어폰 등으로 소리가 늦게 들리는 만큼 당겨서 판정
  let best = null, bd = 9;
  for (const n of d.notes) { if (n.j || n.lane !== lane) continue; const dt = Math.abs(t - n.t); if (dt < bd) { bd = dt; best = n; } }
  d.down[lane] = true;
  const j = best ? judgeOf(bd) : null;
  if (!j) {   // 헛누름: 근처에 음표가 하나도 없을 때만 정확도가 아주 조금 깎인다(콤보는 그대로)
    if (t > d.t0 - 0.2 && !(best && bd < 0.45)) d.cnt.x++;
    return;
  }
  d.dev.push(t - best.t);
  best.j = j; d.cnt[j]++; comboUp();
  if (best.end) best.hold = true;
  d.judge = { p: 'PERFECT', g: 'GREAT', o: 'GOOD' }[j]; d.judgeT = 0.45; d.judgeLane = lane;
  d.hits.push({ lane, t: 0, j }); burst(lane, j);
  A.sfx(j === 'o' ? 'good' : 'perfect'); if (j === 'p') A.sfx('sparkle');
  if (navigator.vibrate && j === 'p') { try { navigator.vibrate(8); } catch (e) { /* 진동 없음 */ } }
}
function pressX(x) { const l = Math.max(0, Math.min(3, Math.floor(x / (W / LANES)))); press(l); return l; }
function release(lane) {   // 손을 떼면: 길게 누르는 음표를 끝나기 전에 놓으면 꼬리를 놓친다
  if (!d) return;
  d.down[lane] = false;
  const t = now() - d.sync;
  for (const n of d.notes) if (n.hold && n.lane === lane && !n.tail) {
    if (t >= n.end - Math.max(WIN.o, d.beat * 0.35)) tailOk(n); else { n.tail = 'm'; n.hold = false; d.cnt.m++; comboBreak(); d.judge = '놓쳤다'; d.judgeT = 0.4; d.judgeLane = lane; }
  }
}
function tailOk(n) { n.tail = 'p'; n.hold = false; d.cnt.p++; comboUp(); d.hits.push({ lane: n.lane, t: 0, j: 'p' }); burst(n.lane, 'p'); A.sfx('perfect'); }
// ---------- 0.46 화려한 연출 ----------
const MILES = [10, 25, 50, 75, 100];
function comboUp() {
  d.combo++; d.maxCombo = Math.max(d.maxCombo, d.combo); d.popT = 1;
  if (MILES.includes(d.combo) || (d.combo > 100 && d.combo % 50 === 0)) {   // 콤보 축하: 큰 글씨·빛 고리·팡파르
    d.mile = { n: d.combo, t: 1.3 }; A.sfx('fanfare');
    for (let i = 0; i < 4; i++) { d.rings.push({ x: laneX(i, 1), y: JUDGE_Y, t: 0, c: COLORS[i], big: true }); burst(i, 'p', 10); }
  }
  if (!d.fever && d.combo >= 30) { d.fever = true; d.feverT = 1.6; A.sfx('fever'); }
}
function comboBreak() { d.combo = 0; d.missT = 0.35; if (d.fever) { d.fever = false; d.feverT = 0; } A.sfx('miss'); }
function burst(lane, j, extra = 0) {   // 맞힌 줄에서 불꽃 파편이 튄다(PERFECT는 더 많고 별 모양)
  const x = laneX(lane, 1), n = (j === 'p' ? 12 : j === 'g' ? 8 : 4) + extra + (d.fever ? 6 : 0);
  for (let i = 0; i < n && d.parts.length < 320; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 260 + Math.random() * 420;
    d.parts.push({ x: x + (Math.random() - 0.5) * 40, y: JUDGE_Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, max: 0.9, c: Math.random() < 0.35 ? '#ffffff' : d.fever ? `hsl(${(lane * 90 + Math.random() * 120) | 0},100%,70%)` : COLORS[lane], star: j === 'p' && Math.random() < 0.4, r: 2 + Math.random() * 3 });
  }
  d.rings.push({ x, y: JUDGE_Y, t: 0, c: j === 'p' ? '#ffffff' : COLORS[lane] });
}
const score = () => { const c = d.cnt; return (c.p + 0.8 * c.g + 0.45 * c.o) / ((d.total || 1) + 0.1 * c.x); };
function result() {
  const c = d.cnt, acc = Math.max(0, score());
  const rank = acc >= 0.94 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.72 ? 'B' : acc >= 0.55 ? 'C' : 'D';
  const dv = d.dev.slice().sort((a, b) => a - b), lag = dv.length >= 8 ? Math.round(dv[dv.length >> 1] * 1000) : 0;   // 가운데 값(ms): +면 늦게 누름
  return { rank, acc, p: c.p, g: c.g, o: c.o, m: c.m, x: c.x, maxCombo: d.maxCombo, total: d.total, level: d.level, song: d.song, songName: d.name, lag };
}

function update(dt) {
  if (!d) return;
  if (d.pre > 0) { d.pre -= dt; if (d.pre <= 0) begin(); return; }
  const t = now() - (d.sync || 0);
  for (const n of d.notes) {
    if (!n.j && t - n.t > WIN.o) { n.j = 'm'; d.cnt.m++; comboBreak(); d.judge = 'MISS'; d.judgeT = 0.4; d.judgeLane = n.lane; if (n.end) { n.tail = 'm'; d.cnt.m++; } }
    if (n.hold && !n.tail) { if (t >= n.end) tailOk(n); else if (!d.down[n.lane]) release(n.lane); else if (Math.random() < 0.3) d.flash[n.lane] = Math.max(d.flash[n.lane], 0.6); }
  }
  for (let i = 0; i < 4; i++) d.flash[i] = Math.max(0, d.flash[i] - dt * 6);
  d.judgeT = Math.max(0, d.judgeT - dt);
  d.hits.forEach(h => { h.t += dt; }); d.hits = d.hits.filter(h => h.t < 0.35);
  for (const p of d.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.vx *= 0.98; p.life -= dt; }
  d.parts = d.parts.filter(p => p.life > 0);
  d.rings.forEach(r => { r.t += dt; }); d.rings = d.rings.filter(r => r.t < (r.big ? 0.7 : 0.4));
  if (d.mile) { d.mile.t -= dt; if (d.mile.t <= 0) d.mile = null; }
  d.feverT = Math.max(0, d.feverT - dt); d.missT = Math.max(0, d.missT - dt); d.popT = Math.max(0, d.popT - dt * 5);
  if (!d.done && t > d.end) { d.done = true; d.res = result(); const fc = d.res.m === 0; A.sfx(fc ? 'fullcombo' : d.res.rank <= 'B' ? 'clear' : 'fail'); if (fc) for (let i = 0; i < 4; i++) burst(i, 'p', 16); }
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
function drawPre(g, T) {   // 0.45: 시작 전 3, 2, 1 — 휴대폰을 내려놓고 양손 검지·중지(또는 D F J K)를 올려 두는 시간
  g.fillStyle = 'rgba(5,2,18,.92)'; g.fillRect(0, 0, W, H);
  text(g, `${d.title} · 🎵 「${d.name}」 · Lv ${d.level}`, W / 2, 150, 17, '#ffd6f5', 800);
  const n = Math.max(1, Math.ceil(d.pre - 0.2)), k = (d.pre - 0.2) % 1, sc = 1 + Math.max(0, k - 0.6) * 1.2;
  g.save(); g.translate(W / 2, H * 0.36); g.scale(sc, sc); text(g, String(n), 0, 0, 150, '#ffffff'); g.restore();
  text(g, '📱 휴대폰을 책상에 내려놓고', W / 2, H * 0.36 + 110, 24, '#ffe7a3', 900);
  text(g, '양손 검지·중지를 한 줄씩 올려 두세요', W / 2, H * 0.36 + 146, 21, '#e8d8ff', 800);
  // 네 줄 자리와 손가락 안내(지금 눌러 보며 자리를 맞춰도 된다)
  const y = JUDGE_Y, lw = W_BOT / LANES;
  for (let i = 0; i < LANES; i++) {
    const x = W / 2 - W_BOT / 2 + lw * (i + 0.5), on = d.flash[i] > 0 || d.down[i];
    g.fillStyle = on ? COLORS[i] : 'rgba(255,255,255,.08)'; g.globalAlpha = on ? 0.55 : 1;
    rr(g, x - lw / 2 + 6, y - 70, lw - 12, 150, 18); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = COLORS[i]; g.lineWidth = 3; rr(g, x - lw / 2 + 6, y - 70, lw - 12, 150, 18); g.stroke();
    text(g, ['중지', '검지', '검지', '중지'][i], x, y - 14, 20, '#ffffff', 900);   // 바깥 줄 = 중지, 안쪽 줄 = 검지
    text(g, KEYS[i], x, y + 24, 18, COLORS[i], 900);
  }
  text(g, '✋ 왼손', W / 2 - W_BOT / 4, y + 110, 20, '#ffd6f5', 900);
  text(g, '오른손 ✋', W / 2 + W_BOT / 4, y + 110, 20, '#ffd6f5', 900);
  for (let i = 0; i < 4; i++) d.flash[i] = Math.max(0, d.flash[i] - 0.03);
  void T;
}
function draw(g, T) {
  if (!d) return;
  if (d.pre > 0) { drawPre(g, T); return; }
  const t = now(), bp = ((t - d.t0) / d.beat % 1 + 1) % 1, kick = Math.max(0, 1 - bp * 3);
  g.fillStyle = 'rgba(5,2,18,.88)'; g.fillRect(0, 0, W, H);
  g.save();
  if (d.missT > 0) g.translate((Math.random() - 0.5) * d.missT * 26, (Math.random() - 0.5) * d.missT * 18);   // 놓치면 화면이 살짝 흔들림
  if (d.fever) {   // FEVER: 바닥에서 무지개 빛이 박자에 맞춰 출렁임
    const fg = g.createLinearGradient(0, H, 0, H * 0.3); fg.addColorStop(0, `hsla(${(T * 120) % 360},100%,60%,${0.22 + kick * 0.18})`); fg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fg; g.fillRect(0, H * 0.3, W, H * 0.7);
  }
  // 무대 불빛
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const a = Math.sin(T * (d.fever ? 2.2 : 0.9) + i * 1.7) * 0.5;
    g.fillStyle = `rgba(${[255, 76, 255, 110][i]},${[106, 201, 209, 227][i]},${[213, 255, 102, 122][i]},${0.05 + kick * (d.fever ? 0.12 : 0.05)})`;
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
  g.lineWidth = 2 + kick * 1.5;   // 줄 경계가 박자마다 밝아짐(FEVER면 무지개)
  for (let i = 0; i <= LANES; i++) { g.strokeStyle = d.fever ? `hsla(${(T * 160 + i * 70) % 360},100%,70%,${0.5 + kick * 0.4})` : `rgba(200,170,255,${0.3 + kick * 0.3})`; g.beginPath(); g.moveTo(laneX(0, 0, i), TOP); g.lineTo(laneX(0, 1.12, i), JUDGE_Y + 90); g.stroke(); }
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
  g.strokeStyle = d.fever ? `hsl(${(T * 200) % 360},100%,85%)` : '#fff'; g.lineWidth = 4 + kick * 4; g.beginPath(); g.moveTo(laneX(0, 1, 0), JUDGE_Y); g.lineTo(laneX(0, 1, 4), JUDGE_Y); g.stroke();
  // 이퀄라이저: 화면 맨 아래에서 박자·누름에 맞춰 춤추는 막대
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 24; i++) {
    const ln = (i / 6) | 0, hgt = 8 + (Math.abs(Math.sin(T * 7 + i * 1.3)) * 0.4 + kick * 0.6 + d.flash[ln] * 0.8) * 46;
    g.fillStyle = d.fever ? `hsla(${(i * 15 + T * 120) % 360},100%,60%,.55)` : COLORS[ln]; g.globalAlpha = d.fever ? 1 : 0.35;
    g.fillRect(i * (W / 24) + 3, H - hgt, W / 24 - 6, hgt);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < LANES; i++) {
    const x0 = laneX(i, 1, 0.06), x1 = laneX(i, 1, 0.94), y = JUDGE_Y + 22;
    rr(g, x0, y, x1 - x0, 64, 14);
    const bg = g.createLinearGradient(0, y, 0, y + 64); bg.addColorStop(0, COLORS[i]); bg.addColorStop(1, 'rgba(20,10,40,.9)');
    g.globalAlpha = 0.35 + d.flash[i] * 0.65; g.fillStyle = bg; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = COLORS[i]; g.lineWidth = 2; g.stroke();
    text(g, KEYS[i], (x0 + x1) / 2, y + 42, 18, 'rgba(255,255,255,.75)', 800);
  }
  // 길게 누르는 음표의 몸통(머리에서 꼬리까지)
  const yOf = s => TOP + (JUDGE_Y - TOP) * Math.pow(Math.max(0, Math.min(1, s)), 1.6);
  for (const n of d.notes) {
    if (!n.end || n.tail === 'p') continue;
    const sh = n.hold ? 1 : 1 - (n.t - t) / APPROACH, se = 1 - (n.end - t) / APPROACH;
    if (sh < 0 || se > 1.05) continue;
    const y0 = yOf(sh), y1 = yOf(se), s0 = depth(y0), s1 = depth(y1);
    g.beginPath(); g.moveTo(laneX(n.lane, s1, 0.3), y1); g.lineTo(laneX(n.lane, s1, 0.7), y1); g.lineTo(laneX(n.lane, s0, 0.7), y0); g.lineTo(laneX(n.lane, s0, 0.3), y0); g.closePath();
    const dead = n.j === 'm' || n.tail === 'm';
    g.globalAlpha = dead ? 0.25 : n.hold ? 0.95 : 0.7; g.fillStyle = dead ? '#555' : COLORS[n.lane]; g.fill();
    if (n.hold) { g.globalCompositeOperation = 'lighter'; g.drawImage(Art.glow(COLORS[n.lane], 40), laneX(n.lane, 1) - 50, JUDGE_Y - 50, 100, 100); g.globalCompositeOperation = 'source-over'; }
    g.globalAlpha = 1;
    if (se >= 0) { rr(g, laneX(n.lane, s1, 0.2), y1 - 4, laneX(n.lane, s1, 0.8) - laneX(n.lane, s1, 0.2), 8, 4); g.fillStyle = dead ? '#555' : '#fff'; g.fill(); }
  }
  // 동시에 누르는 음표를 잇는 빛 막대(같은 손이면 노랗게 — 한 손 두 손가락)
  const groups = {};
  for (const n of d.notes) if (!n.j) (groups[Math.round(n.t * 1000)] = groups[Math.round(n.t * 1000)] || []).push(n);
  for (const k in groups) {
    const gr = groups[k]; if (gr.length < 2) continue;
    const s = 1 - (gr[0].t - t) / APPROACH; if (s < 0 || s > 1.05 || (d.fog && s > 0.42 && s < 0.72)) continue;
    const y = yOf(s), ss = depth(y), lns = gr.map(n => n.lane), lo = Math.min(...lns), hi = Math.max(...lns), same = hi - lo === 1 && (lo === 0 || lo === 2);
    g.globalAlpha = 0.85; g.fillStyle = same ? '#ffe066' : 'rgba(255,255,255,.75)';
    g.fillRect(laneX(lo, ss), y - 2 - ss * 2, laneX(hi, ss) - laneX(lo, ss), 4 + ss * 4); g.globalAlpha = 1;
  }
  // 음표
  for (const n of d.notes) {
    if (n.j && n.j !== 'm') continue;
    const s = 1 - (n.t - t) / APPROACH;
    if (s < 0 || s > 1.18) continue;
    if (d.fog && !n.j && s > 0.42 && s < 0.72) continue;   // 구름 구간: 박자와 소리로 읽기
    const y = TOP + (JUDGE_Y - TOP) * Math.pow(Math.max(0, s), 1.6), ss = depth(y);
    const x0 = laneX(n.lane, ss, 0.08), x1 = laneX(n.lane, ss, 0.92), h = 10 + 18 * ss;
    g.globalAlpha = n.j === 'm' ? 0.25 : 1;
    g.globalCompositeOperation = 'lighter';
    if (!n.j) {
      g.drawImage(Art.glow(COLORS[n.lane], 40), x0 - 14, y - h - 10, x1 - x0 + 28, h * 2 + 20);
      const tl = g.createLinearGradient(0, y - 40 * ss - 10, 0, y); tl.addColorStop(0, 'rgba(0,0,0,0)'); tl.addColorStop(1, COLORS[n.lane]);   // 꼬리 빛
      g.globalAlpha = 0.35; g.fillStyle = tl; g.fillRect(x0 + (x1 - x0) * 0.2, y - 40 * ss - 10, (x1 - x0) * 0.6, 40 * ss + 10); g.globalAlpha = 1;
    }
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
    // 빛기둥: 맞힌 줄을 따라 위로 솟는 빛
    const bw = widthAt(1) / LANES * (h.j === 'p' ? 0.8 : 0.55), bg2 = g.createLinearGradient(0, JUDGE_Y, 0, JUDGE_Y - 520 * k);
    bg2.addColorStop(0, h.j === 'p' ? 'rgba(255,255,255,.7)' : COLORS[h.lane]); bg2.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = k * 0.6; g.fillStyle = bg2; g.fillRect(x - bw / 2 * k, JUDGE_Y - 520 * k, bw * k, 520 * k);
  }
  for (const r of d.rings) {   // 퍼지는 빛 고리
    const k = r.t / (r.big ? 0.7 : 0.4);
    g.globalAlpha = 1 - k; g.strokeStyle = r.c; g.lineWidth = (r.big ? 8 : 4) * (1 - k) + 1;
    g.beginPath(); g.ellipse(r.x, r.y, 20 + k * (r.big ? 160 : 70), (20 + k * (r.big ? 160 : 70)) * 0.4, 0, 0, TAU); g.stroke();
  }
  for (const p of d.parts) {   // 불꽃 파편(별 모양 섞임)
    g.globalAlpha = Math.min(1, p.life / p.max * 1.6); g.fillStyle = p.c;
    if (p.star) { g.save(); g.translate(p.x, p.y); g.rotate(p.life * 8); g.fillRect(-p.r * 2, -0.8, p.r * 4, 1.6); g.fillRect(-0.8, -p.r * 2, 1.6, p.r * 4); g.restore(); }
    else { g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // DJ 로봇과 체력
  if (d.fog) {   // 구름 띠
    const ya = yOf(0.42), yb = yOf(0.72), fg = g.createLinearGradient(0, ya - 20, 0, yb + 20);
    fg.addColorStop(0, 'rgba(200,190,255,0)'); fg.addColorStop(0.3, 'rgba(200,190,255,.18)'); fg.addColorStop(0.7, 'rgba(200,190,255,.18)'); fg.addColorStop(1, 'rgba(200,190,255,0)');
    g.fillStyle = fg; g.fillRect(0, ya - 20, W, yb - ya + 40);
  }
  const dealt = Math.max(0, score());
  drawDJ(g, W / 2, 112, T, kick);
  rr(g, 90, 176, W - 180, 12, 6); g.fillStyle = 'rgba(0,0,0,.6)'; g.fill();
  rr(g, 90, 176, (W - 180) * Math.max(0, 1 - dealt), 12, 6); g.fillStyle = '#ff5da2'; g.fill();
  text(g, `${d.title} · 🎵 「${d.name}」${d.genre ? ` ${d.genre}` : ''} · Lv ${d.level}`, W / 2, 168, 15, '#ffd6f5', 800);
  // 진행 줄
  const prog = Math.max(0, Math.min(1, (t - d.t0) / (d.end - d.t0)));
  g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, W, 5); g.fillStyle = '#ff6ad5'; g.fillRect(0, 0, W * prog, 5);
  // 카운트다운
  if (t < d.t0) {
    const left = Math.ceil((d.t0 - t) / d.beat);
    text(g, left > 1 ? 'READY' : 'GO!', W / 2, H * 0.48, 72, '#ffffff');
    text(g, '음표가 흰 선에 닿을 때 그 줄을 누르세요', W / 2, H * 0.48 + 56, 18, '#e8d8ff', 700);
    text(g, d.fog ? '긴 음표는 끝까지 누르고 · 구름 속 음표는 소리로!' : d.level >= 2 ? '긴 음표는 꼬리까지 누르고 있기 · 소리를 들으며 편하게' : '소리를 들으며 편하게 즐겨요', W / 2, H * 0.48 + 86, 15, '#ffd6f5', 700);
  }
  // 판정과 콤보
  if (d.judgeT > 0 && d.judge) {
    const col = { PERFECT: '#ffe066', GREAT: '#7fffd4', GOOD: '#9fd0ff', MISS: '#ff7a8a' }[d.judge] || '#ff9a9a';
    const sc = 1 + (d.judgeT / 0.45) * 0.3;
    g.save(); g.translate(W / 2, JUDGE_Y - 150); g.scale(sc, sc); text(g, d.judge, 0, 0, 38, col); g.restore();
  }
  if (d.combo >= 3) {   // 콤보 숫자: 맞힐 때마다 톡 튀고, 높을수록 금빛·무지개
    const sc = 1 + d.popT * 0.25, col = d.fever ? `hsl(${(T * 220) % 360},100%,80%)` : d.combo >= 50 ? '#ffe066' : '#ffffff';
    g.save(); g.translate(W / 2, H * 0.4); g.scale(sc, sc); text(g, String(d.combo), 0, 0, 64, col); g.restore();
    text(g, 'COMBO', W / 2, H * 0.4 + 26, 16, '#ffd6f5', 800);
  }
  if (d.fever) {   // FEVER 표시
    const fk = d.feverT > 0 ? 1 + d.feverT * 0.5 : 1 + kick * 0.08;
    g.save(); g.translate(W / 2, 220); g.scale(fk, fk); text(g, '🔥 FEVER 🔥', 0, 0, 30, `hsl(${(T * 300) % 360},100%,70%)`); g.restore();
  }
  if (d.mile) {   // 콤보 축하
    const mk = d.mile.t / 1.3, sc = 1 + Math.max(0, mk - 0.8) * 3;
    g.globalAlpha = Math.min(1, mk * 2.5);
    g.save(); g.translate(W / 2, H * 0.3); g.scale(sc, sc); text(g, `${d.mile.n} COMBO!`, 0, 0, 56, '#ffe066'); g.restore();
    text(g, d.mile.n >= 100 ? '전설의 손가락!' : d.mile.n >= 50 ? '대단해요!' : d.mile.n >= 25 ? '좋은 흐름!' : '나이스!', W / 2, H * 0.3 + 40, 20, '#ffffff', 800);
    g.globalAlpha = 1;
  }
  if (d.missT > 0) {   // 놓치면 붉은 테두리
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); vg.addColorStop(0, 'rgba(255,0,40,0)'); vg.addColorStop(1, `rgba(255,30,60,${d.missT * 1.2})`);
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  text(g, `${Math.round(dealt * 100)}%`, W - 20, 30, 18, '#ffd6f5', 900, 'right');
  // 결과
  if (d.done && d.res) {
    const r = d.res, k = Math.min(1, d.resT * 3);
    g.globalAlpha = k; g.fillStyle = 'rgba(5,2,18,.75)'; g.fillRect(0, 0, W, H);
    rr(g, 60, H * 0.3, W - 120, 330, 24); g.fillStyle = 'rgba(30,18,64,.95)'; g.fill(); g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.stroke();
    text(g, r.rank === 'D' ? 'DJ가 도망쳤다…' : 'DJ를 이겼다!', W / 2, H * 0.3 + 52, 28, '#ffd6f5');
    text(g, r.rank, W / 2, H * 0.3 + 160, 110, { S: '#ffe066', A: '#7fffd4', B: '#9fd0ff', C: '#d8c8ff', D: '#ff7a8a' }[r.rank]);
    text(g, `PERFECT ${r.p} · GREAT ${r.g} · GOOD ${r.o} · MISS ${r.m}${r.x ? ` · 헛누름 ${r.x}` : ''}`, W / 2, H * 0.3 + 230, 16, '#ffffff', 800);
    text(g, `정확도 ${Math.round(r.acc * 100)}% · 최고 콤보 ${r.maxCombo}`, W / 2, H * 0.3 + 262, 16, '#ffd6f5', 700);
    if (r.m === 0) {   // 하나도 안 놓쳤으면 띠
      const ap = r.g === 0 && r.o === 0, bk = 1 + Math.max(0, 0.5 - d.resT) * 1.5;
      g.save(); g.translate(W / 2, H * 0.3 - 30); g.rotate(-0.05); g.scale(bk, bk);
      rr(g, -170, -30, 340, 56, 14); g.fillStyle = ap ? '#ffe066' : '#ff6ad5'; g.fill();
      text(g, ap ? '✨ ALL PERFECT ✨' : '🎉 FULL COMBO 🎉', 0, 10, 28, '#ffffff'); g.restore();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'lighter';   // 결과 위에도 파편이 튄다
    for (const p of d.parts) { g.globalAlpha = Math.min(1, p.life / p.max * 1.6); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

return {
  start, update, draw, press, pressX, release,
  get active() { return !!d; },
  peek: () => (d ? { notes: d.notes, now: now() } : null),   // 점검용
};
})();
