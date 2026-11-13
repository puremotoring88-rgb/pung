// 볼트윙 게임 본체 (표창 공방·땅 구조물·하늘의 사건) — js/game/ 파일들과 js/game.js는 한 이름 공간을 나눠 쓴다(index.html에 적힌 순서대로 읽음).
'use strict';
// ---------- 표창 공방: 넓은 들판에서 로봇을 직접 몰아 사방의 적을 피하며 싸우고, 웨이브 사이 정비 시간에 표창을 몰아서 합친다 ----------
const AW = 2000, AH = 2800, cam = { x: 0, y: 0 };   // 표창 공방 들판 크기(0.33에서 1300×1900 → 넓힘)
// 표창 공방 적의 탄(0.33, 사용자: 표창으로 붙어 싸우는데 피하기 어렵다): 탄 빠르기, 쏘는 간격 배수, 이 거리 안·화면 안에서만 쏨, 쏘기 전 깜빡임(초)
const ARENA_SHOT = { sp: 150, fanSp: 140, ringSp: 115, every: 1.5, range: 520, tell: 0.45, ringN: 7, keeperRing: 10 };
const bounds = () => (run && run.arena ? [30, AW - 30, 40, AH - 40] : [22, W - 22, 90, H - 70]);
const offView = (x, y, m) => x < cam.x - m || x > cam.x + W + m || y < cam.y - m || y > cam.y + H + m;
const ARENA_FOES = { scout: { sp: 125 }, weaver: { sp: 85, shoot: 2.8 }, diver: { sp: 60, dash: 1 }, splitter: { sp: 70 }, tank: { sp: 42, ring: 3.2 }, turret: { sp: 0, shoot: 2.2, fan: 1 } };
function aimOf(sh) {   // 가장 가까운 적 쪽으로 쏜다(없으면 하던 방향)
  let best = null, bd = 650;
  for (const e of foes) { if (e.dead || e.inv || e.harmless) continue; const d = Math.hypot(e.x - sh.x, e.y - sh.y); if (d < bd) { bd = d; best = e; } }
  if (best) sh.aim = Math.atan2(best.y - sh.y, best.x - sh.x);
  return sh.aim === undefined ? -Math.PI / 2 : sh.aim;
}
function arenaSpot(minD) {   // 화면 밖, 로봇 둘레 어딘가
  for (let i = 0; i < 8; i++) {
    const a = rnd(0, TAU), d = rnd(minD, minD + 160), x = clamp(P.x + Math.cos(a) * d, 30, AW - 30), y = clamp(P.y + Math.sin(a) * d, 30, AH - 30);
    if (Math.hypot(x - P.x, y - P.y) > minD * 0.7) return [x, y];
  }
  return [P.x < AW / 2 ? AW - 40 : 40, P.y < AH / 2 ? AH - 40 : 40];
}
function arenaWave() {
  const s = run.stage, opts = [['scout', 4], ['weaver', 2]];
  if (s >= 2) opts.push(['diver', 2], ['turret', 1]);
  if (s >= 3) opts.push(['splitter', 2]);
  if (s >= 4) opts.push(['tank', 1.2]);
  let roll = Math.random() * opts.reduce((a, o) => a + o[1], 0), kind = 'scout';
  for (const [k, w] of opts) if ((roll -= w) <= 0) { kind = k; break; }
  const [x, y] = arenaSpot(kind === 'turret' ? 460 : 580), n = { scout: 4 + Math.min(4, s / 2 | 0), weaver: 3, diver: 2, splitter: 2, tank: 1, turret: 1 }[kind];
  for (let i = 0; i < n; i++) addFoe(kind, x + rnd(-60, 60), y + rnd(-60, 60), { arena: true, fireT: rnd(1, 2.5) });
}
function arenaAI(e, dt) {
  if (run.mondayT > 0) dt *= 0.35;
  e.t += dt;
  const A0 = ARENA_FOES[e.type] || ARENA_FOES.scout, s = nearestShip(e.x, e.y), dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1, fr = run.d.fr;
  const sp = A0.sp * (e.keeper ? 1.1 : 1) * (e.mod === 'swift' ? 1.5 : 1);
  if (A0.dash) {   // 잠깐 멈췄다가 돌진
    if (e.dT === undefined) e.dT = rnd(1.5, 3);
    e.dT -= dt;
    if (e.dT <= 0 && !(e.go > 0)) { e.go = 0.55; e.dT = 2.6; const v = 560 * run.d.bs; e.vx = dx / d * v; e.vy = dy / d * v; }
    if (e.go > 0) e.go -= dt; else { e.vx = dx / d * sp; e.vy = dy / d * sp; }
  } else {
    const want = A0.shoot ? (d > 330 ? 1 : d < 240 ? -0.6 : 0) : 1, side = A0.shoot ? Math.sin(e.t * 0.9 + e.nid) * 0.7 : 0;   // 쏘는 적은 거리를 두고 옆으로 돈다
    e.vx = (dx / d * want - dy / d * side) * sp; e.vy = (dy / d * want + dx / d * side) * sp;
  }
  e.x = clamp(e.x + e.vx * dt, 10, AW - 10); e.y = clamp(e.y + e.vy * dt, 10, AH - 10);
  if (d > ARENA_SHOT.range || offView(e.x, e.y, -20)) { e.tell = false; return; }   // 화면 밖에서는 쏘지 않는다
  e.tell = (A0.shoot || A0.ring) && e.fireT < ARENA_SHOT.tell;   // 곧 쏜다: 깜빡임
  if (A0.shoot && (e.fireT -= dt) <= 0) { e.fireT = A0.shoot * ARENA_SHOT.every / fr; const a = Math.atan2(dy, dx); if (A0.fan) fan(e.x, e.y, a, 3, 0.4, ARENA_SHOT.fanSp, { color: '#ffb347' }); else eShot(e.x, e.y, a, ARENA_SHOT.sp, { color: '#c58bff' }); }
  if (A0.ring && (e.fireT -= dt) <= 0) {
    e.fireT = (e.keeper ? 2.6 : A0.ring * ARENA_SHOT.every) / fr; ring(e.x, e.y, e.keeper ? ARENA_SHOT.keeperRing : ARENA_SHOT.ringN, e.t, ARENA_SHOT.ringSp, { color: '#ff8a5e' });
    if (e.keeper) fan(e.x, e.y, Math.atan2(dy, dx), 3, 0.5, ARENA_SHOT.fanSp + 30, { color: '#ff5d8f' });
  }
}
function arenaTick(dt) {
  if (run.phase !== 'waves') return;
  const k = Math.min(1, run.t / run.waveDur);
  if ((run.spawnT -= dt) <= 0) { run.spawnT = (1.8 - 0.95 * k) * rnd(0.8, 1.2) * (run.keeper ? 2.2 : 1); if (foes.length < 70) arenaWave(); }
  if (!run.keeper && run.t >= run.waveDur) {   // 대장: 쓰러뜨리면 구역 정리
    const [x, y] = arenaSpot(520), e = addFoe('tank', x, y, { arena: true, keeper: true, r: 48, fireT: 2.5 });
    e.hp = e.maxHp = e.maxHp * 14; e.sh = 0; e.mod = undefined; e.xp = 12; e.score = 3000 * run.stage;
    run.keeper = e;
    run.banner = { kind: 'boss', title: '대장 출현!', sub: '쓰러뜨리면 정비 시간', t: 0, life: 2.2 }; A.sfx('warning'); buzz([150, 80, 150]);
  }
}
function arenaClear(e) {   // 대장을 쓰러뜨렸다
  run.keeper = null; run.phase = 'clear'; run.endT = 2.2; run.chain = 0;
  ebul.forEach(b => spark(b.x, b.y, 3, b.color, 80, 0.3, 2)); ebul = [];
  for (const o of foes) if (o !== e && !o.dead) { o.dead = true; explode(o.x, o.y, o.r * 1.4); }
  for (let i = 0; i < 8 + run.stage; i++) drops.push({ kind: 'scrap', x: e.x + rnd(-70, 70), y: e.y + rnd(-50, 50), vy: 0, v: 2 });
  if (Math.random() < 0.25) drops.push({ kind: 'part', x: e.x, y: e.y, vy: 0, v: 1 });
  run.score += 3000 * run.stage;
  say('💰 ' + Forge.fmt(Forge.addGold(30 * Math.pow(1.17, run.stage - 1))), W / 2, H * 0.36, '#ffd166', 26, 1.8);
  run.banner = { kind: 'stage', title: `ZONE ${run.stage} 정리!`, sub: '정비 시간으로', t: 0, life: 2 }; A.sfx('clear'); flash = 0.4;
}
function enterRest(win) {   // 정비 시간: 싸움을 멈추고 표창을 몰아서 합친다
  if (run.blades) run.blades.forEach(b => { b.st = 'orbit'; b.t = null; b.tr.length = 0; });   // 날던 표창은 곁으로
  for (const d of drops) if (d.kind === 'scrap') gainScrap(d.v);
  clearField(); drops = []; shots = []; texts = [];
  run.phase = 'rest'; run.keeper = null; run.combo = 0;
  P.hp = P.maxHp; P.trap = null; P.inv = 0; P.ultKind = null; P.ultT = 0; P.swarmQ = 0;
  run.fails = win ? 0 : (run.fails || 0) + 1;
  run.nextZ = win ? run.stage + 1 : run.fails >= 2 ? Math.max(1, run.stage - 1) : run.stage;
  const made = Forge.takeMade();
  Forge.show(true); $('forge').classList.add('rest'); $('fRest').classList.remove('hidden');
  $('fRestT').innerHTML = (win ? `<b>ZONE ${run.stage} 정리!</b> ` : `<b>격추!</b> `) + `이번 출격에서 표창 <b>${made}</b>개가 생겼어요. 같은 단계끼리 끌어 합쳐서 강해진 뒤 출격하세요.` + (!win && run.nextZ < run.stage ? ' (두 번 졌으니 한 구역 뒤에서 다시)' : '');
  $('fGo').textContent = `▶ ZONE ${run.nextZ}`;
  A.music('hangar', 0); save();
}
function leaveRest() {
  if (!run || run.phase !== 'rest') return;
  A.sfx('click');
  Forge.show(false); $('forge').classList.remove('rest'); $('fRest').classList.add('hidden');
  nextZone(run.nextZ, `ZONE ${run.nextZ}`, '사방에서 온다! 피하면서 싸우자');
  arenaStart();
}
// ---------- 높은 구조물: 땅에서 솟은 전파탑·바위 기둥·풍차. 로봇이 뚫고 지나갈 수 없어 돌아가야 한다 ----------
// 표창 공방: 구역마다 들판 곳곳에 서 있고 적도 막는다. 스테이지·무한: 가끔 땅과 함께 내려온다(보스전·협동에는 없음).
const OB_KINDS = ['tower', 'spire', 'mill'];
const OB_BY_MAP = { 1: ['spire', 'spire', 'tower'], 2: ['bldg', 'bldg', 'tower'], 4: ['stack', 'stack', 'tower'], 5: ['ice', 'ice', 'spire'], 6: ['crag', 'crag', 'stack'], 7: ['ruin', 'ruin', 'spire'] };   // 맵마다 서 있는 구조물
// 스테이지·무한의 땅 구조물이 얼마나 자주 서는지(사용자: 너무 잦다 → 0.32에서 줄임): 하나 세운 뒤 쉬는 초, 한 화면 최대 개수, 섬마다 세울 확률
const OB_GAP = { cd: [7, 11], max: 2, island: 0.45 };
const OB_SIZE = { stack: [20, 150], ice: [26, 115], crag: [32, 105], ruin: [24, 110] };   // 반지름, 높이
function makeObst(x, y, kind) {
  kind = kind || OB_KINDS[(Math.random() * 3) | 0];
  if (OB_SIZE[kind]) { const [r, h] = OB_SIZE[kind]; return { x, y, kind, r: r * rnd(0.9, 1.15), h: h * rnd(0.85, 1.15), ph: Math.random() * TAU, bump: 0 }; }
  return { x, y, kind, r: kind === 'spire' ? rnd(30, 42) : kind === 'mill' ? 24 : kind === 'bldg' ? rnd(24, 32) : 22, h: kind === 'spire' ? rnd(80, 115) : kind === 'mill' ? 125 : kind === 'bldg' ? rnd(130, 180) : 145, ph: Math.random() * TAU, bump: 0 };
}
function arenaObstacles() {
  const list = [], n = 5 + Math.min(3, run.stage / 3 | 0);   // 0.33: 9~15개 → 5~8개(넓어진 들판에 듬성듬성)
  for (let k = 0; k < 300 && list.length < n; k++) {
    const x = rnd(130, AW - 130), y = rnd(170, AH - 130);
    if (Math.hypot(x - AW / 2, y - AH / 2) < 340 || list.some(o => Math.hypot(o.x - x, o.y - y) < 420)) continue;
    list.push(makeObst(x, y));
  }
  run.obst = list;
}
// 눕힌 땅 캔버스의 한 점(cx, cy)이 화면 어디에 보이는지(index.html #bg의 perspective·rotateX와 같은 계산). s는 멀수록 작아지는 배율
const GR_A = 28 * Math.PI / 180, GR_C = Math.cos(GR_A), GR_S = Math.sin(GR_A), GR_D = 120 * W / 100;
function groundPt(cx, cy) {
  const X = cx * (W * 3) / BGW - W * 1.5, Y = cy * (H * 2.3) / BGH - H * 2.3, s = GR_D / (GR_D - Y * GR_S);
  return [W / 2 + X * s, H + Y * GR_C * s, s];
}
const GR_ROW = 24;   // 땅 끝(지평선) 가까이에서 구조물이 나타난다
function groundObstSpawn() {   // 스테이지·무한: 지나가는 섬(사막은 아무 데나) 위에 구조물이 서 있다
  if (run.theme === 3 || run.theme === 8) return;   // 우주·구름 위에는 세울 땅이 없다
  const TH = Art.TH, md = v => (v % TH + TH) % TH, now = md(GR_ROW - bgY);
  const prev = run.obTy === undefined ? now : run.obTy, moved = md(prev - now);
  run.obTy = now;
  if (run.phase !== 'waves' || boss || moved > 200) return;
  const lv = L() + (run.loop || 0) * 5, kinds = OB_BY_MAP[run.theme] || OB_KINDS;
  const put = (tx, ty) => {   // tx, ty: 땅 그림 안의 자리
    if (tx < 110 || tx > 430 || run.obCd > 0) return;   // 하나 세우면 잠깐 쉰다(OB_GAP)
    if (run.obst.filter(q => q.ground && q.y < H * 0.95).length >= OB_GAP.max) return;   // 한 화면에 너무 많이 서지 않게
    const o = makeObst(0, 0, pick(kinds)); o.ground = true; o.gx = (BGW - W) / 2 + tx; o.k = GR_ROW + md(ty - now + TH / 2) - TH / 2 - bgY;
    if (run.obst.some(q => q.ground && Math.abs(q.gx - o.gx) < 150 && Math.abs(q.k - o.k) < 260)) return;
    run.obCd = rnd(OB_GAP.cd[0], OB_GAP.cd[1]) * Math.max(0.75, 1 - lv * 0.03);
    run.obst.push(o);
  };
  const lands = Art.lands(run.theme);
  if (lands) {
    for (const L of lands) {
      if (md(prev - L.y) >= moved) continue;   // 이번에 지평선을 넘어온 섬
      const n = Math.random() < OB_GAP.island + Math.min(0.15, lv * 0.02) ? 1 : 0;   // 섬마다 세울 확률
      for (let i = 0; i < n; i++) { const a = rnd(0, TAU), d = rnd(0, L.r * 0.7); put(L.x + Math.cos(a) * d, L.y + Math.sin(a) * d * 0.8); }
    }
  } else if ((run.obT = (run.obT === undefined ? 4 : run.obT) - moved / 45) <= 0) {   // 사막은 어디나 땅
    run.obT = rnd(9, 14) * Math.max(0.75, 1 - lv * 0.03);
    put(rnd(120, 420), now);

  }
}
function obstTick(dt) {
  if (!run.obst) run.obst = [];
  if (!run.arena) {
    if (run.coop || run.mode === 'dojo' || run.mode === 'rush' || run.mode === 'auto') { run.obst = []; return; }
    if (run.obCd > 0) run.obCd -= dt; groundObstSpawn();
    for (const o of run.obst) if (o.ground) obst3(o);   // 땅과 함께 다가온다(입체 점 계산)
    run.obst = run.obst.filter(o => !o.g3 || Math.min(o.y, o.g3.top[1]) < H + 40);
  }
  for (const o of run.obst) {
    if (o.bump > 0) o.bump -= dt;
    if (P.down > 0) continue;
    if (o.ground) {   // 비행기 높이에 닿는 윗부분(입체 높이의 위 45%, 빛나는 테두리)에 부딪힌다
      if (o.k + bgY < 90 || !o.g3) continue;   // 아직 지평선 너머
      const { M, top, mid } = o.g3, ax = mid[0], ay = mid[1], vx = top[0] - ax, vy = top[1] - ay, L2 = vx * vx + vy * vy || 1;
      const u = clamp(((P.x - ax) * vx + (P.y - ay) * vy) / L2, 0, 1), cx = ax + vx * u, cy = ay + vy * u, sc = mid[2] + (top[2] - mid[2]) * u;
      const rr = M.blades && u > 0.75 ? 52 * top[2] : o.r * (M.rt + (M.rb - M.rt) * (1 - u) * 0.45) * sc * 0.85;
      const dx = P.x - cx, dy = P.y - cy, d = Math.hypot(dx, dy), m = rr + st.hit + 4;
      if (d < m) {
        const k = d || 1; P.x = cx + (d ? dx / k : 1) * m; P.y = cy + (d ? dy / k : 0) * m;
        if (o.bump <= 0) { o.bump = 0.7; shake = Math.max(shake, 4); A.sfx('hit'); hurtPlayer(run.d.dmg * (run.arena ? 0.35 : 0.5)); }
      }
      continue;
    }
    const dx = P.x - o.x, dy = P.y - o.y, d = Math.hypot(dx, dy), m = o.r + 20;
    if (d < m) {   // 부딪히면 밀려난다(다치지는 않는다)
      const k = d || 1; P.x = o.x + dx / k * m; P.y = o.y + dy / k * m;
      if (o.bump <= 0) { o.bump = 0.7; shake = Math.max(shake, 4); A.sfx('hit'); hurtPlayer(run.d.dmg * (run.arena ? 0.35 : 0.5)); }
    }
    if (run.arena) for (const e of foes) {
      if (e.type === 'boss' || e.dead) continue;
      const ex = e.x - o.x, ey = e.y - o.y, ed = Math.hypot(ex, ey), em = o.r + (e.r || 16);
      if (ed < em && ed > 0) { e.x = o.x + ex / ed * em; e.y = o.y + ey / ed * em; }
    }
  }
}
// ---------- 0.43 땅 구조물을 입체로: 땅에 붙은 밑동에서 카메라 쪽으로 솟는 기둥(옆면 그늘·땅 그림자), 부딪히는 곳은 빛나는 윗부분 ----------
const GZ = { k: 1.5, hit: 0.55 };   // 높이 배율(화면 높이 → 입체 높이), 부딪히는 부분은 높이의 위 45%(0.55~1)
function proj3(cx, cy, z) {   // 눕힌 땅 캔버스의 점(cx, cy)에서 땅과 수직으로 z만큼 솟은 점이 화면 어디인지(groundPt의 입체판)
  const X = cx * (W * 3) / BGW - W * 1.5, Y = cy * (H * 2.3) / BGH - H * 2.3;
  const yy = Y * GR_C - z * GR_S, zz = Math.min(GR_D * 0.8, Y * GR_S + z * GR_C), s = GR_D / (GR_D - zz);
  return [W / 2 + X * s, H + yy * s, s];
}
const G3U = () => [BGW / (W * 3), BGH / (H * 2.3)];   // 화면 1px이 땅 캔버스에서 몇 칸인지(가로, 세로)
const OB3 = {   // 구조물 모양: 변 수, 밑 반지름, 위 반지름(×r), 높이(×h), 색, 윗면 색
  tower: { n: 4, rb: 1, rt: 0.14, z: 1, c: '#c9ced8', top: '#e94b4b', frame: true },
  spire: { n: 6, rb: 1, rt: 0.62, z: 1, c: '#8f7f69', top: '#6aaa52' },
  bldg: { n: 4, rb: 1.05, rt: 1.05, z: 1.05, c: '#30456a', top: '#16203a', win: true },
  mill: { n: 6, rb: 0.32, rt: 0.16, z: 1, c: '#e8eef5', top: '#c8d2de', blades: true },
  stack: { n: 10, rb: 0.6, rt: 0.45, z: 1, c: '#6e5e52', top: '#1f1c1a', bands: '#b84a3a', smoke: true },
  ice: { n: 5, rb: 1, rt: 0.12, z: 1.05, c: '#9fd0ee', top: '#e6f6ff' },
  crag: { n: 5, rb: 1, rt: 0.35, z: 0.95, c: '#3a2e2a', top: '#55453d', glow: true },
  ruin: { n: 4, rb: 0.78, rt: 0.72, z: 1, c: '#7a7d6c', top: '#5f9e46' },
};
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
const area2 = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], w = p[(i + 1) % p.length]; a += q[0] * w[1] - w[0] * q[1]; } return a; };
const facePt = (f, u, v) => {   // 옆면 [위j, 위i, 밑i, 밑j] 위의 자리(u 가로 0~1, v 높이 0~1)
  const bx = f[2][0] + (f[3][0] - f[2][0]) * u, by = f[2][1] + (f[3][1] - f[2][1]) * u, tx = f[1][0] + (f[0][0] - f[1][0]) * u, ty = f[1][1] + (f[0][1] - f[1][1]) * u;
  return [bx + (tx - bx) * v, by + (ty - by) * v];
};
const polyPath = p => { ctx.beginPath(); p.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
function obst3(o) {   // 밑동·윗면 점들을 계산해 둔다(그리기와 부딪힘이 같이 쓴다)
  const M = OB3[o.kind] || OB3.spire, [ux, uy] = G3U(), gy = o.k + bgY, Z = o.h * GZ.k * M.z, n = M.n, b = [], t = [];
  for (let i = 0; i < n; i++) {
    const a = o.ph + i / n * TAU, c = Math.cos(a), s = Math.sin(a);
    b.push(proj3(o.gx + c * o.r * M.rb * ux, gy + s * o.r * M.rb * uy, 0));
    t.push(proj3(o.gx + c * o.r * M.rt * ux, gy + s * o.r * M.rt * uy, Z));
  }
  const top = proj3(o.gx, gy, Z), mid = proj3(o.gx, gy, Z * GZ.hit), base = proj3(o.gx, gy, 0);
  o.g3 = { M, b, t, top, mid, base, Z, gy };
  o.x = base[0]; o.y = base[1]; o.s = base[2];
  return o.g3;
}
function drawGroundObst() {
  const list = run.obst.filter(o => o.ground && o.g3).sort((a, b) => a.g3.gy - b.g3.gy);   // 먼 것부터
  for (const o of list) {
    const { M, b, t, top } = o.g3, n = M.n, gy = o.g3.gy;
    const al = clamp((gy - GR_ROW) / 70, 0, 1); if (al <= 0) continue;
    ctx.save(); ctx.globalAlpha = al;
    // 땅 그림자: 빛은 앞 왼쪽에서 → 뒤 오른쪽으로 눕는다
    const [ux, uy] = G3U(), sh = [];
    for (let i = 0; i < n; i++) { const a = o.ph + i / n * TAU; sh.push(proj3(o.gx + (Math.cos(a) * o.r * M.rt + o.g3.Z * 0.55) * ux, gy + (Math.sin(a) * o.r * M.rt - o.g3.Z * 0.3) * uy, 0)); }
    const hull = b.concat(sh), cx = hull.reduce((s, p) => s + p[0], 0) / hull.length, cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
    hull.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
    ctx.fillStyle = 'rgba(0,0,0,.28)'; polyPath(hull); ctx.fill();
    const capSign = Math.sign(area2(t)) || 1;
    // 옆면: 카메라를 보는 면만, 빛을 받는 쪽은 밝게
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, f = [t[j], t[i], b[i], b[j]];
      if (Math.sign(area2(f)) !== capSign) continue;
      const am = o.ph + (i + 0.5) / n * TAU, lit = 0.7 + 0.35 * Math.cos(am - 2.36);   // 빛은 앞 왼쪽에서
      if (M.frame) {   // 전파탑: 뼈대만
        ctx.strokeStyle = shade(M.c, lit + 0.1); ctx.lineWidth = 2.6 * b[i][2];
        ctx.beginPath(); ctx.moveTo(b[i][0], b[i][1]); ctx.lineTo(t[i][0], t[i][1]); ctx.moveTo(b[j][0], b[j][1]); ctx.lineTo(t[j][0], t[j][1]); ctx.stroke();
        ctx.lineWidth = 1.3 * b[i][2]; ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a1 = facePt(f, 0, k / 6), a2 = facePt(f, 1, (k + 1) / 6), a3 = facePt(f, 1, k / 6), a4 = facePt(f, 0, (k + 1) / 6);
          ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.moveTo(a3[0], a3[1]); ctx.lineTo(a4[0], a4[1]);
        }
        ctx.stroke();
        for (const v of [0.3, 0.62]) { const q1 = facePt(f, 0, v), q2 = facePt(f, 1, v); ctx.strokeStyle = '#e94b4b'; ctx.lineWidth = 3.2 * b[i][2]; ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke(); }
        continue;
      }
      ctx.fillStyle = shade(M.c, lit); polyPath(f); ctx.fill();
      if (M.win) {   // 빌딩 창문
        let rn = ((o.ph * 1000) | 0) + i * 97;
        for (let v = 0.08; v < 0.94; v += 0.085) for (let u = 0.12; u < 0.9; u += 0.19) {
          rn = (rn * 1103515245 + 12345) & 0x7fffffff; if (rn % 5 < 2) continue;
          ctx.fillStyle = rn % 3 ? `rgba(255,214,120,${0.55 + lit * 0.35})` : `rgba(140,210,255,${0.5 + lit * 0.3})`;
          polyPath([facePt(f, u, v), facePt(f, u + 0.1, v), facePt(f, u + 0.1, v + 0.045), facePt(f, u, v + 0.045)]); ctx.fill();
        }
      }
      if (M.bands) for (const v of [0.3, 0.7]) { ctx.fillStyle = shade(M.bands, lit + 0.1); polyPath([facePt(f, 0, v), facePt(f, 1, v), facePt(f, 1, v + 0.06), facePt(f, 0, v + 0.06)]); ctx.fill(); }
    }
    // 윗면(가장 가까운 곳 = 부딪히는 높이)
    if (!M.frame) { ctx.fillStyle = M.top; polyPath(t); ctx.fill(); }
    if (M.glow) { const gl = 0.6 + 0.4 * Math.sin(T * 3 + o.ph), m = proj3(o.gx, gy, o.g3.Z * 0.5); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * gl * 0.6; ctx.drawImage(Art.glow('#ff7a2a', 24), m[0] - 26 * m[2], m[1] - 26 * m[2], 52 * m[2], 52 * m[2]); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al; }
    // 부딪히는 곳 표시: 윗부분 둘레가 빛나고, 가까이 가면 붉게 깜빡인다
    const near = Math.hypot(P.x - top[0], P.y - top[1]) < 190, pulse = near ? 0.55 + 0.45 * Math.sin(T * 14) : 0.45;
    ctx.strokeStyle = near ? `rgba(255,90,70,${pulse})` : `rgba(255,214,120,${pulse})`; ctx.lineWidth = (near ? 3 : 2) * top[2];
    if (M.frame) { ctx.beginPath(); ctx.arc(top[0], top[1], o.r * 0.5 * top[2], 0, TAU); ctx.stroke(); } else { polyPath(t); ctx.stroke(); }
    if (M.frame) { const on = Math.sin(T * 4 + o.ph) > 0; ctx.fillStyle = on ? '#ff4040' : '#7a2020'; ctx.beginPath(); ctx.arc(top[0], top[1], 5 * top[2], 0, TAU); ctx.fill(); }
    if (M.blades) {   // 풍차 날개: 꼭대기에서 돈다
      ctx.save(); ctx.translate(top[0], top[1]); ctx.scale(top[2], top[2] * 0.8); ctx.rotate(T * 1.6 + o.ph); ctx.fillStyle = '#f4f8fc';
      for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(54, -6); ctx.lineTo(58, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#c8d2de'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (M.smoke) for (let i = 0; i < 4; i++) { const k = ((T * 0.5 + i / 4 + o.ph) % 1), sr = (10 + k * 26) * top[2]; ctx.fillStyle = `rgba(110,105,100,${0.45 * (1 - k)})`; ctx.beginPath(); ctx.arc(top[0] + k * 30 + Math.sin(T + i) * 4, top[1] - 8 - k * 60, sr, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (o.bump > 0) { ctx.strokeStyle = `rgba(255,220,120,${o.bump})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(top[0], top[1], o.r * top[2] + 8, 0, TAU); ctx.stroke(); }
  }
}
function drawObst(front) {   // front: 로봇보다 앞(아래)에 있는 것만 / 뒤에 있는 것만
  if (!run.obst || !run.obst.length) return;
  const list = run.arena ? run.obst : run.obst.slice().sort((a, b) => a.y - b.y);   // 먼 것부터
  for (const o of list) {
    if (o.ground || (o.y > P.y) !== front) continue;   // 땅 구조물은 drawBg에서(구름·탄·적보다 아래)
    if (o.y - o.h > cam.y + H + 40 || o.y < cam.y - 60 || o.x < cam.x - 120 || o.x > cam.x + W + 120) continue;
    ctx.save();
    if (o.ground) {
      const a = clamp((o.k + bgY - GR_ROW) / 70, 0, 1);   // 지평선 안개에서 서서히 드러난다
      if (a <= 0) { ctx.restore(); continue; }
      ctx.globalAlpha = a; ctx.translate(o.x, o.y); ctx.scale(o.s, o.s);
      obstShape(o, 0, 0);
      ctx.restore();
      if (o.bump > 0) { ctx.strokeStyle = `rgba(255,220,120,${o.bump})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x, o.y - o.h * o.s * 0.75, o.r * o.s + 8, 0, TAU); ctx.stroke(); }
      continue;
    }
    obstShape(o, o.x, o.y);
    ctx.restore();
    if (o.bump > 0) { ctx.strokeStyle = `rgba(255,220,120,${o.bump})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 6, 0, TAU); ctx.stroke(); }
  }
}
function obstShape(o, x, y) {
  const { r, h } = o;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x + h * 0.32, y + 6, r * 1.15 + h * 0.18, r * 0.5, -0.25, 0, TAU); ctx.fill();   // 그림자
  const oim = IMG['obst-' + o.kind];
  if (oim) { const ht = h * 1.3, wd = ht * oim.width / oim.height; ctx.drawImage(oim, x - wd / 2, y - ht * 0.9, wd, ht); return; }   // 그림 파일 구조물(밑동 가운데가 땅에 닿게)
  if (o.kind === 'stack') {   // 공장 굴뚝: 연기를 뿜는다
    const w = r * 1.1, gr = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, '#3a3532'); gr.addColorStop(0.5, '#7a6a5e'); gr.addColorStop(1, '#2c2826');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w * 0.38, y - h); ctx.lineTo(x + w * 0.38, y - h); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b84a3a'; for (const k of [0.25, 0.6]) ctx.fillRect(x - w * (0.5 - k * 0.12), y - h * k - 4, w * (1 - k * 0.24), 7);
    ctx.fillStyle = '#1f1c1a'; ctx.beginPath(); ctx.ellipse(x, y - h, w * 0.4, w * 0.13, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) { const k = ((T * 0.5 + i / 4 + o.ph) % 1), sr = 10 + k * 26; ctx.fillStyle = `rgba(110,105,100,${0.45 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + k * 30 + Math.sin(T + i) * 4, y - h - 8 - k * 70, sr, 0, TAU); ctx.fill(); }
  } else if (o.kind === 'ice') {   // 얼음 기둥
    ctx.fillStyle = '#9fd0ee'; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.3, y - h); ctx.lineTo(x + r * 0.15, y - h * 1.05); ctx.lineTo(x + r, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x - r * 0.25, y - h * 0.95); ctx.lineTo(x - r * 0.05, y - h * 0.9); ctx.lineTo(x - r * 0.2, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6aa8d0'; ctx.beginPath(); ctx.moveTo(x + r * 0.15, y - h * 1.05); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.35, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c4e6f7'; ctx.beginPath(); ctx.moveTo(x + r * 0.5, y); ctx.lineTo(x + r * 0.9, y - h * 0.45); ctx.lineTo(x + r * 1.3, y); ctx.closePath(); ctx.fill();
    if (Math.sin(T * 2 + o.ph) > 0.8) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ffffff', 12), x - r * 0.4 - 8, y - h * 0.7 - 8, 16, 16); ctx.globalCompositeOperation = 'source-over'; }
  } else if (o.kind === 'crag') {   // 화산 바위: 갈라진 틈이 빛난다
    ctx.fillStyle = '#2a2220'; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.7, y - h * 0.7); ctx.lineTo(x - r * 0.2, y - h); ctx.lineTo(x + r * 0.4, y - h * 0.85); ctx.lineTo(x + r, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#463a35'; ctx.beginPath(); ctx.moveTo(x - r * 0.2, y - h); ctx.lineTo(x + r * 0.4, y - h * 0.85); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.1, y); ctx.closePath(); ctx.fill();
    const gl = 0.6 + 0.4 * Math.sin(T * 3 + o.ph);
    ctx.strokeStyle = `rgba(255,120,40,${gl})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - r * 0.1, y - h * 0.9); ctx.lineTo(x - r * 0.3, y - h * 0.55); ctx.lineTo(x, y - h * 0.3); ctx.lineTo(x - r * 0.2, y); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = gl * 0.5; ctx.drawImage(Art.glow('#ff7a2a', 20), x - 20, y - h * 0.6 - 20, 40, 40); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  } else if (o.kind === 'ruin') {   // 밀림 돌탑: 이끼와 덩굴
    const w = r * 1.4;
    ctx.fillStyle = '#6d7062'; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = '#8a8d7c'; ctx.fillRect(x - w / 2, y - h, w * 0.45, h);
    ctx.fillStyle = '#545749'; for (let k = 1; k < 4; k++) ctx.fillRect(x - w / 2, y - h * k / 4 - 2, w, 3);
    ctx.fillStyle = '#7d806f'; ctx.fillRect(x - w * 0.65, y - h - 10, w * 1.3, 12);
    ctx.fillStyle = '#2b2d24'; ctx.fillRect(x - 5, y - h * 0.62, 10, 14);
    ctx.strokeStyle = '#4f8a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, y - h - 4); ctx.quadraticCurveTo(x - w / 2 - 6, y - h / 2, x - w / 2 + 6, y - 6); ctx.stroke();
    ctx.fillStyle = '#5f9e46'; ctx.beginPath(); ctx.ellipse(x + w * 0.2, y - h - 6, w * 0.4, 6, 0, 0, TAU); ctx.fill();
  } else if (o.kind === 'bldg') {   // 밤 도시의 높은 빌딩
    const w = r * 1.5, gr = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, '#1b2740'); gr.addColorStop(0.55, '#33476b'); gr.addColorStop(1, '#141c2e');
    ctx.fillStyle = gr; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = '#0f1626'; ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x - w / 2 + 6, y - h - 7); ctx.lineTo(x + w / 2 + 6, y - h - 7); ctx.lineTo(x + w / 2, y - h); ctx.fill();
    let n = (o.ph * 1000) | 0;
    for (let yy = y - h + 8; yy < y - 6; yy += 11) for (let xx = x - w / 2 + 5; xx < x + w / 2 - 5; xx += 9) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      if (n % 5 < 2) continue;
      ctx.fillStyle = n % 3 ? 'rgba(255,214,120,.85)' : 'rgba(140,210,255,.8)'; ctx.fillRect(xx, yy, 4, 5);
    }
    const on = Math.sin(T * 3 + o.ph) > 0; ctx.fillStyle = on ? '#ff4040' : '#5a1818'; ctx.fillRect(x - 1.5, y - h - 22, 3, 15); ctx.beginPath(); ctx.arc(x, y - h - 23, 4, 0, TAU); ctx.fill();
  } else if (o.kind === 'spire') {   // 바위 기둥
    const gr = ctx.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, '#5e5246'); gr.addColorStop(0.5, '#9a8a74'); gr.addColorStop(1, '#4a4036');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.62, y - h); ctx.lineTo(x + r * 0.55, y - h - 4); ctx.lineTo(x + r, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,20,.45)'; ctx.lineWidth = 2; for (const k of [0.3, 0.55, 0.8]) { ctx.beginPath(); ctx.moveTo(x - r * (1 - k * 0.4), y - h * k); ctx.lineTo(x + r * (0.9 - k * 0.4), y - h * k + 5); ctx.stroke(); }
    ctx.fillStyle = '#5c9a4c'; ctx.beginPath(); ctx.ellipse(x - r * 0.03, y - h - 2, r * 0.66, r * 0.26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7cc266'; ctx.beginPath(); ctx.ellipse(x - r * 0.12, y - h - 5, r * 0.4, r * 0.15, 0, 0, TAU); ctx.fill();
  } else if (o.kind === 'mill') {   // 풍차
    ctx.fillStyle = '#e8eef5'; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x - 3, y - h); ctx.lineTo(x + 3, y - h); ctx.lineTo(x + 8, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b9c6d4'; ctx.fillRect(x + 1, y - h, 3, h);
    ctx.translate(x, y - h); ctx.rotate(T * 1.6 + o.ph); ctx.fillStyle = '#f4f8fc';
    for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(54, -6); ctx.lineTo(58, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#c8d2de'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
  } else {   // 전파탑
    ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - 3, y - h); ctx.moveTo(x + r, y); ctx.lineTo(x + 3, y - h); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(220,226,236,.8)';
    for (let k = 0; k < 6; k++) { const a = k / 6, b = (k + 1) / 6, wa = r * (1 - a) + 3 * a, wb = r * (1 - b) + 3 * b; ctx.beginPath(); ctx.moveTo(x - wa, y - h * a); ctx.lineTo(x + wb, y - h * b); ctx.moveTo(x + wa, y - h * a); ctx.lineTo(x - wb, y - h * b); ctx.stroke(); }
    ctx.fillStyle = '#e94b4b'; ctx.fillRect(x - r * 0.75, y - h * 0.3, r * 1.5, 4); ctx.fillRect(x - r * 0.45, y - h * 0.62, r * 0.9, 4);
    const on = Math.sin(T * 4 + o.ph) > 0; ctx.fillStyle = on ? '#ff4040' : '#7a2020'; ctx.beginPath(); ctx.arc(x, y - h - 4, 5, 0, TAU); ctx.fill();
    if (on) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,60,60,.35)'; ctx.beginPath(); ctx.arc(x, y - h - 4, 14, 0, TAU); ctx.fill(); }
  }
}
// ---------- 하늘의 사건: 돌풍·토네이도(맵과 단계에 따라), 쏘면 안 되는 배달 드론·민간 여객기 ----------
// 스테이지·무한에서만(협동·보스 러시·표창 공방 제외). 단계가 오를수록 종류가 늘고 자주 온다.
const hzLv = () => L() + (run.loop || 0) * 5 + (run.mode === 'endless' ? run.wave >> 1 : 0);
// ---------- 새 맵의 하늘 사건: 🔥 굴뚝 불기둥(공장) ❄️ 눈보라(설원) 🌋 용암 분출(화산) 🌿 덩굴 씨앗(정글) ⚡ 번개(구름 위 성) ----------
const HZ_NM = { gust: '💨 돌풍', tornado: '🌪️ 토네이도', drone: '🚁 배달 드론', liner: '✈️ 민간 여객기', fire: '🔥 굴뚝 불기둥', snow: '❄️ 눈보라', erupt: '🌋 용암 분출', vine: '🌿 덩굴 씨앗', bolt: '⚡ 번개' };
function hzStart2(kind, first) {
  const Z = run.hz, lv = hzLv();
  if (kind === 'fire') {   // 아래에서 위로 솟는 불기둥: 붉은 선이 깜빡인 뒤 1.4초
    const n = lv >= 6 ? 2 : 1, xs = [];
    for (let i = 0; i < n; i++) { let x; do x = rnd(70, W - 70); while (xs.some(q => Math.abs(q - x) < 140)); xs.push(x); Z.fire.push({ x, t: -i * 0.5, warn: 1.25, dur: 1.4, hurtT: 0 }); }
    if (Math.random() < 0.6) Z.fire[Z.fire.length - 1].x = clamp(P.x + rnd(-40, 40), 60, W - 60);   // 가끔은 내 쪽으로
    say(first ? '🔥 굴뚝 불기둥! 붉은 줄에서 비켜요' : '🔥 불기둥!', W / 2, H * 0.36, '#ffb070', 22, 1.6); A.sfx('warning');
  } else if (kind === 'snow') {   // 눈보라: 잘 안 보이고 몸이 무거워진다
    Z.snow = { t: 0, dur: 7, dir: Math.random() < 0.5 ? -1 : 1 };
    say('❄️ 눈보라! 잘 안 보이고 느려져요', W / 2, H * 0.36, '#e8f6ff', 22, 2);
  } else if (kind === 'erupt') {   // 용암 분출: 땅에서 불덩이가 여러 곳에 떨어진다
    if (!run.flak) run.flak = [];
    const n = 4 + Math.min(4, lv >> 1);
    for (let i = 0; i < n; i++) run.flak.push({ x: i === 0 ? clamp(P.x, 40, W - 40) : rnd(50, W - 50), y: i === 0 ? clamp(P.y - 20, 140, H - 60) : rnd(180, H - 80), t: -i * 0.22, warn: 1.1, mini: true, lava: true });
    say('🌋 용암 분출! 붉은 원을 피해요', W / 2, H * 0.36, '#ff9a5a', 22, 1.8); A.sfx('warning'); shake = Math.max(shake, 5);
  } else if (kind === 'vine') {   // 덩굴 씨앗: 닿으면 덩굴에 휘감긴다(연타로 탈출). 쏘면 터진다
    const n = 3 + Math.min(3, lv >> 2);
    for (let i = 0; i < n; i++) Z.pods.push({ x: rnd(60, W - 60), y: -30 - i * 90, vy: rnd(70, 95), ph: rnd(0, TAU), hp: 3, r: 18 });
    say(first ? '🌿 덩굴 씨앗! 닿으면 휘감겨요 · 쏘면 터져요' : '🌿 덩굴 씨앗', W / 2, H * 0.36, '#b8f5a0', 21, 1.8);
  } else if (kind === 'bolt') {   // 번개: 내 둘레에 표시 → 내리친다
    const n = lv >= 6 ? 3 : 2;
    for (let i = 0; i < n; i++) Z.bolts.push({ x: clamp(P.x + (i ? rnd(-170, 170) : rnd(-30, 30)), 50, W - 50), y: clamp(P.y + (i ? rnd(-200, 80) : rnd(-30, 30)), 140, H - 60), t: -i * 0.35, warn: 1.05 });
    say('⚡ 번개 구름! 빛나는 원에서 비켜요', W / 2, H * 0.36, '#fff3a0', 22, 1.6);
  }
}
function hzTick2(dt, Z) {
  run.hzSlow = 1;
  const alive = !(P.down > 0) && run.phase !== 'dead';
  for (const f of Z.fire) {
    f.t += dt; if (f.hurtT > 0) f.hurtT -= dt;
    if (f.t > f.warn && f.t < f.warn + f.dur) {
      if (!f.lit) { f.lit = true; A.sfx('boomL'); shake = Math.max(shake, 4); }
      if (alive && Math.abs(P.x - f.x) < 34 && !(f.hurtT > 0)) { f.hurtT = 0.6; hurtPlayer(run.d.dmg * 0.7); }
      for (const b of ebul) if (Math.abs(b.x - f.x) < 30) b.dead = true;
    }
  }
  Z.fire = Z.fire.filter(f => f.t < f.warn + f.dur);
  const s = Z.snow;
  if (s) {
    s.t += dt; const k = Math.min(1, s.t / 0.8, (s.dur - s.t) / 0.8);
    if (k > 0) { run.hzSlow = 1 - 0.38 * k; if (alive && !P.trap) { const push = s.dir * 45 * k * dt; P.tx += push; P.x += push * 0.6; if (drag) drag.ox += push; } }
    if (s.t > s.dur) Z.snow = null;
  }
  for (const p of Z.pods) {
    p.y += p.vy * dt; p.x += Math.sin(T * 1.5 + p.ph) * 30 * dt;
    for (const sh of shots) if (!sh.dead && Math.hypot(sh.x - p.x, sh.y - p.y) < p.r + (sh.r || 4)) { sh.dead = true; if (--p.hp <= 0) { p.gone = true; explode(p.x, p.y, 16, '#7fd65a'); A.sfx('boomS'); gainScrap(1); break; } }
    if (!p.gone && alive && !P.trap && Math.hypot(P.x - p.x, P.y - p.y) < p.r + 16) { p.gone = true; catchInNet(); run.banner = { kind: 'trap', title: '덩굴에 휘감겼다!', sub: '화면을 빠르게 연타해서 빠져나와!', t: 0, life: 1.6 }; }
  }
  Z.pods = Z.pods.filter(p => !p.gone && p.y < H + 40);
  for (const b of Z.bolts) {
    b.t += dt;
    if (b.t >= b.warn && !b.done) {
      b.done = true; flash = Math.max(flash, 0.35); A.sfx('beam'); shake = Math.max(shake, 5);
      if (alive && Math.hypot(P.x - b.x, P.y - b.y) < 44) hurtPlayer(run.d.dmg * 0.8);
      for (const e of foes) if (!e.dead && e.type !== 'boss' && !e.civ && Math.hypot(e.x - b.x, e.y - b.y) < 50) hitFoe(e, 40);   // 적도 맞는다
    }
  }
  Z.bolts = Z.bolts.filter(b => b.t < b.warn + 0.25);
}
function drawHz2(top) {
  const Z = run.hz;
  if (!top) {
    for (const f of Z.fire) {   // 불기둥
      if (f.t < 0) continue;
      if (f.t < f.warn) {
        const a = 0.35 + 0.45 * Math.abs(Math.sin(f.t * 12));
        ctx.strokeStyle = `rgba(255,80,40,${a})`; ctx.lineWidth = 3; ctx.setLineDash([16, 12]);
        for (const dx of [-34, 34]) { ctx.beginPath(); ctx.moveTo(f.x + dx, 0); ctx.lineTo(f.x + dx, H); ctx.stroke(); }
        ctx.setLineDash([]); ctx.font = '30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔥', f.x, H - 40);
      } else {
        const k = Math.min(1, (f.t - f.warn) / 0.15, (f.warn + f.dur - f.t) / 0.25);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
        const gr = ctx.createLinearGradient(f.x - 40, 0, f.x + 40, 0); gr.addColorStop(0, 'rgba(255,60,0,0)'); gr.addColorStop(0.3, 'rgba(255,110,20,.8)'); gr.addColorStop(0.5, 'rgba(255,235,150,.95)'); gr.addColorStop(0.7, 'rgba(255,110,20,.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(f.x - 40 - Math.sin(T * 30) * 3, 0, 80, H);
        for (let i = 0; i < 6; i++) { const yy = ((T * 700 + i * 160) % (H + 100)); ctx.drawImage(Art.glow('#ffb347', 20), f.x - 22 + Math.sin(T * 9 + i) * 10, H - yy - 22, 44, 44); }
        ctx.restore();
      }
    }
    for (const p of Z.pods) {   // 덩굴 씨앗
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(T * 2 + p.ph) * 0.3);
      ctx.strokeStyle = '#3f7a2c'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + T; ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * 20, Math.sin(a) * 20, Math.cos(a + 0.6) * 28, Math.sin(a + 0.6) * 28); } ctx.stroke();
      ctx.fillStyle = '#6fbf4a'; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.8, p.r, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a5e57a'; ctx.beginPath(); ctx.ellipse(-4, -5, p.r * 0.3, p.r * 0.45, -0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2d5a20'; for (const dx of [-5, 5]) { ctx.beginPath(); ctx.arc(dx, 3, 2.5, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    for (const b of Z.bolts) {   // 번개 표시
      if (b.t < 0 || b.done) continue;
      const k = b.t / b.warn;
      ctx.strokeStyle = `rgba(255,240,140,${0.4 + 0.5 * k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, 44, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255,240,140,${0.1 + 0.25 * k})`; ctx.beginPath(); ctx.arc(b.x, b.y, 44 * k, 0, TAU); ctx.fill();
    }
    return;
  }
  for (const b of Z.bolts) {   // 내리치는 번개
    if (!b.done) continue;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 5; ctx.shadowColor = '#fff3a0'; ctx.shadowBlur = 18;
    ctx.beginPath(); let x = b.x + rnd(-30, 30); ctx.moveTo(x, 0);
    for (let y = 60; y < b.y; y += 60) { x += rnd(-28, 28); ctx.lineTo(x, y); }
    ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  }
  const s = Z.snow;
  if (s) {   // 눈보라: 하얀 막 + 비스듬히 날리는 눈
    const k = Math.max(0, Math.min(1, s.t / 0.8, (s.dur - s.t) / 0.8));
    ctx.save(); ctx.fillStyle = `rgba(235,244,255,${0.32 * k})`; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(255,255,255,${0.85 * k})`;
    const n = Q.low ? 50 : 120;
    for (let i = 0; i < n; i++) { const sx = ((i * 97.3 + T * 260 * s.dir + Math.sin(i) * 50) % (W + 40) + W + 40) % (W + 40) - 20, sy = (i * 61.7 + T * 330) % H; ctx.fillRect(sx, sy, 3 + (i % 3), 3 + (i % 3)); }
    ctx.restore();
  }
}
function hzKinds() {   // 맵마다 어울리는 사건만: 바다 섬은 바람·여객기, 사막은 토네이도, 밤 도시는 드론·여객기, 우주는 없음
  const lv = hzLv(), MAP = [
    [['gust', 2], ['liner', 3], ['drone', 5]],
    [['tornado', 2], ['gust', 4]],
    [['drone', 2], ['liner', 3], ['gust', 6]],
    [],
    [['fire', 2], ['drone', 3], ['gust', 6]],
    [['snow', 2], ['gust', 3]],
    [['erupt', 2], ['tornado', 5]],
    [['vine', 2], ['drone', 4]],
    [['bolt', 2], ['liner', 3], ['gust', 4]],
    [],
  ][run.theme] || [];
  return MAP.filter(m => lv >= m[1]).map(m => m[0]);
}
function hazardTick(dt) {
  if (run.arena || run.coop || !(run.mode === 'stage' || run.mode === 'endless')) return;
  if (!run.hz) run.hz = { t: /fast/.test(location.hash) ? 4 : 14, wind: null, tw: [], seen: {}, fire: [], pods: [], bolts: [], snow: null };
  const Z = run.hz;
  if (run.phase === 'waves' && !boss && !run.gates && !(run.barrageT > 0) && !(run.stormN > 0) && (Z.t -= dt) <= 0) {   // 갈림길 효과와 겹치지 않게
    const ks = hzKinds(), key = ks.join();
    if (Z.key !== key) {   // 판(구역)마다 그날의 하늘: 열린 것 중 1~2가지만 나온다. 가끔은 맑은 하늘
      Z.key = key;
      const lv = hzLv(), mix = ks.slice().sort(() => Math.random() - 0.5);
      Z.set = ks.length && Math.random() < (lv >= 6 ? 0.1 : 0.22) ? [] : mix.slice(0, lv >= 6 ? 2 : 1);
      if (ks.length) say(Z.set.length ? '오늘의 하늘: ' + Z.set.map(k => HZ_NM[k]).join(' · ') : '오늘의 하늘: ☀️ 맑음', W / 2, H * 0.22, '#cfeaff', 18, 2.4);
    }
    Z.t = rnd(15, 24) * Math.max(0.6, 1 - hzLv() * 0.04);
    if (Z.set.length) hzStart(pick(Z.set));
  }
  const w = Z.wind;   // 돌풍: 경고 뒤 4초 동안 옆으로 민다
  if (w) {
    w.t += dt;
    if (w.t > w.warn && w.t < w.warn + w.dur && run.phase !== 'dead') {
      const k = Math.min(1, (w.t - w.warn) / 0.4, (w.warn + w.dur - w.t) / 0.4), push = w.dir * 165 * k * dt;
      if (!(P.down > 0) && !P.trap) { P.tx += push; P.x += push * 0.6; if (drag) drag.ox += push; }
      for (const b of ebul) b.x += push * 0.5;
      for (const d of drops) d.x += push * 0.4;
    }
    if (w.t > w.warn + w.dur) Z.wind = null;
  }
  for (const o of Z.tw) {   // 토네이도: 천천히 내려오며 끌어당긴다
    o.t += dt; o.y += o.vy * dt; o.x += Math.sin(o.t * 0.7 + o.ph) * 40 * dt;
    if (o.hurtT > 0) o.hurtT -= dt;
    const dx = o.x - P.x, dy = o.y - P.y, d = Math.hypot(dx, dy);
    if (d < 260 && !(P.down > 0) && run.phase !== 'dead') {
      const f = (1 - d / 260) * 240 * dt / (d || 1), sw = (1 - d / 260) * 120 * dt / (d || 1);
      const mx = dx * f - dy * sw, my = dy * f + dx * sw;   // 빨아들이며 빙글 돈다
      P.tx += mx; P.ty += my; P.x += mx * 0.6; P.y += my * 0.6; if (drag) { drag.ox += mx; drag.oy += my; }
      if (d < 42 && !(o.hurtT > 0)) { o.hurtT = 0.9; hurtPlayer(run.d.dmg * 0.6); shake = Math.max(shake, 6); }
    }
    for (const b of ebul) { const bx = o.x - b.x, by = o.y - b.y, bd = Math.hypot(bx, by); if (bd < 200 && bd > 1) { b.vx += (bx / bd * 90 - by / bd * 160) * dt; b.vy += (by / bd * 90 + bx / bd * 160) * dt; } }
  }
  Z.tw = Z.tw.filter(o => o.y < H + 200);
  hzTick2(dt, Z);
}
function hzStart(kind) {
  const Z = run.hz, first = !Z.seen[kind]; Z.seen[kind] = true;
  bookMark('hz', kind);
  if (['fire', 'snow', 'erupt', 'vine', 'bolt'].includes(kind)) return hzStart2(kind, first);
  if (kind === 'gust') {
    const dir = Math.random() < 0.5 ? -1 : 1;
    Z.wind = { dir, t: 0, warn: 1.3, dur: 4 };
    say(dir > 0 ? '💨 돌풍! 오른쪽으로 →' : '← 왼쪽으로 돌풍! 💨', W / 2, H * 0.36, '#cfeaff', 26, 1.6);
  } else if (kind === 'tornado') {
    Z.tw.push({ x: rnd(120, W - 120), y: -140, vy: 62, t: 0, ph: rnd(0, TAU), hurtT: 0 });
    say('🌪️ 토네이도! 가운데로 빨려 들지 마세요', W / 2, H * 0.36, '#ffe0a8', 22, 2);
  } else if (kind === 'drone') {
    const n = hzLv() >= 6 ? 2 : 1;
    for (let i = 0; i < n; i++) addFoe('ddrone', rnd(70, W - 70), -40 - i * 140, { civ: true, harmless: true, r: 20, hp: 1, maxHp: 1, vy: 105, vx: 0, ph: rnd(0, TAU), hits: 0 });
    say(first ? '🚁 배달 드론! 쏘지 말고 비켜 주세요' : '🚁 배달 드론 지나갑니다', W / 2, H * 0.36, '#bff5c8', 22, 1.8);
  } else if (kind === 'liner') {
    addFoe('liner', rnd(110, W - 110), -120, { civ: true, harmless: true, r: 50, hp: 1, maxHp: 1, vy: 95, vx: 0, hits: 0, warnT: 0 });
    say('✈️ 민간 여객기 통과 중! 쏘면 안 돼요', W / 2, H * 0.36, '#ffffff', 24, 2);
    A.sfx('warning');
  }
}
function civAI(e, dt) {
  e.t += dt;
  if (e.type === 'ddrone') { e.y += e.vy * dt; e.x += Math.sin(e.t * 1.8 + e.ph) * 50 * dt; }
  else { e.y += e.vy * dt; if (e.warnT > 0) e.warnT -= dt; }
  if (e.y > H + 90) {   // 무사히 지나갔다
    e.gone = true;
    if (e.type === 'ddrone' && !e.broke) { say('📦 배달 완료! 고철 +2', clamp(e.x, 90, W - 90), H - 120, '#9dffcf', 18, 1.4); gainScrap(2); }
    if (e.type === 'liner') {
      if (e.hits <= 3) { say('✈️ 승객 모두 무사! 고철 +5', W / 2, H * 0.4, '#9dffcf', 22, 1.8); gainScrap(5); run.score += 500 * L(); }
      else say('✈️ 여객기가 겨우 빠져나갔다…', W / 2, H * 0.4, '#c9d2dc', 20, 1.6);
    }
  }
}
function civHit(e, dmg) {   // 쏘면 벌점(점수 깎이고 콤보가 끊긴다)
  run.combo = 0; e.flash = 0.08; e.hits++;
  if (e.type === 'ddrone') {
    e.broke = true; e.dead = true; run.score = Math.max(0, run.score - 300 * L());
    spark(e.x, e.y, 12, '#ffd166', 180, 0.4, 3); A.sfx('boomS');
    fx.push({ k: 'debris', x: e.x, y: e.y + 10, vx: rnd(-30, 30), vy: 160, t: 0, life: 0.9, size: 6, rot: 0, vr: 6 });
    say('📦 배달 실패… 점수 -' + 300 * L(), e.x, e.y - 24, '#ff9a9a', 18, 1.4);
  } else {
    run.score = Math.max(0, run.score - 40 * L()); A.sfx('hit');
    if (!(e.warnT > 0)) { e.warnT = 0.8; say('⚠️ 민간 여객기! 쏘지 마세요', clamp(e.x, 130, W - 130), e.y + 70, '#ff8080', 20, 0.9); }
  }
}
function drawCiv(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (hasGround()) { ctx.save(); ctx.translate(e.type === 'liner' ? 40 : 16, e.type === 'liner' ? 60 : 26); ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 0, e.type === 'liner' ? 70 : 20, e.type === 'liner' ? 22 : 10, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  const cim = IMG['civ-' + e.type];
  if (cim) {
    const s = e.type === 'liner' ? 175 : 66; if (e.type === 'ddrone') ctx.rotate(Math.sin(e.t * 1.8 + e.ph) * 0.15);
    ctx.drawImage(cim, -s / 2, -s / 2, s, s);
    if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(cim, -s / 2, -s / 2, s, s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (e.type === 'liner') { ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('🚫 민간기', 0, -96); }
    ctx.restore(); return;
  }
  if (e.type === 'ddrone') {   // 네 날개 배달 드론과 매달린 상자
    ctx.rotate(Math.sin(e.t * 1.8 + e.ph) * 0.15);
    ctx.strokeStyle = '#3c4656'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-16, -16); ctx.lineTo(16, 16); ctx.moveTo(16, -16); ctx.lineTo(-16, 16); ctx.stroke();
    for (const [x, y] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) { ctx.fillStyle = 'rgba(220,235,255,.45)'; ctx.beginPath(); ctx.ellipse(x, y, 11, 3 + Math.abs(Math.sin(T * 40 + x)) * 4, T * 30, 0, TAU); ctx.fill(); }
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#eef3f8'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#35d07f'; ctx.fillRect(-3, -3, 6, 6);
    ctx.strokeStyle = 'rgba(80,60,40,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, 18); ctx.stroke();
    ctx.fillStyle = '#c8955a'; ctx.fillRect(-9, 18, 18, 14); ctx.strokeStyle = '#8a5f30'; ctx.strokeRect(-9, 18, 18, 14); ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, 32); ctx.stroke();
    if (Math.sin(T * 6) > 0) { ctx.fillStyle = '#4dff9e'; ctx.beginPath(); ctx.arc(0, -10, 2.5, 0, TAU); ctx.fill(); }
  } else {   // 민간 여객기(아래로 날아간다)
    const hit = e.flash > 0;
    ctx.fillStyle = hit ? '#ffd0d0' : '#dfe6ee';   // 날개
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-72, -26); ctx.lineTo(-72, -16); ctx.lineTo(-8, 18); ctx.lineTo(8, 18); ctx.lineTo(72, -16); ctx.lineTo(72, -26); ctx.lineTo(6, -8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, -54); ctx.lineTo(-26, -66); ctx.lineTo(-26, -60); ctx.lineTo(-4, -44); ctx.lineTo(4, -44); ctx.lineTo(26, -60); ctx.lineTo(26, -66); ctx.lineTo(5, -54); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9aa6b4'; for (const s of [-1, 1]) { ctx.fillRect(s * 32 - 5, -14, 10, 20); ctx.fillRect(s * 52 - 4, -20, 8, 16); }   // 엔진
    const gr = ctx.createLinearGradient(-12, 0, 12, 0); gr.addColorStop(0, '#c9d2dc'); gr.addColorStop(0.5, hit ? '#fff' : '#ffffff'); gr.addColorStop(1, '#b6c0cc');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, -4, 11, 66, 0, 0, TAU); ctx.fill();   // 몸통
    ctx.fillStyle = '#2a7de1'; ctx.fillRect(-11, 6, 22, 5);
    ctx.fillStyle = '#e84a5f'; ctx.beginPath(); ctx.moveTo(-2, -60); ctx.lineTo(0, -74); ctx.lineTo(2, -60); ctx.fill();   // 꼬리 날개
    ctx.fillStyle = '#2b3a52'; for (let k = -44; k < 50; k += 9) { ctx.fillRect(-7, k, 3, 4); ctx.fillRect(4, k, 3, 4); }   // 창문
    ctx.fillStyle = '#1d2a3c'; ctx.beginPath(); ctx.ellipse(0, 56, 6, 5, 0, 0, Math.PI); ctx.fill();   // 조종석
    const on = Math.sin(T * 5) > 0;
    if (on) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,60,60,.9)'; ctx.beginPath(); ctx.arc(-72, -21, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(60,255,120,.9)'; ctx.beginPath(); ctx.arc(72, -21, 3.5, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('🚫 민간기', 0, -86);
  }
  ctx.restore();
}
function drawHazards(top) {   // top=false: 땅 위 토네이도 / top=true: 화면 위 바람 줄기
  const Z = run.hz;
  if (!Z) return;
  if (Z.fire) drawHz2(top);
  if (!top) {
    for (const o of Z.tw) {
      const dust = run.theme === 6 ? [95, 70, 60] : run.theme === 1 ? [200, 160, 110] : run.theme === 2 ? [120, 140, 180] : [190, 200, 210];
      ctx.save(); ctx.translate(o.x, o.y);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(10, 30, 70, 22, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 9; i++) {   // 아래(땅)는 좁고 위로 갈수록 넓은 깔때기
        const k = i / 8, y = 30 - k * 190, rx = 18 + k * 78, sway = Math.sin(T * 3 + k * 4 + o.ph) * 14 * k;
        ctx.strokeStyle = `rgba(${dust[0]},${dust[1]},${dust[2]},${0.55 - k * 0.25})`; ctx.lineWidth = 7 - k * 3;
        ctx.beginPath(); ctx.ellipse(sway, y, rx, rx * 0.3, 0, T * 6 + i, T * 6 + i + Math.PI * 1.4); ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }
  const w = Z.wind;
  if (!w) return;
  ctx.save();
  if (w.t < w.warn) {   // 경고 화살표
    const a = 0.5 + 0.5 * Math.sin(w.t * 14);
    ctx.globalAlpha = a; ctx.fillStyle = '#cfeaff'; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(w.dir > 0 ? '➜➜' : '⬅⬅', w.dir > 0 ? W - 90 : 90, H * 0.5);
  } else {
    const k = Math.min(1, (w.t - w.warn) / 0.4, (w.warn + w.dur - w.t) / 0.4);
    ctx.strokeStyle = `rgba(230,245,255,${0.35 * k})`; ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const y = (i * 61 + 23) % H, len = 60 + (i * 37) % 90, x = ((w.t * 900 + i * 173) % (W + 300)) - 150, xx = w.dir > 0 ? x : W - x;
      ctx.beginPath(); ctx.moveTo(xx, y); ctx.quadraticCurveTo(xx - w.dir * len / 2, y - 6, xx - w.dir * len, y); ctx.stroke();
    }
  }
  ctx.restore();
}
function arenaStart() {
  run.arena = true; run.keeper = null; run.spawnT = 1.2; run.waveDur = /fast/.test(location.hash) ? 12 : 40;
  P.x = P.tx = P.lx = AW / 2; P.y = P.ty = AH / 2; P.inv = 2;
  cam.x = clamp(P.x - W / 2, 0, AW - W); cam.y = clamp(P.y - H * 0.55, 0, AH - H);
  Forge.takeMade(); arenaObstacles();
}
function drawArenaFloor() {   // 들판의 점 무늬와 울타리(어디로 움직이는지 보이게)
  const g0 = 110, x0 = Math.floor(cam.x / g0) * g0, y0 = Math.floor(cam.y / g0) * g0;
  ctx.fillStyle = 'rgba(255,255,255,.13)';
  for (let x = x0; x < cam.x + W + g0; x += g0) for (let y = y0; y < cam.y + H + g0; y += g0) ctx.fillRect(x - 2, y - 2, 4, 4);
  ctx.strokeStyle = 'rgba(255,120,120,.6)'; ctx.lineWidth = 5; ctx.setLineDash([22, 14]); ctx.strokeRect(8, 8, AW - 16, AH - 16); ctx.setLineDash([]);
}
function drawKeeperHud() {   // 대장 체력과, 화면 밖에 있으면 방향 화살표
  const k = run.keeper; if (!k || k.dead) return;
  segBar(136, 24, W - 272, 12, k.hp / k.maxHp, '#ff3d5a', '#ff9a6b', 10);
  txt('대장', W / 2, 56, 13, '#ffd0d0', 'center', 800);
  if (!offView(k.x, k.y, -20)) return;
  const sx = k.x - cam.x, sy = k.y - cam.y, a = Math.atan2(sy - H / 2, sx - W / 2), ex = clamp(sx, 40, W - 40), ey = clamp(sy, 120, H - 90);
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
  ctx.fillStyle = Math.floor(T * 4) % 2 ? '#ff5d5d' : '#ffd166';
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.restore();
}

