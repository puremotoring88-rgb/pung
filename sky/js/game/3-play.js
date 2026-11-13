// 볼트윙 게임 본체 (내 로봇·맞히기·카드·자동 조종·한 프레임) — js/game/ 파일들과 js/game.js는 한 이름 공간을 나눠 쓴다(index.html에 적힌 순서대로 읽음).
'use strict';
// ---------- 내 로봇: 쏘기와 드론 ----------
function addShot(x, y, vx, vy, dmg, o) {
  shots.push(Object.assign({ x, y, vx, vy, dmg, pierce: 0, r: 5, color: st.Wp.color, hits: [], t: 0 }, o));
}
function fire(sh = P, Wp = st.Wp, base = st.dmg) {   // sh = 쏘는 기체(나 또는 친구)
  const m = run.m, evo = run.evo, mine = sh === P, dmg = base * m.dmg * (run.beatBuff || 1), pierce = (Wp.pierce || 0) + m.pierce, n = 1 + m.multi;
  const rot = run.arena ? aimOf(sh) + Math.PI / 2 : 0, cr = Math.cos(rot), sr = Math.sin(rot);   // 표창 공방: 가장 가까운 적 쪽으로 돌려 쏜다
  const shot = (x, y, vx, vy, d, o) => {
    if (rot) { const ox = x - sh.x, oy = y - sh.y; x = sh.x + ox * cr - oy * sr; y = sh.y + ox * sr + oy * cr; const nvx = vx * cr - vy * sr; vy = vx * sr + vy * cr; vx = nvx; }
    addShot(x, y, vx, vy, d, Object.assign({ color: Wp.color, own: mine ? null : sh }, o));
  };
  if (mine) A.sfx(Wp.id);
  if (Wp.id === 'spread') {
    const k = Wp.pellets + 2 * m.multi + (evo ? 4 : 0), arc = Wp.arc + 0.08 * m.multi + (evo ? 0.25 : 0);
    for (let i = 0; i < k; i++) {
      const a = -Math.PI / 2 - arc / 2 + arc * i / (k - 1), o = { pierce: pierce + (evo ? 1 : 0) };
      if (evo) { o.color = '#ff8a3c'; o.r = 7; }   // 진화: 용의 숨결
      shot(sh.x, sh.y - 24, Math.cos(a) * Wp.speed, Math.sin(a) * Wp.speed, dmg, o);
    }
  } else if (Wp.id === 'missile') {
    const k = n * (evo ? 2 : 1);   // 진화: 군집 미사일
    for (let i = 0; i < k; i++) shot(sh.x + (i - (k - 1) / 2) * 14, sh.y - 18, (i - (k - 1) / 2) * 120 + rnd(-40, 40), -300, dmg, { homing: true, pierce, r: 6, boom: !!evo });
  } else if (Wp.id === 'laser' && evo) {   // 진화: 프리즘 빔
    for (let i = 0; i < n; i++) for (const a of [-0.12, 0, 0.12]) shot(sh.x + (i - (n - 1) / 2) * 14, sh.y - 26, Math.sin(a) * Wp.speed, -Math.cos(a) * Wp.speed, dmg, { pierce: 99, r: 5, long: true, color: '#ffb3f5' });
  } else {
    const gat = evo && Wp.id === 'vulcan';   // 진화: 폭풍 개틀링
    for (let i = 0; i < n; i++) {
      const o = { pierce, r: Wp.id === 'laser' ? 4 : gat ? 7 : 5, long: Wp.id === 'laser' };
      if (gat) o.color = '#fff3a0';
      shot(sh.x + (i - (n - 1) / 2) * 14, sh.y - 26, Wp.id === 'vulcan' ? rnd(-25, 25) : 0, -Wp.speed, dmg * (gat ? 1.1 : 1), o);
    }
  }
  if (sh.twinT > 0) for (const s of [-1, 1]) shot(sh.x + s * 46, sh.y - 10, 0, -(Wp.speed || 760), dmg * 0.6, { r: 4, pierce });   // 분신
  fx.push({ k: 'muzzle', x: sh.x, y: sh.y - 30, t: 0, life: 0.06, color: Wp.color });
}function droneSpots() {
  const n = (st.gun ? 1 : 0) + run.m.drones, spots = [[-44, 16], [44, 16], [-72, 30], [72, 30]];
  return spots.slice(0, n).map(([dx, dy], i) => ({ x: P.x + dx, y: P.y + dy + Math.sin(T * 4 + i) * 3, part: st.gun && i === 0 }));
}
const guardCount = () => (st.guard ? (st.guard >= 3 ? 2 : 1) : 0);
const guardSpots = () => Array.from({ length: guardCount() }, (_, i) => ({ x: P.x + Math.cos(P.ga + i * Math.PI) * 52, y: P.y + Math.sin(P.ga + i * Math.PI) * 52 }));

function useUlt() {
  if (net && net.mode === 'guest') { if (P.ult >= 100) { net.conn.send({ t: 'ult' }); P.ult = 0; } return; }   // 참가자: 방장에게 부탁
  if (state !== 'play' || run.phase === 'dead' || run.phase === 'clear' || P.ult < 100 || P.down > 0) return;
  P.ult = 0; P.ultLock = FEEL.ultLock; run.ults++; S.stats.ults++; dcount('ult'); teamUlt('host');
  if (P.trap) freeTrap(true);   // 궁극기를 쓰면 그물도 터진다
  const u = st.F.ult;
  A.sfx('ult_' + u.id); buzz(60);
  run.banner = { kind: 'ult', title: u.name, sub: '', t: 0, life: 1.3 };
  shake = Math.max(shake, 0.6);
  P.inv = Math.max(P.inv, FEEL.ultInv);   // 0.37: 궁극기를 쓰는 순간 잠깐 무적(반짝임)
  if (u.id === 'laser') { P.ultKind = 'laser'; P.ultT = 3; }
  else if (u.id === 'bulwark') { P.ultKind = 'bulwark'; P.ultT = 5; }
  else if (u.id === 'swarm') { P.swarmQ = 30; P.swarmT = 0; }
  else if (u.id === 'nova') {
    P.ultKind = 'nova'; P.ultT = 0.7; P.novaR = 0; flash = 0.8;
    P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.35);
    for (const e of foes.slice()) hitFoe(e, 260 * ultPow());
    for (const b of ebul) drops.push({ kind: 'scrap', x: b.x, y: b.y, vy: 30, v: 1, small: true });
    ebul = [];
  }
}
const ultPow = () => st.dmg * run.m.dmg / st.Wp.dmg * run.d.hp;   // 궁극기·박자 빔도 내 화력과 스테이지에 맞춰 세진다

// 화면을 톡 눌렀을 때: 그물에 걸렸으면 연타, 비트 러시 중이면 박자, 아니면 두 번 톡톡으로 궁극기
let lastTap = 0;
function onTap() {
  if (state !== 'play' || run.phase === 'dead') return;
  if (P.trap) { tapTrap(); return; }
  if (run.rush) { rushTap(); return; }
  if (run.mode === 'auto') return;   // 표창 공방: 열기는 적을 쓰러뜨리면 찬다
  const now = performance.now();
  if (now - lastTap < 280) useUlt();
  lastTap = now;
}

