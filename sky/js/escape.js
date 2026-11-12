// 볼트윙 「탈출 작전」 시험판(로드맵 9-1): 오른쪽으로 나아가는 한 손가락 모드.
// 비행기(자유 조종) → 비상 탈출 → 로프(한 번 누르면 앞 위 고리로 발사·그네, 또 누르면 끊고 날아감) → 새·보스 기계 탈것 → 다시 로프 …
// 그림은 보스·기체 그림을 돌려 쓰고, 없으면 도형. 탈것(9-3): 새·거미·고래·기사·코어.
window.Escape = (() => {
'use strict';
const W = 540, H = 960, TAU = Math.PI * 2, GROUND = H - 70;
const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 손맛 숫자(해 보고 조정)
const K = {
  g: 1500,              // 사람 중력
  ropeMin: 90,          // 로프 가장 짧은 길이
  ropeReach: 460,       // 로프가 닿는 거리
  pump: 300,            // 매달려 흔들 때 더해지는 힘(흔들리는 방향으로)
  swing: 560,           // 이 빠르기까지만 밀어 준다(그네가 한없이 커지지 않게)
  reel: 70,             // 누르고 있으면 로프가 감기는 빠르기(짧을수록 빨리 돈다)
  flyRise: 1700, flySink: 1150, flyMax: 520,   // 비행기
  birdFlap: 400, birdG: 1250, birdEvery: 0.2,  // 새: 누르고 있으면 0.2초마다 날갯짓
  segPlane: 3600, segRope: 4200, segBird: 3600, // 구간 길이(px). 0.36: 1900·2600·1900 → 더 길게(한 방식에 익숙해질 시간)
  flyX: 300, flyY: 420,                         // 비행기 앞뒤·위아래 빠르기
  stars: [300, 900, 1800],                      // 별 ⭐ 거리(m)
  trouble: 380,                                 // 비행기 구간이 끝나기 이만큼(px) 앞에서 엔진 고장
  coreG: 1100, coreMax: 430,                    // 코어 요새 중력·최대 빠르기(0.34: 1700·620 → 느리게)
  easy: { time: 0.7, reach: 580, hearts: 5, inv: 2, scrap: 0.6 },   // 🐢 연습 모드: 시간 0.7배, 로프 닿는 거리, 하트, 맞은 뒤 무적, 고철 배수
};
let cv, g, box, cb = {}, on = false, raf = 0, last = 0;
let st, P, cam, items, hold = false, holdT = 0, msgs, parts, t, wrecks = [];

// 씨앗(seed)이 같으면 맵이 똑같다 → 유령·친구와 같은 길을 달린다
let seedRng = Math.random;
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let q = Math.imul(a ^ a >>> 15, 1 | a); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; };
const srnd = (a, b) => a + seedRng() * (b - a);
const PH_ID = ['plane', 'rope', 'bird', 'spider', 'whale', 'knight', 'core', 'twins'];
let opt = {}, others = [], netT = 0, pathT = 0, rankT = 0, ptr = null, keys = {};   // ptr: 화면을 누른 손가락(비행기 끌기), keys: 방향키
// opt.seed: 맵 씨앗 · opt.ghost: {seed, path, dist} 내 최고 기록 유령 · opt.race: {others(), send(o), host, again(), done(rank, n)} 친구와 같이 달리기
function start(callbacks, o) {
  cb = callbacks || {}; opt = o || {};
  if (!box) build();
  box.classList.remove('hidden'); box.querySelector('.esRes').classList.add('hidden');
  t = 0; cam = 0; items = []; msgs = []; parts = []; others = []; netT = 0; pathT = 0; keys = {}; ptr = null;
  const seed = opt.seed != null ? opt.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
  seedRng = mulberry(seed);
  st = { phase: 'plane', segEnd: K.segPlane, loop: 0, hearts: 3, inv: 1.5, coins: 0, dist: 0, genX: 600, over: false, hintT: 0, seen: {}, stars: 0, slow: 0, shake: 0, flash: 0, rides: [], best: cb.best ? cb.best() : 0, passBest: false, seed, path: [], raceDone: false };
  wrecks = [];
  st.easy = !opt.race && !opt.ghost && (opt.easy != null ? !!opt.easy : !!(cb.easy && cb.easy())); st.maxH = st.easy ? K.easy.hearts : 3; st.hearts = st.maxH;   // 🐢 연습 모드
  P = { x: 160, y: 420, vx: 300, vy: 0, rope: null, flapT: 0, tilt: 0 };
  banner(opt.race ? '🏃 친구와 같이 달리기!' : opt.ghost ? '👻 유령과 달리기' : '✈️ 비행 구간', opt.race ? '모두 같은 맵이에요 · 가장 멀리 간 사람이 1등' : opt.ghost ? `최고 기록(${opt.ghost.dist.toLocaleString()} m) 때와 같은 맵이에요` : (matchMedia('(pointer: coarse)').matches ? '화면을 누른 채 끌면 비행기가 따라와요(위아래·앞뒤)' : '방향키·WASD로 위아래·앞뒤 · 스페이스는 위로'));
  if (st.easy) say('🐢 연습 모드: 느리게 · 하트 5개', '#9dffcf');
  const R = box.querySelector('.esRes'); R.querySelector('.esAgain').classList.toggle('hidden', !!(opt.race && !opt.race.host));
  R.querySelector('.esAgain').textContent = opt.race ? '다 같이 다시 ▶' : '다시 ▶';
  on = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function build() {
  box = document.createElement('div'); box.id = 'escape'; box.className = 'hidden';
  box.innerHTML = `<canvas width="${W}" height="${H}"></canvas><button class="esQuit">✕</button>
    <div class="esRes hidden"><h2>탈출 작전</h2><div class="esStat"></div><div class="esRank"></div><div class="row"><button class="btn big esAgain">다시 ▶</button><button class="btn sub esEasy"></button><button class="btn sub esGhost hidden">👻 유령과 달리기</button><button class="btn sub esHome">격납고로</button></div><small class="esTip"></small><details class="esHelp"><summary>❓ 조작법</summary><div>✈️ <b>비행기</b>: 누른 채 끌기(PC는 방향키·WASD). 놓으면 그 자리에 떠 있어요.<br>🪢 <b>로프</b>: 노랗게 빛나는 고리가 보일 때 <b>한 번 누르면</b>(스페이스·화면 톡) 로프가 날아가 걸리고, 그네처럼 앞뒤로 계속 흔들려요. 앞쪽 위로 올라가는 순간 <b>한 번 더 누르면</b> 로프가 끊기고 멀리 날아가요. 날아가는 중에 또 누르면 다음 고리. 너무 일찍 끊으면 아래로 떨어져요.<br>🐦 <b>새</b>: 누르고 있으면 날갯짓 · 🕷️ <b>거미</b>: 누를 때마다 천장↔바닥 · 🐋 <b>고래</b>: 누르면 오름 · ⚔️ <b>기사</b>: 누르면 돌진 · 🚀 <b>쌍둥이</b>: 누르고 있으면 오름, 누르면 대포<br>💠 <b>코어</b>: 누를 때마다 중력이 위↔아래로 바뀌어요(옆 화살표 쪽으로 떨어짐). 계속 위로 올라가 있으면 다시 한 번 눌러 내려오세요. 기둥의 빈틈 높이에 맞춰 눌러 주면 돼요.<br>🐢 처음엔 <b>연습 모드</b>(느리게·하트 5개, 고철은 조금 덜)로 익혀 보세요.</div></details></div>`;
  document.getElementById('stage').append(box);
  cv = box.querySelector('canvas'); g = cv.getContext('2d');
  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const down = e => { if (!on || st.over) return; e.preventDefault(); const [x, y] = at(e); ptr = { sx: x, sy: y, x, y, ox: P.x - cam, oy: P.y }; press(true); };
  const move = e => { if (!on || !ptr) return; const [x, y] = at(e); ptr.x = x; ptr.y = y; };
  const up = e => { if (!on) return; e.preventDefault(); ptr = null; press(false); };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  const KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowDown: 'd', KeyS: 'd', KeyW: 'u' };
  window.addEventListener('keydown', e => { if (!on) return; if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); e.stopImmediatePropagation(); } if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat && !st.over) press(true); } if (e.code === 'Escape') { e.stopImmediatePropagation(); finish(true); } }, true);
  window.addEventListener('keyup', e => { if (!on) return; if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = false; e.stopImmediatePropagation(); } if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') { e.stopImmediatePropagation(); press(false); } }, true);
  box.querySelector('.esQuit').addEventListener('click', () => finish(true));
  box.querySelector('.esAgain').addEventListener('click', () => { if (opt.race) opt.race.again(); else start(cb); });
  box.querySelector('.esGhost').addEventListener('click', () => { const gh = ghost(); if (gh) start(cb, { seed: gh.seed, ghost: gh }); });
  box.querySelector('.esHome').addEventListener('click', () => { close(); });
  box.querySelector('.esEasy').addEventListener('click', () => { const v = !(cb.easy && cb.easy()); if (cb.setEasy) cb.setEasy(v); easyBtn(); });
}
const GHOST_V = 2;   // 구간 길이 등 맵 만드는 법이 바뀌면 올린다(옛 유령은 맵이 달라 버림)
const ghost = () => { const g0 = cb.loadGhost && cb.loadGhost(); return g0 && g0.v === GHOST_V ? g0 : null; };
function easyBtn() { const b = box.querySelector('.esEasy'), v = !!(cb.easy && cb.easy()); b.textContent = v ? '🐢 연습 모드 켜짐(느리게·하트 5)' : '🐢 연습 모드 꺼짐'; b.classList.toggle('hidden', !!opt.race); }
function close() { on = false; cancelAnimationFrame(raf); box.classList.add('hidden'); if (opt.race && opt.race.leave) opt.race.leave(); opt = {}; if (cb.home) cb.home(); }
function press(v) {
  if (v === hold) return; hold = v; holdT = 0;
  if (st.riding) { if (v) helpPress(); return; }   // 같이 탄 사람: 누르면 돕기
  if (st.phase === 'rope' && v) { if (P.rope) letGo(); else shoot(); }   // 0.36: 한 번 누르면 로프 발사, 매달린 채 또 누르면 끊고 날아감
  if (st.phase === 'bird' && v) { flap(); st.dFlapT = t; if (st.pass && t - (st.pFlapT || -9) < 0.15) syncFlap(); }
  if (v && st.phase === 'spider') { P.side = -P.side; P.vy = P.side * -200; sfx('flap'); }
  if (v && st.phase === 'knight' && !(P.dashT > 0) && !(P.dashCd > 0)) { P.dashT = 0.32; P.dashCd = 0.55; P.vy = -430; sfx('release'); }
  if (v && st.phase === 'core') { P.gdir = -P.gdir; sfx('flap'); }
  if (v && st.phase === 'twins') { if (st.ammo > 0) { st.muzzle = 0.18; sfx('boom'); if (breakAhead(true)) st.ammo--; } else { say('장전 중…', '#ffb3b3'); } }
}
// ---------- 로프 ----------
const reach = () => (st.easy ? K.easy.reach : K.ropeReach);
function shoot() {
  const best = aimAnchor();
  if (!best) { say('닿는 고리가 없어요!', '#ffb3b3'); P.miss = 0.25; return; }
  grab(best);
}
function aimAnchor() {   // 지금 누르면 걸릴 고리(화면에 노랗게 표시)
  let best = null, bs = 1e9;
  for (const it of items) {
    if (it.k !== 'anchor' || it.gone || it.x < P.x - 40 || it.y > P.y - 20) continue;
    const d = Math.hypot(it.x - P.x, it.y - P.y); if (d > reach()) continue;
    const s = d - (it.x - P.x) * 0.6;   // 앞쪽 고리를 더 좋아한다
    if (s < bs) { bs = s; best = it; }
  }
  for (const o of others) {   // 친구도 걸이점이 된다(풍선이 된 친구를 걸면 구출)
    if (o.over || o.x < P.x - 40 || o.y > P.y - 20) continue;
    const d = Math.hypot(o.x - P.x, o.y - P.y); if (d > reach()) continue;
    const s = d - (o.x - P.x) * 0.6 - (o.bl ? 200 : 0);
    if (s < bs) { bs = s; best = { k: 'friend', fid: o.id, x: o.x, y: o.y }; }
  }
  return best;
}
function grab(best) {
  P.rope = { a: best, L: Math.max(K.ropeMin, Math.hypot(best.x - P.x, best.y - P.y)) }; P.rope.L0 = P.rope.L;
  best.used = true; sfx('rope');
  if (best.fid) {
    const o = others.find(q => q.id === best.fid);
    if (o && o.bl) rescue(o); else { say(`🤝 ${o ? o.name : '친구'}에게 로프!`, '#9dffcf'); netEv(best.fid, 'tug'); }
  }
}
// ---------- 친구와 주고받기(같이 달리기) ----------
const rescT = {};
function netEv(to, k) { if (opt.race && opt.race.event) opt.race.event(to, { k }); }
function rescue(o) {   // 풍선이 된 친구를 구한다(같은 친구는 2초에 한 번)
  if ((rescT[o.id] || 0) > t) return;
  rescT[o.id] = t + 2; netEv(o.id, 'rescue'); st.coins += 3; st.saved = (st.saved || 0) + 1;
  say(`🎈 ${o.name} 구출! 🪙+3`, '#9dffcf'); sfx('star'); spark(o.x, o.y, '#9dffcf', 20);
}
function netEvent(from, e) {   // 친구가 보낸 일
  if (!st || !e || !opt.race) return;
  const o = others.find(q => q.id === from), nm = o ? o.name : '친구';
  if (e.k === 'tug' && !st.over && !st.balloon) { P.vx += 90; say(`💪 ${nm}이(가) 매달려 밀어 줬어요!`, '#9dffcf'); }
  if (e.k === 'rescue' && st.balloon > 0) {
    st.balloon = 0; st.hearts = 1; st.inv = 2.2; st.rescued = (st.rescued || 0) + 1; P.vy = -420; P.vx = 320; P.rope = null;
    banner(`🎈 ${nm}이(가) 구해 줬어요!`, '하트 1개로 다시 달려요'); sfx('star'); spark(P.x, P.y, '#9dffcf', 24);
  }
  // 둘이 타기
  if (e.k === 'board' && !st.over && !st.balloon && !st.riding && !st.pass && RIDE2(st.phase)) { st.pass = from; st.passT = t; netEv(from, 'boardOk'); say(`👥 ${nm} 탑승!`, '#9dffcf'); sfx('star'); }
  if (e.k === 'boardOk' && st.boardAsk === from && !st.riding && RIDE2(st.phase) && !st.over && !st.balloon) {
    st.riding = from; st.boardAsk = null; P.rope = null;
    banner(`👥 ${nm}의 탈것에 같이 탔어요!`, st.phase === 'bird' ? '누르면 같이 날갯짓 · 앞사람과 동시에 누르면 훨씬 높이!' : '누르면 앞 기둥 부수기(2초마다) · 몰기는 앞사람이 해요'); sfx('star');
  }
  if (e.k === 'unboard' && st.pass === from) { st.pass = null; say(`👥 ${nm}이(가) 내렸어요`, '#e6eefa'); }
  if (e.k === 'help' && st.pass === from && !st.over) breakAhead(false);
  if (e.k === 'flap' && st.pass === from && st.phase === 'bird' && !st.over) {
    st.pFlapT = t;
    if (t - (st.dFlapT || -9) < 0.15) syncFlap(); else { P.vy = Math.min(P.vy, 0) - 160; }   // 박자가 안 맞아도 조금은 띄워 준다
  }
}
// 둘이 타기(9-5c): 같은 종류의 탈것을 탄 친구에게 뒤에서 닿으면 그 탈것에 같이 탄다. 앞사람이 몰고, 뒷사람은 돕는다
const RIDE2 = ph => RIDES.includes(ph);   // 새도 함께
function helpPress() {
  if (!st.riding || t < (st.helpT || 0)) return;
  if (st.phase === 'bird') { st.helpT = t + 0.18; netEv(st.riding, 'flap'); sfx('flap'); say('🎵', '#ffe066'); return; }
  st.helpT = t + 2; netEv(st.riding, 'help'); breakAhead(true);
}
function breakAhead(mine) {   // 앞 450px 안의 기둥 중 가장 가까운 것을 부순다(씨앗이 같아서 양쪽 맵에 같은 기둥이 있다)
  let best = null;
  for (const it of items) if (it.k === 'wall' && !it.gone && it.x > P.x - 10 && it.x < P.x + 450 && (!best || Math.abs(it.x - P.x) + Math.abs(clamp(P.y, it.top, it.bot) - P.y) * 0.5 < Math.abs(best.x - P.x) + Math.abs(clamp(P.y, best.top, best.bot) - P.y) * 0.5)) best = it;
  if (!best) { if (mine) say('부술 기둥이 없어요', '#ffb3b3'); return false; }
  best.gone = true; sfx('coin');
  for (let i = 0; i < 14; i++) parts.push({ x: best.x + 35, y: clamp(P.y, best.top, best.bot) + rnd(-60, 60), vx: rnd(-100, 300), vy: rnd(-300, 100), t: 0, life: 0.9, c: '#9dffcf', s: rnd(5, 11) });
  say(mine ? '🔫 기둥 부숨!' : '🔫 친구가 기둥을 부쉈다!', '#9dffcf'); return true;
}
function syncFlap() { P.vy = -K.birdFlap * 1.5; st.coins++; st.pFlapT = -9; st.dFlapT = -9; say('🎵 박자 맞춤! 🪙+1', '#ffe066'); spark(P.x, P.y, '#ffe066', 12); }
function unboard(why) {
  if (!st.riding) return;
  netEv(st.riding, 'unboard'); st.riding = null; P.vy = -380; P.vx = 300; st.inv = Math.max(st.inv, 1);
  if (why) say(why, '#e6eefa');
}
function rideTick() {   // 같이 탄 사람: 앞사람 탈것에 붙어 간다(다치지 않는다)
  const d = others.find(o => o.id === st.riding);
  if (!d || d.over || d.bl || !RIDE2(d.ph)) { unboard('👥 내렸어요'); return false; }
  P.x = d.x - 14; P.y = d.y - 30; P.vx = 300; P.vy = 0; P.tilt = 0;
  return true;
}
function enterBalloon() {   // 같이 달리기에서 하트를 다 잃으면 바로 끝나지 않고 풍선이 되어 구조를 기다린다
  st.balloon = 12; P.rope = null; P.vy = 0; st.inv = 0;
  banner('🎈 풍선이 되었어요!', '친구가 닿거나 로프를 걸면 살아나요 · 12초');
}
function letGo() {
  if (!P.rope) return;
  P.rope = null;
  if (P.vx > 0) { P.vx += 60; P.vy -= 40; }   // 놓는 순간 살짝 앞으로
  sfx('release');
}
function flap() { P.vy = -K.birdFlap * rnd(0.85, 1.15); P.vx += rnd(-40, 40); P.flapT = K.birdEvery; sfx('flap'); }
// ---------- 맵 만들기(앞으로 나아가며 계속) ----------
function gen() {
  while (st.genX < cam + W * 2.2) {
    const x = st.genX, ph = phaseAt(x), lv = Math.floor(x / (K.segPlane + K.segRope * 2 + K.segBird));   // 같은 씨앗이면 누구에게나 같은 맵(사람 위치에 기대지 않는다)
    if (ph === 'rope') {
      const y = srnd(130, 300); items.push({ k: 'anchor', x, y });
      for (let i = 1; i <= 3; i++) items.push({ k: 'coin', x: x + i * 60, y: y + 230 + Math.sin(i) * 30 });
      if (lv + x / 40000 > 0.6 && seedRng() < 0.35) items.push({ k: 'spike', x: x + srnd(110, 170), y: srnd(430, 620), r: 26 });
      st.genX += srnd(230, 320) + lv * 15;
    } else if (ph === 'spider') {   // 거미: 천장이나 바닥에서 솟은 반쪽 기둥 → 반대쪽으로 옮겨 붙어야 한다
      const fromTop = seedRng() < 0.5, len = srnd(330, 470);
      items.push(fromTop ? { k: 'wall', x, top: 0, bot: len, w: 70 } : { k: 'wall', x, top: GROUND - len, bot: GROUND, w: 70 });
      for (let i = 0; i < 3; i++) items.push({ k: 'coin', x: x + 35, y: fromTop ? GROUND - 40 - i * 40 : 70 + i * 40 });
      st.genX += srnd(380, 470) - Math.min(60, lv * 15);
    } else {   // 비행기·새·보스 탈것: 위아래 기둥 사이 틈
      const gap = ({ bird: 330, whale: 360, knight: 300, core: 320, twins: 340 }[ph] || 300) - Math.min(70, lv * 15), gy = srnd(220, GROUND - 120 - gap);
      items.push({ k: 'wall', x, top: 0, bot: gy, w: 70 }, { k: 'wall', x, top: gy + gap, bot: GROUND, w: 70 });
      for (let i = 0; i < 3; i++) items.push({ k: 'coin', x: x + 35, y: gy + gap * (0.3 + i * 0.2) });
      st.genX += srnd(360, 440) - Math.min(60, lv * 15);
    }
  }
  items = items.filter(it => it.x > cam - 200 && !it.gone);
}
// 탈것: 새와 보스 기계 4종. 판마다 순서가 섞인다(비행기 → 로프 → 탈것 → 로프 → …)
const RIDES = ['bird', 'spider', 'whale', 'knight', 'core', 'twins'];
const RIDE_NM = {
  bird: ['🐦 새에 올라탔다!', '누르고 있으면 날갯짓(오름) · 떼면 떨어져요 · 말을 잘 안 들어요!'],
  spider: ['🕷️ 강철 거미에 올라탔다!', '누를 때마다 천장 ↔ 바닥으로 옮겨 붙어요 · 거미는 용암도 견뎌요'],
  whale: ['🐋 폭풍 고래에 올라탔다!', '누르면 천천히 오르고 떼면 천천히 내려가요 · 기둥은 몸으로 부숴요 · 동전을 빨아들여요'],
  knight: ['⚔️ 거울 기사에 올라탔다!', '누를 때마다 앞으로 돌진하며 살짝 떠올라요 · 돌진 중엔 기둥을 베어요'],
  core: ['💠 코어 요새에 올라탔다!', '누를 때마다 중력이 위 ↔ 아래로 바뀌어요(옆의 화살표 쪽으로 떨어짐) · 위로 붙으면 다시 눌러 내려오기 · 기둥의 빈틈에 맞춰 눌러요 · 천장은 안전, 바닥은 용암'],
  twins: ['🚀 쌍둥이 포대선에 올라탔다!', '누르고 있으면 오르고 떼면 내려가요 · 누를 때마다 대포로 앞 기둥을 부숴요(3발, 천천히 다시 참)'],
};
function phaseAt(x) {   // 이 자리가 어느 구간인가(구간 경계는 판을 시작할 때 정한다)
  if (!st.plan) {
    st.plan = []; let at = 0, bag = [];
    for (let i = 0; i < 40; i++) {
      let ph = ['plane', 'rope', 'ride', 'rope'][i % 4];
      if (ph === 'ride') { if (!bag.length) { bag = RIDES.slice(); for (let j = bag.length - 1; j > 0; j--) { const r = Math.floor(seedRng() * (j + 1));[bag[j], bag[r]] = [bag[r], bag[j]]; } } ph = bag.pop(); }
      const len = ph === 'plane' ? K.segPlane : ph === 'rope' ? K.segRope : K.segBird;
      st.plan.push({ ph, from: at, to: at + len }); at += len;
    }
  }
  const s = st.plan.find(s => x >= s.from && x < s.to); return s ? s.ph : 'rope';
}
const isRide = ph => RIDES.includes(ph) && ph !== 'bird';
// ---------- 한 프레임 ----------
function loop(now) {
  if (!on) return;
  const dt = clamp((now - last) / 1000, 0, 0.033); last = now;
  if (st.slow > 0) st.slow -= dt; if (st.shake > 0) st.shake -= dt; if (st.flash > 0) st.flash -= dt;
  if (!st.over) update((st.slow > 0 ? dt * 0.35 : dt) * (st.easy ? K.easy.time : 1));   // 비상 탈출 순간은 느린 화면, 연습 모드는 전부 느리게
  if (opt.race) {   // 친구와 같이 달리기: 내 자리를 보내고 친구 자리를 받는다
    const got = opt.race.others() || [];
    others = got.map(o => { const p = others.find(q => q.id === o.id); return Object.assign({}, o, { ph: typeof o.ph === 'number' ? PH_ID[o.ph] || 'rope' : o.ph, x: p ? p.x + (o.x - p.x) * Math.min(1, dt * 10) : o.x, y: p ? p.y + (o.y - p.y) * Math.min(1, dt * 10) : o.y }); });
    if ((netT -= dt) <= 0) { netT = 0.1; opt.race.send({ x: Math.round(P.x), y: Math.round(P.y), ph: PH_ID.indexOf(st.phase), h: st.hearts, d: st.dist, over: st.over ? 1 : 0, bl: st.balloon > 0 ? 1 : 0, ps: st.riding || '', pp: st.pass ? 1 : 0, frame: cb.frame || 'falcon' }); }
    if (st.over && (rankT -= dt) <= 0) { rankT = 0.5; raceRank(); }
  }
  draw();
  raf = requestAnimationFrame(loop);
}
function update(dt) {
  t += dt; holdT += dt; if (st.inv > 0) st.inv -= dt; if (P.miss > 0) P.miss -= dt;
  if ((pathT -= dt) <= 0 && st.path.length < 9000) { pathT += 0.1; st.path.push([Math.round(P.x), Math.round(P.y), PH_ID.indexOf(st.phase)]); }   // 유령용 길 기록(0.1초마다)
  if (st.balloon > 0) {   // 풍선: 천천히 앞으로 떠가며 친구를 기다린다(친구가 따라잡을 수 있게 느리게)
    st.balloon -= dt; P.vx = 190; P.x += P.vx * dt; P.y += (280 + Math.sin(t * 2) * 40 - P.y) * Math.min(1, dt * 2);
    cam += (P.x - W * 0.32 - cam) * Math.min(1, dt * 6); gen();
    if (st.balloon <= 0 || !others.some(o => !o.over && !o.bl)) { st.balloon = 0; gameOver(); }
    for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; } parts = parts.filter(p => p.t < p.life);
    for (const m of msgs) m.t += dt; msgs = msgs.filter(m => m.t < m.life);
    return;
  }
  if (st.riding && phaseAt(P.x) !== st.phase) unboard();
  if (st.riding && rideTick()) {   // 같이 탄 사람: 몸은 앞사람 탈것에(물리·부딪힘 없음)
    cam += (P.x - W * 0.32 - cam) * Math.min(1, dt * 6); st.dist = Math.max(st.dist, Math.floor(P.x / 10)); gen();
    for (const it of items) if (it.k === 'coin' && !it.gone && Math.hypot(it.x - P.x, it.y - P.y) < 40) { it.gone = true; st.coins++; sfx('coin'); }
    for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; } parts = parts.filter(p => p.t < p.life);
    for (const m of msgs) m.t += dt; msgs = msgs.filter(m => m.t < m.life);
    return;
  }
  if (opt.race && RIDE2(st.phase)) {
    if (st.pass) { const q = others.find(o => o.id === st.pass); if (!q || q.over || (t - st.passT > 1.5 && !q.ps)) st.pass = null; }   // 같이 탄 친구가 사라지면
    else if (!st.riding && !(st.boardT > t)) for (const o of others) {   // 같은 탈것의 친구에게 뒤에서 닿으면 같이 타자고 한다
      if (o.ph === st.phase && !o.ps && !o.pp && !o.over && !o.bl && o.x > P.x - 30 && Math.hypot(o.x - P.x, o.y - P.y) < 80) { st.boardAsk = o.id; st.boardT = t + 1.5; netEv(o.id, 'board'); break; }
    }
  } else if (st.pass) st.pass = null;
  if (P.rope && P.rope.a.fid) {   // 친구에게 건 로프: 친구를 따라 움직인다
    const o = others.find(q => q.id === P.rope.a.fid);
    if (!o || o.over) letGo(); else { P.rope.a.x = o.x; P.rope.a.y = o.y; }
  }
  for (const o of others) if (o.bl && Math.hypot(o.x - P.x, o.y - P.y) < 60) rescue(o);   // 풍선에 닿아도 구출
  const ph = phaseAt(P.x);
  if (ph !== st.phase) changePhase(ph);
  st.loop =Math.floor(P.x / (K.segPlane + K.segRope * 2 + K.segBird));
  const speed = 300 + st.loop * 30;
  if (st.phase === 'plane') {
    // 비행기는 위아래·앞뒤로 자유롭게(떨어지지 않음): 방향키·WASD, 스페이스=위, 화면은 손가락을 끈 만큼 따라감
    let vxr = ((keys.r ? 1 : 0) - (keys.l ? 1 : 0)) * K.flyX, vyt = ((keys.d ? 1 : 0) - (keys.u || (hold && !ptr) ? 1 : 0)) * K.flyY;
    if (ptr) {   // 끌기: 누른 순간의 비행기 자리 + 손가락이 움직인 만큼(1.4배)
      const tx = clamp(ptr.ox + (ptr.x - ptr.sx) * 1.4, 50, W * 0.72), ty = clamp(ptr.oy + (ptr.y - ptr.sy) * 1.4, 60, GROUND - 40);
      vxr = clamp((tx - (P.x - cam)) * 8, -K.flyX * 1.6, K.flyX * 1.6); vyt = clamp((ty - P.y) * 8, -K.flyY * 1.6, K.flyY * 1.6);
    }
    P.vy += (vyt - P.vy) * Math.min(1, dt * 9); P.vx = speed + vxr;
    P.tilt = P.vy / 1400;
    const seg = st.plan && st.plan.find(s => P.x >= s.from && P.x < s.to);   // 엔진 고장: 연기·흔들림·경고
    if (seg && seg.ph === 'plane' && seg.to - P.x < K.trouble) {
      if (!st.trouble) { st.trouble = true; say('⚠️ 엔진 이상!', '#ffb347'); sfx('alarm'); }
      P.tilt += Math.sin(t * 40) * 0.08; P.vy += Math.sin(t * 23) * 400 * dt;
      if (Math.random() < 0.6) parts.push({ x: P.x - 30, y: P.y + rnd(-5, 5), vx: rnd(-140, -60), vy: rnd(-80, -20), t: 0, life: 0.9, c: Math.random() < 0.3 ? '#ff8a3a' : '#555b66', s: rnd(8, 16), smoke: true });
    } else st.trouble = false;
  } else if (st.phase === 'bird') {
    if (hold && (P.flapT -= dt) <= 0) flap();
    P.vy += K.birdG * dt; P.vx += (speed - 20 - P.vx) * dt * 1.5 + Math.sin(t * 3.1) * 30 * dt;   // 새는 제멋대로 조금씩 흔들린다
    P.tilt = clamp(P.vy / 1200, -0.5, 0.6);
  } else if (st.phase === 'spider') {   // 거미: 천장(-1)이나 바닥(1)에 붙어 걷는다
    P.vx = speed * 0.95; P.vy += P.side * 2600 * dt; P.vy = clamp(P.vy, -900, 900);
    const top = 70, bot = GROUND - 34;
    if (P.side > 0 && P.y > bot) { P.y = bot; P.vy = 0; } if (P.side < 0 && P.y < top) { P.y = top; P.vy = 0; }
    P.tilt = 0;
  } else if (st.phase === 'whale') {   // 고래: 무겁고 느리다
    P.vx = speed * 0.85; P.vy += (hold ? -900 : 700) * dt; P.vy = clamp(P.vy, -300, 300); P.tilt = P.vy / 1400;
    for (const it of items) if (it.k === 'coin' && !it.gone) { const dx = P.x - it.x, dy = P.y - it.y, d = Math.hypot(dx, dy); if (d < 170) { it.x += dx / d * 420 * dt; it.y += dy / d * 420 * dt; } }   // 빨아들이기
  } else if (st.phase === 'knight') {   // 기사: 누를 때마다 돌진
    if (P.dashT > 0) P.dashT -= dt; if (P.dashCd > 0) P.dashCd -= dt;
    P.vx = speed * (P.dashT > 0 ? 2.3 : 0.9); P.vy += 1150 * dt; P.vy = clamp(P.vy, -600, 600); P.tilt = P.dashT > 0 ? -0.1 : P.vy / 1500;
  } else if (st.phase === 'twins') {   // 쌍둥이 포대선: 누르고 있으면 오르고, 누를 때마다 대포(3발, 1.6초마다 1발 다시 참)
    P.vx = speed * 0.95; P.vy += (hold ? -1150 : 900) * dt; P.vy = clamp(P.vy, -380, 380); P.tilt = P.vy / 1600;
    if (st.ammo < 3 && (st.reload -= dt) <= 0) { st.ammo++; st.reload = 1.6; }
    if (st.muzzle > 0) st.muzzle -= dt;
    if (P.y < 60) { P.y = 60; if (P.vy < 0) P.vy = 0; }
    if (P.y > GROUND - 50) { P.y = GROUND - 50; P.vy = -380; hurt('용암에 닿았다!'); }
  } else if (st.phase === 'core') {   // 코어: 중력 뒤집기
    P.vx = speed; P.vy += P.gdir * K.coreG * dt; P.vy = clamp(P.vy, -K.coreMax, K.coreMax); P.tilt = 0;
  } else {   // 로프
    P.vy += K.g * dt;
    if (P.rope) {
      const a = P.rope.a, dx = P.x - a.x, dy = P.y - a.y, d = Math.hypot(dx, dy) || 1;
      let tx = -dy / d, ty = dx / d; if (tx < 0) { tx = -tx; ty = -ty; }   // 줄에 수직, 앞쪽
      const vt = P.vx * tx + P.vy * ty;   // 줄을 따라 도는 빠르기(+ 앞쪽, - 뒤쪽)
      if (dy > 0 && Math.abs(vt) < K.swing) { const s = vt >= 0 ? 1 : -1; P.vx += tx * s * K.pump * dt; P.vy += ty * s * K.pump * dt; }   // 아래쪽을 지날 때 흔들리는 방향으로 밀어 준다(떼지 않으면 앞뒤로 계속 그네)
      if (P.rope.L > P.rope.L0 * 0.75) P.rope.L = Math.max(K.ropeMin, P.rope.L - K.reel * dt);   // 처음엔 조금 감기고 그다음엔 그 길이로 흔들린다
    }
    P.vx *= 1 - 0.05 * dt;
  }
  P.x += P.vx * dt; P.y += P.vy * dt;
  if (P.rope) {   // 줄 길이를 넘지 않게(늘어진 줄은 그대로)
    const a = P.rope.a, dx = P.x - a.x, dy = P.y - a.y, d = Math.hypot(dx, dy);
    if (d > P.rope.L) {
      const nx = dx / d, ny = dy / d; P.x = a.x + nx * P.rope.L; P.y = a.y + ny * P.rope.L;
      const vr = P.vx * nx + P.vy * ny; if (vr > 0) { P.vx -= vr * nx; P.vy -= vr * ny; }
    }
    // 0.35: 저절로 놓지 않는다 — 손을 뗄 때까지 앞뒤로 흔들린다
  }
  if (P.y < 30) { P.y = 30; if (P.vy < 0) P.vy = 0; }
  if (st.phase === 'plane') {   // 비행기: 화면은 일정하게 흐르고, 비행기는 화면 안에서 앞뒤로 움직인다
    cam = Math.max(cam + speed * dt, P.x - W * 0.72); P.x = clamp(P.x, cam + 50, cam + W * 0.72);
  } else cam += (P.x - W * 0.32 - cam) * Math.min(1, dt * 6);
  st.dist = Math.max(st.dist, Math.floor(P.x / 10));
  if (st.stars < 3 && st.dist >= K.stars[st.stars]) {   // 별 ⭐
    st.stars++; banner('⭐'.repeat(st.stars) + ` ${K.stars[st.stars - 1].toLocaleString()} m 돌파!`, st.stars < 3 ? `다음 별까지 ${K.stars[st.stars].toLocaleString()} m` : '별을 모두 모았어요!');
    sfx('star'); spark(P.x, P.y, '#ffe066', 24);
  }
  if (st.best > 50 && !st.passBest && st.dist > st.best) { st.passBest = true; say('🏁 최고 기록 넘었다!', '#9dffcf'); sfx('star'); }
  for (const w of wrecks) {   // 버린 탈것이 떨어져 용암에서 터진다
    w.t += dt;
    if (w.k === 'bird') { w.x += 240 * dt; w.y -= 180 * dt; w.rot = -0.3; if (w.t > 3) w.done = true; continue; }   // 새는 날아가 버린다
    w.vy += 900 * dt; w.x += w.vx * dt; w.y += w.vy * dt; w.rot += w.vr * dt;
    if (Math.random() < 0.5) parts.push({ x: w.x, y: w.y, vx: rnd(-60, 20), vy: rnd(-90, -30), t: 0, life: 0.8, c: '#4a4f58', s: rnd(8, 14), smoke: true });
    if (w.y > GROUND && !w.done) { w.done = true; sfx('boom'); st.shake = 0.35; spark(w.x, GROUND - 10, '#ff8a3a', 26); spark(w.x, GROUND - 10, '#ffe066', 14); }
  }
  wrecks = wrecks.filter(w => !w.done);
  gen();
  // 부딪힘
  for (const it of items) {
    if (it.k === 'coin' && !it.gone && Math.hypot(it.x - P.x, it.y - P.y) < 30) { it.gone = true; st.coins++; sfx('coin'); spark(it.x, it.y, '#ffd166'); }
    const hr = isRide(st.phase) ? 26 : 18, hy = st.phase === 'twins' ? 46 : hr;   // 쌍둥이는 위아래로 길다
    if (it.k === 'wall' && !it.gone && P.x + hr > it.x && P.x - hr < it.x + it.w && P.y + hy > it.top && P.y - hy < it.bot) {
      if (st.phase === 'whale' || (st.phase === 'knight' && P.dashT > 0)) {   // 몸으로 부수기 · 베기
        it.gone = true; sfx('coin'); for (let i = 0; i < 12; i++) parts.push({ x: it.x + 35, y: clamp(P.y, it.top, it.bot) + rnd(-40, 40), vx: rnd(50, 350), vy: rnd(-300, 100), t: 0, life: 0.9, c: '#6b7484', s: rnd(5, 11) });
        st.coins++; say(st.phase === 'whale' ? '쾅! 부쉈다' : '싹둑!', '#ffd166'); continue;
      }
      if (st.inv <= 0) hurt('기둥에 쾅!');
    }
    if (st.inv > 0) continue;
    if (it.k === 'spike' && Math.hypot(it.x - P.x, it.y - P.y) < it.r + 16) hurt('가시 공!');
  }
  if (st.phase === 'core') { if (P.y < 50) { P.y = 50; P.vy = 0; } }
  if (P.y > GROUND - 14 && st.phase !== 'spider') {
    if (st.phase === 'rope') { hurt('용암에 빠졌다!'); respawn(); }
    else { P.y = GROUND - 14; P.vy = st.phase === 'core' ? 0 : -380; if (st.inv <= 0) hurt('용암에 닿았다!'); if (st.phase === 'core') { P.gdir = -1; P.vy = -300; } }
  }
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.smoke ? -40 : 600) * dt; if (p.smoke) p.s += 14 * dt; }
  parts = parts.filter(p => p.t < p.life);
  for (const m of msgs) m.t += dt; msgs = msgs.filter(m => m.t < m.life);
}
function changePhase(ph) {
  const was = st.phase; st.phase = ph; P.rope = null;
  if (ph === 'rope' && was !== 'rope') {   // 타던 것을 버린다: 느린 화면 + 번쩍 + 떨어지는 잔해
    wrecks.push({ k: was, x: P.x, y: P.y, vx: P.vx * 0.5, vy: -120, rot: P.tilt || 0, vr: rnd(1.5, 3) * (Math.random() < 0.5 ? -1 : 1), t: 0, side: P.side, gdir: P.gdir });
    st.slow = was === 'plane' ? 0.7 : 0.45; st.flash = 0.25; st.shake = 0.2;
  }
  if (RIDES.includes(ph) && !st.rides.includes(ph)) st.rides.push(ph);
  if (ph === 'rope') {
    for (let i = 0; i < 14; i++) parts.push({ x: P.x, y: P.y, vx: rnd(-200, 100), vy: rnd(-300, 100), t: 0, life: 1.2, c: was === 'bird' ? '#d9c7a8' : '#9aa6b4', s: rnd(4, 9) });
    P.vx = 320; P.vy = -720;
    const off = { plane: '🚨 엔진 고장! 비상 탈출!', bird: '🐦 새가 지쳤다! 뛰어내려!', spider: '🕷️ 거미가 멈췄다! 뛰어내려!', whale: '🐋 고래가 잠들었다! 뛰어내려!', knight: '⚔️ 기사가 무릎을 꿇었다! 뛰어내려!', core: '💠 코어가 꺼졌다! 뛰어내려!' };
    banner(off[was] || '뛰어내려!', st.seen.rope ? '한 번 누르면 로프 발사 · 또 누르면 끊고 날아가요' : '한 번 누르면(스페이스·화면 톡) 노란 고리로 로프가 날아가 걸리고 그네처럼 흔들려요 · 앞쪽 위로 올라갈 때 한 번 더 누르면 끊고 날아가요 · 날아가는 중에 또 누르면 다음 고리');
    // 탈출하자마자 잡을 고리를 하나 둔다
    items.push({ k: 'anchor', x: P.x + 260, y: 170 });
  } else if (RIDE_NM[ph]) {
    const nm = RIDE_NM[ph]; P.vy = -150; P.side = 1; P.gdir = 1; P.dashT = 0; P.dashCd = 0; st.ammo = 3; st.reload = 1.6; st.muzzle = 0;
    banner(nm[0], st.seen[ph] ? nm[1].split(' · ')[0] : nm[1]);
    // 탈것으로 바뀌는 자리 바로 앞은 비워 둔다(갑자기 기둥에 부딪히지 않게)
    items = items.filter(it => !(it.k === 'wall' && it.x > P.x - 40 && it.x < P.x + 320));
  } else { P.vy = -100; banner('✈️ 새 비행기를 잡아탔다!', matchMedia('(pointer: coarse)').matches ? '누른 채 끌어서 조종' : '방향키로 조종'); }
  st.seen[ph] = true; st.inv = Math.max(st.inv, 1); sfx('phase');
}
function respawn() {
  if (st.balloon > 0) return;
  const a = items.filter(it => it.k === 'anchor' && it.x > P.x - 60).sort((p, q) => p.x - q.x)[0];
  if (a) { P.x = a.x - 20; P.y = a.y + 140; P.vx = 200; P.vy = 0; P.rope = { a, L: 150, L0: 150 }; }
  else { P.y = 300; P.vy = -300; }
  st.inv = 1.6;
}
function hurt(why) {
  if (st.inv > 0 || st.balloon > 0) return;
  st.hearts--; st.inv = st.easy ? K.easy.inv : 1.3; say(why, '#ff8a8a'); sfx('hurt'); spark(P.x, P.y, '#ff6b5e', 14);
  if (st.hearts <= 0) { if (opt.race && (st.rescued || 0) < 2 && others.some(o => !o.over && !o.bl)) enterBalloon(); else gameOver(); }
}
function gameOver() {
  st.over = true; on = true;
  const scrap = Math.floor((Math.floor(st.dist / 60) + st.coins) * (st.easy ? K.easy.scrap : 1));   // 연습 모드는 덜 번다
  const best = st.best, starBonus = [0, 10, 25, 50][st.stars];
  if (cb.gain) cb.gain(scrap + starBonus, st.dist, st.stars);
  const r = box.querySelector('.esRes'); r.classList.remove('hidden');
  const RI = { bird: '🐦', spider: '🕷️', whale: '🐋', knight: '⚔️', core: '💠' };
  const next = K.stars.find(s => s > st.dist);
  const pil = cb.img && cb.img('esc-pilot');
  r.querySelector('.esStat').innerHTML = `${pil ? `<img class="esPilot" src="${pil.src}" alt="">` : ''}<div class="esStars">${[0, 1, 2].map(i => `<span class="${i < st.stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.25}s">⭐</span>`).join('')}</div>
    <div class="big">${st.dist.toLocaleString()} m</div>
    <div>🪙 ${st.coins} · 🔩 고철 +${scrap}${starBonus ? ` <b>+ 별 보너스 ${starBonus}</b>` : ''}</div>
    ${st.rides.length ? `<div>타 본 탈것 ${st.rides.map(k => RI[k]).join(' ')}</div>` : ''}
    ${st.saved || st.rescued ? `<div>🎈 구한 친구 ${st.saved || 0}번 · 구조받음 ${st.rescued || 0}번</div>` : ''}
    ${st.dist > best && best > 0 ? `<div class="rec">🏆 최고 기록! (지난 최고 ${best.toLocaleString()} m)</div>` : !best ? '<div class="rec">🏁 첫 기록!</div>' : `<div>최고 ${best.toLocaleString()} m · ${(best - st.dist).toLocaleString()} m 모자라요</div>`}
    ${next ? `<small>다음 별: ${next.toLocaleString()} m</small>` : ''}`;
  if (!opt.race && st.dist > best && cb.saveGhost) cb.saveGhost({ seed: st.seed, path: st.path, dist: st.dist, v: GHOST_V });   // 최고 기록이면 유령으로 남긴다
  const gh = !opt.race && ghost();
  r.querySelector('.esGhost').classList.toggle('hidden', !gh);
  r.querySelector('.esRank').innerHTML = '';
  easyBtn();
  r.querySelector('.esTip').textContent = opt.race ? (opt.race.host ? '모두 끝나면 순위가 정해져요 · 「다 같이 다시」로 새 맵' : '모두 끝나면 순위가 정해져요 · 방장이 다시 시작하면 함께 시작해요') : gh ? '👻 유령과 달리기: 최고 기록 때와 같은 맵에서 그때의 나와 겨뤄요' : '';
  if (opt.race) { rankT = 0; raceRank(); }
}
function raceRank() {   // 같이 달리기 순위(모두 끝나면 확정)
  const list = [{ name: '나', d: st.dist, over: true, me: true }, ...others.map(o => ({ name: o.name, d: o.d || 0, over: !!o.over, color: o.color }))].sort((a, b) => b.d - a.d);
  const all = list.every(x => x.over), myRank = list.findIndex(x => x.me) + 1;
  box.querySelector('.esRank').innerHTML = `<div class="esRk">${list.map((x, i) => `<div class="${x.me ? 'me' : ''}"><b>${all ? ['🥇', '🥈', '🥉'][i] || i + 1 : i + 1 + '.'}</b> <span style="color:${x.color || '#ffd166'}">${esc(x.name)}</span> ${x.d.toLocaleString()} m ${x.over ? '' : '<i>달리는 중…</i>'}</div>`).join('')}</div>${all ? st.bonusHtml || '' : '<small>친구가 끝나기를 기다리는 중…</small>'}`;
  if (all && !st.raceDone) { st.raceDone = true; if (opt.race.done) { const bonus = opt.race.done(myRank, list.length); if (bonus) { st.bonusHtml = `<div class="rec">${myRank === 1 ? '🏆 1등!' : `${myRank}등`} 순위 보너스 🔩 +${bonus}</div>`; box.querySelector('.esRank').insertAdjacentHTML('beforeend', st.bonusHtml); } } }
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function finish(quit) { if (!st || st.over) { close(); return; } if (quit) { st.hearts = 0; gameOver(); } }
// ---------- 그리기 ----------
let bgTop = null;
function drawBg() {   // 그림 배경(esc-bg): 높이 640으로 줄여 느리게 흐르고, 이어 붙일 때 한 장 걸러 좌우를 뒤집어 이음매를 숨긴다
  const im = cb.img && cb.img('esc-bg'); if (!im) return false;
  const h = 640, w = Math.round(im.width * h / im.height), top = GROUND + 20 - h, ox = cam * 0.22;
  if (!bgTop) { try { const c = document.createElement('canvas'); c.width = 8; c.height = 1; const cg = c.getContext('2d'); cg.drawImage(im, 0, 0, im.width, 4, 0, 0, 8, 1); const d = cg.getImageData(0, 0, 8, 1).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < 32; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } bgTop = `rgb(${r >> 3},${gg >> 3},${b >> 3})`; } catch (e) { bgTop = '#2f3046'; } }
  const sky = g.createLinearGradient(0, 0, 0, top + 2); sky.addColorStop(0, '#191a2a'); sky.addColorStop(1, bgTop);
  g.fillStyle = sky; g.fillRect(0, 0, W, top + 2);
  for (let i = Math.floor(ox / w); i * w - ox < W; i++) {
    const x = i * w - ox;
    if (i % 2) { g.save(); g.translate(x + w, top); g.scale(-1, 1); g.drawImage(im, 0, 0, w, h); g.restore(); } else g.drawImage(im, x, top, w, h);
  }
  g.fillStyle = 'rgba(20,16,26,.25)'; g.fillRect(0, 0, W, H);   // 조금 어둡게(앞의 것이 잘 보이게)
  return true;
}
function draw() {
  const hasBg = drawBg();
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#2b4f86'); sky.addColorStop(0.6, '#7fa8d6'); sky.addColorStop(1, '#f2b58a');
  if (!hasBg) { g.fillStyle = sky; g.fillRect(0, 0, W, H); }
  for (const [k, c, base, amp] of hasBg ? [[0.45, 'rgba(30,24,34,.85)', 800, 60]] : [[0.2, '#5a77a3', 640, 90], [0.45, '#3f5a80', 720, 70]]) {   // 먼 산(느리게). 그림 배경이 있으면 가까운 바위 한 겹만
    g.fillStyle = c; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) { const wx = x + cam * k; g.lineTo(x, base - Math.abs(Math.sin(wx / 160)) * amp - Math.sin(wx / 53) * 12); }
    g.lineTo(W, H); g.fill();
  }
  g.save(); g.translate(-cam + (st.shake > 0 ? rnd(-8, 8) : 0), st.shake > 0 ? rnd(-6, 6) : 0);
  // 용암 바닥
  const lg = g.createLinearGradient(0, GROUND, 0, H); lg.addColorStop(0, '#ff7a2a'); lg.addColorStop(1, '#8a1c08');
  g.fillStyle = lg; g.fillRect(cam - 10, GROUND, W + 20, H - GROUND);
  g.fillStyle = 'rgba(255,220,120,.6)'; for (let x = Math.floor(cam / 40) * 40; x < cam + W + 40; x += 40) g.fillRect(x + Math.sin(t * 3 + x) * 8, GROUND + 6 + Math.sin(t * 2 + x / 30) * 3, 16, 3);
  const aimed = st.phase === 'rope' && !P.rope && !st.riding && !(st.balloon > 0) ? aimAnchor() : null;
  for (const it of items) {
    if (it.gone) continue;
    if (it.k === 'anchor') {
      const near = it === aimed;   // 지금 누르면 걸릴 고리 하나만 빛난다
      g.strokeStyle = '#5b6470'; g.lineWidth = 2; g.beginPath(); g.moveTo(it.x, 0); g.lineTo(it.x, it.y - 14); g.stroke();
      g.strokeStyle = near ? '#ffe066' : '#d6dde6'; g.lineWidth = 6; g.beginPath(); g.arc(it.x, it.y, 13, 0, TAU); g.stroke();
      if (near) { g.strokeStyle = 'rgba(255,224,102,.55)'; g.lineWidth = 3; g.beginPath(); g.arc(it.x, it.y, 22 + Math.sin(t * 8) * 3, 0, TAU); g.stroke(); g.setLineDash([8, 10]); g.strokeStyle = 'rgba(255,224,102,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(it.x, it.y); g.stroke(); g.setLineDash([]); }
    } else if (it.k === 'coin') {
      g.fillStyle = '#ffd166'; g.beginPath(); g.ellipse(it.x, it.y, 9 * Math.abs(Math.cos(t * 4 + it.x)) + 2, 10, 0, 0, TAU); g.fill();
    } else if (it.k === 'wall') {
      g.fillStyle = '#4a5260'; g.fillRect(it.x, it.top, it.w, it.bot - it.top);
      g.fillStyle = '#6b7484'; g.fillRect(it.x, it.top, 12, it.bot - it.top);
      g.fillStyle = '#ff5d5d'; g.fillRect(it.x - 4, it.top === 0 ? it.bot - 10 : it.top, it.w + 8, 10);
    } else if (it.k === 'spike') {
      g.strokeStyle = '#5b6470'; g.lineWidth = 2; g.beginPath(); g.moveTo(it.x, 0); g.lineTo(it.x, it.y); g.stroke();
      g.save(); g.translate(it.x, it.y); g.rotate(t * 2);
      g.fillStyle = '#3a3f48'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? it.r * 0.7 : it.r * 1.25; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill();
      g.restore();
    }
  }
  if (st.best > 50 && st.best * 10 > cam - 60 && st.best * 10 < cam + W + 60) {   // 🏁 내 최고 기록 자리
    const bx = st.best * 10;
    g.strokeStyle = '#e6eefa'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, GROUND); g.lineTo(bx, GROUND - 260); g.stroke();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(bx + i * 14, GROUND - 260 + j * 14 + Math.sin(t * 5 + i) * 3, 14, 14); }
    g.fillStyle = '#e6eefa'; g.font = '800 18px sans-serif'; g.textAlign = 'left'; g.fillText(`최고 ${st.best.toLocaleString()} m`, bx + 6, GROUND - 270);
  }
  for (const w of wrecks) drawWreck(w);
  const ghost = ghostAt();
  if (ghost) drawOther(ghost);
  for (const o of others) drawOther(o);
  if (P.rope) {   // 로프는 조종사 손까지(그림이 있으면 몸 중심에서 줄 쪽으로 36px)
    const dx = P.rope.a.x - P.x, dy = P.rope.a.y - P.y, d = Math.hypot(dx, dy) || 1, hk = cb.img && cb.img('esc-p-rope') ? Math.min(36, d) : 0;
    g.strokeStyle = '#f4e3b5'; g.lineWidth = 3; g.beginPath(); g.moveTo(P.rope.a.x, P.rope.a.y); g.lineTo(P.x + dx / d * hk, P.y + dy / d * hk); g.stroke();
  }
  if (P.miss > 0) { g.strokeStyle = `rgba(255,180,180,${P.miss * 3})`; g.lineWidth = 2; g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(P.x + 160, P.y - 260); g.stroke(); }
  drawHero();
  if (st.pass) {   // 내 탈것에 같이 탄 친구(뒤쪽에 앉음)
    const q = others.find(o => o.id === st.pass), sit = cb.img && cb.img('esc-p-sit');
    if (q) {
      const bx = P.x - 36, by = P.y - (st.phase === 'bird' ? 44 : 38) + Math.sin(t * 5) * 3;
      if (sit) g.drawImage(sit, bx - 24, by - 30, 48, 48); else { g.fillStyle = q.color; g.beginPath(); g.arc(bx, by, 10, 0, TAU); g.fill(); }
      g.fillStyle = q.color; g.font = '800 14px sans-serif'; g.textAlign = 'center'; g.fillText(`👥 ${q.name}`, bx, by - 34);
    }
  }
  for (const p of parts) {
    g.globalAlpha = (1 - p.t / p.life) * (p.smoke ? 0.55 : 1); g.fillStyle = p.c;
    if (p.smoke) { g.beginPath(); g.arc(p.x, p.y, p.s / 2, 0, TAU); g.fill(); } else g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  g.globalAlpha = 1;
  g.restore();
  if (st.flash > 0) { g.fillStyle = `rgba(255,240,220,${st.flash * 2.4})`; g.fillRect(0, 0, W, H); }
  if (st.slow > 0) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, W, 50); g.fillRect(0, H - 50, W, 50); }   // 느린 화면 띠
  g.fillStyle = '#ffe066'; g.font = '22px sans-serif'; g.textAlign = 'left'; g.fillText('⭐'.repeat(st.stars) + '☆'.repeat(3 - st.stars), 24, 120);
  // 화면 밖 친구·유령: 가장자리에 화살표와 거리 차
  for (const o of (ghost ? [ghost] : []).concat(others)) {
    const sx = o.x - cam; if (sx > -20 && sx < W + 20) continue;
    const left = sx < 0, y = clamp(o.y, 150, H - 120), diff = Math.round((o.x - P.x) / 10);
    g.globalAlpha = 0.85; g.fillStyle = o.color; g.beginPath();
    if (left) { g.moveTo(6, y); g.lineTo(22, y - 12); g.lineTo(22, y + 12); } else { g.moveTo(W - 6, y); g.lineTo(W - 22, y - 12); g.lineTo(W - 22, y + 12); }
    g.fill(); g.font = '700 14px sans-serif'; g.textAlign = left ? 'left' : 'right';
    g.fillText(`${o.bl ? "🎈 " : ""}${o.name} ${diff > 0 ? '+' : ''}${diff}m`, left ? 26 : W - 26, y + 5); g.globalAlpha = 1;
  }
  if (opt.race && others.length) {   // 지금 순위
    const rank = 1 + others.filter(o => (o.d || 0) > st.dist).length;
    g.fillStyle = '#9dffcf'; g.font = '800 22px sans-serif'; g.textAlign = 'left'; g.fillText(`🏃 ${rank}위 / ${others.length + 1}명`, 24, 152);
  }
  if (st.riding || st.pass) {   // 둘이 타기 안내(아래)
    const ready = !(st.helpT > t), txt = st.riding ? (st.phase === 'bird' ? '👥 같이 탐 · 누르면 날갯짓(앞사람과 동시에!)' : `👥 같이 탐 · 누르면 기둥 부수기 ${ready ? '✅' : `(${Math.ceil(st.helpT - t)}초)`}`) : (st.phase === 'bird' ? '👥 친구가 탔어요 · 같이 눌러 박자 맞추기!' : '👥 친구가 탔어요 · 친구가 기둥을 부숴 줘요');
    g.fillStyle = 'rgba(6,12,24,.55)'; g.fillRect(0, H - 120, W, 40); g.fillStyle = '#9dffcf'; g.font = '800 18px sans-serif'; g.textAlign = 'center'; g.fillText(txt, W / 2, H - 93);
  }
  if (st.easy && !st.riding && !st.pass && !st.over) {   // 🐢 연습 모드: 지금 할 일을 아래에 늘 보여 준다
    const ph = st.phase, tip = ph === 'plane' ? (matchMedia('(pointer: coarse)').matches ? '✈️ 화면을 누른 채 끌어서 움직여요' : '✈️ 방향키·WASD로 움직여요')
      : ph === 'rope' ? (P.rope ? (P.vx > 120 && P.vy < -60 ? '🪢 지금! 누르면 끊고 앞으로 날아가요' : '🪢 그네 타는 중 · 앞쪽 위로 올라갈 때 누르기') : '🪢 노란 고리가 보이면 한 번 누르기')
      : ph === 'core' ? `💠 누르면 중력이 ${P.gdir > 0 ? '위' : '아래'}로 바뀌어요 · 기둥 틈에 맞춰서` : '' + ((RIDE_NM[ph] || [])[1] || '').split(' · ')[0];
    g.fillStyle = 'rgba(6,12,24,.6)'; g.fillRect(0, H - 120, W, 40); g.fillStyle = '#ffe066'; g.font = '800 18px sans-serif'; g.textAlign = 'center'; g.fillText(tip, W / 2, H - 93);
    g.textAlign = 'left'; g.font = '700 16px sans-serif'; g.fillStyle = '#9dffcf'; g.fillText('🐢 연습 모드', 24, 116);
  }
  // 화면 위 글자
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '800 30px sans-serif'; g.fillText(`${st.dist.toLocaleString()} m`, 24, 56);
  g.font = '600 20px sans-serif'; g.fillText(`🪙 ${st.coins}`, 24, 88);
  g.textAlign = 'right'; g.font = '26px sans-serif'; g.fillText('❤️'.repeat(Math.max(0, st.hearts)) + '🤍'.repeat(Math.max(0, st.maxH - st.hearts)), W - 70, 56);
  if (st.phase === 'twins' && !st.riding) { g.font = '800 20px sans-serif'; g.fillStyle = '#ffd6ff'; g.fillText('🔫 ' + '●'.repeat(st.ammo) + '○'.repeat(3 - st.ammo), W - 70, 86); }
  g.textAlign = 'center';
  for (const m of msgs) {
    const a = Math.min(1, (m.life - m.t) / 0.4), y = m.big ? H * 0.3 : H * 0.42 - m.t * 30;
    g.globalAlpha = a;
    if (m.big) { g.fillStyle = 'rgba(6,12,24,.6)'; g.fillRect(0, y - 46, W, m.sub ? 92 : 64); }
    g.fillStyle = m.c; g.font = `800 ${m.big ? 32 : 24}px sans-serif`; g.fillText(m.text, W / 2, y);
    if (m.sub) { g.fillStyle = '#e6eefa'; g.font = '600 17px sans-serif'; wrapText(m.sub, W / 2, y + 30, W - 40, 22); }
    g.globalAlpha = 1;
  }
}
function wrapText(s, x, y, maxW, lh) { const words = s.split(' '); let line = ''; for (const w of words) { const tl = line ? line + ' ' + w : w; if (g.measureText(tl).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = tl; } g.fillText(line, x, y); }
function drawHero() {
  if (st.inv > 0 && Math.floor(st.inv * 12) % 2 === 0 && !st.over) return;
  g.save(); g.translate(P.x, P.y);
  const img = k => cb.img ? cb.img(k) : null;
  if (st.riding) {   // 친구 탈것에 같이 탄 나(탈것은 친구 쪽 그림으로 그려진다)
    const sit = img('esc-p-sit'), b = Math.sin(t * 5) * 3;
    if (sit) g.drawImage(sit, -24, -26 + b, 48, 48); else { g.fillStyle = '#ff7a5e'; g.beginPath(); g.arc(0, b, 10, 0, TAU); g.fill(); }
    g.restore(); return;
  }
  if (st.balloon > 0) {   // 풍선이 된 나
    drawBalloon('#ff7a5e', st.balloon < 4 && Math.floor(t * 6) % 2);
    g.restore(); g.fillStyle = '#fff'; g.font = '800 18px sans-serif'; g.textAlign = 'center'; g.fillText(`🎈 구조를 기다리는 중 ${Math.ceil(st.balloon)}`, P.x, P.y + 50); return;
  }
  if (isRide(st.phase)) {
    drawRide(st.phase, img('boss-' + st.phase));
    if (st.phase === 'core') {   // 중력 화살표: 이쪽으로 떨어진다
      const d = P.gdir > 0 ? 1 : -1, pulse = 1 + Math.sin(t * 8) * 0.12; g.save(); g.translate(78, 0); g.scale(pulse, pulse * d);
      g.fillStyle = d > 0 ? '#ff9a5e' : '#9dd8ff'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-8, -26); g.lineTo(8, -26); g.lineTo(8, 2); g.lineTo(18, 2); g.lineTo(0, 26); g.lineTo(-18, 2); g.lineTo(-8, 2); g.closePath(); g.stroke(); g.fill(); g.restore();
    }
    g.restore(); return;
  }
  const shipIm = st.phase === 'plane' && img('ship-' + (cb.frame || 'falcon'));
  if (shipIm) {   // 볼트윙 기체 그림(위를 보는 그림을 오른쪽으로 돌림)
    g.rotate(P.tilt + Math.PI / 2);
    g.fillStyle = '#ffb347'; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(0, 34 + Math.random() * 6, 7, 14, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.drawImage(shipIm, -36, -36, 72, 72);
  } else if (st.phase === 'plane') {   // 그림이 없으면 도형 비행기
    g.rotate(P.tilt);
    g.fillStyle = '#4cc9ff'; g.beginPath(); g.moveTo(34, 0); g.lineTo(-26, -14); g.lineTo(-20, 0); g.lineTo(-26, 14); g.closePath(); g.fill();
    g.fillStyle = '#2a8fc4'; g.beginPath(); g.moveTo(4, 0); g.lineTo(-14, -30); g.lineTo(-22, -30); g.lineTo(-10, 0); g.lineTo(-22, 30); g.lineTo(-14, 30); g.closePath(); g.fill();
    g.fillStyle = '#ffb347'; g.beginPath(); g.ellipse(-30 - Math.random() * 6, 0, 10, 5, 0, 0, TAU); g.fill();
  } else if (st.phase === 'bird' && img('esc-bird1')) {   // 새 그림: 오를 때 날개 펼침, 떨어질 때 접음
    g.rotate(P.tilt * 0.7);
    const up = P.vy < 60 || P.flapT > 0.08, bi = img(up ? 'esc-bird1' : 'esc-bird2'), s = 118;
    g.drawImage(bi, -s / 2, -s / 2, s, s);
    const sit = img('esc-p-sit'); if (sit) g.drawImage(sit, -10, up ? -66 : -60, 50, 50);   // 안장 위 조종사
  } else if (st.phase === 'bird') {   // 새(그림이 없을 때)
    g.rotate(P.tilt);
    const wf = Math.sin(t * (hold ? 26 : 8)) * 0.9;
    g.fillStyle = '#e8d8b8'; g.beginPath(); g.ellipse(0, 0, 30, 15, 0, 0, TAU); g.fill();
    g.fillStyle = '#c9b48e'; g.save(); g.rotate(-0.3 - wf * 0.5); g.beginPath(); g.ellipse(-4, -14, 26, 9, -0.4, 0, TAU); g.fill(); g.restore();
    g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(28, -3); g.lineTo(42, 2); g.lineTo(28, 5); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(18, -5, 2.5, 0, TAU); g.fill();
    g.fillStyle = '#ff7a5e'; g.beginPath(); g.arc(-2, -20, 9, 0, TAU); g.fill();   // 등에 탄 조종사
  } else {   // 조종사(로프)
    const sp = Math.hypot(P.vx, P.vy), ang = P.rope ? Math.atan2(P.rope.a.y - P.y, P.rope.a.x - P.x) + Math.PI / 2 : clamp(P.vx / 900, -0.6, 0.6);
    const pose = P.rope ? 'esc-p-rope' : P.vy > 380 || st.inv > 0.9 ? 'esc-p-fall' : 'esc-p-fly', pim = img(pose);
    if (pim) {   // 조종사 그림: 로프에 매달림 · 날아감 · 떨어짐
      if (P.rope) { g.rotate(ang); const s = 80; g.drawImage(pim, -s * 0.42, -s * 0.5, s, s); }
      else if (pose === 'esc-p-fly') { g.rotate(clamp(Math.atan2(P.vy, Math.max(80, P.vx)), -0.7, 0.9)); const s = 84; g.drawImage(pim, -s / 2, -s / 2, s, s); }
      else { g.rotate(Math.sin(t * 9) * 0.15); const s = 78; g.drawImage(pim, -s / 2, -s / 2, s, s); }
      if (sp > 700) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-30 - i * 6, 10 + i * 6); g.lineTo(-54 - i * 8, 14 + i * 6); g.stroke(); } }
      g.restore(); return;
    }
    g.rotate(ang);
    g.fillStyle = '#ff7a5e'; g.beginPath(); g.ellipse(0, 4, 12, 16, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffe0c0'; g.beginPath(); g.arc(0, -14, 10, 0, TAU); g.fill();
    g.fillStyle = '#4cc9ff'; g.fillRect(-9, -18, 18, 6);
    if (sp > 700) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-14 - i * 6, 10 + i * 6); g.lineTo(-34 - i * 8, 14 + i * 6); g.stroke(); } }
  }
  g.restore();
}
// 보스 기계 옆모습 그림(side-<id>): 크기, 좌석 자리(그림 안 0~1), 좌우 뒤집기. 없으면 위에서 본 보스 그림을 돌려 쓴다
const SIDE = { spider: { s: 150, seat: [0.43, 0.2] }, whale: { s: 170, seat: [0.6, 0.4] }, knight: { s: 160, seat: [0.47, 0.17], flip: true }, twins: { s: 150, seat: null, flip: true } };   // 쌍둥이 그림엔 조종사가 이미 타 있다
function sideImg(ph) { const d = SIDE[ph], im = d && cb.img && cb.img('side-' + ph); return im ? Object.assign({ im }, d) : null; }
function drawSide(sd, alpha) {   // (0,0) 가운데에 옆모습 그림 + 좌석의 조종사
  g.save(); if (sd.flip) g.scale(-1, 1); g.drawImage(sd.im, -sd.s / 2, -sd.s / 2, sd.s, sd.s); g.restore();
  const sit = cb.img && cb.img('esc-p-sit'), ps = sd.s * 0.35;
  if (sit && alpha !== 0 && sd.seat) g.drawImage(sit, (sd.seat[0] - 0.5) * sd.s - ps / 2, (sd.seat[1] - 0.5) * sd.s - ps / 2, ps, ps);
}
// 보스 기계 탈것: 옆모습 그림이 있으면 그것으로, 없으면 보스 그림(아래를 보는 그림)을 오른쪽으로 돌려 그리고 등에 조종사를 태운다
function drawRide(ph, im) {
  const bob = Math.sin(t * 5) * 3, S0 = 120, sd = sideImg(ph);
  if (sd) {
    g.save();
    if (ph === 'spider' && P.side < 0) g.scale(1, -1);
    g.translate(0, bob + (ph === 'spider' ? Math.abs(Math.sin(t * 12)) * -4 : 0));
    if (ph !== 'spider') g.rotate(P.tilt * (ph === 'twins' ? 0.6 : 1));
    if (ph === 'knight' && P.dashT > 0) { g.fillStyle = 'rgba(200,230,255,.35)'; g.beginPath(); g.moveTo(40, -40); g.lineTo(-160, -16); g.lineTo(-160, 16); g.lineTo(40, 40); g.fill(); }
    if (ph === 'twins' && st.muzzle > 0) { g.fillStyle = `rgba(255,200,255,${st.muzzle * 4})`; g.beginPath(); g.arc(sd.s * 0.47, -sd.s * 0.19, 16, 0, TAU); g.arc(sd.s * 0.47, sd.s * 0.13, 16, 0, TAU); g.fill(); }
    drawSide(sd);
    g.restore(); return;
  }
  g.save();
  if (ph === 'spider' && P.side < 0) g.scale(1, -1);   // 천장에 붙으면 뒤집힌다
  g.translate(0, bob);
  if (ph === 'whale' || ph === 'knight') g.rotate(P.tilt);
  if (ph === 'core') g.rotate(t * 0.8 * P.gdir);
  if (ph === 'knight' && P.dashT > 0) {   // 돌진 빛 궤적
    g.fillStyle = 'rgba(200,230,255,.35)'; g.beginPath(); g.moveTo(40, -30); g.lineTo(-140, -14); g.lineTo(-140, 14); g.lineTo(40, 30); g.fill();
  }
  if (im) {
    g.save(); g.rotate(-Math.PI / 2);
    if (ph === 'spider') g.rotate(Math.sin(t * 14) * 0.05);   // 걸음
    g.drawImage(im, -S0 / 2, -S0 / 2, S0, S0); g.restore();
  } else {   // 그림이 없을 때의 도형
    const col = { spider: '#7a8696', whale: '#4a90c8', knight: '#c8d4e8', core: '#b48cff' }[ph];
    g.fillStyle = col; g.beginPath();
    if (ph === 'core') { for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); } }
    else g.ellipse(0, 0, ph === 'whale' ? 58 : 44, ph === 'whale' ? 30 : 26, 0, 0, TAU);
    g.fill();
    if (ph === 'spider') { g.strokeStyle = col; g.lineWidth = 5; for (let i = 0; i < 4; i++) { const x = -30 + i * 20, s = Math.sin(t * 14 + i * 1.6) * 8; g.beginPath(); g.moveTo(x, 10); g.lineTo(x + s, 40); g.stroke(); } }
    if (ph === 'knight') { g.fillStyle = '#e8f2ff'; g.fillRect(30, -4, 46, 8); }
    if (ph === 'core') { g.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 6) * 0.3})`; g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill(); }
  }
  g.restore();
  // 등에 탄 조종사(거미가 천장에 있으면 아래쪽에 매달림)
  const py = (ph === 'spider' && P.side < 0 ? 40 : -40) + bob, sit = cb.img && cb.img('esc-p-sit');
  if (sit) { g.save(); g.translate(-6, py); if (ph === 'spider' && P.side < 0) g.scale(1, -1); g.drawImage(sit, -26, -34, 52, 52); g.restore(); return; }
  g.fillStyle = '#ff7a5e'; g.beginPath(); g.arc(-6, py, 10, 0, TAU); g.fill();
  g.fillStyle = '#ffe0c0'; g.beginPath(); g.arc(-6, py - (P.side < 0 && ph === 'spider' ? -12 : 12), 7, 0, TAU); g.fill();
}
function ghostAt() {   // 유령: 기록한 길을 같은 시간에 따라간다
  if (!opt.ghost || !opt.ghost.path || !opt.ghost.path.length) return null;
  const pa = opt.ghost.path, f = t / 0.1, i = Math.min(pa.length - 1, Math.floor(f)), j = Math.min(pa.length - 1, i + 1), k = Math.min(1, f - i);
  if (!(i >= 0)) return null;
  return { x: pa[i][0] + (pa[j][0] - pa[i][0]) * k, y: pa[i][1] + (pa[j][1] - pa[i][1]) * k, ph: PH_ID[pa[i][2]] || 'rope', name: '👻 최고 기록', color: '#c8d8ff', over: i >= pa.length - 1, frame: cb.frame };
}
function drawBalloon(col, blink) {   // (0,0)에 매달린 조종사 + 위의 풍선
  const sw = Math.sin(t * 2.4) * 0.12;
  g.save(); g.rotate(sw);
  g.strokeStyle = '#e6eefa'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, -52); g.stroke();
  g.fillStyle = blink ? '#ffffff' : col; g.beginPath(); g.ellipse(0, -80, 26, 32, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-9, -90, 6, 10, -0.4, 0, TAU); g.fill();
  g.fillStyle = col; g.beginPath(); g.moveTo(-5, -47); g.lineTo(5, -47); g.lineTo(0, -53); g.fill();
  const pr = cb.img && cb.img('esc-p-rope');   // 풍선 줄에 매달린 조종사
  if (pr) g.drawImage(pr, -60 * 0.42, -14, 60, 60);
  else { g.fillStyle = '#ff7a5e'; g.beginPath(); g.ellipse(0, 4, 11, 14, 0, 0, TAU); g.fill(); g.fillStyle = '#ffe0c0'; g.beginPath(); g.arc(0, -12, 9, 0, TAU); g.fill(); }
  g.restore();
}
function drawOther(o) {   // 친구·유령은 반투명하게(부딪히지 않는다)
  if (o.bl) {   // 풍선이 된 친구: 진하게, 구해 달라고
    g.save(); g.translate(o.x, o.y); g.globalAlpha = 0.9; drawBalloon(o.color, Math.floor(t * 4) % 2); g.restore();
    g.globalAlpha = 1; g.fillStyle = o.color; g.font = '800 16px sans-serif'; g.textAlign = 'center'; g.fillText(`🎈 ${o.name} 구해 줘!`, o.x, o.y + 46);
    g.strokeStyle = 'rgba(157,255,207,.6)'; g.lineWidth = 3; g.beginPath(); g.arc(o.x, o.y - 40, 60 + Math.sin(t * 6) * 6, 0, TAU); g.stroke(); return;
  }
  const im = cb.img ? (o.ph === 'plane' ? cb.img('ship-' + (o.frame || 'falcon')) : isRide(o.ph) ? cb.img('boss-' + o.ph) : o.ph === 'bird' ? cb.img('esc-bird1') : o.ph === 'rope' ? cb.img('esc-p-fly') : null) : null;
  if (o.ps) return;   // 같이 탄 사람은 앞사람 탈것 위에 그린다(앞사람 쪽에서)
  g.save(); g.globalAlpha = o.over ? 0.22 : o.id === st.riding ? 1 : 0.5; g.translate(o.x, o.y);
  const so = isRide(o.ph) && sideImg(o.ph);
  if (so) drawSide(so, 0);
  else if (im && (o.ph === 'bird' || o.ph === 'rope')) { const s = o.ph === 'bird' ? 100 : 70; g.drawImage(im, -s / 2, -s / 2, s, s); }
  else if (im) { g.rotate(o.ph === 'plane' ? Math.PI / 2 : -Math.PI / 2); const s = o.ph === 'plane' ? 62 : 100; g.drawImage(im, -s / 2, -s / 2, s, s); }
  else if (o.ph === 'rope') { g.fillStyle = o.color; g.beginPath(); g.ellipse(0, 4, 12, 16, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -14, 9, 0, TAU); g.fill(); }
  else { g.fillStyle = o.color; g.beginPath(); g.ellipse(0, 0, 30, 14, 0, 0, TAU); g.fill(); }
  g.restore();
  g.globalAlpha = o.over ? 0.4 : 0.95; g.fillStyle = o.color; g.font = '800 15px sans-serif'; g.textAlign = 'center';
  g.fillText(o.over ? `${o.name} 💥` : o.name, o.x, o.y - (o.ph === 'rope' ? 34 : 52)); g.globalAlpha = 1;
}
function drawWreck(w) {   // 버린 탈것(빙글빙글 떨어진다, 그을려 어둡게)
  const im = cb.img ? cb.img(w.k === 'plane' ? 'ship-' + (cb.frame || 'falcon') : w.k === 'bird' ? (Math.floor(t * 8) % 2 ? 'esc-bird1' : 'esc-bird2') : 'boss-' + w.k) : null;
  g.save(); g.translate(w.x, w.y); g.rotate(w.rot); g.filter = w.k === 'bird' ? 'none' : 'brightness(0.55)';
  const sw = sideImg(w.k);
  if (sw) { if (sw.flip) g.scale(-1, 1); g.drawImage(sw.im, -sw.s / 2, -sw.s / 2, sw.s, sw.s); }
  else if (im && w.k === 'bird') g.drawImage(im, -55, -55, 110, 110);
  else if (im) { g.rotate(w.k === 'plane' ? Math.PI / 2 : -Math.PI / 2); const s = w.k === 'plane' ? 72 : 120; g.drawImage(im, -s / 2, -s / 2, s, s); }
  else { g.fillStyle = w.k === 'bird' ? '#e8d8b8' : w.k === 'plane' ? '#4cc9ff' : '#7a8696'; g.beginPath(); g.ellipse(0, 0, 32, 15, 0, 0, TAU); g.fill(); }
  g.filter = 'none'; g.restore();
}
function banner(text, sub) { msgs = msgs.filter(m => !m.big); msgs.push({ text, sub, c: '#ffd166', t: 0, life: 3, big: true }); }
function say(text, c) { msgs.push({ text, c, t: 0, life: 1.1 }); }
function spark(x, y, c, n = 8) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-180, 180), vy: rnd(-260, 60), t: 0, life: 0.5, c, s: rnd(3, 6) }); }
function sfx(k) { if (cb.sfx) cb.sfx(k); }
return { start, netEvent, get others() { return others; }, get cam() { return cam; }, get on() { return on; }, K, get st() { return st; }, get P() { return P; }, press, get items() { return items; } };   // st·P·press·items는 점검용
})();
