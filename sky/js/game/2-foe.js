// 볼트윙 게임 본체 (효과·적·보스·함정·비트 러시·리듬 결투·갈림길) — js/game/ 파일들과 js/game.js는 한 이름 공간을 나눠 쓴다(index.html에 적힌 순서대로 읽음).
'use strict';
// ---------- 효과 ----------
const fxCap = () => (Q.low ? 260 : 700);
function spark(x, y, n, color, sp = 220, life = 0.5, size = 3) {
  if (Q.low) n = Math.ceil(n / 2);
  for (let i = 0; i < n && fx.length < fxCap(); i++) {
    const a = rnd(0, TAU), v = rnd(0.3, 1) * sp;
    fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(life * 0.6, life), color, size: rnd(size * 0.6, size) });
  }
}
// 폭발: 불덩이 + 연기 + 파편 + 불똥 + 충격파
function explode(x, y, size, color = '#ffb06b') {
  if (net && net.mode === 'host') netEv.push(['x', x | 0, y | 0, size | 0, color]);
  const n = Math.max(2, Math.round(size / 8));
  for (let i = 0; i < n && fx.length < fxCap(); i++) fx.push({ k: 'fire', x: x + rnd(-size, size) * 0.3, y: y + rnd(-size, size) * 0.3, vx: rnd(-40, 40), vy: rnd(-40, 40), t: 0, life: rnd(0.35, 0.6), size: size * rnd(0.6, 1.1) });
  if (!Q.low) for (let i = 0; i < n; i++) fx.push({ k: 'smoke', x: x + rnd(-size, size) * 0.4, y: y + rnd(-size, size) * 0.4, vx: rnd(-20, 20), vy: rnd(10, 40), t: 0, life: rnd(0.8, 1.4), size: size * rnd(0.8, 1.4) });
  for (let i = 0; i < n * 2 && fx.length < fxCap(); i++) { const a = rnd(0, TAU), v = rnd(120, 360); fx.push({ k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.4, 0.9), size: rnd(2, 4), rot: rnd(0, 6), vr: rnd(-12, 12) }); }
  spark(x, y, n * 2, color, 300, 0.5, 3);
  fx.push({ k: 'ring', x, y, r: size * 1.4, t: 0, life: 0.45, color: '#fff3c4' });
}
function ringFx(x, y, r, color) { fx.push({ k: 'ring', x, y, r, t: 0, life: 0.45, color }); if (net && net.mode === 'host') netEv.push(['r', x | 0, y | 0, r | 0, color]); }
function say(text, x, y, color, size = 22, life = 1.2) { if (run && run.arena && x === W / 2) { x += cam.x; y += cam.y; } texts.push({ text, x, y, color, size, t: 0, life }); if (net && net.mode === 'host') netEv.push(['s', text, x | 0, y | 0, color, size, life]); }

// ---------- 적 ----------
function addFoe(type, x, y, o) {
  const E = D.ENEMIES[type] || { hp: 1, r: 22, xp: 0, score: 30 }, hp = E.hp * run.d.hp * foeK() * (run.teamK || 1);   // 함께 하면 적이 튼튼해진다, 판 안에서 세진 만큼도
  const e = Object.assign({ nid: ++foeSeq, type, x, y, vx: 0, vy: 0, r: E.r, hp, maxHp: hp, t: 0, fireT: rnd(0.6, 1.6), flash: 0, xp: E.xp, score: E.score, elite: !!E.elite }, o);
  const ec = run.dangerT > 0 ? 0.45 : L() >= 3 ? Math.min(0.3, 0.04 + 0.025 * L()) : 0;
  if (type !== 'treasure' && !e.harmless && Math.random() < ec) {   // 정예: 방패(먼저 깎아야 함), 쾌속(빠름), 폭발(부서지면 탄을 뿌림)
    e.mod = pick(['shield', 'swift', 'volatile']); e.xp = Math.ceil(e.xp * 1.5) + 1; e.score *= 2;
    if (e.mod === 'shield') e.sh = e.maxHp * 0.7;
  }
  foes.push(e);
  return e;
}
const angTo = e => { const s = nearestShip(e.x, e.y); return Math.atan2(s.y - e.y, s.x - e.x); };
function eShot(x, y, a, sp, o) {
  const v = sp * run.d.bs;
  ebul.push(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 7, color: '#ff5d8f' }, o));
}
function fan(x, y, a, n, spread, sp, o) { for (let i = 0; i < n; i++) eShot(x, y, a + (n > 1 ? -spread / 2 + spread * i / (n - 1) : 0), sp, o); }
function ring(x, y, n, off, sp, o) { for (let i = 0; i < n; i++) eShot(x, y, off + TAU * i / n, sp, o); }

function spawnWave() {
  const s = L(), extra = Math.min(3, (s - 1) / 2 | 0);
  const opts = [['line', 3], ['weave', 3], ['column', 2]];
  if (s >= 2) opts.push(['dive', 2], ['turret', 2], ['net', 1.2]);
  if (s >= 3) opts.push(['split', 2]);
  if (s >= 4) opts.push(['tank', 1]);
  const mf = Object.keys(D.ENEMIES).find(k => D.ENEMIES[k].map === run.theme);   // 맵 전용 적
  if (mf && !run.arena) opts.push(['map', 2.6]);
  let roll = Math.random() * opts.reduce((a, o) => a + o[1], 0), kind = opts[0][0];
  for (const [k, w] of opts) { if ((roll -= w) <= 0) { kind = k; break; } }
  if (kind === 'net' && foes.some(e => e.type === 'netter')) kind = 'line';   // 그물기는 한 번에 하나만
  if (kind === 'line') { const n = 4 + extra, gap = (W - 120) / (n - 1); for (let i = 0; i < n; i++) addFoe('scout', 60 + gap * i, -30 - (i % 2) * 30, { vy: 150 }); }
  else if (kind === 'column') { const x = rnd(70, W - 70); for (let i = 0; i < 4 + extra; i++) addFoe('scout', x, -30 - i * 55, { vy: 170 }); }
  else if (kind === 'weave') { const bx = rnd(130, W - 130); for (let i = 0; i < 4 + extra; i++) addFoe('weaver', bx, -30 - i * 60, { bx, ph: i * 0.7 }); }
  else if (kind === 'dive') { for (let i = 0; i < 2 + (extra >> 1); i++) addFoe('diver', i % 2 ? W - rnd(80, 160) : rnd(80, 160), -30 - i * 40, { mode: 'in', ty: rnd(140, 300) }); }
  else if (kind === 'turret') { addFoe('turret', rnd(100, W - 100), -40, { ty: rnd(130, 250) }); addFoe('scout', 70, -60, { vy: 160 }); addFoe('scout', W - 70, -60, { vy: 160 }); }
  else if (kind === 'split') { for (let i = 0; i < 2 + (extra >> 1); i++) addFoe('splitter', rnd(80, W - 80), -40 - i * 70); }
  else if (kind === 'tank') addFoe('tank', W / 2 + rnd(-120, 120), -50, { ty: rnd(150, 220) });
  else if (kind === 'net') addFoe('netter', rnd(90, W - 90), -40, { ty: rnd(150, 230), fireT: 2 });
  else if (kind === 'map') {
    if (mf === 'm4') for (let i = 0; i < 2 + (extra >> 1); i++) addFoe('m4', rnd(80, W - 80), -40 - i * 60, { ty: rnd(110, 240) });
    else if (mf === 'm5') { const bx = rnd(120, W - 120); for (let i = 0; i < 3 + (extra >> 1); i++) addFoe('m5', bx, -30 - i * 70, { bx, ph: i * 0.9 }); }
    else if (mf === 'm6') for (let i = 0; i < 2 + (extra >> 1); i++) { const L = i % 2 === 0; addFoe('m6', L ? -30 : W + 30, rnd(60, 200), { vx: L ? 230 : -230 }); }
    else if (mf === 'm7') for (let i = 0; i < 3 + (extra >> 1); i++) addFoe('m7', rnd(70, W - 70), -30 - i * 80);
    else if (mf === 'm8') for (let i = 0; i < 2; i++) addFoe('m8', 120 + i * 300 + rnd(-40, 40), -40, { mode: 'in', ty: rnd(130, 260) });
  }
}