// ---------- 맞히기·맞기 ----------
// ---------- 표창 공방: 표창이 로봇 둘레를 돌며 닿는 적을 벤다. 로봇을 몰아 적에게 들이대야 부서진다 ----------
// 🌀 던지기(버튼·X키): 표창이 바깥으로 쭉 퍼졌다가 돌아오며 길에 있는 적을 모두 벤다.
// 카드 강화도 표창에 붙는다: 화력 = 표창 피해, 연사 = 도는 속도, 탄 갈래 = 기본 날 하나 더.
const THROW_CD = 3.2;
function bladeSet() {   // 장착한 표창(최대 5) + 모자라면 기본 날로 3개까지, 탄 갈래 카드마다 기본 날 하나 더
  const eq = Forge.equipped().slice(), need = Math.max(3, eq.length) + (run.m.multi || 0);
  while (eq.length < need) eq.push(1);
  return eq.slice(0, 8);
}
function bladeTick(dt, fighting) {
  const eq = bladeSet(), n = eq.length;
  if (!run.blades || run.blades.length !== n || run.blades.some((b, i) => b.lv !== eq[i])) run.blades = eq.map((lv, i) => ({ lv, x: P.x, y: P.y, cool: new Map(), tr: [] }));
  const fev = Forge.fever, spin = 3.4 * (run.m.rate || 1) * (fev ? 1.7 : 1) * (itemOn('rapid') ? 1.4 : 1);
  run.bAng = (run.bAng || 0) + spin * dt;
  const th = run.throwT || 0; if (th > 0) run.throwT = Math.max(0, th - dt);
  if (run.throwCd > 0) run.throwCd -= dt * (fev ? 2 : 1);
  const out = th > 0 ? Math.sin((1 - th / 0.7) * Math.PI) : 0;   // 던지면 0 → 1 → 0
  const R0 = 62 + n * 5 + (fev ? 14 : 0), R = R0 + out * 230;
  const dmgK = (run.m.dmg || 1) * (out > 0.2 ? 1.3 : 1);
  run.blades.forEach((b, i) => {
    const a = run.bAng + i * TAU / n;
    b.x = P.x + Math.cos(a) * R; b.y = P.y + Math.sin(a) * R;
    b.tr.push(b.x, b.y); if (b.tr.length > 12) b.tr.splice(0, 2);
    if (!fighting || P.down > 0) return;
    const size = Math.min(23, 11 + b.lv * 0.8);
    for (const e of foes) {
      if (e.inv || e.dead || e.gone || e.harmless) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) > (e.r || 20) + size) continue;
      const t0 = b.cool.get(e) || 0; if (run.t - t0 < 0.28) continue;   // 같은 적은 0.28초에 한 번
      b.cool.set(e, run.t);
      hitFoe(e, Forge.starDmg(b.lv) * dmgK);
      spark(b.x, b.y, Q.low ? 3 : 6, Forge.tierOf(b.lv), 240, 0.3, 3);
      if (!e.boss && !e.dead) { const k = Math.hypot(e.x - P.x, e.y - P.y) || 1; e.x += (e.x - P.x) / k * 10; e.y += (e.y - P.y) / k * 10; }   // 살짝 밀려난다
    }
    if (b.cool.size > 40) b.cool.clear();
  });
}
function throwBlades() {
  if (!run || !run.arena || run.phase === 'rest' || run.throwCd > 0 || state !== 'play') return;
  run.throwT = 0.7; run.throwCd = THROW_CD; A.sfx('ult'); ringFx(P.x, P.y, 80, '#ffd166');
}
function drawBlades() {
  if (!run.blades) return;
  const thrown = (run.throwT || 0) > 0, fev = Forge.fever;
  if (thrown || fev) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const b of run.blades) {
      ctx.strokeStyle = Forge.tierOf(b.lv);
      for (let k = 2; k < b.tr.length; k += 2) { ctx.globalAlpha = k / b.tr.length * 0.55; ctx.lineWidth = 2 + k / b.tr.length * 8; ctx.beginPath(); ctx.moveTo(b.tr[k - 2], b.tr[k - 1]); ctx.lineTo(b.tr[k], b.tr[k + 1]); ctx.stroke(); }
    }
    ctx.restore();
  } else {   // 도는 길을 옅게
    const b0 = run.blades[0]; if (b0) { ctx.strokeStyle = 'rgba(255,230,150,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, Math.hypot(b0.x - P.x, b0.y - P.y), 0, TAU); ctx.stroke(); }
  }
  for (const b of run.blades) {
    const s = Math.min(46, 22 + b.lv * 1.6) * (thrown ? 1.25 : 1);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(T * 18); ctx.drawImage(Forge.sprite(b.lv), -s / 2, -s / 2, s, s); ctx.restore();
  }
}
function hitFoe(e, dmg, own) {
  if (e.civ) { if (!e.dead && !e.gone) civHit(e, dmg); return; }   // 쏘면 안 되는 민간 비행체
  if (e.shield) { if (!(e.shT > 0)) { e.shT = 0.25; ringFx(e.x, e.y + 30, 50, '#9fd8ff'); } return; }   // 거울 방패: 그동안 무적
  if (e.inv || e.dead || e.gone) return;
  if (e.sh > 0) {
    const a = Math.min(e.sh, dmg); e.sh -= a; dmg -= a; e.flash = 0.04;
    if (e.sh <= 0) { ringFx(e.x, e.y, e.r * 1.6, '#7fd8ff'); A.sfx('barrier'); }
    if (dmg <= 0) return;
  }
  if (e.balloonT > 0) dmg *= 4;   // 풍선은 잘 터진다
  e.hp -= dmg; e.flash = 0.06;
  if (S.dmgNum !== false && run.mode !== 'auto' && !Q.low) {   // 피해 숫자: 짧은 간격으로 모아서 띄운다
    e.dAcc = (e.dAcc || 0) + dmg;
    if (!(e.dT > T)) { e.dT = T + FEEL.numGap; if (dnums.length < 40) dnums.push({ x: e.x + rnd(-12, 12), y: e.y - (e.r || 20) * 0.6, v: Math.max(1, Math.round(e.dAcc)), t0: T, big: !!e.isBoss || e.dAcc > 40 }); e.dAcc = 0; }
  }
  // 0.43: 궁극기는 때린 양이 아니라 시간으로 찬다(사용자: 강해지면 너무 빨리 찬다). FEEL.ultSec
  if (e.hp <= 0) killFoe(e);
  else A.sfx('hit');
}
const comboMul = () => 1 + Math.min(run.combo, 50) * 0.02;
function killFoe(e) {
  e.dead = true;
  if (!e.isBoss && !e.civ && !e.harmless && D.ENEMIES[e.type]) bookMark('foes', e.type);   // 도감: 만난 적
  run.kills++; S.stats.kills++; dcount('kills');
  if (e.leader && run.phase === 'boss') leaderDown(e);
  run.combo++; run.comboT = 2.5; run.maxCombo = Math.max(run.maxCombo, run.combo);
  if (run.mode !== 'auto') { if (A.chain) A.chain(run.combo); if (!net && !e.isBoss) { if (e.r > 25) hitStop = Math.max(hitStop, FEEL.stopBig); else if (e.elite || e.mod) hitStop = Math.max(hitStop, FEEL.stopElite); } }
  if (run.combo % 10 === 0) say(`${run.combo} 콤보!`, e.x, e.y - 30, '#ffd166', 26, 1);
  run.score += Math.round(e.score * comboMul());
  if (e.harmless) { spark(e.x, e.y, 10, '#fff3a0', 160, 0.4, 3); A.sfx('xp'); critterDown(e); return; }
  if (e.balloonT > 0) { say('펑!', e.x, e.y - 16, '#ff7ad9', 20, 0.7); spark(e.x, e.y, 14, '#ff7ad9', 200, 0.4, 4); A.sfx('boomS'); if (e.xp) drops.push({ kind: 'xp', x: e.x, y: e.y, vy: 60, v: e.xp }); drops.push({ kind: 'scrap', x: e.x, y: e.y, vy: 70, v: 1 }); return; }
  explode(e.x, e.y, e.isBoss ? 90 : e.r * 1.6, e.isBoss ? '#ffd166' : '#ffb06b');
  A.sfx(e.r > 25 ? 'boomL' : 'boomS');
  if (e.r > 25) { shake = Math.max(shake, 0.5); buzz(40); }
  if (e.keeper) arenaClear(e);
  if (e.isBoss) {
    if (boss.parts.every(p => p.dead)) bossDown();
    return;
  }
  const dm = run.dangerT > 0 ? 2 : 1;   // 위험 항로에서는 보상 2배
  if (e.mod === 'volatile') ring(e.x, e.y, 8, rnd(0, 1), 150, { color: '#ff9a3c' });
  if (e.type === 'treasure') {
    for (let i = 0; i < 16; i++) drops.push({ kind: 'scrap', x: e.x + rnd(-60, 60), y: e.y + rnd(-30, 30), vy: rnd(30, 90), v: 2 });
    if (Math.random() < 0.3) drops.push({ kind: 'part', x: e.x, y: e.y, vy: 50, v: 1 });
    drops.push({ kind: 'heart', x: e.x + 20, y: e.y, vy: 60, v: 20 });
    say('황금 수송선 격파! 고철이 쏟아진다', W / 2, H * 0.3, '#ffd166', 26, 2); flash = 0.4;
  }
  if (run.mode === 'auto') { const gv = Forge.addGold((e.elite ? 4 : 1) * Math.pow(1.17, run.stage - 1)); if (!Q.low && Math.random() < 0.5) say('💰' + Forge.fmt(gv), e.x, e.y - 10, '#ffd166', 13, 0.6); Forge.tap(0.025); Forge.kill(); }
  if (e.xp) drops.push({ kind: 'xp', x: e.x, y: e.y, vy: 60, v: e.xp * dm * (run.xpBoostT > 0 ? 2 : 1) });
  if (e.bounty) { drops.push({ kind: 'part', x: e.x, y: e.y, vy: 50, v: 1 }); say('👑 정예 격파! 부품', e.x, e.y - 30, '#c58bff', 18, 1.2); }
  if (dm > 1 && Math.random() < 0.5) drops.push({ kind: 'scrap', x: e.x, y: e.y, vy: 70, v: 1 });
  if (Math.random() < (run.mode === 'auto' ? 0.2 : 0.3) || e.elite) drops.push({ kind: 'scrap', x: e.x + rnd(-10, 10), y: e.y, vy: 70, v: e.elite ? 6 : 1 });
  if (Math.random() < 0.02) drops.push({ kind: 'heart', x: e.x, y: e.y, vy: 60, v: 20 });
  if (Math.random() < (e.elite || e.mod ? 0.22 : 0.035)) dropItem(e.x, e.y);   // 판 안의 아이템
  else if (Math.random() < (e.elite || e.mod ? 0.18 : 0.035)) dropUp(e.x, e.y);   // 작은 강화
  if (e.elite && Math.random() < 0.15) drops.push({ kind: 'part', x: e.x, y: e.y, vy: 50, v: 1 });
  if (e.type === 'splitter') for (const s of [-1, 1]) addFoe('scout', e.x + s * 12, e.y, { vy: 180, vx: s * 90, xp: 1 });
}
function hurtPlayer(dmg) {
  if (SKY.god || P.inv > 0 || P.ultKind === 'bulwark' || run.phase === 'dead' || run.phase === 'clear') return;
  if (run.m.barrier && P.barrierReady) {
    P.barrierReady = false; P.barrierT = 16; P.inv = 0.5;
    A.sfx('barrier'); ringFx(P.x, P.y, 40, '#7fd8ff');
    return;
  }
  if (P.orb) { P.orb = 0; P.inv = 0.8; A.sfx('barrier'); ringFx(P.x, P.y, 46, ITEMS.orb.c); say('🛡️ 막았다!', P.x, P.y - 50, ITEMS.orb.c, 18, 0.9); return; }
  P.hp -= dmg * (run.dmgTaken || 1); P.inv = st.invT; run.hits++; run.hurtT = 0.6;
  if (run.combo >= 10) say('콤보 끊김', P.x, P.y - 60, '#ff9a9a', 20, 1);
  run.combo = 0;
  shake = Math.max(shake, 0.5);
  A.sfx('hurt'); buzz(70); spark(P.x, P.y, 18, '#ff6b6b', 260, 0.5, 3);
  if (P.hp <= 0 && rs('revive') && !run.revived) {   // 긴급 수리 연구: 판마다 한 번 다시 일어난다
    run.revived = true; P.hp = Math.round(P.maxHp * (0.2 + 0.1 * rs('revive'))); P.inv = 3; P.trap = null;
    ebul = []; flash = 0.8; ringFx(P.x, P.y, 120, '#ff9ad5');
    run.banner = { kind: 'ult', title: '긴급 수리!', sub: '', t: 0, life: 1.5 }; A.sfx('part'); buzz(120);
    return;
  }
  if (P.hp <= 0 && net && net.mode === 'host' && allies.some(a => a.down <= 0)) {   // 협동: 친구가 살아 있으면 6초 뒤 복귀
    P.hp = 0; P.down = DOWN_T; P.inv = 99; P.trap = null; P.wx = P.x; P.wy = P.y; P.resc = 0;
    explode(P.x, P.y, 60, st.F.color); say('격추! 친구가 구하러 오면 바로 복귀', W / 2, H * 0.4, '#ff9a9a', 22, 1.8);
    return;
  }
  if (P.hp <= 0) {
    P.hp = 0; run.phase = 'dead'; run.endT = 2; P.trap = null; run.rush = null;
    explode(P.x, P.y, 80, st.F.color); A.sfx('boomL'); shake = 1.4; flash = 0.7; buzz([100, 50, 200]);
  }
}
function grantPart() {
  const cand = partsAvail();
  if (!cand.length) { const nl = nextPartLv(); S.scrap += 25; run.scrapGot += 25; say(nl < 99 ? `고철 +25 (다음 부품은 조종사 Lv ${nl}부터)` : '부품을 다 모았다! 고철 +25', P.x, P.y - 70, '#ffd166', 20, 1.8); A.sfx('scrap'); save(); return; }
  const p = pick(cand);
  S.parts[p.id] = 1;
  if (!S.equip[p.slot]) S.equip[p.slot] = p.id;   // 빈 칸이면 다음 판부터 바로 끼워진다
  run.partsGot.push(`${p.icon} ${p.name}`);
  say(`새 부품! ${p.icon} ${p.name}`, W / 2, H * 0.5, '#ffd166', 30, 2.2);
  A.sfx('part'); buzz(50); save();
}

