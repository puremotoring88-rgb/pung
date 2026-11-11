// 볼트윙(by motive) — 소리. 음악 파일 없이 코드로 연주한다(저작권 걱정 없음, 내려받을 것 없음).
// 효과음은 무기·기체마다 다르고, 배경음악은 격납고·스테이지·보스가 다르며 스테이지 배경마다 조(키)가 바뀐다.
window.AudioKit = (() => {
'use strict';
let ac = null, musicBus, sfxBus, musicOn = true, sfxOn = true;
let mood = null, theme = 0, step = 0, nextT = 0, noiseBuf = null, startT = 0;
const last = {};
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function init() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  try { ac = new C(); } catch (e) { return; }
  const comp = ac.createDynamicsCompressor();   // 소리가 겹쳐도 찢어지지 않게
  comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ac.destination);
  const out = ac.createGain(); out.gain.value = 0.9; out.connect(comp);
  musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.3 : 0; musicBus.connect(out);
  sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 0.55 : 0; sfxBus.connect(out);
  setInterval(tick, 25);
  document.addEventListener('visibilitychange', () => { if (ac) (document.hidden ? ac.suspend() : ac.resume()); });
}

function env(g, t, a, d, v) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function osc(bus, type, f0, f1, t, dur, vol, a = 0.004) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, a, dur, vol); o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + dur + 0.05);
}
function noise(bus, t, dur, vol, ftype, f0, f1, q = 1) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.003, dur, vol); s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