function foeAI(e, dt) {
  if (e.leader) { leaderAI(e, dt); return; }   // 정예 편대 대장
  if (e.arena) { arenaAI(e, dt); return; }
  if (e.civ) { civAI(e, dt); return; }
  if (e.harmless) { critterAI(e, dt); return; }
  if (e.balloonT > 0) {   // 풍선: 둥실둥실 떠오르기만 한다
    e.balloonT -= dt; e.t += dt; e.y -= 30 * dt; e.x += Math.sin(e.t * 2 + e.nid) * 30 * dt;
    if (e.y < -60) e.gone = true;
    return;
  }
  if (run.danceT > 0 && e.type !== 'treasure') { e.t += dt; e.x += Math.sin(T * 14 + e.nid) * 90 * dt; e.y += Math.cos(T * 7 + e.nid) * 20 * dt; return; }   // 춤추느라 바쁘다
  if (run.mondayT > 0) dt *= 0.35;   // 월요병
  e.t += dt;
  const fr = run.d.fr;
  switch (e.type) {
    case 'scout':
      e.y += e.vy * dt; e.x += e.vx * dt;
      if (L() >= 2 && !e.shot && e.y > 230) { e.shot = true; if (Math.random() < 0.4) eShot(e.x, e.y, angTo(e), 230); }
      break;
    case 'weaver':
      e.y += 105 * dt; e.x = e.bx + Math.sin(e.t * 2.4 + e.ph) * 95;
      if (L() >= 3 && (e.fireT -= dt) <= 0) { e.fireT = 2.6 / fr; eShot(e.x, e.y, angTo(e), 210, { color: '#c58bff' }); }
      break;
    case 'diver':
      if (e.mode === 'in') { e.y += 300 * dt; if (e.y >= e.ty) { e.mode = 'wait'; e.w = 0.65; } }
      else if (e.mode === 'wait') { if ((e.w -= dt) <= 0) { e.mode = 'go'; const a = angTo(e), v = 520 * run.d.bs; e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; } }
      else { e.x += e.vx * dt; e.y += e.vy * dt; }
      break;
    case 'turret':
      if (e.t < 9) { if (e.y < e.ty) e.y += 90 * dt; if ((e.fireT -= dt) <= 0) { e.fireT = 1.7 / fr; fan(e.x, e.y + 12, angTo(e), 3, 0.35, 195, { color: '#ffb347' }); } }
      else e.y += 90 * dt;
      break;
    case 'splitter':
      e.y += 85 * dt; e.x += Math.sin(e.t * 1.6) * 45 * dt;
      break;
    case 'tank':
      if (e.t < 13) { if (e.y < e.ty) e.y += 45 * dt; if ((e.fireT -= dt) <= 0) { e.fireT = 2.3 / fr; ring(e.x, e.y, 10, e.t, 150, { color: '#ff8a5e' }); } }
      else e.y += 55 * dt;
      break;
    case 'm4':   // 굴뚝 로봇: 내려와 멈춰서 기름 덩이 3개를 아래로 떨군 뒤 다시 내려간다
      if (e.y < e.ty) e.y += 120 * dt;
      else if (!e.done) { if ((e.fireT -= dt) <= 0) { e.n = (e.n || 0) + 1; e.fireT = 0.35; eShot(e.x, e.y + 14, Math.PI / 2, 150, { color: '#3a2a1a', r: 10 }); if (e.n >= 3) { e.done = true; e.fireT = 2.2 / fr; } } }
      else { if ((e.fireT -= dt) <= 0) { e.done = false; e.n = 0; e.ty += 120; } }
      if (e.t > 12) e.y += 90 * dt;
      break;
    case 'm5':   // 서리 드론: 물결치며 얼음 탄(맞으면 잠깐 느려짐)
      e.y += 95 * dt; e.x = e.bx + Math.sin(e.t * 1.8 + (e.ph || 0)) * 80;
      if ((e.fireT -= dt) <= 0) { e.fireT = 2.4 / fr; eShot(e.x, e.y + 12, angTo(e), 200, { color: '#bff0ff', r: 8, ice: true }); }
      break;
    case 'm6':   // 용암 새: 옆에서 휘어 들어와 지나가며 불씨를 떨어뜨린다
      e.x += e.vx * dt; e.y += (60 + Math.sin(e.t * 2.2) * 110) * dt; e.vx += (W / 2 - e.x) * 0.25 * dt;
      if ((e.fireT -= dt) <= 0) { e.fireT = 0.45 / fr; eShot(e.x, e.y + 10, Math.PI / 2 + rnd(-0.2, 0.2), 110, { color: '#ff8a2a', r: 6 }); }
      break;
    case 'm7':   // 잎 딱정벌레: 숲에 숨어 천천히 내려오다 가까워지면(또는 맞으면) 드러나 부채꼴로 쏜다
      e.y += (e.seen ? 60 : 75) * dt;
      if (!e.seen && (Math.hypot(P.x - e.x, P.y - e.y) < 300 || e.hp < e.maxHp)) { e.seen = true; e.fireT = 0.5; say('!', e.x, e.y - 30, '#ffe066', 26, 0.6); }
      if (e.seen && (e.fireT -= dt) <= 0) { e.fireT = 2.2 / fr; fan(e.x, e.y + 12, angTo(e), 5, 0.9, 190, { color: '#b8f5a0' }); }
      break;
    case 'm8':   // 구름 연 기사: 떠 있다가 붉은 선으로 겨눈 뒤 창을 들고 곧장 돌격
      if (e.mode === 'in') { e.y += (e.ty - e.y) * 2 * dt; e.x += Math.sin(e.t * 1.4) * 40 * dt; if (e.t > 1.6) { e.mode = 'aim'; e.w = 0.9; e.ax = clamp(P.x, 40, W - 40); } }
      else if (e.mode === 'aim') { e.x += (e.ax - e.x) * 4 * dt; if ((e.w -= dt) <= 0) { e.mode = 'go'; e.vy = 620 * run.d.bs; A.sfx('warning'); } }
      else e.y += e.vy * dt;
      break;
    case 'treasure':   // 천천히 가로질러 지나간다. 놓치면 끝
      e.x += e.vx * dt; e.y = e.by + Math.sin(e.t * 1.5) * 18;
      if (e.x > W + 90) { e.gone = true; say('황금 수송선이 도망쳤다…', W / 2, H * 0.3, '#c9d2dc', 22, 1.6); }
      break;
    case 'netter':   // 그물을 쏜다. 맞으면 움직일 수 없게 된다
      if (e.t < 12) {
        if (e.y < e.ty) e.y += 80 * dt;
        e.x += Math.sin(e.t * 1.2) * 50 * dt;
        if ((e.fireT -= dt) <= 0 && !P.trap) { e.fireT = 4.5 / fr; eShot(e.x, e.y + 16, angTo(e), 170, { net: true, r: 15, color: '#7ff0dc' }); A.sfx('net'); }
      } else e.y += 90 * dt;
      break;
  }
  if (e.type !== 'boss' && (e.y > H + 80 || e.x < -100 || e.x > W + 100 || e.y < -400)) e.gone = true;
}