// ---------- 레벨 업 카드: 등급(일반·희귀·영웅), 대가 카드, 무기 진화 ----------
const EVOS = {   // 무기마다 조건 카드를 모으면 진화 카드가 나온다
  vulcan: { need: 'rate', n: 2, name: '폭풍 개틀링', icon: '🌪️', desc: '연사 2배, 탄이 굵고 세진다' },
  spread: { need: 'multi', n: 2, name: '용의 숨결', icon: '🐉', desc: '갈래 +4, 불꽃 탄이 적 하나를 더 뚫는다' },
  laser: { need: 'pierce', n: 2, name: '프리즘 빔', icon: '🔺', desc: '레이저가 셋으로 갈라지고 모든 적을 뚫는다' },
  missile: { need: 'drone', n: 1, name: '군집 미사일', icon: '🐝', desc: '미사일 2배, 맞으면 작은 폭발' },
};
const EVO_HINT = { rate: '연사 강화 2번', multi: '탄 갈래 2번', pierce: '관통 2번', drone: '임시 드론 1번' };
// 0.61 무기 진화가 확 느껴지게: 순간(느린 화면·빛 고리 3겹·주변 탄 지우기) + 판 끝까지 기체 둘레에 진화 색 빛
const EVO_C = { vulcan: '#fff3a0', spread: '#ff8a3c', laser: '#ffb3f5', missile: '#9dffcf' };
function evoFx() {
  const c = EVO_C[st.Wp.id] || '#ffd166';
  if (!net) { slowT = Math.max(slowT, 0.9); shake = Math.max(shake, 0.8); }
  [60, 120, 190].forEach((r, i) => setTimeout(() => ringFx(P.x, P.y, r, c), i * 110));
  for (const b of ebul) if (!b.net && Math.hypot(b.x - P.x, b.y - P.y) < 260) { b.dead = true; spark(b.x, b.y, 3, c, 140, 0.3, 2); }   // 진화 순간 둘레 탄을 지워 숨 돌릴 틈
  run.evoT = 2.5;
}
function drawEvoAura() {   // 기체 아래에 깔리는 진화 빛(돌아가는 두 겹 고리, 진화 직후엔 크게)
  if (!run || !run.evo) return;
  const c = EVO_C[st.Wp.id] || '#ffd166', big = Math.max(0, run.evoT || 0), r = 46 + big * 18;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 + 0.15 * Math.sin(T * 5) + big * 0.2; ctx.drawImage(Art.glow(c, 40), P.x - r, P.y - r, r * 2, r * 2);
  ctx.globalAlpha = 0.7; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([10, 12]);
  ctx.beginPath(); ctx.arc(P.x, P.y, 40, T * 2, T * 2 + TAU); ctx.stroke();
  ctx.lineDashOffset = T * 30; ctx.beginPath(); ctx.arc(P.x, P.y, 52, -T * 1.4, -T * 1.4 + TAU); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
}
const CURSES = [
  { id: 'glass', name: '유리 대포', icon: '💎', desc: '피해 +60%, 대신 최대 체력 -30%' },
  { id: 'overheat', name: '과열 엔진', icon: '♨️', desc: '연사 +50%, 대신 받는 피해 +30%' },
  { id: 'gambler', name: '도박꾼', icon: '🎲', desc: '고철 2배, 대신 이번 판 회복 효과 없음' },
];
const SCALE = { dmg: k => `피해 +${Math.round(20 * k)}%`, rate: k => `연사 +${Math.round(18 * k)}%`, magnet: k => `줍는 범위 +${Math.round(40 * k)}%`,
  heal: k => `체력 ${Math.round(Math.min(100, 40 * k))}% 회복`, maxhp: k => `최대 체력 +${Math.round(20 * k)}`, ult: k => `궁극기 충전 +${Math.round(30 * k)}%`, speed: k => `이동 속도 +${Math.round(12 * k)}%` };
