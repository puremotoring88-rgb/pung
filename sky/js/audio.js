// 볼트윙(by motive) — 소리. 음악 파일 없이 코드로 연주한다(저작권 걱정 없음, 내려받을 것 없음).
// 효과음은 무기·기체마다 다르고, 배경음악은 격납고·스테이지·보스가 다르며 스테이지 배경마다 조(키)가 바뀐다.
window.AudioKit = (() => {
'use strict';
let ac = null, musicBus, sfxBus, leadBus, padBus, musicOn = true, sfxOn = true;
let mood = null, theme = 0, step = 0, nextT = 0, noiseBuf = null, startT = 0;
let dlNode = null;
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
  // 0.46 고급스러운 울림: 잔향(방 울림)과 메아리. 음악 전체에 조금, 가락에는 메아리까지
  const rev = ac.createConvolver(), ir = ac.createBuffer(2, ac.sampleRate * 2.4, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const dd = ir.getChannelData(c); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / dd.length, 3.2); }
  rev.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.32; rev.connect(wet); wet.connect(out);
  const mSend = ac.createGain(); mSend.gain.value = 0.55; musicBus.connect(mSend); mSend.connect(rev);
  const sSend = ac.createGain(); sSend.gain.value = 0.18; sfxBus.connect(sSend); sSend.connect(rev);
  leadBus = ac.createGain(); leadBus.gain.value = 1; leadBus.connect(musicBus);
  const dl = dlNode = ac.createDelay(1), fb = ac.createGain(), dw = ac.createGain(), dlf = ac.createBiquadFilter(); dl.delayTime.value = 0.3; fb.gain.value = 0.32; dw.gain.value = 0.28; dlf.type = 'lowpass'; dlf.frequency.value = 3200;
  leadBus.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(dw); dw.connect(musicBus);
  padBus = ac.createGain(); padBus.gain.value = 1; padBus.connect(musicBus);
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

// ---------- 0.46 고급 악기: 여러 겹·필터·잔향으로 풍성하게 ----------
function vo(bus, type, f, t, dur, vol, a, det, fl0, fl1, q) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
  let nd = o;
  if (fl0) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = q || 0.7; fl.frequency.setValueAtTime(fl0, t); if (fl1) fl.frequency.exponentialRampToValueAtTime(fl1, t + a + dur); o.connect(fl); nd = fl; }
  env(g, t, a, dur, vol); nd.connect(g); g.connect(bus); o.start(t); o.stop(t + a + dur + 0.05);
}
// kind: saw(슈퍼소우) pad(따뜻한 패드) str(현악) ep(일렉 피아노) pluck(뜯는 소리) bell(종) 그 밖은 기본 파형
function inst(kind, midi, t, dur, vol, bus) {
  bus = bus || leadBus; const f = mtof(midi);
  if (kind === 'saw') { [-14, 0, 14].forEach(d => vo(bus, 'sawtooth', f, t, dur, vol * 0.45, 0.008, d, 3800, 1400, 1)); vo(bus, 'square', f / 2, t, dur, vol * 0.18, 0.008, 0, 1600, 600); }
  else if (kind === 'pad') [-9, 9].forEach(d => vo(bus, 'sawtooth', f, t, dur, vol * 0.5, Math.min(0.45, dur * 0.3), d, 1300, 700));
  else if (kind === 'str') { [-7, 7].forEach(d => vo(bus, 'sawtooth', f, t, dur, vol * 0.45, Math.min(0.25, dur * 0.25), d, 2200, 1200)); vo(bus, 'triangle', f * 2, t, dur, vol * 0.15, 0.2); }
  else if (kind === 'ep') { vo(bus, 'sine', f, t, dur * 1.4, vol, 0.004); vo(bus, 'sine', f * 2, t, dur * 0.5, vol * 0.35, 0.002); vo(bus, 'triangle', f * 4, t, 0.08, vol * 0.12, 0.001); }
  else if (kind === 'pluck') { vo(bus, 'sawtooth', f, t, Math.min(dur, 0.22), vol, 0.002, 0, 4200, 300, 2); vo(bus, 'sawtooth', f, t, Math.min(dur, 0.22), vol * 0.5, 0.002, 10, 4200, 300, 2); }
  else if (kind === 'bell') { vo(bus, 'sine', f, t, dur + 0.6, vol, 0.002); vo(bus, 'sine', f * 2.76, t, 0.4, vol * 0.35, 0.001); vo(bus, 'sine', f * 5.4, t, 0.15, vol * 0.18, 0.001); }
  else osc(bus, kind, f, f, t, dur, vol);
}
// 북을 칠 때 패드 소리를 잠깐 낮춘다(사이드체인: 음악이 숨 쉬듯 출렁임)
function duck(t) { if (!padBus) return; const g = padBus.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.3, t); g.linearRampToValueAtTime(1, t + 0.22); }
function syncEcho(bpm) { if (dlNode) dlNode.delayTime.setValueAtTime(Math.min(0.9, 60 / bpm * 0.75), ac.currentTime); }   // 메아리 = 점8분음표

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
  // 0.46 리듬 연출: 반짝임·콤보 축하·피버·놓침·풀콤보
  sparkle: t => [2637, 3136, 3951].forEach((f, i) => osc(sfxBus, 'sine', f, f, t + i * 0.025, 0.12, 0.035)),
  fanfare: t => { [523, 659, 784, 1047].forEach((f, i) => { osc(sfxBus, 'sawtooth', f, f, t + i * 0.06, 0.18, 0.035); osc(sfxBus, 'triangle', f * 2, f * 2, t + i * 0.06, 0.2, 0.04); }); noise(sfxBus, t + 0.18, 0.5, 0.08, 'highpass', 6000, 9000); },
  fever: t => { osc(sfxBus, 'sawtooth', 200, 1600, t, 0.5, 0.06); noise(sfxBus, t, 0.6, 0.12, 'bandpass', 800, 6000, 1.5); [1047, 1319, 1568, 2093].forEach((f, i) => osc(sfxBus, 'square', f, f, t + 0.45 + i * 0.05, 0.12, 0.04)); },
  miss: t => { osc(sfxBus, 'sawtooth', 160, 70, t, 0.14, 0.06); noise(sfxBus, t, 0.08, 0.06, 'lowpass', 600, 200); },
  fullcombo: t => { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => { osc(sfxBus, 'triangle', f, f, t + i * 0.07, 0.4, 0.09); osc(sfxBus, 'sine', f * 1.5, f * 1.5, t + i * 0.07 + 0.03, 0.3, 0.03); }); noise(sfxBus, t + 0.5, 1.2, 0.1, 'highpass', 5000, 9000); },
  // 기체마다 다른 궁극기 소리
  ult_laser: t => { osc(sfxBus, 'sawtooth', 120, 1800, t, 0.6, 0.14); for (let i = 0; i < 10; i++) osc(sfxBus, 'square', 220 + (i % 2) * 30, 220 + (i % 2) * 30, t + 0.4 + i * 0.25, 0.24, 0.05); },
  ult_bulwark: t => { osc(sfxBus, 'sine', 60, 60, t, 1.2, 0.4); [880, 1320, 1760].forEach((f, i) => osc(sfxBus, 'triangle', f, f * 0.98, t + 0.05 * i, 0.9, 0.08)); },
  ult_swarm: t => { for (let i = 0; i < 14; i++) noise(sfxBus, t + i * 0.08, 0.18, 0.1, 'bandpass', 800, 3000, 3); },
  ult_nova: t => { noise(sfxBus, t, 1.4, 0.6, 'lowpass', 2400, 80); [262, 330, 392, 523].forEach(f => osc(sfxBus, 'sine', f, f * 2, t + 0.2, 1.3, 0.07)); },
};
const GAP = { sparkle: 0.05, miss: 0.12, fanfare: 0.3, vulcan: 0.05, laser: 0.06, drone: 0.08, hit: 0.04, xp: 0.03, scrap: 0.05, boomS: 0.04, reflect: 0.06, missile: 0.08 };
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
// 리듬 곡: 장르마다 화음 진행·북 무늬(16칸: x 크게, o 작게)·베이스·가락 소리가 다르다. 떨어지는 음표가 가락이 된다.
const SONGS = [
  { id: 'neon', name: '네온 질주', genre: '신스팝', k: 1, root: 57, prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], lead: 'square', bass: 'sawtooth',
    pat: { k: 'x...x...x...x...', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' } },
  { id: 'chip', name: '8비트 모험', genre: '칩튠', k: 1.05, root: 60, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], lead: 'square', bass: 'square', bassPat: 'x.o.x.o.x.o.x.o.',
    pat: { k: 'x.......x.x.....', n: '....x.......x...', h: '..o...o...o...o.' } },
  { id: 'house', name: '한밤 클럽', genre: '하우스', k: 0.97, root: 55, prog: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]], lead: 'sawtooth', bass: 'sawtooth', bassPat: '..x...x...x...x.',
    pat: { k: 'x...x...x...x...', s: '....x.......x...', o: '..x...x...x...x.', h: 'o.o.o.o.o.o.o.o.' }, pad: true },
  { id: 'lofi', name: '구름 다방', genre: '로파이', k: 0.8, root: 53, prog: [[0, 4, 11], [5, 9, 16], [2, 5, 12], [7, 11, 17]], lead: 'triangle', bass: 'triangle', bassPat: 'x.....x...x.....', soft: true,
    pat: { k: 'x.......x.x.....', r: '....x.......x...', h: 'o...o.o.o...o.o.' }, pad: true },
  { id: 'rock', name: '불꽃 록', genre: '록', k: 1.06, root: 52, prog: [[0, 7, 12], [10, 17, 22], [8, 15, 20], [7, 14, 19]], lead: 'sawtooth', bass: 'sawtooth', bassPat: 'xxxxxxxxxxxxxxxx',
    pat: { k: 'x.....x.x.......', S: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
  { id: 'tropic', name: '파도 축제', genre: '트로피컬', k: 0.9, root: 62, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], lead: 'triangle', bass: 'sine', bassPat: 'x..x..x.x..x..x.',
    pat: { k: 'x...x...x...x...', s: '...x..x....x..x.', h: '..o...o...o...o.' }, pad: true },
  { id: 'funk', name: '반짝 펑크', genre: '펑크', k: 0.94, root: 55, prog: [[0, 3, 10], [5, 9, 15], [0, 3, 10], [7, 10, 17]], lead: 'square', bass: 'square', bassPat: 'x..x..x...x.x...',
    pat: { k: 'x..x..x...x.....', s: '....x..o....x..o', h: 'oooooooooooooooo' } },
  { id: 'dnb', name: '번개 브레이크', genre: '드럼앤베이스', k: 1.1, root: 50, prog: [[0, 3, 7], [0, 3, 7], [8, 12, 15], [7, 10, 14]], lead: 'sawtooth', bass: 'sine', bassPat: 'x.......x.x.....',
    pat: { k: 'x.........x.....', S: '....x.......x...', h: 'oooooooooooooooo' } },
  // ✨ 0.46 고급 곡: 슈퍼소우·패드·일렉 피아노·종·현악, 4화음, 잔향과 메아리
  { id: 'star', name: '별빛 고속도로', genre: '✨ 신스웨이브', pro: true, k: 0.95, root: 57, prog: [[0, 3, 7, 10], [8, 12, 15, 19], [5, 8, 12, 15], [7, 10, 14, 17]], lead: 'sawtooth', inst: 'saw', bass: 'sawtooth', bassPat: 'x.o.x.o.x.o.x.o.', padInst: 'pad', pad: true,
    arp: [0, 1, 2, 3, 2, 1, 2, 3], arpInst: 'pluck', pat: { k: 'x...x...x...x...', S: '....x.......x...', h: '..o...o...o...o.' } },
  { id: 'candy', name: '솜사탕 은하', genre: '✨ 퓨처베이스', pro: true, k: 0.9, root: 60, prog: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]], lead: 'sawtooth', inst: 'bell', bass: 'sine', bassPat: 'x..x..x...x.....', padInst: 'pad', pad: true,
    chordPat: 'x..x..x...x.x...', chordInst: 'saw', pat: { k: 'x.....x...x.....', S: '....x.......x...', h: 'o.o.o.o.o.o.o.o.', o: '..............x.' } },
  { id: 'lounge', name: '달빛 라운지', genre: '✨ 재즈 소울', pro: true, k: 0.8, root: 50, prog: [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 12, 16, 19]], lead: 'triangle', inst: 'ep', bass: 'triangle', bassPat: 'x...x.o...x.x...', soft: true, padInst: 'str', pad: true,
    chordPat: 'x.....x...x.....', chordInst: 'ep', pat: { k: 'x.......x.x.....', r: '....x.......x...', h: 'o.oo.o.oo.o.oo.o' } },
  { id: 'hero', name: '영웅의 비상', genre: '✨ 시네마틱', pro: true, k: 1, root: 50, prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], lead: 'triangle', inst: 'bell', bass: 'sawtooth', bassPat: 'x.x.x.x.x.x.x.x.', padInst: 'str', pad: true,
    arp: [0, 1, 2, 1], arpInst: 'pluck', pat: { k: 'x.....x.x.......', T: '..........x.x.xx', S: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' } },
  { id: 'aurora', name: '오로라 트랜스', genre: '✨ 트랜스', pro: true, k: 1.08, root: 57, prog: [[0, 3, 7], [5, 8, 12], [8, 12, 15], [7, 11, 14]], lead: 'sawtooth', inst: 'saw', bass: 'sawtooth', bassPat: '..xx..xx..xx..xx', padInst: 'pad', pad: true,
    arp: [0, 1, 2, 3, 2, 1, 2, 3], arpInst: 'pluck', pat: { k: 'x...x...x...x...', s: '....x.......x...', o: '..x...x...x...x.', h: 'oxoxoxoxoxoxoxox' } },
];
const ROOTS = [45, 48, 43, 50, 41, 52, 40, 47, 53];   // 스테이지 배경마다 다른 조(A, C, G, D)
// 맵마다 다른 음악: 빠르기·화음·북 무늬·악기·가락(mel: 마디마다 16칸, 숫자 = 그 마디 화음의 몇 번째 음(3~5는 한 옥타브 위), '-' 늘임, '.' 쉼)
const MAPMUS = [
  { nm: '바다 섬', bpm: 124, root: 57, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bass: 'sine', bassPat: 'x..x..x.x..x..x.', arpWave: 'triangle', arp: [0, 1, 2, 1], arpHalf: true, lead: 'square', pad: true,
    pat: { k: 'x...x...x...x...', s: '...x..x....x..x.', h: '..o...o...o...o.' }, mel: ['0-2.1.3-..2.1.0.', '3-.2.1.0-..1.2-.'] },
  { nm: '사막', bpm: 112, root: 52, prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [10, 13, 17]], bass: 'triangle', bassPat: 'x.....x...x.....', arpWave: 'sawtooth', arp: [0, 1, 2, 1, 0, 2], lead: 'triangle', pad: true,
    pat: { k: 'x.....x...x.....', r: '....x.......x.x.', h: 'o..o..o.o..o..o.' }, mel: ['0--.1.0.2---1.0.', '3--.2.1.0---....'] },
  { nm: '밤 도시', bpm: 118, root: 55, prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], bass: 'sawtooth', bassPat: 'x.o.x.o.x.o.x.o.', arpWave: 'square', arp: [0, 1, 2, 3, 2, 1, 0, 1], lead: 'sawtooth', pad: true,
    pat: { k: 'x...x...x...x...', s: '....x.......x...', h: '..o...o...o...o.' }, mel: ['3-.3-.2-1-0-....', '2-.2-.1-0-1-....'] },
  { nm: '우주', bpm: 100, root: 50, prog: [[0, 4, 11], [2, 5, 9], [7, 11, 14], [5, 9, 16]], bass: 'sine', bassPat: 'x.......x.......', arpWave: 'sine', arp: [0, 2, 1, 3], lead: 'sine', soft: true, pad: true,
    pat: { k: 'x.........x.....', h: 'o...o...o...o...' }, mel: ['0-------2-------', '1-------3-------'] },
  { nm: '공장', bpm: 132, root: 48, prog: [[0, 3, 7], [0, 3, 7], [6, 10, 13], [5, 8, 12]], bass: 'square', bassPat: 'x.xox.xox.xox.xo', arpWave: 'square', arp: [0, 0, 2, 0, 1, 0, 3, 0], lead: 'square',
    pat: { k: 'x..x..x.x..x..x.', S: '....x.......x...', n: '..x...x...x...xx', h: 'oooooooooooooooo' }, mel: ['0.0.3.0.0.2.0.1.', '0.0.3.0.2.1.0...'] },
  { nm: '설원', bpm: 108, root: 59, prog: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], bass: 'triangle', bassPat: 'x.......x...x...', arpWave: 'sine', arp: [0, 2, 3, 2, 1, 2, 3, 2], lead: 'triangle', soft: true, pad: true,
    pat: { k: 'x.......x.x.....', r: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' }, mel: ['5.4.3.2.3...1...', '4.3.2.1.2.......'] },
  { nm: '화산', bpm: 140, root: 52, prog: [[0, 7, 12], [1, 8, 13], [0, 7, 12], [10, 17, 22]], bass: 'sawtooth', bassPat: 'xxxxxxxxxxxxxxxx', arpWave: 'sawtooth', arp: [0, 1, 0, 2], arpHalf: true, lead: 'sawtooth',
    pat: { k: 'x.x...x.x.x...x.', S: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, mel: ['0-..0-..1-2-3---', '3-..2-..1-0-....'] },
  { nm: '정글', bpm: 116, root: 53, prog: [[0, 3, 7], [10, 14, 17], [8, 12, 15], [10, 14, 17]], bass: 'sine', bassPat: 'x..x..x...x.x...', arpWave: 'triangle', arp: [0, 2, 1, 2], arpHalf: true, lead: 'triangle',
    pat: { k: 'x..x..x...x..x..', r: '..x...x.x...x..x', s: '....x.......x...', h: 'o.oo.o.oo.o.oo.o' }, mel: ['0..1..2.3..2..1.', '2..1..0...1.2...'] },
  { nm: '구름 위 성', bpm: 120, root: 60, prog: [[0, 4, 7], [5, 9, 12], [2, 5, 9], [7, 11, 14]], bass: 'triangle', bassPat: 'x...x...x...x...', arpWave: 'triangle', arp: [0, 1, 2, 3], lead: 'square', pad: true,
    pat: { k: 'x.......x.......', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.', o: '..........x.....' }, mel: ['0---1---2---3---', '4---3---2-1-0---'] },
];
const BOSS_PAT = { k: 'x.x.x.x.x.x.x.x.', S: '....x.......x...', h: 'xoxoxoxoxoxoxoxo' };
// 탈출 작전: 모험 느낌의 경쾌한 곡
const ESC_MUS = { bpm: 136, root: 57, prog: [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]], bass: 'square', bassPat: 'x.o.x.o.x.o.x.o.', arpWave: 'triangle', arp: [0, 1, 2, 1], arpHalf: true, lead: 'square', pad: true,
  pat: { k: 'x...x...x...x...', s: '....x.......x..o', h: 'o.x.o.x.o.x.o.x.' }, mel: ['0.1.2.3-2.1.2---', '3.2.1.0-1.2.3---'] };
function music(m, th) {
  if (!ac) return;
  if (m === mood && (th || 0) === theme) return;
  const mm = MAPMUS[(th || 0) % MAPMUS.length];
  if (m === 'stage') MOODS.stage = Object.assign({ drums: 'beat' }, mm);
  if (m === 'boss') MOODS.boss = Object.assign({ drums: 'hard' }, mm, { bpm: Math.min(160, mm.bpm + 24), pat: Object.assign({}, mm.pat, BOSS_PAT), arpWave: 'sawtooth', arp: [0, 2, 1, 3, 0, 2, 1, 3], arpHalf: false, soft: false, stab: true });
  if (m === 'escape') MOODS.escape = Object.assign({ drums: 'beat' }, ESC_MUS);
  mood = m; theme = th || 0; step = 0; nextT = ac.currentTime + 0.08; startT = nextT;
  if (MOODS[m]) syncEcho(MOODS[m].bpm);
}
// 리듬 결투: 박자 수 세기 + 악보의 음표마다 가락을 미리 예약한다. 0번째 박의 시각을 돌려준다
function duel(chart, bpm, countIn, song) {
  const beat = 60 / bpm, S = song || SONGS[0];
  if (!ac || ac.state !== 'running') return performance.now() / 1000 + countIn * beat + 0.3;
  MOODS.duel = { bpm, prog: S.prog, root: S.root, pat: S.pat, bass: S.bass, bassPat: S.bassPat, soft: S.soft, pad: S.pad, padInst: S.padInst, noArp: !S.arp, arp: S.arp, arpWave: 'triangle', arpInst: S.arpInst, chordPat: S.chordPat, chordInst: S.chordInst, drums: 'beat' };
  syncEcho(bpm);
  mood = 'duel'; theme = 0; step = 0; nextT = ac.currentTime + 0.1; startT = nextT;
  const t0 = startT + countIn * beat;
  for (let i = 0; i < countIn; i++) osc(sfxBus, 'square', i === countIn - 1 ? 1760 : 1320, i === countIn - 1 ? 1760 : 1320, startT + i * beat, 0.06, 0.08);
  const lv = S.soft ? 0.7 : 1;
  for (const n of chart) {   // 줄마다 그 마디 화음의 음: 1·3·5도와 한 옥타브 위
    const ch = S.prog[Math.floor(n.b / 4) % 4], t = t0 + n.b * beat;
    const midi = S.root + 12 + [ch[0], ch[1], ch[2], ch[0] + 12][n.lane];
    if (S.inst) inst(S.inst, midi, t, beat * (n.len || 0.45), (S.inst === 'saw' ? 0.05 : S.inst === 'ep' ? 0.08 : 0.07) * lv);
    else osc(leadBus, S.lead, mtof(midi), mtof(midi), t, beat * (n.len || (S.lead === 'triangle' ? 0.3 : 0.42)), (S.lead === 'sawtooth' ? 0.04 : 0.05) * lv);
    osc(musicBus, 'triangle', mtof(midi + 12), mtof(midi + 12), t, beat * 0.3, 0.035 * lv);
  }
  return t0;
}
// 박자 시계: 리듬 구간의 음표를 음악 박자에 맞추려고 쓴다(소리가 꺼져 있으면 보통 시계로 대신한다)
function clock() {
  if (ac && ac.state === 'running' && mood) return { t: ac.currentTime, bpm: MOODS[mood].bpm, t0: startT, lat: Math.min(0.3, (ac.outputLatency || 0) + (ac.baseLatency || 0)) };   // lat: 예약한 소리가 실제로 귀에 들리기까지 늦는 시간
  return { t: performance.now() / 1000, bpm: 128, t0: 0 };
}
function tick() {
  if (!ac || !mood || ac.state !== 'running') return;
  const M = MOODS[mood], sp = 60 / M.bpm / 4;
  if (nextT < ac.currentTime) nextT = ac.currentTime + 0.02;
  while (nextT < ac.currentTime + 0.12) { playStep(M, step, nextT, sp); nextT += sp; step++; }
}
function playStep(M, s, t, sp) {
  const bar = Math.floor(s / 16) % 4, i = s % 16, ch = M.prog[bar], root = M.root ? M.root - 12 : mood === 'hangar' ? 50 : ROOTS[theme % ROOTS.length];
  if (M.pat) {   // 리듬 곡의 북 무늬
    const P = M.pat, on = (p, ...c) => p && c.includes(p[i]), sv = M.soft ? 0.55 : 1;
    if (on(P.k, 'x')) { osc(musicBus, 'sine', M.soft ? 110 : 150, 40, t, 0.18, 0.5 * sv); osc(musicBus, 'triangle', 2400, 600, t, 0.012, 0.06 * sv); duck(t); }
    if (on(P.T, 'x')) { const tf = 190 - i * 5; osc(musicBus, 'sine', tf, tf * 0.6, t, 0.22, 0.32); noise(musicBus, t, 0.08, 0.06, 'lowpass', 900, 300); }
    if (on(P.s, 'x')) { noise(musicBus, t, 0.14, 0.16, 'bandpass', 1800, 1200, 0.8); osc(musicBus, 'triangle', 220, 180, t, 0.08, 0.07); }
    if (on(P.s, 'o')) noise(musicBus, t, 0.06, 0.05, 'bandpass', 2000, 1600, 0.8);
    if (on(P.S, 'x')) { noise(musicBus, t, 0.2, 0.22, 'bandpass', 1500, 900, 0.6); osc(musicBus, 'triangle', 200, 150, t, 0.1, 0.1); }
    if (on(P.n, 'x')) noise(musicBus, t, 0.1, 0.12, 'highpass', 3000, 3000);
    if (on(P.r, 'x')) osc(musicBus, 'square', 900, 700, t, 0.03, 0.05);
    if (on(P.h, 'x', 'o')) noise(musicBus, t, 0.04, (P.h[i] === 'x' ? 0.05 : 0.025) * sv, 'highpass', 7000, 7000);
    if (on(P.o, 'x')) noise(musicBus, t, 0.16, 0.04, 'highpass', 6000, 6000);
    const bp = M.bassPat || 'x.x.x.x.x.x.x.x.';
    if (bp[i] !== '.') {
      const f = mtof(root + ch[0] + (bp[i] === 'o' ? 12 : 0)), o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain(), dd = sp * 1.8;
      o.type = M.bass; o.frequency.value = f;
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(M.soft ? 500 : 1000, t); fl.frequency.exponentialRampToValueAtTime(200, t + dd);
      env(g, t, 0.005, dd, M.soft ? 0.12 : 0.15);
      o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dd + 0.05);
    }
    if (M.pad && i === 0) ch.forEach(c => inst(M.padInst || 'pad', root + 12 + c, t, sp * 15, (M.soft ? 0.022 : 0.028) * (ch.length > 3 ? 0.8 : 1), padBus));
    if (M.chordPat && M.chordPat[i] === 'x') ch.forEach(c => inst(M.chordInst || 'saw', root + 24 + c, t, sp * 1.6, (M.chordInst === 'ep' ? 0.035 : 0.022), padBus));
    if (M.arp && !M.noArp && (!M.arpHalf || i % 2 === 0)) {   // 맵 음악의 아르페지오
      const k = M.arp[(M.arpHalf ? i / 2 | 0 : i) % M.arp.length], n = root + 12 + ch[k % 3] + (k >= 3 ? 12 : 0);
      if (M.arpInst) inst(M.arpInst, n + 12, t, sp * (M.arpHalf ? 1.8 : 0.9), 0.03, padBus); else osc(musicBus, M.arpWave, mtof(n), mtof(n), t, sp * (M.arpHalf ? 1.8 : 0.9), (M.soft ? 0.022 : 0.026));
    }
    if (M.mel) {   // 가락: 화음의 음을 고르고 '-'만큼 늘인다
      const ln = M.mel[bar % M.mel.length], c = ln[i];
      if (c >= '0' && c <= '5') {
        const d = +c, n = root + 24 + ch[d % 3] + (d >= 3 ? 12 : 0); let len = 1; while (ln[i + len] === '-') len++;
        osc(leadBus, M.lead || 'square', mtof(n), mtof(n), t, sp * len * 0.92, M.lead === 'sawtooth' ? 0.024 : M.lead === 'sine' ? 0.045 : 0.03);
      }
    }
    if (M.stab && [0, 3, 6, 10].includes(i)) { const n = root + 24 + ch[(i / 3 | 0) % 3]; osc(musicBus, 'square', mtof(n), mtof(n), t, sp * 1.4, 0.022); }
    return;
  }
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
  if (M.pad && i === 0) ch.forEach(c => inst('pad', root + c, t, sp * 15, 0.032, padBus));
  if (mood === 'boss' && [0, 3, 6, 10].includes(i)) { const n = root + 24 + ch[(i / 3 | 0) % 3]; osc(musicBus, 'square', mtof(n), mtof(n), t, sp * 1.4, 0.025); }
  if (mood === 'stage' && bar % 2 === 1 && (i === 0 || i === 6 || i === 10)) { const n = root + 24 + ch[(i / 4 | 0) % 3]; osc(musicBus, 'triangle', mtof(n), mtof(n), t, sp * 2.5, 0.035); }
}

// 연속 처치: 콤보가 오를수록 한 음씩 올라가는 맑은 소리(5음계)
const PENTA = [0, 2, 4, 7, 9];
function chain(n) {
  if (!ac || !sfxOn || ac.state !== 'running') return;
  const t = ac.currentTime + 0.005; if (last.chain && t - last.chain < 0.045) return; last.chain = t;
  const k = Math.min(n, 24), st = PENTA[k % 5] + 12 * Math.floor(k / 5), f = 523 * Math.pow(2, Math.min(st, 24) / 12);
  try { osc(sfxBus, 'triangle', f, f, t, 0.09, 0.05); osc(sfxBus, 'sine', f * 2, f * 2, t, 0.06, 0.018); } catch (e) {}
}

return {
  init, sfx, chain, music, clock, duel, SONGS,
  stopMusic() { mood = null; },
  setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.value = on ? 0.3 : 0; },
  setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.55 : 0; },
};
})();