// ---------- 보스 ----------
function spawnBoss() {
  const idx = run.mode === 'rush' ? run.bossIdx : run.mode === 'endless' ? run.bossCount % 5 : run.mode === 'stage' ? stageBossIdx(run.stage) : (run.stage - 1) % 5, def = D.BOSSES[idx];
  const scout = run.mode === 'stage' && stageEnd(run.stage) === 'scout';   // 보스 선발대: 다음 챕터 보스를 미리 만난다(체력 절반)
  const hp = def.hp * run.d.hp * foeK() * (1 + 0.15 * run.loop) * (run.mode === 'auto' ? 0.35 : 1) * (run.teamK || 1) * (scout ? 0.5 : 1);
  boss = { def, idx, t: 0, x: W / 2, y: -170, entering: true, tm: {}, parts: [], spin: 0, inhale: 0, mirror: 0, stream: 0, tx: W / 2, slash: 0 };
  const lay = { spider: [[0, 70]], whale: [[0, 90]], twins: [[-135, 56], [135, 56]], knight: [[0, 60]], core: [[0, 82]] }[def.id];
  for (const [dx, r] of lay) {
    const part = { type: 'boss', isBoss: true, x: W / 2 + dx, y: -170, dx, r, hp, maxHp: hp, t: 0, flash: 0, xp: 0, score: 0, inv: true };
    foes.push(part); boss.parts.push(part);
  }
  run.hitsAtBoss = run.hits; run.bossStart = run.t;
  A.music('boss', run.theme);
  run.banner = { kind: 'boss', title: (scout ? '선발대 · ' : '') + def.name, sub: scout ? '다음 챕터의 보스가 먼저 왔다! (체력 절반)' : def.tip, t: 0, life: 3.4 };
}

function addLaser(src, a, warn, dur) { lasers.push({ src, x: src.x, y: src.y, a, warn, dur, w: 26, hit: false }); A.sfx('charge'); }