const RARE = { common: 1, rare: 1.6, hero: 2.5 };
function rollCards() {
  let pool = D.CARDS.filter(c => !c.max || (run.taken[c.id] || 0) < c.max);
  if (P.hp > P.maxHp * 0.85 || run.gambler) pool = pool.filter(c => c.id !== 'heal');
  const choice = [], lucky = run.clover;   // 네잎클로버: 4장, 좋은 카드가 잘 나오고 대가 카드는 없다
  run.clover = false;
  while (choice.length < (lucky ? 4 : 3) && pool.length) {
    const c = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    const r = SCALE[c.id] ? (Math.random() < (lucky ? 0.25 : 0.08) ? 'hero' : Math.random() < (lucky ? 0.6 : 0.27) ? 'rare' : 'common') : 'common';
    choice.push({ ...c, rarity: r, mult: RARE[r], desc: SCALE[c.id] ? SCALE[c.id](RARE[r]) : c.desc });
  }
  const curses = CURSES.filter(c => !run.taken[c.id]);
  if (!lucky && curses.length && run.level >= 3 && Math.random() < 0.18) choice[choice.length - 1] = { ...pick(curses), rarity: 'curse', mult: 1 };
  const evo = EVOS[st.Wp.id];
  if (evo && !run.evo && (run.taken[evo.need] || 0) >= evo.n) choice[0] = { id: 'evo', name: evo.name, icon: evo.icon, desc: '무기 진화! ' + evo.desc, rarity: 'evo', mult: 1 };
  return choice;
}
function openCards() {
  drag = null;
  A.sfx('levelup');
  const choice = rollCards();
  run.cardChoice = choice;
  if (run.mode === 'auto') {
    const ids = choice.map(c => c.id);
    const want = ids.includes('evo') ? 'evo' : P.hp < P.maxHp * 0.4 && ids.includes('heal') ? 'heal' : AUTO_CARDS.find(id => ids.includes(id)) || ids[0];
    state = 'cards'; takeCard(want);
    const c = choice.find(x => x.id === want);
    say(`${c.icon} ${c.name}`, P.x, P.y - 70, '#9dffcf', 22, 1.4);
    return;
  }
  state = 'cards';
  const box = $('cardsBox'); box.innerHTML = '';
  choice.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'pickCard ' + c.rarity;
    b.style.animationDelay = i * 0.08 + 's';
    const tag = { rare: '희귀', hero: '영웅', curse: '대가', evo: '진화' }[c.rarity];
    const have = run.taken[c.id] ? `<i>지금 ${run.taken[c.id]}번 고름</i>` : '';
    b.innerHTML = `<span class="ic">${c.icon}</span><span>${tag ? `<em>${tag}</em>` : ''}<b>${i + 1}. ${c.name}</b>${c.desc}${have}</span>`;
    b.addEventListener('click', () => takeCard(c.id));
    box.append(b);
  });
  const evo = EVOS[st.Wp.id];
  $('cardsLv').innerHTML = `Lv ${run.level}` + (evo && !run.evo ? `<small style="display:block;opacity:.7;font-size:.7em">진화 조건: ${EVO_HINT[evo.need]} → ${evo.icon} ${evo.name}</small>` : '');
  $('cards').dataset.ids = choice.map(c => c.id).join(',');
  $('cards').classList.remove('hidden');
}
function takeCard(id) {
  if (state !== 'cards') return;
  const m = run.m, c = (run.cardChoice || []).find(x => x.id === id) || { mult: 1 }, k = c.mult || 1;
  run.taken[id] = (run.taken[id] || 0) + 1;
  if (id === 'dmg') m.dmg *= 1 + 0.2 * k;
  else if (id === 'rate') m.rate *= 1 + 0.18 * k;
  else if (id === 'multi') m.multi++;
  else if (id === 'pierce') m.pierce++;
  else if (id === 'drone') m.drones++;
  else if (id === 'magnet') m.magnet *= 1 + 0.4 * k;
  else if (id === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * Math.min(1, 0.4 * k));
  else if (id === 'maxhp') { P.maxHp += Math.round(20 * k); P.hp += Math.round(20 * k); }
  else if (id === 'ult') m.ult *= 1 + 0.3 * k;
  else if (id === 'speed') m.speed *= 1 + 0.12 * k;
  else if (id === 'barrier') { m.barrier = 1; P.barrierReady = true; }
  else if (id === 'glass') { m.dmg *= 1.6; P.maxHp = Math.round(P.maxHp * 0.7); P.hp = Math.min(P.hp, P.maxHp); }
  else if (id === 'overheat') { m.rate *= 1.5; run.dmgTaken = 1.3; }
  else if (id === 'gambler') run.gambler = true;
  else if (id === 'evo') { run.evo = true; const ev = EVOS[st.Wp.id]; run.banner = { kind: 'ult', title: `${ev.icon} 진화! ${ev.name}`, sub: ev.desc, t: 0, life: 2.8 }; flash = 0.8; A.sfx('part'); A.sfx('fanfare'); buzz([40, 30, 80, 30, 120]); evoFx(); }
  A.sfx('click');
  $('cards').classList.add('hidden');
  state = 'play';
}
// ---------- 자동 조종: 날아오는 탄을 미리 보고 가장 안전한 곳으로, 적 아래로 붙는다 ----------
const AUTO_STEPS = [[0, 0], [-60, 0], [60, 0], [0, -50], [0, 50], [-50, -40], [50, -40], [-50, 40], [50, 40], [-120, 0], [120, 0], [-90, 60], [90, 60]];
const AUTO_CARDS = ['dmg', 'multi', 'rate', 'drone', 'pierce', 'barrier', 'ult', 'maxhp', 'magnet', 'speed', 'heal'];
function autoPilot(dt) {
  if (P.trap) { run.autoTap = (run.autoTap || 0) - dt; if (run.autoTap <= 0) { run.autoTap = 0.12; tapTrap(); } return; }
  if (run.rush) { const now = A.clock().t; for (const n of run.rush.notes) if (!n.j && now - n.t > 0.1 && now - n.t < 0.16) { rushTap(); break; } }   // 자동은 GOOD 정도만
  if (P.ult >= 100 && (boss || foes.length > 6 || P.hp < P.maxHp * 0.35)) useUlt();
  let target = null, bd = 1e9;
  for (const e of foes) { if (e.inv || e.y > P.y - 40 || e.y < 0) continue; const d = Math.abs(e.x - P.x) + (P.y - e.y) * 0.3 - (e.isBoss ? 200 : 0); if (d < bd) { bd = d; target = e; } }
  let wantX = target ? target.x : W / 2;
  const floor = run.mode === 'auto' ? H - 380 : H - 80, wantY = boss && boss.inhale > 0 ? floor - 10 : floor - 150;
  const near = drops.find(d => d.kind !== 'xp' && Math.hypot(d.x - P.x, d.y - P.y) < 160);
  if (near && !boss) wantX = near.x;
  let best = [P.x, P.y], bs = Infinity;
  for (const [dx, dy] of AUTO_STEPS) {
    const x = clamp(P.x + dx, 30, W - 30), y = clamp(P.y + dy, 160, floor);
    let danger = 0;
    for (const b of ebul) {
      for (const tt of [0.08, 0.22, 0.4]) {
        const k = Math.min(1, tt / 0.3), px = P.x + (x - P.x) * k, py = P.y + (y - P.y) * k;
        if (Math.hypot(b.x + b.vx * tt - px, b.y + b.vy * tt - py) < st.hit + b.r + 16) danger += (b.net ? 3 : 1) * (1.2 - tt);
      }
    }
    for (const e of foes) if (!e.inv && Math.hypot(e.x - x, e.y - y) < e.r + 36) danger += 2;
    for (const l of lasers) { const ddx = x - l.x, ddy = y - l.y; if (Math.abs(-ddx * Math.sin(l.a) + ddy * Math.cos(l.a)) < l.w + 24 && ddx * Math.cos(l.a) + ddy * Math.sin(l.a) > 0) danger += 3; }
    const sc = danger * 100 + Math.abs(x - wantX) * 0.15 + Math.abs(y - wantY) * 0.08;
    if (sc < bs) { bs = sc; best = [x, y]; }
  }
  P.tx = best[0]; P.ty = best[1];
}
function awayReward(sec, where) {   // 자리를 비운 동안의 보상
  const min = Math.min(sec, 8 * 3600) / 60, rate = Math.max(S.idle.rate, 1 + S.idle.best * 0.4);
  const got = Math.floor(rate * min * 0.5), gold = Math.floor((S.forge.rate || 0) * min * 0.5);
  if (got < 1 && gold < 1) return;
  S.scrap += got; S.idle.total += got; S.forge.gold += gold; save();
  popups.push({ title: '어서 와요!', html: `<div>자리를 비운 동안 <b>${min >= 60 ? (min / 60).toFixed(1) + '시간' : Math.round(min) + '분'}</b></div><div>공방 로봇이 모은 것</div><div class="big">🔩 ${got}</div><div class="big">💰 ${Forge.fmt(gold)}</div><div class="rules">구역 ${S.idle.best}까지 간 기록을 바탕으로, 직접 켜 둘 때의 절반 속도로 계산합니다(최대 8시간).</div>` });
  if (where === 'play') { state = 'pause'; $('away').dataset.resume = '1'; }
  showPopup();
}

