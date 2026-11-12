// 볼트윙 「탈출 작전」 시험판(로드맵 9-1): 오른쪽으로 나아가는 한 손가락 모드.
// 비행기(누르면 오름) → 비상 탈출 → 로프(누르면 앞 위의 고리에 걸려 흔들리고, 떼면 날아감) → 새(누르면 날갯짓, 말을 잘 안 들음) → 다시 로프 …
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
  pump: 260,            // 매달려 앞으로 흔들 때 더해지는 힘
  reel: 70,             // 누르고 있으면 로프가 감기는 빠르기(짧을수록 빨리 돈다)
  flyRise: 1700, flySink: 1150, flyMax: 520,   // 비행기
  birdFlap: 400, birdG: 1250, birdEvery: 0.2,  // 새: 누르고 있으면 0.2초마다 날갯짓
  segPlane: 1900, segRope: 2600, segBird: 1900, // 구간 길이(px)
};
let cv, g, box, cb = {}, on = false, raf = 0, last = 0;
let st, P, cam, items, hold = false, holdT = 0, msgs, parts, t;

function start(callbacks) {
  cb = callbacks || {};
  if (!box) build();
  box.classList.remove('hidden'); box.querySelector('.esRes').classList.add('hidden');
  t = 0; cam = 0; items = []; msgs = []; parts = [];
  st = { phase: 'plane', segEnd: K.segPlane, loop: 0, hearts: 3, inv: 1.5, coins: 0, dist: 0, genX: 600, over: false, hintT: 0, seen: {} };
  P = { x: 160, y: 420, vx: 300, vy: 0, rope: null, flapT: 0, tilt: 0 };
  banner('✈️ 비행 구간', '누르고 있으면 올라가요 · 떼면 내려가요');
  on = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function build() {
  box = document.createElement('div'); box.id = 'escape'; box.className = 'hidden';
  box.innerHTML = `<canvas width="${W}" height="${H}"></canvas><button class="esQuit">✕</button>
    <div class="esRes hidden"><h2>탈출 작전</h2><div class="esStat"></div><div class="row"><button class="btn big esAgain">다시 ▶</button><button class="btn sub esHome">격납고로</button></div><small>시험판이에요. 손맛이 어떤지 알려 주세요!</small></div>`;
  document.getElementById('stage').append(box);
  cv = box.querySelector('canvas'); g = cv.getContext('2d');
  const down = e => { if (!on || st.over) return; e.preventDefault(); press(true); };
  const up = e => { if (!on) return; e.preventDefault(); press(false); };
  cv.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  window.addEventListener('keydown', e => { if (!on) return; if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat && !st.over) press(true); } if (e.code === 'Escape') { e.stopImmediatePropagation(); finish(true); } }, true);
  window.addEventListener('keyup', e => { if (!on) return; if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') { e.stopImmediatePropagation(); press(false); } }, true);
  box.querySelector('.esQuit').addEventListener('click', () => finish(true));
  box.querySelector('.esAgain').addEventListener('click', () => start(cb));
  box.querySelector('.esHome').addEventListener('click', () => { close(); });
}
function close() { on = false; cancelAnimationFrame(raf); box.classList.add('hidden'); if (cb.home) cb.home(); }
function press(v) {
  if (v === hold) return; hold = v; holdT = 0;
  if (st.phase === 'rope') { if (v) shoot(); else letGo(); }
  if (st.phase === 'bird' && v) flap();
  if (v && st.phase === 'spider') { P.side = -P.side; P.vy = P.side * -200; sfx('flap'); }
  if (v && st.phase === 'knight' && !(P.dashT > 0) && !(P.dashCd > 0)) { P.dashT = 0.32; P.dashCd = 0.55; P.vy = -430; sfx('release'); }
  if (v && st.phase === 'core') { P.gdir = -P.gdir; sfx('flap'); }
}
// ---------- 로프 ----------
function shoot() {
  let best = null, bs = 1e9;
  for (const it of items) {
    if (it.k !== 'anchor' || it.x < P.x - 40 || it.y > P.y - 20) continue;
    const d = Math.hypot(it.x - P.x, it.y - P.y); if (d > K.ropeReach) continue;
    const s = d - (it.x - P.x) * 0.6;   // 앞쪽 고리를 더 좋아한다
    if (s < bs) { bs = s; best = it; }
  }
  if (!best) { say('닿는 고리가 없어요!', '#ffb3b3'); P.miss = 0.25; return; }
  P.rope = { a: best, L: Math.max(K.ropeMin, Math.hypot(best.x - P.x, best.y - P.y)) };
  best.used = true; sfx('rope');
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
    const x = st.genX, ph = phaseAt(x), lv = st.loop;
    if (ph === 'rope') {
      const y = rnd(130, 300); items.push({ k: 'anchor', x, y });
      for (let i = 1; i <= 3; i++) items.push({ k: 'coin', x: x + i * 60, y: y + 230 + Math.sin(i) * 30 });
      if (lv + st.dist / 4000 > 0.6 && Math.random() < 0.35) items.push({ k: 'spike', x: x + rnd(110, 170), y: rnd(430, 620), r: 26 });
      st.genX += rnd(230, 320) + lv * 15;
    } else if (ph === 'spider') {   // 거미: 천장이나 바닥에서 솟은 반쪽 기둥 → 반대쪽으로 옮겨 붙어야 한다
      const fromTop = Math.random() < 0.5, len = rnd(330, 470);
      items.push(fromTop ? { k: 'wall', x, top: 0, bot: len, w: 70 } : { k: 'wall', x, top: GROUND - len, bot: GROUND, w: 70 });
      for (let i = 0; i < 3; i++) items.push({ k: 'coin', x: x + 35, y: fromTop ? GROUND - 40 - i * 40 : 70 + i * 40 });
      st.genX += rnd(380, 470) - Math.min(60, lv * 15);
    } else {   // 비행기·새·보스 탈것: 위아래 기둥 사이 틈
      const gap = ({ bird: 330, whale: 360, knight: 300, core: 320 }[ph] || 300) - Math.min(70, lv * 15), gy = rnd(220, GROUND - 120 - gap);
      items.push({ k: 'wall', x, top: 0, bot: gy, w: 70 }, { k: 'wall', x, top: gy + gap, bot: GROUND, w: 70 });
      for (let i = 0; i < 3; i++) items.push({ k: 'coin', x: x + 35, y: gy + gap * (0.3 + i * 0.2) });
      st.genX += rnd(360, 440) - Math.min(60, lv * 15);
    }
  }
  items = items.filter(it => it.x > cam - 200 && !it.gone);
}
// 탈것: 새와 보스 기계 4종. 판마다 순서가 섞인다(비행기 → 로프 → 탈것 → 로프 → …)
const RIDES = ['bird', 'spider', 'whale', 'knight', 'core'];
const RIDE_NM = {
  bird: ['🐦 새에 올라탔다!', '누르고 있으면 날갯짓(오름) · 떼면 떨어져요 · 말을 잘 안 들어요!'],
  spider: ['🕷️ 강철 거미에 올라탔다!', '누를 때마다 천장 ↔ 바닥으로 옮겨 붙어요 · 거미는 용암도 견뎌요'],
  whale: ['🐋 폭풍 고래에 올라탔다!', '누르면 천천히 오르고 떼면 천천히 내려가요 · 기둥은 몸으로 부숴요 · 동전을 빨아들여요'],
  knight: ['⚔️ 거울 기사에 올라탔다!', '누를 때마다 앞으로 돌진하며 살짝 떠올라요 · 돌진 중엔 기둥을 베어요'],
  core: ['💠 코어 요새에 올라탔다!', '누를 때마다 중력이 위아래로 뒤집혀요'],
};
function phaseAt(x) {   // 이 자리가 어느 구간인가(구간 경계는 판을 시작할 때 정한다)
  if (!st.plan) {
    st.plan = []; let at = 0, bag = [];
    for (let i = 0; i < 40; i++) {
      let ph = ['plane', 'rope', 'ride', 'rope'][i % 4];
      if (ph === 'ride') { if (!bag.length) bag = RIDES.slice().sort(() => Math.random() - 0.5); ph = bag.pop(); }
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
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (!st.over) update(dt);
  draw();
  raf = requestAnimationFrame(loop);
}
function update(dt) {
  t += dt; holdT += dt; if (st.inv > 0) st.inv -= dt; if (P.miss > 0) P.miss -= dt;
  const ph = phaseAt(P.x);
  if (ph !== st.phase) changePhase(ph);
  st.loop = Math.floor(P.x / (K.segPlane + K.segRope * 2 + K.segBird));
  const speed = 300 + st.loop * 30;
  if (st.phase === 'plane') {
    P.vx = speed; P.vy += (hold ? -K.flyRise : K.flySink) * dt; P.vy = clamp(P.vy, -K.flyMax, K.flyMax);
    P.tilt = P.vy / 1400;
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
  } else if (st.phase === 'core') {   // 코어: 중력 뒤집기
    P.vx = speed; P.vy += P.gdir * 1700 * dt; P.vy = clamp(P.vy, -620, 620); P.tilt = 0;
  } else {   // 로프
    P.vy += K.g * dt;
    if (P.rope) {
      const a = P.rope.a, dx = P.x - a.x, dy = P.y - a.y, d = Math.hypot(dx, dy) || 1;
      let tx = -dy / d, ty = dx / d; if (tx < 0) { tx = -tx; ty = -ty; }   // 줄에 수직, 앞쪽
      if (P.vx > -50) { P.vx += tx * K.pump * dt; P.vy += ty * K.pump * dt; }
      if (hold) P.rope.L = Math.max(K.ropeMin, P.rope.L - K.reel * dt);
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
    if (P.x > a.x + 40 && P.y < a.y + 20) letGo();   // 고리 위로 넘어가면 저절로 놓는다
  }
  if (P.y < 30) { P.y = 30; if (P.vy < 0) P.vy = 0; }
  cam += (P.x - W * 0.32 - cam) * Math.min(1, dt * 6);
  st.dist = Math.max(st.dist, Math.floor(P.x / 10));
  gen();
  // 부딪힘
  for (const it of items) {
    if (it.k === 'coin' && !it.gone && Math.hypot(it.x - P.x, it.y - P.y) < 30) { it.gone = true; st.coins++; sfx('coin'); spark(it.x, it.y, '#ffd166'); }
    const hr = isRide(st.phase) ? 26 : 18;
    if (it.k === 'wall' && !it.gone && P.x + hr > it.x && P.x - hr < it.x + it.w && P.y + hr > it.top && P.y - hr < it.bot) {
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
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; }
  parts = parts.filter(p => p.t < p.life);
  for (const m of msgs) m.t += dt; msgs = msgs.filter(m => m.t < m.life);
}
function changePhase(ph) {
  const was = st.phase; st.phase = ph; P.rope = null;
  if (ph === 'rope') {
    for (let i = 0; i < 14; i++) parts.push({ x: P.x, y: P.y, vx: rnd(-200, 100), vy: rnd(-300, 100), t: 0, life: 1.2, c: was === 'bird' ? '#d9c7a8' : '#9aa6b4', s: rnd(4, 9) });
    P.vx = 320; P.vy = -720;
    const off = { plane: '🚨 엔진 고장! 비상 탈출!', bird: '🐦 새가 지쳤다! 뛰어내려!', spider: '🕷️ 거미가 멈췄다! 뛰어내려!', whale: '🐋 고래가 잠들었다! 뛰어내려!', knight: '⚔️ 기사가 무릎을 꿇었다! 뛰어내려!', core: '💠 코어가 꺼졌다! 뛰어내려!' };
    banner(off[was] || '뛰어내려!', st.seen.rope ? '누르면 로프 · 떼면 날아가요' : '누르고 있으면 앞 위 고리에 로프가 걸려 흔들려요 · 떼면 그 힘으로 날아가요');
    // 탈출하자마자 잡을 고리를 하나 둔다
    items.push({ k: 'anchor', x: P.x + 260, y: 170 });
    st.genX = Math.max(st.genX, P.x + 520);
  } else if (RIDE_NM[ph]) {
    const nm = RIDE_NM[ph]; P.vy = -150; P.side = 1; P.gdir = 1; P.dashT = 0; P.dashCd = 0;
    banner(nm[0], st.seen[ph] ? nm[1].split(' · ')[0] : nm[1]);
    // 탈것으로 바뀌는 자리 바로 앞은 비워 둔다(갑자기 기둥에 부딪히지 않게)
    items = items.filter(it => !(it.k === 'wall' && it.x > P.x - 40 && it.x < P.x + 320));
  } else { P.vy = -100; banner('✈️ 새 비행기를 잡아탔다!', '누르면 올라가요'); }
  st.seen[ph] = true; st.inv = Math.max(st.inv, 1); sfx('phase');
}
function respawn() {
  const a = items.filter(it => it.k === 'anchor' && it.x > P.x - 60).sort((p, q) => p.x - q.x)[0];
  if (a) { P.x = a.x - 20; P.y = a.y + 140; P.vx = 200; P.vy = 0; P.rope = { a, L: 150 }; }
  else { P.y = 300; P.vy = -300; }
  st.inv = 1.6;
}
function hurt(why) {
  if (st.inv > 0) return;
  st.hearts--; st.inv = 1.3; say(why, '#ff8a8a'); sfx('hurt'); spark(P.x, P.y, '#ff6b5e', 14);
  if (st.hearts <= 0) gameOver();
}
function gameOver() {
  st.over = true; on = true;
  const scrap = Math.floor(st.dist / 60) + st.coins;
  const best = cb.best ? cb.best(st.dist) : 0;
  if (cb.gain) cb.gain(scrap, st.dist);
  const r = box.querySelector('.esRes'); r.classList.remove('hidden');
  r.querySelector('.esStat').innerHTML = `<div class="big">${st.dist.toLocaleString()} m</div><div>🪙 ${st.coins} · 🔩 고철 +${scrap}</div>${best && st.dist >= best ? '<div class="rec">🏆 최고 기록!</div>' : best ? `<div>최고 ${best.toLocaleString()} m</div>` : ''}`;
}
function finish(quit) { if (!st || st.over) { close(); return; } if (quit) { st.hearts = 0; gameOver(); } }
// ---------- 그리기 ----------
function draw() {
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#2b4f86'); sky.addColorStop(0.6, '#7fa8d6'); sky.addColorStop(1, '#f2b58a');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (const [k, c, base, amp] of [[0.2, '#5a77a3', 640, 90], [0.45, '#3f5a80', 720, 70]]) {   // 먼 산(느리게)
    g.fillStyle = c; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) { const wx = x + cam * k; g.lineTo(x, base - Math.abs(Math.sin(wx / 160)) * amp - Math.sin(wx / 53) * 12); }
    g.lineTo(W, H); g.fill();
  }
  g.save(); g.translate(-cam, 0);
  // 용암 바닥
  const lg = g.createLinearGradient(0, GROUND, 0, H); lg.addColorStop(0, '#ff7a2a'); lg.addColorStop(1, '#8a1c08');
  g.fillStyle = lg; g.fillRect(cam - 10, GROUND, W + 20, H - GROUND);
  g.fillStyle = 'rgba(255,220,120,.6)'; for (let x = Math.floor(cam / 40) * 40; x < cam + W + 40; x += 40) g.fillRect(x + Math.sin(t * 3 + x) * 8, GROUND + 6 + Math.sin(t * 2 + x / 30) * 3, 16, 3);
  for (const it of items) {
    if (it.gone) continue;
    if (it.k === 'anchor') {
      const near = !P.rope && st.phase === 'rope' && it.x > P.x - 40 && it.y < P.y - 20 && Math.hypot(it.x - P.x, it.y - P.y) < K.ropeReach;
      g.strokeStyle = '#5b6470'; g.lineWidth = 2; g.beginPath(); g.moveTo(it.x, 0); g.lineTo(it.x, it.y - 14); g.stroke();
      g.strokeStyle = near ? '#9dffcf' : '#d6dde6'; g.lineWidth = 6; g.beginPath(); g.arc(it.x, it.y, 13, 0, TAU); g.stroke();
      if (near) { g.strokeStyle = 'rgba(157,255,207,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(it.x, it.y, 22 + Math.sin(t * 8) * 3, 0, TAU); g.stroke(); }
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
  if (P.rope) { g.strokeStyle = '#f4e3b5'; g.lineWidth = 3; g.beginPath(); g.moveTo(P.rope.a.x, P.rope.a.y); g.lineTo(P.x, P.y); g.stroke(); }
  if (P.miss > 0) { g.strokeStyle = `rgba(255,180,180,${P.miss * 3})`; g.lineWidth = 2; g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(P.x + 160, P.y - 260); g.stroke(); }
  drawHero();
  for (const p of parts) { g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
  g.globalAlpha = 1;
  g.restore();
  // 화면 위 글자
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '800 30px sans-serif'; g.fillText(`${st.dist.toLocaleString()} m`, 24, 56);
  g.font = '600 20px sans-serif'; g.fillText(`🪙 ${st.coins}`, 24, 88);
  g.textAlign = 'right'; g.font = '26px sans-serif'; g.fillText('❤️'.repeat(Math.max(0, st.hearts)) + '🤍'.repeat(Math.max(0, 3 - st.hearts)), W - 70, 56);
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
  if (isRide(st.phase)) { drawRide(st.phase, img('boss-' + st.phase)); g.restore(); return; }
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
  } else if (st.phase === 'bird') {   // 새
    g.rotate(P.tilt);
    const wf = Math.sin(t * (hold ? 26 : 8)) * 0.9;
    g.fillStyle = '#e8d8b8'; g.beginPath(); g.ellipse(0, 0, 30, 15, 0, 0, TAU); g.fill();
    g.fillStyle = '#c9b48e'; g.save(); g.rotate(-0.3 - wf * 0.5); g.beginPath(); g.ellipse(-4, -14, 26, 9, -0.4, 0, TAU); g.fill(); g.restore();
    g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(28, -3); g.lineTo(42, 2); g.lineTo(28, 5); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(18, -5, 2.5, 0, TAU); g.fill();
    g.fillStyle = '#ff7a5e'; g.beginPath(); g.arc(-2, -20, 9, 0, TAU); g.fill();   // 등에 탄 조종사
  } else {   // 조종사(로프)
    const sp = Math.hypot(P.vx, P.vy), ang = P.rope ? Math.atan2(P.rope.a.y - P.y, P.rope.a.x - P.x) + Math.PI / 2 : clamp(P.vx / 900, -0.6, 0.6);
    g.rotate(ang);
    g.fillStyle = '#ff7a5e'; g.beginPath(); g.ellipse(0, 4, 12, 16, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffe0c0'; g.beginPath(); g.arc(0, -14, 10, 0, TAU); g.fill();
    g.fillStyle = '#4cc9ff'; g.fillRect(-9, -18, 18, 6);
    if (sp > 700) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-14 - i * 6, 10 + i * 6); g.lineTo(-34 - i * 8, 14 + i * 6); g.stroke(); } }
  }
  g.restore();
}
// 보스 기계 탈것: 보스 그림(아래를 보는 그림)을 오른쪽으로 돌려 그리고 등에 조종사를 태운다
function drawRide(ph, im) {
  const bob = Math.sin(t * 5) * 3, S0 = 120;
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
  const py = (ph === 'spider' && P.side < 0 ? 40 : -40) + bob;
  g.fillStyle = '#ff7a5e'; g.beginPath(); g.arc(-6, py, 10, 0, TAU); g.fill();
  g.fillStyle = '#ffe0c0'; g.beginPath(); g.arc(-6, py - (P.side < 0 && ph === 'spider' ? -12 : 12), 7, 0, TAU); g.fill();
}
function banner(text, sub) { msgs = msgs.filter(m => !m.big); msgs.push({ text, sub, c: '#ffd166', t: 0, life: 3, big: true }); }
function say(text, c) { msgs.push({ text, c, t: 0, life: 1.1 }); }
function spark(x, y, c, n = 8) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-180, 180), vy: rnd(-260, 60), t: 0, life: 0.5, c, s: rnd(3, 6) }); }
function sfx(k) { if (cb.sfx) cb.sfx(k); }
return { start, get on() { return on; }, K, get st() { return st; }, get P() { return P; }, press, get items() { return items; } };   // st·P·press·items는 점검용
})();