// ---------- 효과음 ----------
const SFX = {
  // 무기마다 다른 발사음
  vulcan: t => osc(sfxBus, 'square', 1500, 700, t, 0.035, 0.045),
  spread: t => { noise(sfxBus, t, 0.09, 0.16, 'lowpass', 1400, 300); osc(sfxBus, 'triangle', 180, 70, t, 0.09, 0.14); },
  laser: t => osc(sfxBus, 'sawtooth', 700, 1900, t, 0.07, 0.045),
  missile: t => noise(sfxBus, t, 0.2, 0.12, 'bandpass', 600, 2600, 2),
  drone: t => osc(sfxBus, 'square', 2000, 1400, t, 0.02, 0.02),
  hit: t => osc(sfxBus, 'square', 300, 180, t, 0.03, 0.025),
  boomS: t => noise(sfxBus, t, 0.22, 0.22, 'lowpass', 1600, 200),
  boomL: t => { noise(sfxBus, t, 0.8, 0.5, 'lowpass', 900, 60); osc(sfxBus, 'sine', 90, 30, t, 0.7, 0.45); },
  hurt: t => { noise(sfxBus, t, 0.25, 0.35, 'highpass', 800, 300); osc(sfxBus, 'square', 220, 90, t, 0.2, 0.12); },
  xp: t => osc(sfxBus, 'sine', 1100, 1500, t, 0.05, 0.04),
  scrap: t => { osc(sfxBus, 'triangle', 1300, 1300, t, 0.05, 0.06); osc(sfxBus, 'triangle', 1750, 1750, t + 0.04, 0.06, 0.05); },
  heal: t => [523, 784].forEach((f, i) => osc(sfxBus, 'sine', f, f, t + i * 0.07, 0.14, 0.1)),
  part: t => [660, 880, 1100, 1320, 1760].forEach((f, i) => osc(sfxBus, 'triangle', f, f, t + i * 0.08, 0.2, 0.12)),
  levelup: t => [523, 659, 784, 1047].forEach((f, i) => osc(sfxBus, 'square', f, f, t + i * 0.06, 0.12, 0.06)),
  barrier: t => { osc(sfxBus, 'sine', 900, 300, t, 0.2, 0.12); noise(sfxBus, t, 0.15, 0.1, 'highpass', 3000, 3000); },
  warning: t => { for (let i = 0; i < 4; i++) { osc(sfxBus, 'sawtooth', 440, 440, t + i * 0.5, 0.22, 0.09); osc(sfxBus, 'sawtooth', 330, 330, t + i * 0.5 + 0.25, 0.22, 0.09); } },
  reflect: t => osc(sfxBus, 'triangle', 2400, 3200, t, 0.05, 0.05),
  charge: t => osc(sfxBus, 'sawtooth', 200, 900, t, 0.8, 0.06),
  beam: t => { noise(sfxBus, t, 0.5, 0.2, 'bandpass', 500, 2000, 1); osc(sfxBus, 'sawtooth', 110, 90, t, 0.5, 0.12); },
  clear: t => [523, 659, 784, 1047, 1319].forEach((f, i) => osc(sfxBus, 'triangle', f, f, t + i * 0.12, 0.3, 0.14)),
  fail: t => [392, 349, 311, 262].forEach((f, i) => osc(sfxBus, 'triangle', f, f, t + i * 0.2, 0.35, 0.13)),
  click: t => osc(sfxBus, 'sine', 700, 950, t, 0.04, 0.06),
  tap: t => osc(sfxBus, 'square', 500 + Math.random() * 300, 300, t, 0.04, 0.05),
  net: t => { noise(sfxBus, t, 0.4, 0.25, 'bandpass', 2000, 400, 2); osc(sfxBus, 'sawtooth', 300, 120, t, 0.4, 0.08); },
  escape: t => { noise(sfxBus, t, 0.3, 0.3, 'highpass', 1500, 6000); [784, 1047, 1319].forEach((f, i) => osc(sfxBus, 'triangle', f, f, t + i * 0.05, 0.12, 0.1)); },
  perfect: t => { osc(sfxBus, 'triangle', 1568, 1568, t, 0.12, 0.13); osc(sfxBus, 'sine', 2093, 2093, t + 0.02, 0.1, 0.08); },
  good: t => osc(sfxBus, 'triangle', 1175, 1175, t, 0.1, 0.1),
  rush: t => [392, 523, 659, 784, 1047].forEach((f, i) => osc(sfxBus, 'square', f, f, t + i * 0.07, 0.12, 0.06)),
  buy: t => [880, 1320].forEach((f, i) => osc(sfxBus, 'square', f, f, t + i * 0.05, 0.08, 0.05)),
  // 기체마다 다른 궁극기 소리
  ult_laser: t => { osc(sfxBus, 'sawtooth', 120, 1800, t, 0.6, 0.14); for (let i = 0; i < 10; i++) osc(sfxBus, 'square', 220 + (i % 2) * 30, 220 + (i % 2) * 30, t + 0.4 + i * 0.25, 0.24, 0.05); },
  ult_bulwark: t => { osc(sfxBus, 'sine', 60, 60, t, 1.2, 0.4); [880, 1320, 1760].forEach((f, i) => osc(sfxBus, 'triangle', f, f * 0.98, t + 0.05 * i, 0.9, 0.08)); },
  ult_swarm: t => { for (let i = 0; i < 14; i++) noise(sfxBus, t + i * 0.08, 0.18, 0.1, 'bandpass', 800, 3000, 3); },
  ult_nova: t => { noise(sfxBus, t, 1.4, 0.6, 'lowpass', 2400, 80); [262, 330, 392, 523].forEach(f => osc(sfxBus, 'sine', f, f * 2, t + 0.2, 1.3, 0.07)); },
};
const GAP = { vulcan: 0.05, laser: 0.06, drone: 0.08, hit: 0.04, xp: 0.03, scrap: 0.05, boomS: 0.04, reflect: 0.06, missile: 0.08 };
function sfx(name) {
  if (!ac || !sfxOn || ac.state !== 'running') return;
  const now = ac.currentTime;
  if (GAP[name] && last[name] && now - last[name] < GAP[name]) return;
  last[name] = now;
  try { SFX[name] && SFX[name](now + 0.005); } catch (e) { /* 소리가 안 나도 게임은 계속 */ }
}