// ---------- 한 프레임 ----------
function update(dt) {
  if (run.arena && run.phase === 'rest') { if (run.banner && (run.banner.t += dt) > run.banner.life) run.banner = null; tickFx(dt); Forge.tick(dt, false); return; }   // 정비 시간: 싸움은 멈춘다
  if (run.mode === 'auto') {
    if (!run.arena) autoPilot(dt);
    if (Date.now() - S.idle.lastSeen > 5000) {   // 5초마다 시간과 벌이 속도를 적어 둔다
      const mins = (Date.now() - run.startedAt) / 60000;
      if (mins > 0.5) S.idle.rate = S.idle.rate ? S.idle.rate * 0.9 + (run.scrapGot / mins) * 0.1 : run.scrapGot / mins;
      if (mins > 0.5) { const gr = (S.forge.earned - run.goldStart) / mins; S.forge.rate = S.forge.rate ? S.forge.rate * 0.9 + gr * 0.1 : gr; }
      S.idle.lastSeen = Date.now(); save();
    }
  }
  run.t += dt;
  bgY += dt * 45; nearY += dt * 120;
  if (run.banner) { run.banner.t += dt; if (run.banner.t > run.banner.life) run.banner = null; }
  if (run.rushSum && (run.rushSum.t += dt) > 2.4) run.rushSum = null;
  if (run.hurtT > 0) run.hurtT -= dt;
  if (run.comboT > 0 && (run.comboT -= dt) <= 0) run.combo = 0;
  // 움직이기: 손가락이나 방향키가 가리키는 곳으로 기체 속도만큼 따라간다(그물에 걸리면 못 움직인다)
  const ks = 420 * st.speed * run.m.speed * (run.hzSlow || 1) * (P.iceT > 0 ? 0.55 : 1);
  if (!P.trap) {
    if (keys.ArrowLeft || keys.a) P.tx -= ks * dt;
    if (keys.ArrowRight || keys.d) P.tx += ks * dt;
    if (keys.ArrowUp || keys.w) P.ty -= ks * dt;
    if (keys.ArrowDown || keys.s) P.ty += ks * dt;
  } else { P.tx = P.x; P.ty = P.y; }
  padSteer(dt);
  if (boss && boss.inhale > 0 && run.phase === 'boss' && !P.trap) {   // 고래가 숨을 들이쉬면 입 앞까지 끌려간다
    const pull = 170 * dt, side = Math.sign(boss.x - P.x) * 60 * dt, stop = boss.y + 125;
    const ny = Math.max(stop, P.ty - pull), moved = P.ty - ny;
    P.ty = ny; P.tx += side;
    if (drag) { drag.oy -= moved; drag.ox += side; }
    if (Math.hypot(P.x - boss.x, P.y - boss.y) < 130) hurtPlayer(run.d.dmg);
  }
  const PB = bounds(); P.tx = clamp(P.tx, PB[0], PB[1]); P.ty = clamp(P.ty, PB[2], PB[3]);
  const maxMove = 900 * st.speed * run.m.speed * (run.hzSlow || 1) * (P.iceT > 0 ? 0.55 : 1) * dt, dx = P.tx - P.x, dy = P.ty - P.y, dl = Math.hypot(dx, dy);
  if (dl > maxMove) { P.x += dx / dl * maxMove; P.y += dy / dl * maxMove; } else { P.x = P.tx; P.y = P.ty; }
  obstTick(dt);   // 높은 구조물에 막힌다
  P.bank += (clamp((P.x - P.lx) / Math.max(dt, 0.001) / 600, -1, 1) - P.bank) * Math.min(1, dt * 10);   // 옆으로 움직이면 기체가 기운다
  P.lx = P.x;
  if (run.arena) { cam.x = clamp(P.x - W / 2, 0, AW - W); cam.y = clamp(P.y - H * 0.55, 0, AH - H); bgY = -cam.y * 0.5; nearY = -cam.y; }   // 화면이 로봇을 따라간다
  if (P.inv > 0) P.inv -= dt;
  if (run.evoT > 0) run.evoT -= dt;
  if (run.phase !== 'dead' && !run.gambler) P.hp = Math.min(P.maxHp, P.hp + st.regen * dt);
  P.ult = Math.min(100, P.ult + 100 / FEEL.ultSec * dt * st.ult * run.m.ult);   // 궁극기: 약 50초에 한 번(궁극 칩·연구·카드로 조금 빨라짐)
  if (run.m.barrier && !P.barrierReady && (P.barrierT -= dt) <= 0) P.barrierReady = true;
  P.ga += dt * 3;
  tickItems(dt); tickGags(dt); skillTick(dt);
  trailFx(P, myLook(), dt); for (const a of allies) trailFx(a, a.look, dt);
  if (net && net.mode === 'host') { updateAllies(dt); if (run.coop) coopTick(dt); }
  if (P.trap) {   // 그물: 조금씩 다시 조여 오고, 7초가 지나면 저절로 풀리지만 다친다
    P.trap.t += dt; P.trap.g = Math.max(0, P.trap.g - 0.22 * dt);
    if (P.trap.t > 7) { freeTrap(false); hurtPlayer(run.d.dmg); }
  }
  // 비트 러시
  if (run.phase === 'waves' && !run.rushDone && !run.coop && run.t >= run.rushAt && !P.trap) { startDuelEvent(); return; }
  if (run.phase === 'waves' && run.gateAt && run.t >= run.gateAt) { run.gateAt = 0; spawnGates(); }
  if (run.phase === 'waves' && run.treasureAt && run.t >= run.treasureAt) {
    run.treasureAt = 0; run.treasureLast = run.t;
    if (Math.random() < 0.7) { addFoe('treasure', -70, 200, { vx: 75, by: 200 }); say('★ 황금 수송선 출현! 놓치지 마!', W / 2, H * 0.3, '#ffd166', 26, 2); A.sfx('rush'); }
  }
  if (run.gates) updateGates(dt);
  gateRunTick(dt);
  if (run.dangerT > 0) run.dangerT -= dt;
  if (run.rush) updateRush();

  const fighting = run.phase !== 'dead' && run.phase !== 'clear';
  if (run.mode === 'auto') {   // 표창 공방: 표창이 생기고, 장착한 표창이 적에게 날아간다
    Forge.tick(dt, run.phase === 'waves');
    bladeTick(dt, fighting);
  }
  if (fighting && !(P.down > 0) && !run.arena) {   // 표창 공방에서는 로봇이 쏘지 않는다(표창이 무기)
    P.fireT -= dt;
    while (P.fireT <= 0) { fire(); P.fireT += 1 / (st.rate * run.m.rate * (P.trap ? 0.5 : 1) * (run.evo && st.Wp.id === 'vulcan' ? 2 : 1) * (itemOn('rapid') ? 2 : 1)); }
    if ((P.droneT -= dt) <= 0) {
      P.droneT = 0.22;
      const sp = droneSpots();
      const da = run.arena ? aimOf(P) : -Math.PI / 2;
      for (const d of sp) addShot(d.x, d.y - 10, Math.cos(da) * 900, Math.sin(da) * 900, d.part ? 3 + 2 * st.gun : st.dmg * 0.5, { r: 3, color: '#b8f7ff' });
      if (sp.length) A.sfx('drone');
    }
    if (st.seeker && (P.seekT -= dt) <= 0) {
      P.seekT = 3.2 - 0.3 * st.seeker;
      for (const s of [-1, 1]) addShot(P.x + s * 20, P.y, s * 160, -200, 12 * (1 + 0.2 * st.seeker), { homing: true, r: 6, color: '#ffb86b' });
      A.sfx('missile');
    }
  }
  // 궁극기
  if (P.swarmQ > 0 && (P.swarmT -= dt) <= 0) {
    P.swarmT = 0.04; P.swarmQ--;
    addShot(P.x + rnd(-20, 20), P.y, rnd(-320, 320), rnd(-260, -120), 22 * ultPow(), { homing: true, r: 6, color: '#ffe066', pierce: 0 });
  }
  if (P.ultT > 0) {
    P.ultT -= dt;
    const pw = ultPow();
    if (P.ultKind === 'laser') {
      for (const e of foes.slice()) if (Math.abs(e.x - P.x) < 38 + e.r && e.y < P.y) hitFoe(e, 320 * pw * dt);
      ebul = ebul.filter(b => !(Math.abs(b.x - P.x) < 40 && b.y < P.y));
    } else if (P.ultKind === 'bulwark') {
      ebul = ebul.filter(b => { if (Math.hypot(b.x - P.x, b.y - P.y) < 70) { drops.push({ kind: 'scrap', x: b.x, y: b.y, vy: 20, v: 1, small: true }); return false; } return true; });
      for (const e of foes.slice()) if (Math.hypot(e.x - P.x, e.y - P.y) < 60 + e.r) hitFoe(e, 200 * pw * dt);
    } else if (P.ultKind === 'nova') P.novaR += dt * 1400;
    if (P.ultT <= 0) P.ultKind = null;
  }

  // 적 나오기와 보스(비트 러시 중에는 적이 덜 나온다)
  if (run.arena) arenaTick(dt);
  else if (run.phase === 'waves') {
    if (run.mode === 'endless') {
      const w = 1 + Math.floor(run.t / 30);
      if (w !== run.wave) { run.wave = w; run.d = diffFor(1 + (w - 1) * 0.6); run.stage = Math.min(9, 1 + (w / 2 | 0)); run.banner = { kind: 'stage', title: `WAVE ${w}`, sub: '더 세게 몰려온다!', t: 0, life: 1.8 }; A.sfx('rush'); }
      if (!run.rushDone && run.t >= run.rushAt) { /* 아래에서 처리 */ }
      if (run.t >= run.nextBoss && !run.rush) { run.phase = 'warning'; run.warnT = 3; A.sfx('warning'); buzz([200, 100, 200]); }
      if (run.rushDone && run.t > run.rushAt + 80) { run.rushDone = false; run.rushAt = run.t + rnd(10, 25); }   // 리듬 결투가 가끔 다시 온다
      if (!run.gateAt && !run.gates && run.t > (run.gateLast || 0) + 100) run.gateAt = run.t + 5;
      if (!run.treasureAt && run.t > (run.treasureLast || 0) + 120) run.treasureAt = run.t + 10;
    }
    if ((run.spawnT -= dt * (run.dangerT > 0 ? 1.6 : 1)) <= 0) { spawnWave(); run.spawnT = run.d.iv * (run.mode === 'endless' ? 0.85 : 1 - 0.35 * Math.min(1, run.t / run.waveDur)) * rnd(0.8, 1.2); }
    if (run.t >= run.waveDur && !run.rush) { run.phase = 'warning'; run.warnT = 3; A.sfx('warning'); buzz([200, 100, 200]); }
  } else if (run.phase === 'warning') {
    if ((run.warnT -= dt) <= 0) { run.phase = 'boss'; if (run.mode === 'stage' && stageEnd(run.stage) === 'leader') spawnLeader(); else spawnBoss(); }
  }
  if (boss && run.phase === 'boss') { if (boss.sneezeT > 0) boss.sneezeT -= dt; else bossAI(dt); }
  if (run.theme !== run.bookTh) { run.bookTh = run.theme; bookMark('maps', run.theme); }   // 도감: 날아 본 맵
  if (P.iceT > 0) P.iceT -= dt;
  flakTick(dt);   // 재채기하는 동안은 쉰다
  colTick(dt);
  hazardTick(dt);   // 돌풍·토네이도·민간 비행체
  for (const e of foes) { if (e.type !== 'boss') foeAI(e, dt * (e.mod === 'swift' ? 1.6 : 1)); if (e.flash > 0) e.flash -= dt; }

  // 내 탄
  for (const s of shots) {
    s.t += dt;
    if (s.homing) {
      let best = null, bd = 1e9;
      for (const e of foes) { if (e.dead || e.inv || e.civ || e.y < -20) continue; const d = Math.hypot(e.x - s.x, e.y - s.y); if (d < bd) { bd = d; best = e; } }
      const sp = Math.min(720, Math.hypot(s.vx, s.vy) + 900 * dt);
      let a = Math.atan2(s.vy, s.vx);
      if (best && s.t > 0.12) { let da = Math.atan2(best.y - s.y, best.x - s.x) - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; a += clamp(da, -7 * dt, 7 * dt); }
      s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
      if (!Q.low && Math.random() < 0.5) fx.push({ k: 'smoke', x: s.x, y: s.y, vx: 0, vy: 0, t: 0, life: 0.4, size: 10 });
    }
    if (s.orb) {   // 말벌 회오리: 기체 둘레를 돌며 반지름이 50 → 275로 커짐, 0.3초마다 같은 적을 다시 벨 수 있음
      if (s.t > 3) { s.dead = true; continue; }
      const R = 50 + s.t * 75, a = s.orb.a0 + s.t * 7; s.x = s.orb.who.x + Math.cos(a) * R; s.y = s.orb.who.y + Math.sin(a) * R;
      if ((s.rh = (s.rh || 0) + dt) > 0.3) { s.rh = 0; s.hits = []; }
    } else { s.x += s.vx * dt; s.y += s.vy * dt; }
    if (s.eraser) ebul = ebul.filter(b => b.net || Math.hypot(b.x - s.x, b.y - s.y) > s.r + 12);   // 중간 스킬 표창은 닿는 탄을 지운다
    if (!s.orb && (offView(s.x, s.y, run.arena ? 160 : 40) || s.t > 4)) { s.dead = true; continue; }
    for (const e of foes) {
      if (e.dead || e.inv || s.hits.includes(e)) continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) > e.r + s.r) continue;
      if (e.shield) {   // 거울 방패: 탄이 되돌아온다(절반만, 느리게)
        if (Math.random() < 0.5) eShot(s.x, s.y, angTo({ x: s.x, y: s.y }), 170, { color: '#9fc8ff', r: 6 });
        A.sfx('reflect'); s.dead = true; break;
      }
      hitFoe(e, s.orb && e.isBoss ? s.dmg * 0.5 : s.dmg, s.own);
      s.hits.push(e);
      if (s.boom) { for (const o of foes) if (o !== e && !o.dead && Math.hypot(o.x - s.x, o.y - s.y) < 46 + o.r) hitFoe(o, s.dmg * 0.5); explode(s.x, s.y, 14, '#ffb86b'); }
      spark(s.x, s.y, 2, s.color, 120, 0.2, 2);
      if (s.pierce-- <= 0) { s.dead = true; break; }
    }
  }
  shots = shots.filter(s => !s.dead);

  // 적 탄
  const gs = guardSpots();
  for (const b of ebul) {
    if (b.mine !== undefined) {
      b.vy *= 1 - dt * 1.2; b.mine -= dt;
      if (b.mine <= 0) { b.dead = true; ring(b.x, b.y, 10 + run.loop * 2, rnd(0, 1), 160, { color: '#ff7070' }); explode(b.x, b.y, 30, '#ff6b6b'); A.sfx('boomS'); continue; }
    }
    if (b.net) b.spin = (b.spin || 0) + dt * 4;
    if (b.rev !== undefined && (b.rev -= dt) <= 0) { b.vx *= -1.15; b.vy *= -1.15; b.rev = undefined; }   // 0.61 중력 고리: 퍼졌다가 거꾸로
    const bsl = itemOn('slow') ? 0.4 : 1;   // 느림보 시계
    b.x += b.vx * dt * bsl; b.y += b.vy * dt * bsl;
    if (run.arena ? offView(b.x, b.y, 520) : (b.y > H + 20 || b.y < -40 || b.x < -20 || b.x > W + 20)) { b.dead = true; continue; }
    for (const g of gs) if (!b.net && Math.hypot(g.x - b.x, g.y - b.y) < 14 + b.r) { b.dead = true; spark(b.x, b.y, 4, '#9ff3ff', 120, 0.25, 2); }
    if (!b.dead && run.phase !== 'dead' && Math.hypot(P.x - b.x, P.y - b.y) < st.hit + b.r) {
      b.dead = true;
      if (b.net) {
        if (P.ultKind === 'bulwark' || P.inv > 0 || P.trap) continue;
        if (run.m.barrier && P.barrierReady) { P.barrierReady = false; P.barrierT = 16; A.sfx('barrier'); ringFx(P.x, P.y, 40, '#7fd8ff'); continue; }
        catchInNet();
      } else { hurtPlayer(run.d.dmg); if (b.ice) { P.iceT = 1.6; say('❄️ 얼었다! 잠깐 느려져요', P.x, P.y - 60, '#bff0ff', 18, 0.9); } }
    }
  }
  ebul = ebul.filter(b => !b.dead);

  // 광선
  for (const l of lasers) {
    if (l.warn > 0) { l.x = l.src.x; l.y = l.src.y; if ((l.warn -= dt) <= 0) { A.sfx('beam'); shake = Math.max(shake, 0.4); } continue; }
    l.dur -= dt;
    const ddx = P.x - l.x, ddy = P.y - l.y, along = ddx * Math.cos(l.a) + ddy * Math.sin(l.a), perp = Math.abs(-ddx * Math.sin(l.a) + ddy * Math.cos(l.a));
    if (!l.hit && along > 0 && perp < l.w / 2 + st.hit) { l.hit = true; hurtPlayer(run.d.dmg * 1.6); }
  }
  lasers = lasers.filter(l => l.warn > 0 || l.dur > 0);

  // 몸으로 부딪히기
  if (run.phase !== 'dead' && !(P.down > 0)) for (const e of foes) {
    if (e.dead || e.inv || e.harmless || e.balloonT > 0) continue;
    if (Math.hypot(e.x - P.x, e.y - P.y) < e.r * 0.8 + st.hit) {
      hurtPlayer(run.d.dmg + 8);
      if (!e.isBoss) hitFoe(e, 30);
    }
  }
  foes = foes.filter(e => !e.dead && !e.gone);

  // 줍기
  const mag = itemOn('magnet') ? 2000 : st.magnet * run.m.magnet;
  for (const d of drops) {
    if (d.dead) continue;
    const dd = Math.hypot(P.x - d.x, P.y - d.y);
    if (run.phase !== 'dead' && !(P.down > 0) && (dd < mag || run.phase === 'clear')) { const v = 700 * dt / Math.max(dd, 1); d.x += (P.x - d.x) * Math.min(1, v); d.y += (P.y - d.y) * Math.min(1, v); }
    else if (!run.arena) d.y += d.vy * dt;   // 들판에서는 떨어지지 않고 30초 동안 남는다
    if (run.arena ? (d.age = (d.age || 0) + dt) > 30 : d.y > H + 30) { d.dead = true; continue; }
    if (run.phase !== 'dead' && !(P.down > 0) && dd < 26) {
      d.dead = true;
      if (d.kind === 'xp') { run.xp += d.v * (1 + 0.06 * rs('learn')); A.sfx('xp'); }
      else if (d.kind === 'scrap') { gainScrap(d.v); A.sfx('scrap'); }
      else if (d.kind === 'heart') { if (!run.gambler) P.hp = Math.min(P.maxHp, P.hp + d.v); A.sfx('heal'); say('+' + d.v, P.x, P.y - 40, '#6ee37a', 22); }
      else if (d.kind === 'part') grantPart();
      else if (d.kind === 'item') useItem(d.id, P);
      else if (d.kind === 'up') takeUp(d.id, P);
    }
  }
  drops = drops.filter(d => !d.dead);

  tickFx(dt);
  if (run.phase === 'clear') {
    if (run.chain > 0 && Math.random() < dt * 8) { run.chain--; const c = boss || run.clearAt || { x: W / 2, y: H * 0.25 }; explode(c.x + rnd(-90, 90), c.y + rnd(-60, 60), rnd(40, 70), pick(['#ffd166', '#ff8a5e', '#fff'])); A.sfx('boomS'); }
    if ((run.endT -= dt) <= 0) afterBoss();
  } else if (run.phase === 'dead') {
    if ((run.endT -= dt) <= 0) { if (run.mode === 'auto') respawn(); else endRun(false); }
  } else if (run.xp >= run.xpNeed && !run.rush && !P.trap) {   // 박자·그물 중에는 레벨 업 창을 미룬다
    run.xp -= run.xpNeed; run.level++; run.xpNeed = Math.round(run.xpNeed * 1.55 + 6);   // 카드는 덜 자주(작은 강화는 줍기로)
    openCards();
  }
}