// ---------- 보스가 지상으로: 땅에 내려가 대공포를 쏜다. 그동안은 공격이 닿지 않으니 붉은 표적을 피하기만 한다 ----------
function groundDive(b, dt, fr, L) {
  if (run.arena || run.coop || b.entering) return false;
  if (!b.dive) {
    if (b.phT > 0) return false;
    b.diveT = (b.diveT === undefined ? 10 : b.diveT) - dt;
    if (b.diveT > 0) return false;
    b.dive = { st: 'down', t: 0, ft: 0.5 };
    b.parts.forEach(p => { if (!p.dead) p.inv = true; });
    run.banner = { kind: 'boss', title: '보스가 지상으로!', sub: '땅에서는 공격이 닿지 않아요. 붉은 표적을 피하세요', t: 0, life: 1.8 };
    A.sfx('charge');
  }
  const d = b.dive; d.t += dt;
  if (d.st === 'down') {
    b.gs = 1 - 0.45 * Math.min(1, d.t / 0.9); b.y += (300 - b.y) * Math.min(1, dt * 2);
    if (d.t >= 0.9) { d.st = 'ground'; d.t = 0; shake = Math.max(shake, 0.6); }
  } else if (d.st === 'ground') {
    b.gs = 0.55; b.x += (clamp(P.x, 90, W - 90) - b.x) * Math.min(1, dt * 0.5);   // 땅을 따라 기어 온다
    if ((d.ft -= dt) <= 0) {
      d.ft = Math.max(0.45, 0.85 - 0.06 * L) / fr;
      run.flak.push({ x: clamp(P.x + rnd(-55, 55), 40, W - 40), y: clamp(P.y + rnd(-55, 40), 140, H - 60), t: 0, warn: 0.95 });
      if (b.p2 && Math.random() < 0.4) run.flak.push({ x: rnd(60, W - 60), y: rnd(300, H - 100), t: 0, warn: 1.1 });
    }
    if (d.t >= 5 + Math.min(2, L)) { d.st = 'up'; d.t = 0; }
  } else {
    b.gs = 0.55 + 0.45 * Math.min(1, d.t / 0.9); b.y += (175 - b.y) * Math.min(1, dt * 2.5);
    if (d.t >= 0.9) {
      b.gs = 1; b.dive = null; b.diveT = rnd(14, 19);
      b.parts.forEach(p => { if (!p.dead) p.inv = false; });
      ring(b.x, b.y, 16 + 2 * L, 0, 150, { color: '#ffb347' }); shake = Math.max(shake, 0.5);
    }
  }
  return true;
}
// 0.61 보스 새 패턴(2단계부터) — 세로 줄 경고(거미 다리 내려찍기)·되돌아오는 탄(코어 중력 고리)에 쓰는 도우미
function colWarn(x, w, warn, go) { (run.cols = run.cols || []).push({ x, w, t: 0, warn, go }); }
function colTick(dt) {
  if (!run.cols || !run.cols.length) return;
  for (const c of run.cols) { c.t += dt; if (c.t >= c.warn && !c.done) { c.done = true; c.go(c); } }
  run.cols = run.cols.filter(c => !c.done);
}
function drawCols() {
  if (!run.cols || !run.cols.length) return;
  for (const c of run.cols) {
    const k = Math.min(1, c.t / c.warn);
    ctx.fillStyle = `rgba(255,60,60,${0.06 + 0.16 * k})`; ctx.fillRect(c.x - c.w / 2, 0, c.w, H);
    ctx.strokeStyle = `rgba(255,90,90,${0.45 + 0.5 * k})`; ctx.lineWidth = 2; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -T * 60;
    ctx.beginPath(); ctx.moveTo(c.x - c.w / 2, 0); ctx.lineTo(c.x - c.w / 2, H); ctx.moveTo(c.x + c.w / 2, 0); ctx.lineTo(c.x + c.w / 2, H); ctx.stroke(); ctx.setLineDash([]);
  }
}
function flakTick(dt) {   // 대공포 표적: 붉은 원이 조여 들다가 터진다
  if (!run.flak || !run.flak.length) return;
  for (const f of run.flak) {
    f.t += dt;
    if (f.t >= f.warn && !f.done) {
      f.done = true;
      explode(f.x, f.y, 26, '#ffb347'); A.sfx('hit');
      if (Math.hypot(P.x - f.x, P.y - f.y) < (f.mini ? 46 : 58) && !(P.down > 0)) hurtPlayer(run.d.dmg * (f.mini ? 0.6 : 1));
      if (!f.mini) ring(f.x, f.y, 6 + 2 * run.loop, rnd(0, TAU), 130, { color: '#ffb347', r: 6 });
    }
  }
  run.flak = run.flak.filter(f => f.t < f.warn + 0.3);
}
function drawFlak() {
  if (!run.flak || !run.flak.length) return;
  for (const f of run.flak) {
    if (f.done || f.t < 0) continue;
    const k = f.t / f.warn;
    ctx.strokeStyle = `rgba(255,70,70,${0.4 + 0.5 * k})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(f.x, f.y, (f.mini ? 46 : 58), 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,60,60,${0.12 + 0.25 * k})`; ctx.beginPath(); ctx.arc(f.x, f.y, (f.mini ? 46 : 58) * k, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(f.x - 12, f.y); ctx.lineTo(f.x + 12, f.y); ctx.moveTo(f.x, f.y - 12); ctx.lineTo(f.x, f.y + 12); ctx.stroke();
  }
}
function bossAI(dt) {
  const b = boss, fr = run.d.fr, L = run.loop;
  const alive = b.parts.filter(p => !p.dead);
  if (!alive.length) return;
  if (b.entering) {
    b.y += (175 - b.y) * Math.min(1, dt * 1.4);
    if (b.y > 170) { b.entering = false; b.parts.forEach(p => { p.inv = false; }); }
  } else b.t += dt;
  const ev = (k, iv) => {
    if (b.entering) return false;
    if (b.tm[k] === undefined) b.tm[k] = iv * 0.6;
    if ((b.tm[k] -= dt) <= 0) { b.tm[k] += iv; return true; }
    return false;
  };
  const hpFrac = b.parts.reduce((s, p) => s + Math.max(0, p.hp), 0) / b.parts.reduce((s, p) => s + p.maxHp, 0);
  const ph = b.entering ? 1 : hpFrac < 1 / 3 ? 3 : hpFrac < 2 / 3 ? 2 : 1;
  if (ph > (b.ph || 1)) {   // 단계가 바뀔 때: 잠깐 무적이 되며 모습이 바뀐다
    b.ph = ph; b.phT = 1.1;
    b.parts.forEach(p => { if (!p.dead) p.inv = true; });
    run.banner = { kind: 'boss', title: `${b.def.name} · ${ph}단계`, sub: ph === 2 ? '공격이 거세진다!' : '마지막 발악!', t: 0, life: 1.6 };
    shake = Math.max(shake, 0.9); flash = 0.35; A.sfx('charge'); buzz([60, 40, 60]);
  }
  if (b.phT > 0 && (b.phT -= dt) <= 0) b.parts.forEach(p => { p.inv = false; });
  const p2 = ph >= 2, p3 = ph >= 3;
  b.p3 = p3;
  b.p2 = p2;
  const main = alive[0];
  if (!run.flak) run.flak = [];
  if (groundDive(b, dt, fr, L)) { for (const p of b.parts) { p.x = b.x + p.dx * (b.gs || 1); p.y = b.y; } return; }   // 지상에 있는 동안은 평소 공격을 쉰다
  switch (b.def.id) {
    case 'spider':
      b.x = W / 2 + Math.sin(b.t * 0.7) * 150;
      if (ev('ring', 0.85 / fr)) ring(b.x, b.y + 20, 14 + 2 * L, b.t * 0.6, 165, { color: '#ffb347' });
      if (ev('aim', 2.6 / fr)) fan(b.x, b.y + 30, angTo(main), 3, 0.25, 235);
      if (p2 && ev('mine', 2.1 / fr)) ebul.push({ x: rnd(60, W - 60), y: b.y + 40, vx: 0, vy: 140, r: 13, color: '#ff3d3d', mine: 1.4 });
      if (p2 && ev('web', 7)) { eShot(b.x, b.y + 40, angTo(main), 160, { net: true, r: 16, color: '#7ff0dc' }); A.sfx('net'); }   // 거미줄 그물
      if (p3 && ev('spiral', 0.14 / fr)) for (const s of [1, -1]) eShot(b.x, b.y + 10, s * b.t * 2.2, 150, { color: '#ffd166', r: 6 });   // 두 겹 소용돌이
      if (p2 && ev('stomp', 6.5)) {   // 0.61 다리 내려찍기: 붉은 세로 줄 경고 뒤 그 줄로 탄 기둥이 쏟아진다(내 자리 하나 + 옆 하나)
        const xs = [nearestShip(b.x, b.y).x]; xs.push(clamp(xs[0] + (Math.random() < 0.5 ? -1 : 1) * rnd(130, 190), 40, W - 40));
        if (p3) xs.push(rnd(40, W - 40));
        for (const x of xs) colWarn(x, 54, 0.95, c => { for (let i = 0; i < 7; i++) ebul.push({ x: c.x + rnd(-6, 6), y: b.y + 40 - i * 46, vx: 0, vy: 430 * run.d.bs, r: 8, color: '#ff7a3c' }); shake = Math.max(shake, 0.35); A.sfx('boomS'); });
        say('다리 내려찍기!', W / 2, H * 0.42, '#ff9a6b', 22, 1.1);
      }
      break;
    case 'whale':
      b.x = W / 2 + Math.sin(b.t * 0.4) * 110;
      if (b.fanT > 0) b.fanT -= dt;
      if (ev('fan', 1.7 / fr)) { b.fanT = 0.3; fan(b.x, b.y + 50, angTo(main), 5, 0.6, 195, { color: '#7fd8ff' }); if (p2) fan(b.x, b.y + 50, Math.PI / 2, 9, 1.8, 150, { color: '#7fd8ff' }); }
      if (ev('pup', 5)) { addFoe('scout', 60, -20, { vy: 170 }); addFoe('scout', W - 60, -20, { vy: 170 }); }
      if (p3 && ev('wall', 3.2 / fr)) {   // 틈이 하나뿐인 물방울 벽
        const gap = rnd(80, W - 80);
        for (let x = 20; x < W; x += 34) if (Math.abs(x - gap) > 46) ebul.push({ x, y: b.y + 60, vx: 0, vy: 130 * run.d.bs, r: 9, color: '#9fe0ff' });
      }
      if (b.inhale > 0) {
        b.inhale -= dt;
        if (Math.random() < 0.6) fx.push({ k: 'streak', x: rnd(0, W), y: rnd(b.y + 120, H), vx: 0, vy: -520, t: 0, life: 0.6, color: 'rgba(200,240,255,.7)', size: 2 });
      } else if (p2 && ev('bubble', 9)) {   // 0.61 거품 감옥: 내 둘레에 거품이 둘러싸고 조여 든다. 한쪽 틈으로 빠져나가기
        const s = nearestShip(b.x, b.y), n = 16, gap = rnd(0, n) | 0;
        for (let i = 0; i < n; i++) {
          if ((i - gap + n) % n < 3) continue;   // 틈 3칸
          const a = TAU * i / n, R = 200;
          ebul.push({ x: s.x + Math.cos(a) * R, y: s.y + Math.sin(a) * R, vx: -Math.cos(a) * 85, vy: -Math.sin(a) * 85, r: 11, color: '#7fe8ff' });
        }
        say('거품 감옥! 틈으로 빠져나가!', W / 2, H * 0.42, '#9fe0ff', 22, 1.4); A.sfx('charge');
      } else if (ev('inhale', 8.5)) { b.inhale = 2.6; say('숨을 들이쉰다! 아래로 버텨!', W / 2, H * 0.5, '#9fe0ff', 26, 1.8); A.sfx('charge'); }
      break;
    case 'twins': {
      b.x = W / 2 + Math.sin(b.t * 0.5) * 40;
      const [Lp, Rp] = b.parts, enr = alive.length === 1;
      if (enr && !b.enraged) { b.enraged = true; say('남은 쪽이 화났다!', W / 2, H * 0.4, '#ff8a8a', 28, 1.6); }
      if (!Lp.dead) {
        if (ev('Lb', (enr ? 1.6 : 2.4) / fr)) b.stream = 8 + 2 * L;
        if (b.stream > 0 && ev('Ls', 0.1)) { b.stream--; eShot(Lp.x, Lp.y + 30, angTo(Lp), 270, { color: '#ff6b6b' }); }
      }
      if (!Rp.dead) {
        b.spin += dt * 2.4 * (enr ? 1.4 : 1);
        if (ev('Rs', 0.11 / fr)) for (let k = 0; k < 2; k++) eShot(Rp.x, Rp.y, b.spin + k * Math.PI, 170, { color: '#c58bff' });
      }
      if (enr && ev('laser', p3 ? 2.6 : 4)) addLaser(main, angTo(main), p3 ? 0.8 : 1.0, 0.6);
      if (!enr && p2 && ev('xbeam', 7.5)) { addLaser(Lp, angTo(Lp), 1.1, 0.45); addLaser(Rp, angTo(Rp), 1.1, 0.45); say('합동 빔! 옆으로 비켜!', W / 2, H * 0.42, '#ff9ad0', 22, 1.1); }   // 0.61 둘이 함께 나를 겨눈 빔(교차점을 피해 옆으로)
      if (p3 && ev('cross', 3.6)) for (const a of [Math.PI / 2 - 0.5, Math.PI / 2 + 0.5]) addLaser(main, a, 1.0, 0.5);
      break;
    }
    case 'knight':
      if (ev('dash', (p2 ? 1.9 : 2.6) / fr)) { b.tx = rnd(90, W - 90); b.slash = 1; }
      b.x += (b.tx - b.x) * Math.min(1, dt * 5);
      if (b.slash === 1 && Math.abs(b.tx - b.x) < 8) {
        b.slash = p2 ? 2 : 0; b.slashT = 0.35;
        fan(b.x, b.y + 40, Math.PI / 2, 7 + L, 1.3, 245, { color: '#e0e8ff' });
        b.swingT = 0.42; fan(b.x, b.y + 40, angTo(main), 2, 0.35, 300, { color: '#9fd0ff', r: 8 });   // 칼을 휘두르면 검기 탄이 날아온다
      }
      if (b.slash === 2 && (b.slashT -= dt) <= 0) {
        b.slash = 0; fan(b.x, b.y + 40, Math.PI / 2, 8 + L, 1.5, 200, { color: '#e0e8ff' });
        b.swingT = 0.42; fan(b.x, b.y + 40, angTo(main), 3, 0.5, 300, { color: '#9fd0ff', r: 8 });
        if (p3) for (const a of [Math.PI / 2 - 0.7, Math.PI / 2 + 0.7]) fan(b.x, b.y + 40, a, 5, 0.25, 280, { color: '#ffffff', r: 6 });   // X자 베기
      }
      if (b.swingT > 0) b.swingT -= dt;
      if (b.mirror > 0) b.mirror -= dt;
      else if (ev('mirror', p3 ? 5.5 : 8)) { b.mirror = 2.6; say('거울 방패! 내 탄이 되돌아온다', W / 2, H * 0.45, '#9fc8ff', 24, 1.6); }
      main.shield = b.mirror > 0;
      {   // 0.61 검의 벽: 틈 하나 있는 칼날 줄이 두 번(두 번째는 0.65초 뒤, 틈 자리가 바뀜)
        const row = gx => { for (let x = 18; x < W; x += 30) if (Math.abs(x - gx) > 52) ebul.push({ x, y: b.y + 50, vx: 0, vy: 150 * run.d.bs, r: 7, color: '#e0e8ff' }); b.swingT = 0.42; };
        if (b.blade2 && (b.blade2.t -= dt) <= 0) { row(b.blade2.g); b.blade2 = null; }
        if (p2 && b.mirror <= 0 && ev('blades', 7)) {
          const g1 = rnd(70, W - 70); row(g1); A.sfx('reflect');
          b.blade2 = { t: 0.65, g: clamp(g1 + (g1 < W / 2 ? 1 : -1) * rnd(140, 220), 70, W - 70) };
          say('검의 벽! 틈을 찾아!', W / 2, H * 0.42, '#cfe0ff', 22, 1.1);
        }
      }
      break;
    case 'core':
      b.x = W / 2;
      b.spin += dt * (p2 ? 1.3 : 1.0);
      if (p3) b.spin -= dt * 2.6;   // 마지막 단계: 거꾸로 돈다
      if (ev('sp', 0.13 / fr)) { const arms = p3 ? 6 : 4; for (let k = 0; k < arms; k++) eShot(b.x, b.y, b.spin + k * TAU / arms, 175, { color: p3 ? '#ff8a8a' : '#7cf0c0' }); }
      if (ev('ring', 3 / fr)) ring(b.x, b.y, 16 + 2 * L, 0, 140, { color: '#ffd166' });
      if (p2 && ev('laser', 3.4)) addLaser(main, angTo(main), 0.9, 0.5);
      if (p2 && ev('grav', 6)) { ring(b.x, b.y, 18 + 2 * L, b.spin, 170, { color: '#c58bff', r: 8, rev: 1.1 }); say('중력 고리! 되돌아온다', W / 2, H * 0.42, '#d6b0ff', 22, 1.1); }   // 0.61 퍼졌다가 1.1초 뒤 거꾸로 돌아오는 고리
      break;
  }
  for (const p of b.parts) {
    p.x = b.x + p.dx;
    p.y = b.y + (b.def.id === 'twins' ? Math.sin(b.t * 1.3 + p.dx) * 12 : 0);
  }
}

// 정예 편대(챕터의 1·2·4번째 스테이지 끝): 커다란 대장 장갑기가 버티며 원형 탄·조준 탄을 쏘고 호위기를 부른다. 대장을 쓰러뜨리면 클리어
const LEADER = { hp: 11, r: 46, scale: 1.75, ring: 2.6, aim: 3.4, call: 9 };   // 체력 배수(장갑기의), 크기, 원형 탄·조준 탄·호위 부르기 간격(초)
function spawnLeader() {
  const e = addFoe('tank', W / 2, -80, { ty: 210 });
  e.leader = true; e.mod = undefined; e.sh = 0; e.r = LEADER.r; e.hp = e.maxHp = e.maxHp * LEADER.hp; e.xp = 10; e.score = 2500 * L();
  e.ringT = 1.8; e.aimT = 2.6; e.callT = 1;
  run.leaderE = e; run.hitsAtBoss = run.hits; run.bossStart = run.t;
  A.music('boss', run.theme);
  run.banner = { kind: 'boss', title: '정예 편대 출현!', sub: '커다란 대장 장갑기를 쓰러뜨리면 클리어', t: 0, life: 3 };
}
function leaderAI(e, dt) {
  const fr = run.d.fr;
  e.t += dt;
  if (e.y < e.ty) e.y += 70 * dt; else e.x = W / 2 + Math.sin(e.t * 0.55) * (W * 0.3);
  if ((e.ringT -= dt) <= 0) { e.ringT = LEADER.ring / fr; ring(e.x, e.y, 10 + Math.min(6, L()), e.t, 140, { color: '#ff8a5e' }); }
  if ((e.aimT -= dt) <= 0) { e.aimT = LEADER.aim / fr; fan(e.x, e.y + 20, angTo(e), 3, 0.35, 220, { color: '#ff5d8f' }); }
  if ((e.callT -= dt) <= 0) { e.callT = LEADER.call; for (const dx of [-150, 150]) addFoe(L() >= 3 ? 'turret' : 'weaver', clamp(e.x + dx, 40, W - 40), -30, { ty: rnd(120, 260), bx: clamp(e.x + dx, 40, W - 40) }); }
}
function leaderDown(e) {
  run.phase = 'clear'; run.endT = 3.2; run.chain = 10; run.leaderE = null; run.clearAt = { x: e.x, y: e.y };
  if (!net) { hitStop = FEEL.stopBoss; slowT = FEEL.slowBoss; flash = Math.max(flash, 0.5); shake = Math.max(shake, 1); buzz([60, 40, 120]); }
  for (let i = 0; i < 5; i++) explode(e.x + rnd(-60, 60), e.y + rnd(-40, 40), rnd(30, 60), pick(['#ffd166', '#ffb06b', '#ff7a5e']));
  ebul.forEach(b => spark(b.x, b.y, 3, b.color, 80, 0.3, 2)); ebul = []; lasers = [];
  for (const f of foes) if (!f.dead && !f.civ) { f.dead = true; explode(f.x, f.y, 18, '#ffb06b'); }
  if (P.trap) freeTrap(true);
  if (Math.random() < 0.3) drops.push({ kind: 'part', x: e.x, y: e.y, vy: 40, v: 1 });
  for (let i = 0; i < 8 + L(); i++) drops.push({ kind: 'scrap', x: e.x + rnd(-70, 70), y: e.y + rnd(-40, 40), vy: rnd(20, 90), v: 3 });
  run.score += 2500 * L();
  say('🛡️ 정예 편대 격파!', W / 2, H * 0.36, '#ffd166', 32, 2.4); A.sfx('boomL');
}
function bossDown() {
  run.phase = 'clear'; run.endT = run.mode === 'stage' ? 3.6 : 2.6; run.chain = 14;
  if (!net) { hitStop = FEEL.stopBoss; slowT = FEEL.slowBoss; flash = Math.max(flash, 0.6); shake = Math.max(shake, 1.2); buzz([60, 40, 120]); }   // 보스 처치: 잠깐 멈췄다가 느린 화면
  for (let i = 0; i < 7; i++) explode(boss.x + rnd(-90, 90), boss.y + rnd(-60, 60), rnd(40, 80), pick(['#ffd166', '#ffb06b', '#ff7a5e']));
  ebul.forEach(b => spark(b.x, b.y, 3, b.color, 80, 0.3, 2)); ebul = []; lasers = [];
  if (P.trap) freeTrap(true);
  const x = boss.x, y = boss.y;
  if (run.mode !== 'auto' || Math.random() < 0.25) drops.push({ kind: 'part', x, y, vy: 40, v: 1 });
  for (let i = 0; i < 10 + L(); i++) drops.push({ kind: 'scrap', x: x + rnd(-80, 80), y: y + rnd(-40, 40), vy: rnd(20, 90), v: run.mode === 'auto' ? 2 : 3 });
  run.score += 5000 * L();
  if (run.mode !== 'auto') { const nc = run.mode === 'stage' && stageEnd(run.stage) === 'boss' ? 2 : 1; addCores(nc); say(`💠 코어 +${nc}`, W / 2, H * 0.46, '#c58bff', 22, 2.2); }   // 0.63 한계 돌파 재료
  if (run.mode === 'auto') say('💰 ' + Forge.fmt(Forge.addGold(30 * Math.pow(1.17, run.stage - 1))), W / 2, H * 0.36, '#ffd166', 26, 1.8);
  if (!S.stats.bossSeen.includes(boss.idx)) S.stats.bossSeen.push(boss.idx);
  dcount('boss');
  if (run.hits === run.hitsAtBoss) { S.stats.nohit = 1; say('노피격 격파!', W / 2, H * 0.32, '#7fffd4', 30, 2.4); }
  // 보스 랭크: 정해진 시간(par) 안에 적게 맞고 잡을수록 높다. S·A면 고철 덤
  const bt = run.t - run.bossStart, hits = run.hits - run.hitsAtBoss, par = (boss.def.par || 45) + 3 * Math.min(L(), 10);
  const rank = run.assist ? 'C' : hits === 0 && bt <= par ? 'S' : hits <= 1 && bt <= par * 1.3 ? 'A' : hits <= 3 && bt <= par * 1.8 ? 'B' : 'C';
  run.bossRank = rank; run.bossTime = bt;
  if (run.mode !== 'auto') bossRecord(boss.def.id, hits === 0 && !run.assist, bt <= par && !run.assist, bt);   // 보스 무훈
  const bonus = { S: 6, A: 3, B: 1, C: 0 }[rank];
  for (let i = 0; i < bonus; i++) drops.push({ kind: 'scrap', x: x + rnd(-60, 60), y: y + rnd(-30, 30), vy: rnd(30, 80), v: 5 });
  say(`${rank} 랭크 · ${bt.toFixed(1)}초`, W / 2, H * 0.4, { S: '#ffd166', A: '#9dffcf', B: '#9fd0ff', C: '#c9d2dc' }[rank], 34, 2.6);
  if (run.mode === 'stage') { S.ranks = S.ranks || {}; const old = S.ranks[run.stage]; if (!old || 'SABC'.indexOf(rank) < 'SABC'.indexOf(old)) S.ranks[run.stage] = rank; }
  A.sfx('boomL'); shake = 1.4; flash = 1; buzz([80, 60, 160]);
}

// ---------- 그물 함정: 걸리면 움직일 수 없고, 화면을 연타해서 빠져나온다 ----------
function catchInNet() {
  P.trap = { g: 0.12, t: 0 };
  drag = null;
  A.sfx('net'); buzz([50, 40, 50]);
  run.banner = { kind: 'trap', title: '그물에 걸렸다!', sub: '화면을 빠르게 연타해서 빠져나와!', t: 0, life: 1.6 };
}
function tapTrap() {
  if (!P.trap) return;
  P.trap.g += 0.11;
  A.sfx('tap'); buzz(12);
  spark(P.x + rnd(-20, 20), P.y + rnd(-20, 20), 3, '#7ff0dc', 180, 0.3, 2);
  if (P.trap.g >= 1) freeTrap(true);
}
function freeTrap(byTap) {
  P.trap = null; P.inv = Math.max(P.inv, 0.8);
  if (byTap) {
    S.stats.escapes++; dcount('escape');
    P.ult = Math.min(100, P.ult + 8);
    ringFx(P.x, P.y, 60, '#7ff0dc'); spark(P.x, P.y, 24, '#bffff0', 320, 0.5, 3);
    say('탈출!', P.x, P.y - 60, '#7ff0dc', 30, 1);
    A.sfx('escape');
  }
}

// ---------- 비트 러시: 음악 박자에 맞춰 톡! 맞히면 내 앞으로 박자 빔이 나간다 ----------
const RUSH_NOTES = 16, PERFECT = 0.085, GOOD = 0.17, LANE_X = 92, NOTE_SPEED = 300;
function startRush() {
  const c = A.clock(), beat = 60 / c.bpm;
  const first = c.t0 + Math.ceil((c.t + 1.8 - c.t0) / beat) * beat;   // 다음 박자부터(준비 시간 1.8초)
  const notes = [];
  for (let i = 0; i < RUSH_NOTES; i++) {
    notes.push({ t: first + i * beat, j: null });
    if (L() >= 3 && i < RUSH_NOTES - 1 && i % 4 === 2 && Math.random() < 0.6) notes.push({ t: first + (i + 0.5) * beat, j: null, half: true });   // 엇박
  }
  run.rush = { notes, beat, perfect: 0, good: 0, miss: 0, chain: 0, end: notes[notes.length - 1].t + 0.4, judge: null, judgeT: 0 };
  run.rushDone = true;
  run.banner = { kind: 'rush', title: 'BEAT RUSH', sub: '박자에 맞춰 화면을 톡!', t: 0, life: 1.8 };
  A.sfx('rush'); buzz(40);
}
function rushTap() {
  const r = run.rush, now = A.clock().t;
  let best = null, bd = 9;
  for (const n of r.notes) { if (n.j) continue; const d = Math.abs(now - n.t); if (d < bd) { bd = d; best = n; } }
  if (!best || bd > GOOD) { A.sfx('tap'); return; }   // 박자가 아닐 때 누르면 아무 일 없음(벌 없음)
  const perfect = bd <= PERFECT;
  best.j = perfect ? 'p' : 'g';
  r.chain++;
  if (perfect) { r.perfect++; S.stats.perfects++; dcount('perfect'); } else r.good++;
  r.judge = perfect ? 'PERFECT' : 'GOOD'; r.judgeT = 0.5;
  A.sfx(perfect ? 'perfect' : 'good'); buzz(perfect ? 20 : 10);
  beatStrike(perfect ? 1 : 0.55);
}
function beatStrike(k) {   // 박자 빔: 내 앞 세로 줄의 적을 한꺼번에 때린다
  const pw = ultPow();
  for (const e of foes.slice()) if (Math.abs(e.x - P.x) < 55 + e.r && e.y < P.y) hitFoe(e, 42 * k * pw);
  ebul = ebul.filter(b => !(Math.abs(b.x - P.x) < 50 && b.y < P.y && b.y > P.y - 260 && !b.net));
  fx.push({ k: 'beam', x: P.x, y: P.y, t: 0, life: 0.18, w: 70 * k + 30 });
  P.ult = Math.min(100, P.ult + 2.5 * k);
}
function updateRush() {
  const r = run.rush, now = A.clock().t;
  for (const n of r.notes) if (!n.j && now - n.t > GOOD) { n.j = 'm'; r.miss++; r.chain = 0; r.judge = 'MISS'; r.judgeT = 0.4; }
  if (r.judgeT > 0) r.judgeT -= 1 / 60;
  if (now > r.end) {
    const total = r.notes.length, reward = r.perfect + Math.floor(r.good / 2);
    S.scrap += reward; run.scrapGot += reward;
    const great = r.perfect >= total * 0.75;
    if (great) P.ult = Math.min(100, P.ult + 30);
    run.rushSum = { text: `PERFECT ${r.perfect} · GOOD ${r.good} · MISS ${r.miss}`, sub: `고철 +${reward}${great ? ' · 완벽한 박자! 궁극기 +30' : ''}`, t: 0 };
    if (great) A.sfx('levelup');
    run.rush = null;
  }
}

// ---------- 리듬 결투(중간 보스): 비행을 멈추고 리듬 게임에만 집중 ----------
function startDuelEvent() {
  run.rushDone = true;
  state = 'duel'; drag = null;
  $('hud').classList.add('hidden');
  ebul = []; lasers = [];
  Duel.start({ level: Math.min(8, L() + run.loop * 2 + (run.mode === 'endless' ? run.wave >> 1 : 0)), title: '중간 보스', sync: S.dojo.sync, speed: S.dojo.spd, onEnd: duelEnd });
}
function duelEnd(r) {
  state = 'play'; $('hud').classList.remove('hidden');
  A.music('stage', run.theme);
  S.stats.perfects += r.p; dcount('perfect', r.p);
  const rw = { S: [40, 100, 1.25], A: [25, 60, 1.15], B: [15, 35, 1.08], C: [6, 15, 1], D: [0, 0, 1] }[r.rank];
  if (rw[0]) gainScrap(rw[0]);
  P.ult = Math.min(100, P.ult + rw[1]);
  if (rw[2] > 1) run.beatBuff = Math.max(run.beatBuff || 1, rw[2]);
  if (r.rank === 'D') hurtPlayer(run.d.dmg);   // DJ의 반격
  P.inv = Math.max(P.inv, 1.5);
  run.rushSum = { text: `리듬 결투 ${r.rank} 랭크 · 정확도 ${Math.round(r.acc * 100)}%`, sub: r.rank === 'D' ? 'DJ가 도망치며 한 방 날렸다!' : `고철 +${rw[0]} · 궁극기 +${rw[1]}${rw[2] > 1 ? ` · 이번 판 피해 +${Math.round((rw[2] - 1) * 100)}%` : ''}`, t: 0 };
}
function dojoEnd(r) {
  state = 'result'; $('hud').classList.add('hidden');
  const lv = r.level, order = 'SABCD', old = S.dojo.best[lv];
  if (!old || order.indexOf(r.rank) < order.indexOf(old)) S.dojo.best[lv] = r.rank;
  const pass = order.indexOf(r.rank) <= 2, opened = pass && lv === S.dojo.open && lv < 8;
  if (opened) S.dojo.open = lv + 1;
  const reward = Math.round({ S: 20, A: 12, B: 6, C: 2, D: 0 }[r.rank] * (1 + 0.25 * (lv - 1)));
  S.scrap += reward; S.stats.perfects += r.p; dcount('perfect', r.p);
  save(); A.music('hangar', 0);
  $('rTitle').innerHTML = `<small>리듬 도장 Lv ${lv} · 🎵 ${r.songName}</small>${r.rank} 랭크`; $('rTitle').className = pass ? 'win' : 'lose';
  const lagTxt = r.p + r.g + r.o < 8 ? '' : Math.abs(r.lag) < 25 ? '박자에 딱 맞게 눌렀어요 👍' : `평균 ${Math.abs(r.lag)}ms ${r.lag > 0 ? '늦게' : '빠르게'} 눌렀어요`;
  $('rStars').innerHTML = '';
  $('rStats').innerHTML = [`<div class="big">${Math.round(r.acc * 100)}<small>% 정확도</small></div>`,
    `<div>PERFECT <b>${r.p}</b> · GREAT <b>${r.g}</b> · GOOD <b>${r.o}</b> · MISS <b>${r.m}</b></div>`,
    `<div>최고 콤보 <b>${r.maxCombo}</b> / ${r.total} · 이 단계 최고 <b class="gold">${S.dojo.best[lv]}</b></div>`,
    `<div>얻은 고철 🔩 <b>${reward}</b></div>`, lagTxt ? `<div>⏱️ ${lagTxt}</div>` : '', opened ? `<div class="gold">🔓 Lv ${lv + 1} 열림!</div>` : pass ? '' : '<div>B 랭크 이상이면 다음 단계가 열립니다.</div>'].join('');
  const btns = $('rBtns'); btns.innerHTML = '';
  const mk = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', () => { A.sfx('click'); fn(); }); btns.append(b); };
  if (lv < S.dojo.open) mk(`Lv ${lv + 1} 도전 ▶`, 'big', () => { dojoLv = lv + 1; startRun(1, 'dojo'); });
  mk('다시 하기', lv < S.dojo.open ? 'sub' : 'big', () => { dojoLv = lv; startRun(1, 'dojo'); });
  mk('격납고', 'sub', showHangar);
  if (Math.abs(r.lag) >= 25) mk(`🎧 싱크 맞추기 (${r.lag > 0 ? '+' : ''}${r.lag}ms)`, 'sub', () => {   // 늘 늦거나 빠르면 판정을 그만큼 옮긴다
    S.dojo.sync = Math.max(-250, Math.min(250, S.dojo.sync + r.lag)); save();
    const b = btns.lastElementChild; b.textContent = `✅ 싱크 ${S.dojo.sync}ms로 맞췄어요`; b.disabled = true;
  });
  Rank.after('dojo', lv * 1000 + Math.round(r.acc * 999), `Lv ${lv} · ${r.rank} 랭크 · 정확도 ${Math.round(r.acc * 100)}%`);
  $('copy').dataset.text = `🎵 볼트윙 리듬 도장 Lv ${lv} ${r.rank} 랭크 · 정확도 ${Math.round(r.acc * 100)}% · 콤보 ${r.maxCombo}`;
  $('result').classList.remove('hidden'); resultFx();
}

// ---------- 갈림길: 항로 문 2~3개 중 하나를 지나간다. 단계가 오르면 새 항로가 열리고, 희귀·전설 항로는 드물게 나온다 ----------
const ROUTES = {
  danger: { icon: '⚠️', name: '위험 항로', sub: '강한 적 22초 · 보상 ×2', c: '#ff5d5d', tier: 0, lv: 1 },
  supply: { icon: '✚', name: '보급 항로', sub: '체력 35% · 고철', c: '#6ee37a', tier: 0, lv: 1 },
  storm: { icon: '⛈️', name: '폭풍 항로', sub: '돌풍 3번 · 경험치 ×2', c: '#8fb8ff', tier: 0, lv: 2 },
  barrage: { icon: '☄️', name: '포격 지대', sub: '포탄을 피하면 고철 ×2', c: '#ff9a3c', tier: 0, lv: 2 },
  treasure: { icon: '💰', name: '보물 항로', sub: '황금 수송선이 나타난다', c: '#ffd166', tier: 1, lv: 2 },
  hunt: { icon: '👑', name: '정예 사냥', sub: '정예 3기 · 부품 확정', c: '#c58bff', tier: 1, lv: 3 },
  overdrive: { icon: '🔥', name: '과열 항로', sub: '연사 2배 + 분신 10초', c: '#ffb347', tier: 1, lv: 3 },
  shortcut: { icon: '⏩', name: '지름길', sub: '보스가 20초 빨리 · 점수 +', c: '#7fd8ff', tier: 1, lv: 4 },
  card: { icon: '🃏', name: '강화 항로', sub: '카드를 바로 1번 고른다', c: '#9dffcf', tier: 2, lv: 3 },
  gamble: { icon: '🎲', name: '운명 항로', sub: '대박? 쪽박?', c: '#ff7ad9', tier: 2, lv: 4 },
};
const TIER = [{ name: '일반', c: '#dfe6ee', w: 5 }, { name: '희귀', c: '#5fb8ff', w: 2.6 }, { name: '전설', c: '#ffd166', w: 1 }];
function spawnGates() {
  run.gateLast = run.t;
  const lv = L() + (run.loop || 0) * 5 + (run.mode === 'endless' ? run.wave >> 1 : 0);
  const pool = Object.keys(ROUTES).filter(k => ROUTES[k].lv <= lv && k !== run.lastRoute && !(k === 'storm' && run.theme === 3));   // 바로 전에 고른 항로는 쉬게 한다
  const n = lv >= 4 && Math.random() < 0.5 ? 3 : 2, offer = [];
  while (offer.length < n && pool.length) {
    let roll = Math.random() * pool.reduce((a, k) => a + TIER[ROUTES[k].tier].w, 0), i = 0;
    for (; i < pool.length - 1; i++) if ((roll -= TIER[ROUTES[pool[i]].tier].w) <= 0) break;
    offer.push(pool.splice(i, 1)[0]);
  }
  if (!offer.some(k => ['supply', 'overdrive', 'card', 'treasure'].includes(k))) offer[offer.length - 1] = 'supply';   // 안전한 길 하나는 꼭
  const xs = n === 3 ? [0.19, 0.5, 0.81] : [0.27, 0.73];
  run.gates = offer.map((kind, i) => ({ x: W * xs[i], y: -110, kind, hw: n === 3 ? 50 : 64, t: 0 }));
  say('⑂ 갈림길! 하나를 골라 지나가세요', W / 2, H * 0.3, '#ffffff', 24, 2); A.sfx('charge');
}
function updateGates(dt) {
  for (const g of run.gates) {
    g.y += 85 * dt; g.t += dt;
    if (run.phase !== 'dead' && [P, ...allies].some(s => !(s.down > 0) && Math.abs(s.x - g.x) < g.hw && Math.abs(s.y - g.y) < 40)) { chooseGate(g.kind, g); return; }
  }
  if (run.gates[0].y > H + 100) run.gates = null;
}
function chooseGate(kind, g) {
  const R = ROUTES[kind] || ROUTES.supply;
  for (const o of run.gates) if (o !== g) spark(o.x, o.y, 14, '#8a96a8', 160, 0.5, 3);   // 고르지 않은 문은 부서진다
  run.gates = null; run.lastRoute = kind;
  ringFx(P.x, P.y, 110, R.c); flash = Math.max(flash, 0.25); buzz(40);
  S.routes = S.routes || {};
  if (!S.routes[kind]) { S.routes[kind] = 1; say(`📖 새 항로 발견! (${Object.keys(S.routes).length}/${Object.keys(ROUTES).length})`, W / 2, H * 0.42, '#ffd166', 20, 2.2); }
  else S.routes[kind]++;
  const banner = (sub, k = 'trap') => { run.banner = { kind: k, title: `${R.icon} ${R.name}`, sub, t: 0, life: 2 }; };
  if (kind === 'danger') { run.dangerT = 22; banner('22초 동안 강한 적이 몰려온다 · 보상 2배!', 'boss'); A.sfx('warning'); buzz([80, 40, 80]); }
  else if (kind === 'supply') {
    if (!run.gambler) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.35); for (const a of allies) if (!(a.down > 0)) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.35); }
    for (let i = 0; i < 8; i++) drops.push({ kind: 'scrap', x: P.x + rnd(-80, 80), y: P.y - 200 + rnd(-40, 40), vy: 60, v: 2 });
    if (Math.random() < 0.15) drops.push({ kind: 'part', x: P.x, y: P.y - 250, vy: 50, v: 1 });
    banner('체력 회복과 고철 보급'); A.sfx('heal');
  } else if (kind === 'storm') { run.stormN = 3; run.xpBoostT = 22; banner('돌풍 3번을 버티면 · 22초 경험치 2배'); }
  else if (kind === 'barrage') { run.barrageT = 14; run.it_gold = 16; banner('14초 동안 포탄이 떨어진다 · 고철 2배', 'boss'); A.sfx('warning'); }
  else if (kind === 'treasure') { addFoe('treasure', -70, rnd(170, 240), { vx: 75, by: 200 }); banner('황금 수송선을 놓치지 마세요!'); A.sfx('part'); }
  else if (kind === 'hunt') {
    for (let i = 0; i < 3; i++) { const e = addFoe(i === 1 ? 'tank' : 'turret', W * (0.25 + 0.25 * i), -50 - i * 40, { ty: rnd(140, 240), bounty: true }); e.mod = pick(['shield', 'swift', 'volatile']); e.elite = true; e.xp = Math.ceil(e.xp * 1.5) + 1; if (e.mod === 'shield') e.sh = e.maxHp * 0.7; }
    banner('정예 3기를 잡으면 부품을 준다', 'boss'); A.sfx('warning');
  } else if (kind === 'overdrive') { useItem('rapid'); run.it_rapid = 10; P.twinT = 10; banner('10초 동안 연사 2배 + 분신'); }
  else if (kind === 'shortcut') {
    if (run.mode === 'endless') run.nextBoss = Math.max(run.t + 5, run.nextBoss - 20); else run.t = Math.min(run.waveDur - 4, run.t + 20);
    run.score += 1500 * L(); banner(`보스가 20초 빨리 온다 · 점수 +${1500 * L()}`); A.sfx('charge');
  } else if (kind === 'card') { banner('강화 카드를 고르세요'); setTimeout(() => { if (run && state === 'play') openCards(); }, 700); }
  else if (kind === 'gamble') {
    if (Math.random() < 0.55) {
      run.clover = true; for (let i = 0; i < 14; i++) drops.push({ kind: 'scrap', x: P.x + rnd(-120, 120), y: P.y - 220 + rnd(-60, 60), vy: 60, v: 2 });
      drops.push({ kind: 'part', x: P.x, y: P.y - 260, vy: 50, v: 1 }); banner('🎉 대박! 고철·부품, 다음 카드 4장', 'stage'); A.sfx('levelup');
    } else { run.dangerT = 16; banner('💀 쪽박! 적이 몰려온다(그래도 보상 2배)', 'boss'); A.sfx('warning'); }
  }
}
function gateRunTick(dt) {   // 항로 효과의 시간 흐름
  if (run.xpBoostT > 0) run.xpBoostT -= dt;
  if (run.barrageT > 0) {
    run.barrageT -= dt;
    if ((run.barT = (run.barT || 0) - dt) <= 0) { run.barT = 0.45; if (!run.flak) run.flak = []; run.flak.push({ x: clamp(P.x + rnd(-150, 150), 40, W - 40), y: clamp(P.y + rnd(-200, 60), 120, H - 60), t: 0, warn: 1.0, mini: true }); }
  }
  if (run.stormN > 0 && run.hz && !run.hz.wind && (run.stormT = (run.stormT || 1) - dt) <= 0) { run.stormN--; run.stormT = 2; hzStart('gust'); }
}
function drawGates() {
  if (!run.gates) return;
  for (const g of run.gates) {
    const R = ROUTES[g.kind] || ROUTES.supply, c = R.c, y = g.y, hw = g.hw || 64, tc = TIER[R.tier], a = g.t === undefined ? 1 : Math.min(1, g.t * 2);
    ctx.save(); ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow(c, 60), g.x - hw * 1.5, y - 90, hw * 3, 170);
    const fld = ctx.createLinearGradient(0, y - 60, 0, y + 40); fld.addColorStop(0, c + '00'); fld.addColorStop(0.5, c + '55'); fld.addColorStop(1, c + '10');   // 빛의 막
    ctx.fillStyle = fld; ctx.fillRect(g.x - hw + 10, y - 60, hw * 2 - 20, 100);
    ctx.strokeStyle = c + '99'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const xx = g.x - hw + 14 + ((i * 0.23 + g.t * 0.6) % 1) * (hw * 2 - 28); ctx.beginPath(); ctx.moveTo(xx, y - 56); ctx.lineTo(xx + Math.sin(g.t * 5 + i) * 4, y + 36); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    for (const s of [-1, 1]) {   // 양쪽 기둥
      const px = g.x + s * hw;
      const gr = ctx.createLinearGradient(px - 9, 0, px + 9, 0); gr.addColorStop(0, '#2a3242'); gr.addColorStop(0.5, '#7d8aa0'); gr.addColorStop(1, '#1d2330');
      ctx.fillStyle = gr; ctx.fillRect(px - 9, y - 66, 18, 112);
      ctx.fillStyle = '#11151d'; ctx.fillRect(px - 12, y + 40, 24, 8); ctx.fillRect(px - 12, y - 72, 24, 8);
      for (let k = 0; k < 4; k++) { const on = ((g.t * 6 + k) | 0) % 4 === k; ctx.fillStyle = on ? c : c + '55'; ctx.fillRect(px - 4, y - 54 + k * 24, 8, 12); }
    }
    ctx.lineWidth = 6; ctx.strokeStyle = '#0b0f18'; ctx.beginPath(); ctx.arc(g.x, y - 66, hw, Math.PI, 0); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = c; ctx.stroke();
    ctx.fillStyle = '#0b0f18'; ctx.beginPath(); ctx.arc(g.x, y - 66 - hw * 0.55, 22, 0, TAU); ctx.fill();   // 아이콘 동그라미
    ctx.lineWidth = 3; ctx.strokeStyle = tc.c; ctx.stroke();
    ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(R.icon, g.x, y - 65 - hw * 0.55); ctx.textBaseline = 'alphabetic';
    if (R.tier) txt(tc.name, g.x, y - 66 - hw * 0.55 - 30, 12, tc.c, 'center', 900);
    txt(R.name, g.x, y - 10, hw > 55 ? 17 : 15, c, 'center', 900);
    txt(R.sub, g.x, y + 12, 11, '#ffffff', 'center', 700);
    ctx.restore();
  }
}