// ---------- 배경음악(16분음표 단위로 미리 예약해서 연주) ----------
const MOODS = {
  hangar: { bpm: 92, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], drums: null, bass: 'triangle', arpWave: 'sine', arp: [0, 1, 2, 1], pad: true },
  stage: { bpm: 128, prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], drums: 'beat', bass: 'sawtooth', arpWave: 'square', arp: [0, 1, 2, 3, 2, 1, 0, 1] },
  boss: { bpm: 152, prog: [[0, 3, 7], [0, 3, 7], [8, 12, 15], [10, 14, 17]], drums: 'hard', bass: 'sawtooth', arpWave: 'sawtooth', arp: [0, 2, 1, 3, 0, 2, 1, 3] },
  duel: { bpm: 140, prog: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 11, 14]], drums: 'beat', bass: 'square', arpWave: 'triangle', arp: [0], noArp: true },
};
const ROOTS = [45, 48, 43, 50];   // 스테이지 배경마다 다른 조(A, C, G, D)
function music(m, th) {
  if (!ac) return;
  if (m === mood && (th || 0) === theme) return;
  mood = m; theme = th || 0; step = 0; nextT = ac.currentTime + 0.08; startT = nextT;
}
// 리듬 결투: 박자 수 세기 + 악보의 음표마다 가락을 미리 예약한다. 0번째 박의 시각을 돌려준다
function duel(chart, bpm, countIn) {
  const beat = 60 / bpm;
  if (!ac || ac.state !== 'running') return performance.now() / 1000 + countIn * beat + 0.3;
  MOODS.duel.bpm = bpm;
  mood = 'duel'; theme = 0; step = 0; nextT = ac.currentTime + 0.1; startT = nextT;
  const t0 = startT + countIn * beat;
  for (let i = 0; i < countIn; i++) osc(sfxBus, 'square', i === countIn - 1 ? 1760 : 1320, i === countIn - 1 ? 1760 : 1320, startT + i * beat, 0.06, 0.08);
  const root = 57;
  for (const n of chart) {
    const ch = MOODS.duel.prog[Math.floor(n.b / 4) % 4], t = t0 + n.b * beat;
    const midi = root + 12 + ch[0] + [0, 3, 7, 12][n.lane];
    osc(musicBus, 'square', mtof(midi), mtof(midi), t, beat * (n.len || 0.42), 0.05);
    osc(musicBus, 'triangle', mtof(midi + 12), mtof(midi + 12), t, beat * 0.3, 0.035);
  }
  return t0;
}
// 박자 시계: 리듬 구간의 음표를 음악 박자에 맞추려고 쓴다(소리가 꺼져 있으면 보통 시계로 대신한다)
function clock() {
  if (ac && ac.state === 'running' && mood) return { t: ac.currentTime, bpm: MOODS[mood].bpm, t0: startT };
  return { t: performance.now() / 1000, bpm: 128, t0: 0 };
}
function tick() {
  if (!ac || !mood || ac.state !== 'running') return;
  const M = MOODS[mood], sp = 60 / M.bpm / 4;
  if (nextT < ac.currentTime) nextT = ac.currentTime + 0.02;
  while (nextT < ac.currentTime + 0.12) { playStep(M, step, nextT, sp); nextT += sp; step++; }
}
function playStep(M, s, t, sp) {
  const bar = Math.floor(s / 16) % 4, i = s % 16, ch = M.prog[bar], root = mood === 'hangar' ? 50 : ROOTS[theme % 4];
  if (M.drums) {
    if (i % 4 === 0 && (M.drums === 'hard' || i % 8 === 0 || i === 12)) osc(musicBus, 'sine', 150, 40, t, 0.18, 0.5);
    if (i === 4 || i === 12) { noise(musicBus, t, 0.14, 0.16, 'bandpass', 1800, 1200, 0.8); osc(musicBus, 'triangle', 220, 180, t, 0.08, 0.07); }
    if (M.drums === 'hard' || i % 2 === 0) noise(musicBus, t, 0.04, i % 4 === 2 ? 0.05 : 0.025, 'highpass', 7000, 7000);
  }
  if (i % 2 === 0) {   // 베이스(8분음표)
    const f = mtof(root - 12 + ch[0] + (i % 8 === 6 ? 12 : 0));
    const o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain(), d = sp * 1.8;
    o.type = M.bass; o.frequency.value = f;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(mood === 'boss' ? 1500 : 900, t); fl.frequency.exponentialRampToValueAtTime(200, t + d);
    env(g, t, 0.005, d, mood === 'hangar' ? 0.12 : 0.15);
    o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + d + 0.05);
  }
  const slow = mood === 'hangar';
  if (!M.noArp && (!slow || i % 2 === 0)) {   // 아르페지오
    const k = M.arp[(slow ? i / 2 | 0 : i) % M.arp.length];
    const n = root + 12 + ch[k % 3] + (k === 3 ? 12 : 0);
    osc(musicBus, M.arpWave, mtof(n), mtof(n), t, sp * (slow ? 2.5 : 0.9), slow ? 0.05 : 0.03);
  }
  if (M.pad && i === 0) ch.forEach(c => osc(musicBus, 'sine', mtof(root + c), mtof(root + c), t, sp * 15, 0.035, 0.4));
  if (mood === 'boss' && [0, 3, 6, 10].includes(i)) { const n = root + 24 + ch[(i / 3 | 0) % 3]; osc(musicBus, 'square', mtof(n), mtof(n), t, sp * 1.4, 0.025); }
  if (mood === 'stage' && bar % 2 === 1 && (i === 0 || i === 6 || i === 10)) { const n = root + 24 + ch[(i / 4 | 0) % 3]; osc(musicBus, 'triangle', mtof(n), mtof(n), t, sp * 2.5, 0.035); }
}

return {
  init, sfx, music, clock, duel,
  stopMusic() { mood = null; },
  setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.value = on ? 0.3 : 0; },
  setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.55 : 0; },
};
})();