function clearField() { foes = []; ebul = []; lasers = []; boss = null; if (run) { run.flak = []; if (run.hz) { run.hz.tw = []; run.hz.wind = null; } } }
function afterBoss() {
  if (run.arena) { enterRest(true); return; }
  const m = run.mode;
  if (m === 'stage') { endRun(true); return; }
  if (m === 'rush') {
    run.bossIdx++;
    if (run.bossIdx >= 5) { endRun(true); return; }
    clearField(); run.phase = 'warning'; run.warnT = 2; run.theme = themeFor(run.bossIdx * 2 + 1);
    run.banner = { kind: 'boss', title: `BOSS ${run.bossIdx + 1} / 5`, sub: '다음 보스가 온다!', t: 0, life: 1.8 };
    return;
  }
  if (m === 'endless') {
    clearField(); run.phase = 'waves'; run.bossCount++; run.nextBoss = run.t + 90; A.music('stage', run.theme);
    return;
  }
  // 자동 출격: 다음 구역으로
  run.zone0 = run.stage + 1; nextZone(run.stage + 1, `ZONE ${run.stage + 1}`, '다음 구역');
}
function nextZone(z, title, sub) {
  clearField();
  run.stage = z; S.idle.zone = z; S.idle.best = Math.max(S.idle.best, z);
  run.d = diffFor(z); if (run.mode === 'auto') run.d.hp = Math.pow(1.22, z - 1); run.theme = themeFor(z); run.loop = (z - 1) / 5 | 0;
  run.t = 0; run.phase = 'waves'; run.rushDone = run.mode === 'auto'; run.rushAt = rnd(15, 30);
  run.banner = { kind: 'stage', title, sub, t: 0, life: 2.2 };
  A.music('stage', run.theme); save();
}
function respawn() {   // 자동 출격에서 지면: 한 구역 뒤로 물러나 다시 싸운다(잃는 것 없음)
  if (run.arena) { enterRest(false); return; }
  const z = Math.max(1, run.stage - 1);
  P.hp = P.maxHp; P.inv = 3; P.trap = null; P.x = P.tx = W / 2; P.y = P.ty = H - 190;
  nextZone(z, `ZONE ${z}`, '한 구역 물러나서 다시!');
}
function tickFx(dt) {
  for (const p of fx) {
    p.t += dt;
    if (p.k === 'ring' || p.k === 'muzzle' || p.k === 'beam') continue;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const dr = p.k === 'debris' ? 1.5 : 2;
    p.vx *= 1 - dt * dr; p.vy *= 1 - dt * dr;
    if (p.rot !== undefined) p.rot += p.vr * dt;
  }
  fx = fx.filter(p => p.t < p.life);
  for (const t of texts) t.t += dt;
  texts = texts.filter(t => t.t < t.life);
  shake = Math.max(0, shake - dt * 2.5);
  flash = Math.max(0, flash - dt * 2.5);
}

const fmt = sec => { sec = Math.round(sec); return sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`; };
function endOther(win) {   // 무한 생존·보스 러시·자동 출격의 결과
  keepAwake(false);
  const m = run.mode;
  S.stats.bestCombo = Math.max(S.stats.bestCombo, run.maxCombo);
  let title = '', rec = '', good = win;
  if (m === 'endless') {
    const nb = run.wave > S.records.wave;
    S.records.wave = Math.max(S.records.wave, run.wave); S.records.endlessScore = Math.max(S.records.endlessScore, run.score);
    title = `<small>무한 생존</small>WAVE ${run.wave}`; rec = `버틴 시간 ${fmt(run.t)}${nb ? ' · 최고 기록!' : ` · 최고 WAVE ${S.records.wave}`}`; good = nb;
  } else if (m === 'rush') {
    const beaten = win ? 5 : run.bossIdx;
    S.records.rush = Math.max(S.records.rush, beaten);
    if (win && (!S.records.rushTime || run.t < S.records.rushTime)) S.records.rushTime = run.t;
    title = win ? '<small>보스 러시</small>완주!' : `<small>보스 러시</small>${beaten} / 5`;
    rec = win ? `걸린 시간 ${fmt(run.t)} · 최단 ${fmt(S.records.rushTime)}` : '보스를 더 잡으려면 기체를 강화해 보세요';
  } else {
    S.idle.on = false; good = true;
    title = `<small>표창 공방</small>ZONE ${run.stage}`;
    rec = `켜 둔 시간 ${fmt((Date.now() - run.startedAt) / 1000)} · 번 금화 💰${Forge.fmt(S.forge.earned - run.goldStart)} · 최고 구역 ${S.idle.best} · 최고 표창 Lv ${S.forge.maxLv}`;
  }
  dcount('combo', run.maxCombo, true);
  const pxp = Math.round(run.score / 600 + run.kills * (m === 'auto' ? 0.1 : 0.35) + (win ? 30 : 0)), up = gainPilotXp(pxp);
  save();
  A.sfx(good ? 'clear' : 'fail'); A.music('hangar', 0);
  $('rTitle').innerHTML = title; $('rTitle').className = good ? 'win' : 'lose';
  $('rStars').innerHTML = '';
  $('rStats').innerHTML = [
    `<div class="big">${run.score.toLocaleString()}<small>점</small></div>`, `<div>${rec}</div>`,
    `<div>처치 <b>${run.kills}</b> · 최고 콤보 <b>${run.maxCombo}</b> · 레벨 <b>${run.level}</b></div>`,
    `<div>얻은 고철 🔩 <b>${run.scrapGot}</b></div>`,
    run.partsGot.length ? `<div class="gold">새 부품: ${run.partsGot.join(', ')}</div>` : '',
    `<div>조종사 경험치 +${pxp} · Lv ${S.pilot.lv} ${rankName(S.pilot.lv)}${up.ups ? ` <b class="gold">승급! 🔩+${up.reward}</b>` : ''}${up.opened && up.opened.length ? `<br><b class="gold">🔓 새로 열림: ${up.opened.join(', ')}</b>` : ''}</div>`,
  ].filter(Boolean).join('');
  const btns = $('rBtns'); btns.innerHTML = '';
  const mk = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', () => { A.sfx('click'); fn(); }); btns.append(b); };
  mk(m === 'auto' ? '다시 켜 두기 ▶' : '다시 하기 ▶', 'big', () => startRun(1, m));
  mk('격납고', 'sub', showHangar);
  if (m === 'endless') Rank.after('endless', run.score, `WAVE ${run.wave} · ${fmt(run.t)}`, !run.coop);
  if (m === 'rush') Rank.after('rush', run.score, run.bossIdx >= 5 || win ? `완주 · ${fmt(run.t)}` : `보스 ${run.bossIdx}/5`, !run.coop);
  $('copy').dataset.text = `⚡ 볼트윙 ${MODES.find(x => x.id === m).name} ${title.replace(/<[^>]+>/g, ' ').trim()} · 점수 ${run.score.toLocaleString()}`;
  $('result').classList.remove('hidden'); resultFx();
}
let wakeLock = null;
async function keepAwake(on) {   // 자동 출격 중에는 화면이 꺼지지 않게(되는 기기에서만)
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* 안 되는 기기 */ }
}
function resultFx() {   // 결과 점수가 0부터 올라가고, 최고 기록이면 반짝인다
  if ($('rStats')) { $('rStats').insertAdjacentHTML('beforeend', weekGain()); Rank.league(S.week.pts, $('rStats')); }   // 주간 별 → 주간 리그
  const el = $('rStats') && $('rStats').querySelector('.big'); if (!el || !el.firstChild || el.firstChild.nodeType !== 3) return;
  const node = el.firstChild, goal = +node.textContent.replace(/[^0-9]/g, ''); if (!goal) return;
  const t0 = performance.now(), dur = Math.min(1400, 500 + goal / 50); let tick = 0;
  const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = Math.round(goal * e).toLocaleString(); if (++tick % 4 === 0 && k < 1) A.sfx('xp'); if (k < 1) requestAnimationFrame(step); else if (el.textContent.includes('최고')) { el.classList.add('record'); A.sfx('levelup'); } };
  requestAnimationFrame(step);
}
function endRun(win) {
  Cloud.log('end', { m: run.mode, s: run.stage, w: win ? 1 : 0, t: Math.round((Date.now() - (run.at0 || Date.now())) / 1000), k: run.kills, sc: run.score, lv: S.pilot.lv, pw: powerOf(buildStats()), c: run.coop ? 1 : 0 });   // 0.60
  state = 'result';
  Forge.show(false);
  netEndOnce(win);
  $('hud').classList.add('hidden');
  if (run.mode !== 'stage') { endOther(win); return; }
  const before = S.cleared, hpOk = P.hp >= P.maxHp * 0.5;
  S.stats.bestCombo = Math.max(S.stats.bestCombo, run.maxCombo);
  const old = S.stars[run.stage] || [false, false, false];
  const now = [old[0] || win, old[1] || (win && hpOk && !run.assist), old[2] || (run.maxCombo >= 30 && !run.assist)];
  S.fails = S.fails || {};
  S.fails[run.stage] = win ? 0 : (S.fails[run.stage] || 0) + 1;
  const newStars = now.filter((v, i) => v && !old[i]).length;
  if (now.some(Boolean)) S.stars[run.stage] = now;
  S.scrap += newStars * STAR_REWARD;
  const newGear = win ? D.FRAMES.concat(D.WEAPONS).filter(o => o.unlock && before < o.unlock && run.stage >= o.unlock && !(S.got || {})[o.id]).map(o => (D.FRAMES.includes(o) ? '✈️ 기체 ' : '🔫 무기 ') + o.name) : [];   // 챕터를 넘을 때 새 기체·무기
  if (win) { S.cleared = Math.max(S.cleared, run.stage); S.maxStage = Math.max(S.maxStage, run.stage + 1); S.next = run.stage + 1; }
  S.lastRun = S.lastRun || {}; const prevScore = S.lastRun['stage' + run.stage]; S.lastRun['stage' + run.stage] = run.score;   // 지난번과 비교
  const newBest = run.score > S.best;
  S.best = Math.max(S.best, run.score);
  dcount('combo', run.maxCombo, true);
  const pxp = Math.round(run.score / 600 + run.kills * 0.35 + (win ? 25 : 0)), up = gainPilotXp(pxp);
  save();
  hangarStage = win ? run.stage + 1 : run.stage;
  A.sfx(win ? 'clear' : 'fail');
  A.music('hangar', 0);
  const opened = [...D.FRAMES, ...D.WEAPONS].filter(o => o.unlock && o.unlock > before && o.unlock <= S.cleared).map(o => o.name);
  $('rTitle').innerHTML = win ? `<small>STAGE ${stLabel(run.stage)}</small>클리어!` : `<small>STAGE ${stLabel(run.stage)}</small>격추당했다`;
  $('rTitle').className = win ? 'win' : 'lose';
  $('rStars').innerHTML = now.map((v, i) => `<span class="${v ? 'on' : ''} ${v && !old[i] ? 'new' : ''}" title="${STAR_RULES[i]}">★</span>`).join('');
  $('rStats').innerHTML = [
    `<div class="big">${run.score.toLocaleString()}<small>점${newBest ? ' · 최고 기록!' : ''}</small></div>`,
    prevScore !== undefined ? `<div class="cmp ${run.score >= prevScore ? 'up' : 'down'}">지난번보다 ${run.score >= prevScore ? '+' : ''}${(run.score - prevScore).toLocaleString()}점 ${run.score >= prevScore ? '▲' : '▼'}</div>` : '',
    run.bossRank ? `<div>보스 랭크 <b class="gold">${run.bossRank}</b> · ${run.bossTime.toFixed(1)}초 · 맞은 횟수 ${run.hits - run.hitsAtBoss}${S.ranks && S.ranks[run.stage] ? ` · 최고 ${S.ranks[run.stage]}` : ''}</div>` : '',
    run.assist ? '<div>🛟 지원 출격으로 깼습니다(별 2·3과 S·A 랭크는 지원 없이 도전)</div>' : '',
    `<div>처치 <b>${run.kills}</b> · 최고 콤보 <b>${run.maxCombo}</b> · 레벨 <b>${run.level}</b></div>`,
    `<div>얻은 고철 🔩 <b>${run.scrapGot}</b>${newStars ? ` + 새 별 보상 🔩 <b>${newStars * STAR_REWARD}</b>` : ''}</div>`,
    newGear.length ? `<div class="gold">🎉 새로 열림: ${newGear.join(', ')}</div>` : '',
    run.partsGot.length ? `<div class="gold">새 부품: ${run.partsGot.join(', ')}</div>` : '',
    opened.length ? `<div class="gold">🔓 새로 열림: ${opened.join(', ')}</div>` : '',
    `<div>조종사 경험치 +${pxp} · Lv ${S.pilot.lv} ${rankName(S.pilot.lv)}${up.ups ? ` <b class="gold">승급! 🔩+${up.reward}</b>` : ''}${up.opened && up.opened.length ? `<br><b class="gold">🔓 새로 열림: ${up.opened.join(', ')}</b>` : ''}</div>`,
    `<div class="rules">${STAR_RULES.map((r, i) => `${now[i] ? '★' : '☆'} ${r}`).join('<br>')}</div>`,
    win ? `<div>다음: 스테이지 ${stLabel(run.stage + 1)} · ${stageEnd(run.stage + 1) === 'leader' ? END_NM.leader : END_NM[stageEnd(run.stage + 1)] + ' ' + D.BOSSES[stageBossIdx(run.stage + 1)].name}${subOf(run.stage) === 5 ? ' · 🗺️ 새 맵 「' + D.THEMES[stageTheme(run.stage + 1)].name + '」' : ''}</div>` : '<div>격납고에서 부품과 무기를 강화하고 다시 도전해 보세요.</div>',
  ].filter(Boolean).join('');
  const btns = $('rBtns');
  btns.innerHTML = '';
  const mk = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', () => { A.sfx('click'); fn(); }); btns.append(b); };
  const stg = run.stage;
  if (win) mk('다음 스테이지 ▶', 'big', () => startRun(stg + 1));
  else mk('다시 도전', 'big', () => startRun(stg));
  mk('격납고', 'sub', showHangar);
  Rank.after('stage', run.score, `STAGE ${stLabel(run.stage)}${win ? ' 클리어' : ''} · ${st.F.name}`, !run.coop && !run.assist);
  $('copy').dataset.text = `⚡ 볼트윙 스테이지 ${stLabel(run.stage)} ${win ? '클리어' : '도전'} ${now.map(v => (v ? '★' : '☆')).join('')} 점수 ${run.score.toLocaleString()} · 콤보 ${run.maxCombo} · ${st.F.name}+${st.Wp.name}`;
  $('result').classList.remove('hidden'); resultFx();
}

