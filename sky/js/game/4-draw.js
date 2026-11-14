// 볼트윙 게임 본체 (그리기·보스 그림·HUD) — js/game/ 파일들과 js/game.js는 한 이름 공간을 나눠 쓴다(index.html에 적힌 순서대로 읽음).
'use strict';
// ---------- 그리기: 배경(먼 층은 눕힌 캔버스에, 가까운 층은 위 캔버스에) ----------
function drawBg(theme) {
  const TH = Art.TH, f = Art.far(theme), n = Art.near(theme);
  const y1 = (bgY % TH + TH) % TH, y2 = (nearY % TH + TH) % TH;
  if (skyTheme !== theme) { skyTheme = theme; $('stage').style.background = SKIES[theme]; }   // 땅 끝 너머로 보이는 하늘
  const cx0 = (BGW - W) / 2;
  for (const yy of [y1 - TH, y1]) {
    bctx.drawImage(f, cx0, yy);
    // 양옆은 거울처럼 뒤집어 이어 붙인다(이음매가 보이지 않게)
    bctx.save(); bctx.translate(cx0, 0); bctx.scale(-1, 1); bctx.drawImage(f, 0, yy); bctx.restore();
    bctx.save(); bctx.translate(cx0 + W * 2, 0); bctx.scale(-1, 1); bctx.drawImage(f, 0, yy); bctx.restore();
  }
  // 멀수록 옅은 안개(공기 원근)
  const fog = bctx.createLinearGradient(0, 0, 0, BGH * 0.5);
  fog.addColorStop(0, ['rgba(170,215,255,.55)', 'rgba(255,170,130,.5)', 'rgba(20,40,80,.6)', 'rgba(30,10,60,.5)', 'rgba(90,85,80,.55)', 'rgba(225,235,245,.6)', 'rgba(60,20,10,.55)', 'rgba(150,190,150,.45)', 'rgba(255,225,230,.55)'][theme]); fog.addColorStop(1, 'rgba(0,0,0,0)');
  bctx.fillStyle = fog; bctx.fillRect(0, 0, BGW, BGH);
  if (state !== 'hangar' && run && !run.arena && run.obst && run.obst.length) drawGroundObst();   // 땅에 선 구조물: 땅 바로 위, 가까운 구름 아래
  ctx.drawImage(n, 0, y2 - TH); ctx.drawImage(n, 0, y2);
  const g = ctx.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, 'rgba(3,6,14,.5)'); g.addColorStop(1, 'rgba(3,6,14,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 150);
}
const hasGround = () => run && run.theme !== 3;   // 우주에는 그림자가 없다

function drawShipAt(g, id, x, y, s, bank, t, withShadow, look) {
  const F = frameOf(id), im = IMG['ship-' + id], spr = look && look.paint !== 'none' ? paintedShip(id, look.paint) : im || Art.ship(id, F.color), size = Art.SHIP / Art.SS, fc = flameColor(look, F);
  const sx = 1 - Math.abs(bank) * 0.22;
  if (withShadow) {
    g.save(); g.translate(x + 26, y + 40); g.scale(s * sx * 0.85, s * 0.85); g.rotate(bank * 0.08);
    g.globalAlpha = 0.9; g.drawImage(im ? silhouette('ship-' + id) : Art.shipShadow(id, F.color), -size / 2, -size / 2, size, size); g.restore();
  }
  g.save(); g.translate(x, y); g.scale(s, s);
  g.globalCompositeOperation = 'lighter';
  const tier = (look && look.tier) || 0, fm = 1 + 0.12 * Math.min(tier, 5);   // 성장 단계: 불꽃이 커진다
  shipAura(g, tier, t, size, sx); g.globalCompositeOperation = 'lighter';
  const fl = (1 + Math.sin(t * 40) * 0.15) * fm;
  for (const ex of (id === 'turtle' ? [-27, 27] : id === 'hornet' ? [0] : [-6, 6])) {
    g.drawImage(Art.glow(fc, 24), ex - 8 * fm, 18, 16 * fm, 34 * fl);
    g.drawImage(Art.glow('#fff6c0', 10), ex - 5, 20, 10, 16 * fl);
  }
  g.globalCompositeOperation = 'source-over';
  g.save(); g.scale(sx, 1); g.rotate(bank * 0.08);
  g.drawImage(spr, -size / 2, -size / 2, size, size);
  // 기울어진 쪽 날개에 빛이 비친다(입체감)
  if (Math.abs(bank) > 0.05) {
    g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(-size / 2, 0, size / 2, 0);
    lg.addColorStop(bank > 0 ? 0 : 1, `rgba(255,255,255,${Math.abs(bank) * 0.25})`); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(bank > 0 ? 1 : 0, `rgba(0,0,0,${Math.abs(bank) * 0.3})`);
    g.fillStyle = lg; g.fillRect(-size / 2, -size / 2, size, size);
    g.globalCompositeOperation = 'source-over';
  }
  const dc = look && lookOf('decal', look.decal)[2];
  if (dc) { g.font = '15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(dc, 0, 6); g.textBaseline = 'alphabetic'; }   // 스티커
  g.restore();
  shipTierFx(g, tier, t, size, sx); if (look) shipSetFx(g, look, t, size);
  const tips ={ falcon: 31, turtle: 30, phoenix: 34 }[id];
  if (tips && Math.floor(t * 2.5) % 2 === 0) {
    g.globalCompositeOperation = 'lighter';
    g.drawImage(Art.glow('#ff4d4d', 8), -tips * sx - 8, 6, 16, 16);
    g.drawImage(Art.glow('#4dff88', 8), tips * sx - 8, 6, 16, 16);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

function drawFoe(e) {
  if (e.civ) { drawCiv(e); return; }
  const size = Art.EN / Art.ES, rot = e.arena ? Math.atan2(e.vy || 1, e.vx || 0) - Math.PI / 2 : e.type === 'weaver' ? e.t * 3 : e.type === 'netter' ? e.t * 0.8 : e.type === 'diver' && e.mode === 'go' ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : 0;
  if (hasGround()) { ctx.save(); ctx.translate(e.x + 16, e.y + 26); ctx.scale(0.85, 0.85); ctx.rotate(rot); ctx.drawImage(silhouette('enemy-' + e.type) || Art.enemyShadow(e.type), -size / 2, -size / 2, size, size); ctx.restore(); }
  if (e.mod) {   // 정예 표시
    const c = { shield: '#7fd8ff', swift: '#ffe066', volatile: '#ff9a3c' }[e.mod];
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow(c, 40), e.x - e.r * 1.8, e.y - e.r * 1.8, e.r * 3.6, e.r * 3.6); ctx.globalCompositeOperation = 'source-over';
    if (e.sh > 0) { ctx.strokeStyle = 'rgba(127,216,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, TAU * e.sh / (e.maxHp * 0.7)); ctx.stroke(); }
  }
  if (e.tell && Math.floor(T * 14) % 2) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ff5d5d', 40), e.x - e.r * 2, e.y - e.r * 2, e.r * 4, e.r * 4); ctx.globalCompositeOperation = 'source-over'; }   // 표창 공방: 곧 쏜다
  if (e.harmless || CRITTER[e.type]) { drawEmojiFoe(e); return; }
  if (e.balloonT > 0) { drawBalloon(e); return; }
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(rot); if (e.leader) ctx.scale(LEADER.scale, LEADER.scale);
  if (run.danceT > 0) ctx.rotate(Math.sin(T * 14 + (e.nid || 0)) * 0.5);   // 춤
  if (e.type === 'treasure') ctx.scale(1.6, 1.6); else if (e.keeper) ctx.scale(2.2, 2.2);
  const eim = IMG['enemy-' + e.type];
  if (eim) {   // 그림 적: 둥실거리고, 움직이는 쪽으로 기울고, 포대는 나를 겨눈다
    ctx.translate(0, Math.sin(T * 4 + (e.nid || 0)) * 2);
    if (e.type === 'turret' && !e.arena) ctx.rotate(clamp(angTo(e) - Math.PI / 2, -1.2, 1.2)); else if (!e.arena && e.type !== 'weaver' && e.type !== 'netter') ctx.rotate(clamp(-(e.vx || 0) / 500, -0.35, 0.35));
    ctx.drawImage(eim, -size / 2, -size / 2, size, size); if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(eim, -size / 2, -size / 2, size, size); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
  else ctx.drawImage(Art.enemy(e.type, e.flash > 0), -size / 2, -size / 2, size, size);
  ctx.restore();
  if (e.type === 'turret') {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(angTo(e) - Math.PI / 2);
    ctx.fillStyle = Art.metal(ctx, -5, 0, 5, 0, [[0, '#9aa6b4'], [1, '#2b3440']]); ctx.fillRect(-5, 4, 10, 24); ctx.strokeStyle = '#11161c'; ctx.lineWidth = 1.5; ctx.strokeRect(-5, 4, 10, 24);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ffb347', 12), -12, -12, 24, 24); ctx.restore();
  }
  if (e.type === 'diver' && e.mode === 'wait') { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ff5050', 22), e.x - 22, e.y - 22, 44, 44); ctx.globalCompositeOperation = 'source-over'; }
  if (e.elite && e.hp < e.maxHp) { const w = 46; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5); ctx.fillStyle = '#ff8a5e'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * e.hp / e.maxHp, 5); }
}

// ---------- 그림 보스 움직이기: 그림의 한 조각(다각형, 0~1 좌표)을 잘라 돌리고 옮긴다 ----------
function imgPiece(im, w, poly, pv, ang, dx, dy, sc) {
  ctx.save();
  ctx.translate((pv[0] - 0.5) * w + dx, (pv[1] - 0.5) * w + dy); ctx.rotate(ang || 0); if (sc) ctx.scale(sc, sc); ctx.translate(-(pv[0] - 0.5) * w, -(pv[1] - 0.5) * w);
  ctx.beginPath(); poly.forEach(([u, v], i) => ctx[i ? 'lineTo' : 'moveTo']((u - 0.5) * w, (v - 0.5) * w)); ctx.closePath(); ctx.clip();
  ctx.drawImage(im, -w / 2, -w / 2, w, w);
  ctx.restore();
}
function imgBody(im, w, holes) {   // 조각들을 뺀 나머지 몸통
  ctx.save(); ctx.beginPath(); ctx.rect(-w, -w, w * 2, w * 2);
  for (const poly of holes) { poly.forEach(([u, v], i) => ctx[i ? 'lineTo' : 'moveTo']((u - 0.5) * w, (v - 0.5) * w)); ctx.closePath(); }
  ctx.clip('evenodd'); ctx.drawImage(im, -w / 2, -w / 2, w, w); ctx.restore();
}
const KN_SWORD = [[0.07, 0.62], [0.24, 0.55], [0.36, 0.66], [0.68, 0.92], [0.66, 1], [0.5, 1], [0.15, 0.7]];
const KN_SHIELD = [[0.64, 0.2], [0.99, 0.2], [0.99, 0.88], [0.64, 0.88]];
const SP_LEG_L = [[0, 0], [0.31, 0], [0.31, 1], [0, 1]], SP_LEG_R = [[0.69, 0], [1, 0], [1, 1], [0.69, 1]];
const WH_JAW = [[0.3, 0.76], [0.7, 0.76], [0.72, 1], [0.28, 1]], WH_TAIL = [[0.28, 0], [0.72, 0], [0.62, 0.27], [0.38, 0.27]];
function drawBossImg(b, p, im, w) {
  if (b.drawnAt !== T) { b.dtd = Math.min(0.05, T - (b.drawnAt ?? T)); b.drawnAt = T; }
  const dtNow = b.dtd || 0.016;
  const id = b.def.id, t = b.t || 0, p3 = b.p3;
  ctx.translate(0, Math.sin(t * 2.2 + (p.dx || 0)) * 4);   // 둥실둥실
  if (id === 'knight') {
    const lean = clamp(((b.tx || b.x) - b.x) / 260, -0.28, 0.28);
    const sw = b.swingT > 0 ? 1 - b.swingT / 0.42 : 1;   // 0→1: 들어 올렸다가 내려 벤다
    const target = b.swingT > 0 ? (sw < 0.35 ? 1.0 * sw / 0.35 : 1.0 - 2.1 * Math.min(1, (sw - 0.35) / 0.4)) : (b.slash === 1 ? 0.5 : 0);
    b.swA = (b.swA || 0) + (target - (b.swA || 0)) * Math.min(1, (b.swingT > 0 ? 30 : 6) * dtNow);
    b.shA = (b.shA || 0) + ((b.mirror > 0 ? 1 : 0) - (b.shA || 0)) * Math.min(1, 8 * dtNow);
    ctx.rotate(lean - b.swA * 0.12);
    imgBody(im, w, [KN_SWORD, KN_SHIELD]);
    imgPiece(im, w, KN_SWORD, [0.27, 0.62], b.swA, 0, 0);
    if (b.swingT > 0 && sw > 0.35 && sw < 0.85) {   // 칼이 지나간 빛
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(200,230,255,${0.9 - (sw - 0.35)})`; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc((0.27 - 0.5) * w, (0.62 - 0.5) * w, w * 0.5, 0.15, 0.15 + 1.6 * (sw - 0.35) / 0.5); ctx.stroke(); ctx.restore();
    }
    imgPiece(im, w, KN_SHIELD, [0.82, 0.55], -0.25 * b.shA, -w * 0.3 * b.shA, w * 0.12 * b.shA, 1 + 0.15 * b.shA);   // 방패를 앞으로
  } else if (id === 'spider') {
    const k = Math.sin(t * 7) * 0.07;   // 다리를 번갈아 젓는다
    imgBody(im, w, [SP_LEG_L, SP_LEG_R]);
    imgPiece(im, w, SP_LEG_L, [0.33, 0.45], k, 0, 0);
    imgPiece(im, w, SP_LEG_R, [0.67, 0.45], k, 0, 0);
  } else if (id === 'whale') {
    const open = b.inhale > 0 ? 1 : (b.fanT > 0 ? b.fanT / 0.3 : 0);
    b.mouth = (b.mouth || 0) + (open - (b.mouth || 0)) * Math.min(1, 8 * dtNow);
    if (b.mouth > 0.05) { ctx.fillStyle = '#0a1420'; ctx.beginPath(); ctx.ellipse(0, w * 0.33, w * 0.18, w * 0.1 * b.mouth + 2, 0, 0, TAU); ctx.fill(); }
    imgBody(im, w, [WH_JAW, WH_TAIL]);
    imgPiece(im, w, WH_TAIL, [0.5, 0.27], Math.sin(t * 2.6) * 0.18, 0, 0);
    imgPiece(im, w, WH_JAW, [0.5, 0.78], 0, 0, w * 0.09 * b.mouth);
  } else if (id === 'core') {
    ctx.rotate((b.spin || 0) * 0.5);   // 요새가 천천히 돈다
    ctx.drawImage(im, -w / 2, -w / 2, w, w);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5); ctx.drawImage(Art.glow(p3 ? '#ff8a8a' : '#c08bff', 60), -w * 0.22, -w * 0.22, w * 0.44, w * 0.44); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  } else if (id === 'twins') {
    const rec = p.dx < 0 ? (b.stream > 0 ? Math.abs(Math.sin(t * 30)) * 5 : 0) : 0;   // 쏠 때 뒤로 밀린다
    const aim = clamp(Math.atan2(P.y - p.y, P.x - p.x) - Math.PI / 2, -0.35, 0.35);
    ctx.rotate(p.dx < 0 ? aim : Math.sin((b.spin || 0) * 0.5) * 0.12); ctx.translate(0, -rec);
    ctx.drawImage(im, -w / 2, -w / 2, w, w);
  } else ctx.drawImage(im, -w / 2, -w / 2, w, w);
}
function bossOverlay(b, w, glowAt) {   // 그림 파일 보스: 상태를 빛으로 보여 준다
  if (b.p2 || b.enraged) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22 + 0.12 * Math.sin(T * 8); ctx.drawImage(Art.glow('#ff3030', 60), -w / 2, -w / 2, w, w); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  if (b.def.id === 'knight' && b.mirror > 0) { ctx.globalAlpha = 0.45; glowAt(0, w * 0.45, '#9fc8ff', w * 0.3); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(190,225,255,.95)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, w * 0.56, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke(); }
  if (b.def.id === 'whale' && b.inhale > 0) glowAt(0, w * 0.4, '#7fe8ff', w * 0.32);
}
function drawBoss() {
  if (!boss) return;
  const b = boss, id = b.def.id, im = IMG['boss-' + id];
  const glowAt = (x, y, c, r) => { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow(c, r), x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over'; };
  for (const p of b.parts) {
    if (p.dead) continue;
    if (hasGround()) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(p.x + 34, p.y + 60, p.r * 1.1, p.r * 0.8, 0, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.translate(p.x, p.y);
    if (b.gs && b.gs < 1) { ctx.scale(b.gs, b.gs); ctx.filter = `brightness(${(0.35 + 0.65 * (b.gs - 0.55) / 0.45).toFixed(2)}) saturate(.7)`; }   // 지상: 작고 어둡게
    if (im) { const w = p.r * 2.8; drawBossImg(b, p, im, w); if (p.flash > 0) { ctx.globalAlpha = 0.45; glowAt(0, 0, '#ffffff', p.r * 0.6); ctx.globalAlpha = 1; } bossOverlay(b, w, glowAt); ctx.restore(); continue; }
    ctx.lineWidth = 3; ctx.strokeStyle = '#0b0f18'; ctx.lineJoin = 'round';
    const grad = (a, c) => { const g = ctx.createRadialGradient(-p.r * 0.3, -p.r * 0.4, 4, 0, 0, p.r * 1.1); g.addColorStop(0, a); g.addColorStop(0.55, c); g.addColorStop(1, '#0a0d14'); return g; };
    if (id === 'spider') {
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1, k = i % 4, wig = Math.sin(b.t * 6 + i) * 0.15;
        const kx = side * (60 + k * 8), ky = -30 + k * 25, fx2 = kx + side * 30, fy = ky + 40 + wig * 30;
        for (const [lw, c] of [[9, '#0b0f18'], [6, '#59606c'], [2, '#a8b0bd']]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(kx, ky - 30 + wig * 40); ctx.lineTo(fx2, fy); ctx.stroke(); }
        ctx.fillStyle = '#ff5d5d'; ctx.beginPath(); ctx.arc(fx2, fy, 3, 0, TAU); ctx.fill();
      }
      ctx.lineWidth = 3; ctx.strokeStyle = '#0b0f18';
      ctx.beginPath(); ctx.arc(0, 0, 56, 0, TAU); ctx.fillStyle = grad('#d3dae5', '#4a5260'); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(10,14,20,.5)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(0, 0, 56, i * TAU / 6, i * TAU / 6 + 0.6); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, TAU); ctx.stroke();
      for (const [ex, ey, er] of [[-16, 10, 8], [16, 10, 8], [-6, 26, 5], [6, 26, 5]]) glowAt(ex, ey, b.p2 ? '#ff2020' : '#ff6060', er * 2.4);
    } else if (id === 'whale') {
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 82, -12, 42, 17, sx * 0.4, 0, TAU); ctx.fillStyle = grad('#9fd2ff', '#2d6aa6'); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-30, -90); ctx.quadraticCurveTo(0, -130, 30, -90); ctx.fillStyle = '#2d6aa6'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 70, 95, 0, 0, TAU); ctx.fillStyle = grad('#c8ecff', '#2a5f94'); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e4f5ff'; ctx.beginPath(); ctx.ellipse(0, 42, 46, 42, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(60,110,160,.45)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-38 + i * 15, 14); ctx.lineTo(-30 + i * 12, 78); ctx.stroke(); }
      for (const sx of [-1, 1]) { ctx.fillStyle = '#0b1424'; ctx.beginPath(); ctx.arc(sx * 32, 10, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * 32 - 2, 7, 2.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = b.inhale > 0 ? '#050b14' : '#1b3550';
      ctx.beginPath(); ctx.ellipse(0, 72, b.inhale > 0 ? 36 : 22, b.inhale > 0 ? 20 : 6, 0, 0, TAU); ctx.fill();
      if (b.inhale > 0) glowAt(0, 72, '#9fe0ff', 40);
    } else if (id === 'twins') {
      const red = p.dx < 0, enr = b.enraged;
      ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fillStyle = grad(red ? '#ffc7c0' : '#e3ccff', red ? '#a02a36' : '#5c2b9a'); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + b.t; ctx.fillStyle = '#d6dde6'; ctx.beginPath(); ctx.arc(Math.cos(a) * 47, Math.sin(a) * 47, 2.5, 0, TAU); ctx.fill(); }
      ctx.save(); ctx.rotate(angTo(p) - Math.PI / 2); ctx.fillStyle = Art.metal(ctx, -9, 0, 9, 0, [[0, '#8a949f'], [1, '#1b2028']]); ctx.fillRect(-9, 18, 18, 48); ctx.strokeStyle = '#0b0f18'; ctx.strokeRect(-9, 18, 18, 48); ctx.restore();
      glowAt(0, 0, enr ? '#ffef5a' : (red ? '#ff8080' : '#c58bff'), enr ? 34 : 24);
    } else if (id === 'knight') {
      ctx.save(); ctx.rotate(0.25 + Math.sin(b.t * 3) * 0.1);
      ctx.fillStyle = Art.metal(ctx, 48, 0, 58, 0, [[0, '#ffffff'], [1, '#8fa3bd']]); ctx.fillRect(48, -66, 10, 116); ctx.strokeRect(48, -66, 10, 116);
      ctx.fillStyle = '#c9a04a'; ctx.fillRect(38, 44, 30, 8); ctx.strokeRect(38, 44, 30, 8);
      ctx.restore();
      ctx.fillStyle = grad('#f2f6fb', '#56647a');
      ctx.beginPath(); ctx.moveTo(-60, -10); ctx.lineTo(-32, -38); ctx.lineTo(32, -38); ctx.lineTo(60, -10); ctx.lineTo(38, 42); ctx.lineTo(-38, 42); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(20,28,40,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, 42); ctx.moveTo(-50, -6); ctx.lineTo(50, -6); ctx.stroke();
      ctx.strokeStyle = '#c9a04a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-60, -10); ctx.lineTo(-32, -38); ctx.lineTo(32, -38); ctx.lineTo(60, -10); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#0b0f18';
      ctx.beginPath(); ctx.arc(0, -18, 22, Math.PI, 0); ctx.lineTo(22, 6); ctx.lineTo(-22, 6); ctx.closePath(); ctx.fillStyle = grad('#c7d3e3', '#5c6c84'); ctx.fill(); ctx.stroke();
      glowAt(0, -10, '#00e5ff', 20); ctx.fillStyle = '#bff8ff'; ctx.fillRect(-14, -12, 28, 4);
      if (b.mirror > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(120,200,255,${0.6 + Math.sin(T * 20) * 0.3})`; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(0, 0, 78, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.fillStyle = 'rgba(120,200,255,.16)'; ctx.beginPath(); ctx.arc(0, 0, 78, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      for (let k = 0; k < 4; k++) {
        ctx.save(); ctx.rotate(b.spin + k * TAU / 4);
        ctx.fillStyle = Art.metal(ctx, 0, -12, 0, 12, [[0, '#7d8ea6'], [1, '#1c2633']]); ctx.fillRect(40, -13, 52, 26); ctx.strokeRect(40, -13, 52, 26);
        ctx.fillStyle = '#0e141c'; ctx.fillRect(84, -7, 10, 14);
        glowAt(90, 0, '#7cf0c0', 12);
        ctx.restore();
      }
      for (const [rr, a, c] of [[74, '#55677f', '#1d2633'], [54, '#8ea0b8', '#2b3747'], [34, '#1c2633', '#0b0f18']]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fillStyle = grad(a, c); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(124,240,192,.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -T * 40; ctx.beginPath(); ctx.arc(0, 0, 64, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      glowAt(0, 0, b.p2 ? '#ff6b6b' : '#7cf0c0', 34 + Math.sin(T * 6) * 6);
    }
    if (p.flash > 0) glowAt(0, 0, '#ffffff', p.r);
    ctx.restore();
  }
  if (b.def.id === 'twins' && b.parts.every(p => !p.dead)) {
    ctx.strokeStyle = 'rgba(200,200,220,.5)'; ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -T * 30;
    ctx.beginPath(); ctx.moveTo(b.parts[0].x, b.parts[0].y); ctx.lineTo(b.parts[1].x, b.parts[1].y); ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawShots() {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const s of shots) {
    if (s.star) {
      if (s.orb) {   // 말벌 회오리: 노란 빛 + 크게 + 꼬리
        const a = s.orb.a0 + s.t * 7 - 0.35, R = 50 + s.t * 75, tx = s.orb.who.x + Math.cos(a) * R, ty = s.orb.who.y + Math.sin(a) * R, k = Math.min(1, (3 - s.t) * 2);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * k; ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.globalAlpha = 0.8 * k; ctx.drawImage(Art.glow('#ffd23c', 30), s.x - 30, s.y - 30, 60, 60); ctx.restore();
        ctx.save(); ctx.globalAlpha = k; ctx.translate(s.x, s.y); ctx.rotate(s.t * 20); ctx.drawImage(Forge.sprite(s.star), -22, -22, 44, 44); ctx.restore(); continue;
      }
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.t * 16); ctx.drawImage(Forge.sprite(s.star), -15, -15, 30, 30); ctx.restore(); continue;
    }
    const len = s.long ? 30 : s.homing ? 10 : 16, sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
    ctx.globalAlpha = SHOT_A;   // 0.61: 내 탄은 조금 옅게(적 탄이 먼저 보이게)
    ctx.strokeStyle = s.color; ctx.lineWidth = s.r * 1.8;
    ctx.beginPath(); ctx.moveTo(s.x - ux * len, s.y - uy * len); ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s.r * 0.6;
    ctx.beginPath(); ctx.moveTo(s.x - ux * len * 0.6, s.y - uy * len * 0.6); ctx.lineTo(s.x, s.y); ctx.stroke();
    if (!Q.low) ctx.drawImage(Art.glow(s.color, 12), s.x - 9, s.y - 9, 18, 18);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawNet(x, y, r, spin, alpha) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#7ff0dc'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
  for (const k of [0.35, 0.65, 1]) { ctx.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU; ctx.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } ctx.stroke(); }
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#7ff0dc', 30), -r, -r, r * 2, r * 2);
  ctx.restore();
}
// 0.61 적 탄 읽기 쉽게: 어느 맵에서도 「진한 테두리 → 밝은 색 → 흰 속」. 색·크기마다 한 번 그려 두고 찍는다
const EBS = new Map(), SHOT_A = 0.72;   // SHOT_A: 내 탄 진하기
function ebSprite(color, r) {
  const k = color + '|' + Math.round(r * 2), hit = EBS.get(k); if (hit) return hit;
  const R = Math.ceil(r + 4), c = document.createElement('canvas'); c.width = c.height = R * 2; const g = c.getContext('2d');
  g.fillStyle = 'rgba(16,2,12,.92)'; g.beginPath(); g.arc(R, R, r + 3, 0, TAU); g.fill();
  const gr = g.createRadialGradient(R, R, 0, R, R, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.42, '#fff'); gr.addColorStop(0.55, color); gr.addColorStop(1, color);
  g.fillStyle = gr; g.beginPath(); g.arc(R, R, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.beginPath(); g.arc(R, R, r - 0.5, 0, TAU); g.stroke();
  EBS.set(k, c); if (EBS.size > 200) EBS.delete(EBS.keys().next().value);
  return c;
}
function drawEbul() {
  ctx.globalCompositeOperation = 'lighter';
  for (const b of ebul) {
    if (b.mine !== undefined || b.net) continue;
    const r = b.r * 2.6;
    ctx.drawImage(Art.glow(b.color, 24), b.x - r, b.y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const b of ebul) {
    if (b.net) { drawNet(b.x, b.y, b.r * 1.4, b.spin || 0, 0.9); continue; }
    if (b.mine !== undefined) {
      const k = 0.5 + 0.5 * Math.sin(T * (b.mine < 0.6 ? 30 : 10));
      ctx.fillStyle = '#3a0a0a'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ff3030', 20), b.x - 14 * k - 4, b.y - 14 * k - 4, 28 * k + 8, 28 * k + 8); ctx.globalCompositeOperation = 'source-over';
      continue;
    }
    const sp = ebSprite(b.color || '#ff5d7a', b.r), h = sp.width / 2;
    ctx.drawImage(sp, b.x - h, b.y - h);
  }
}
function drawLasers() {
  for (const l of lasers) {
    const ex = l.x + Math.cos(l.a) * 1400, ey = l.y + Math.sin(l.a) * 1400;
    if (l.warn > 0) {
      ctx.strokeStyle = `rgba(255,70,70,${0.4 + Math.sin(T * 30) * 0.3})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      for (const [w, c] of [[l.w * 2.4, 'rgba(255,60,60,.25)'], [l.w * 1.3, 'rgba(255,90,90,.6)'], [l.w * 0.4, '#fff']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
function drawDrops() {
  for (const d of drops) {
    if (d.kind === 'xp') {
      const r = 5 + Math.min(5, d.v);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#4dff9e', 16), d.x - r * 1.6, d.y - r * 1.6, r * 3.2, r * 3.2); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#b9ffd8'; ctx.beginPath(); ctx.moveTo(d.x, d.y - r); ctx.lineTo(d.x + r * 0.65, d.y); ctx.lineTo(d.x, d.y + r); ctx.lineTo(d.x - r * 0.65, d.y); ctx.fill();
    } else if (d.kind === 'scrap') {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(T * 4 + d.x);
      const s = d.small ? 3 : 4 + Math.min(4, d.v);
      ctx.fillStyle = Art.metal(ctx, -s, 0, s, 0, [[0, '#fff1b8'], [0.5, '#ffd166'], [1, '#8a6a1c']]);
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a4210'; ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, TAU); ctx.fill(); ctx.restore();
    } else if (d.kind === 'heart') { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💗', d.x, d.y + 8); }
    else if (d.kind === 'item') drawItemDrop(d);
    else if (d.kind === 'up') drawUpDrop(d);
    else {
      const k = 1 + Math.sin(T * 6) * 0.08;
      ctx.save(); ctx.translate(d.x, d.y); ctx.scale(k, k);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ffd166', 40), -40, -40, 80, 80); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = Art.metal(ctx, 0, -12, 0, 12, [[0, '#e3a75a'], [1, '#7a4a18']]); ctx.fillRect(-15, -13, 30, 26);
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.strokeRect(-15, -13, 30, 26); ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.stroke();
      ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🧩', 0, 6); ctx.restore();
    }
  }
}
function drawPlayer() {
  drawAllies();
  if (run.phase === 'dead' || P.down > 0) return;
  const blink = P.inv > 0 && P.ultKind !== 'bulwark' && !P.trap && Math.floor(T * 20) % 2;
  for (const g of guardSpots()) {
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#9ff3ff', 16), g.x - 16, g.y - 16, 32, 32); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#d8fbff'; ctx.beginPath(); ctx.arc(g.x, g.y, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a6b80'; ctx.lineWidth = 2; ctx.stroke();
  }
  for (const d of droneSpots()) {
    ctx.fillStyle = Art.metal(ctx, d.x - 8, 0, d.x + 8, 0, [[0, '#f0fdff'], [1, d.part ? '#3a8fb0' : '#7a5ab8']]); ctx.strokeStyle = '#0b1424'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(d.x, d.y - 11); ctx.lineTo(d.x + 9, d.y + 6); ctx.lineTo(d.x, d.y + 2); ctx.lineTo(d.x - 9, d.y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#9ff3ff', 8), d.x - 6, d.y + 2, 12, 14); ctx.globalCompositeOperation = 'source-over';
  }
  if (P.ultKind === 'laser') {
    ctx.globalCompositeOperation = 'lighter';
    const w = 74 + Math.sin(T * 50) * 6, g = ctx.createLinearGradient(P.x - w / 2, 0, P.x + w / 2, 0);
    g.addColorStop(0, 'rgba(76,201,255,0)'); g.addColorStop(0.3, 'rgba(76,201,255,.7)'); g.addColorStop(0.5, '#fff'); g.addColorStop(0.7, 'rgba(76,201,255,.7)'); g.addColorStop(1, 'rgba(76,201,255,0)');
    ctx.fillStyle = g; ctx.fillRect(P.x - w / 2, cam.y, w, P.y - 20 - cam.y);
    ctx.drawImage(Art.glow('#4cc9ff', 60), P.x - 60, P.y - 90, 120, 120);
    ctx.globalCompositeOperation = 'source-over';
  }
  const shakeX = P.trap ? Math.sin(T * 60) * 2 : 0;   // 그물 안에서 버둥거림
  if (P.twinT > 0) { ctx.globalAlpha = 0.5; for (const s of [-1, 1]) drawShipAt(ctx, st.F.id, P.x + s * 46, P.y + 6, 0.6, P.bank, T, false, myLook()); ctx.globalAlpha = 1; }   // 분신
  drawEvoAura();
  if (!blink) drawShipAt(ctx, st.F.id, P.x + shakeX, P.y, 1, P.trap ? Math.sin(T * 25) * 0.4 : P.bank, T, hasGround(), myLook());
  if (P.orb) { ctx.strokeStyle = `rgba(127,216,255,${0.5 + Math.sin(T * 6) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(P.x, P.y, 40, 0, TAU); ctx.stroke(); }
  if (run.mode === 'auto') drawBlades();   // 표창이 둘레를 돌다가 적에게 날아간다
  if (P.trap) drawNet(P.x, P.y, 46 - P.trap.g * 16, T * 0.5, 0.95 - P.trap.g * 0.4);
  if (P.ultKind === 'bulwark') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(123,220,107,${0.6 + Math.sin(T * 12) * 0.3})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(P.x, P.y, 62, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(123,220,107,.12)'; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (P.ultKind === 'nova') { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,140,60,.8)'; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(P.x, P.y, P.novaR, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
  if (run.m.barrier && P.barrierReady) { ctx.strokeStyle = 'rgba(127,216,255,.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -T * 20; ctx.beginPath(); ctx.arc(P.x, P.y, 36, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P.x, P.y, st.hit * 0.8, 0, TAU); ctx.fill();   // 맞는 자리(가운데 흰 점)
  ctx.strokeStyle = 'rgba(255,80,80,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
}
function drawFx() {
  const fr = Art.fire(), sm = Art.smoke();
  for (const p of fx) {
    const k = 1 - p.t / p.life;
    if (p.k === 'smoke') { const s = p.size * (1.6 - k * 0.6); ctx.globalAlpha = k * 0.8; ctx.drawImage(sm, p.x - s, p.y - s, s * 2, s * 2); }
    else if (p.k === 'debris') { ctx.globalAlpha = k; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#2a2f38'; ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (const p of fx) {
    const k = 1 - p.t / p.life;
    if (p.k === 'fire') { const s = p.size * (0.6 + (1 - k) * 0.7); ctx.globalAlpha = k; ctx.drawImage(fr, p.x - s, p.y - s, s * 2, s * 2); }
    else if (p.k === 'ring') { ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.lineWidth = 5 * k; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - k), 0, TAU); ctx.stroke(); }
    else if (p.k === 'muzzle') { ctx.globalAlpha = k; ctx.drawImage(Art.glow(p.color, 20), p.x - 14, p.y - 14, 28, 28); }
    else if (p.k === 'streak') { ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 22); }
    else if (p.k === 'spark') { ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    else if (p.k === 'glyph') { ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.font = `900 ${p.size}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(p.ch, p.x, p.y); }
    else if (p.k === 'beam') {   // 박자 빔
      ctx.globalAlpha = k;
      const g = ctx.createLinearGradient(p.x - p.w / 2, 0, p.x + p.w / 2, 0);
      g.addColorStop(0, 'rgba(255,120,240,0)'); g.addColorStop(0.5, 'rgba(255,230,255,.95)'); g.addColorStop(1, 'rgba(255,120,240,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - p.w / 2, 0, p.w, p.y - 20);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  for (const t of texts) {
    const k = t.t / t.life;
    ctx.globalAlpha = Math.min(1, (1 - k) * 3);
    ctx.font = `900 ${t.size}px sans-serif`; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(5,8,16,.85)'; ctx.lineJoin = 'round';
    const y = t.y - Math.min(t.t, 0.5) * 30;
    ctx.strokeText(t.text, t.x, y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, y);
  }
  ctx.globalAlpha = 1;
}

// ---------- 화면 장식(HUD) ----------
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function panel(x, y, w, h, r = 10) {
  rrect(x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(22,32,52,.88)'); g.addColorStop(1, 'rgba(8,12,22,.88)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
}
function segBar(x, y, w, h, k, c1, c2, segs) {
  rrect(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
  if (k > 0) {
    ctx.save(); rrect(x, y, w, h, h / 2); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(x, y, w * clamp(k, 0, 1), h);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, w * clamp(k, 0, 1), h * 0.4);
    ctx.restore();
  }
  if (segs) { ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5; for (let i = 1; i < segs; i++) { const sx = x + w * i / segs; ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, y + h); ctx.stroke(); } }
  rrect(x, y, w, h, h / 2); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
}
function drawNums() {   // 피해 숫자: 떠오르며 사라진다
  if (!dnums.length) return;
  dnums = dnums.filter(n => T - n.t0 < 0.65);
  for (const n of dnums) { const a = T - n.t0; ctx.globalAlpha = Math.min(1, (1 - a / 0.65) * 1.8); txt(String(n.v), n.x, n.y - a * 46, n.big ? 20 : 14, n.big ? '#ffd166' : '#ffffff', 'center', 900); }
  ctx.globalAlpha = 1;
}
function txt(s, x, y, size, color, align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px sans-serif`; ctx.textAlign = align; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(3,6,14,.8)';
  ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function drawRush() {   // 비트 러시: 아래쪽 박자 줄
  const r = run.rush, now = A.clock().t, y = H - 112;
  panel(14, y - 30, W - 170, 60, 30);
  // 박자마다 맥박
  const ph = ((now - r.notes[0].t) / r.beat % 1 + 1) % 1, pulse = 1 - ph;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(Art.glow('#ff7ad9', 40), LANE_X - 30 - pulse * 8, y - 30 - pulse * 8, 60 + pulse * 16, 60 + pulse * 16);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#ffe6ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(LANE_X, y, 21, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LANE_X + 24, y); ctx.lineTo(W - 172, y); ctx.stroke();
  for (const n of r.notes) {
    const x = LANE_X + (n.t - now) * NOTE_SPEED;
    if (x > W - 166 || x < 30) continue;
    if (n.j === 'p' || n.j === 'g') continue;
    const miss = n.j === 'm', rr = n.half ? 11 : 15;
    ctx.globalAlpha = miss ? 0.3 : 1;
    ctx.globalCompositeOperation = 'lighter';
    if (!miss) ctx.drawImage(Art.glow(n.half ? '#7fd8ff' : '#ff7ad9', 26), x - 26, y - 26, 52, 52);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = miss ? '#555' : '#fff'; ctx.beginPath(); ctx.arc(x, y, rr * 0.55, 0, TAU); ctx.fill();
    ctx.strokeStyle = miss ? '#777' : (n.half ? '#7fd8ff' : '#ff7ad9'); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (r.judge && r.judgeT > 0) txt(r.judge, LANE_X, y - 38, 20, r.judge === 'PERFECT' ? '#ffe066' : r.judge === 'GOOD' ? '#9fe0ff' : '#ff8a8a', 'center', 900);
  txt(`${r.perfect + r.good} / ${r.notes.length}`, W - 164, y - 38, 13, '#ffe6ff', 'right', 800);
  if (r.chain >= 3) txt(`${r.chain} 연속!`, W / 2, y - 38, 16, '#ffd166', 'center', 900);
}
function drawTrap() {   // 그물: 가운데 연타 안내와 게이지
  const g = P.trap.g, y = H * 0.66;
  panel(W / 2 - 150, y - 46, 300, 92, 18);
  txt('연타! 연타!', W / 2, y - 12, 30, Math.floor(T * 8) % 2 ? '#7ff0dc' : '#ffffff', 'center', 900);
  segBar(W / 2 - 120, y + 6, 240, 16, g, '#2fb3a8', '#bffff0', 10);
  txt(`${Math.max(0, 7 - P.trap.t).toFixed(1)}초 뒤 저절로 풀리지만 다친다`, W / 2, y + 40, 11, '#b9c8dc', 'center', 600);
  for (let i = 0; i < 3; i++) {   // 손가락 표시
    const a = T * 10 + i * 2.1, s = 1 + Math.sin(a) * 0.2;
    ctx.globalAlpha = 0.5 + Math.sin(a) * 0.3; txt('👆', W / 2 + (i - 1) * 70, y + 90, 28 * s, '#fff', 'center', 400); ctx.globalAlpha = 1;
  }
}
function drawHud() {
  segBar(0, 0, W, 6, run.xp / run.xpNeed, '#2be38a', '#9dffcf');
  panel(10, 14, 118, 52, 12);
  const badge = { stage: ['STAGE', stLabel(run.stage)], endless: ['WAVE', String(run.wave)], rush: ['BOSS', `${run.bossIdx + 1}/5`], auto: ['ZONE', String(run.stage)] }[run.mode] || ['LEVEL', String(run.stage)];
  txt(badge[0], 22, 32, 11, '#ffd166', 'left', 800);
  txt(badge[1], 22, 58, 26, '#ffffff', 'left', 900);
  if (run.mode === 'auto') {
    rrect(10, 72, 118, 22, 11); ctx.fillStyle = Math.floor(T * 2) % 2 ? 'rgba(43,227,138,.85)' : 'rgba(30,160,100,.85)'; ctx.fill();
    txt('⭐ 표창 공방', 69, 88, 12, '#04120a', 'center', 900);
  }
  txt(`Lv ${run.level}`, 118, 32, 12, '#9dffcf', 'right', 800);
  txt(D.THEMES[run.theme].name, 118, 56, 11, '#b9c8dc', 'right', 600);
  panel(W - 150, 14, 140, 52, 12);
  txt('SCORE', W - 138, 32, 11, '#ffd166', 'left', 800);
  txt(run.score.toLocaleString(), W - 20, 58, 20, '#ffffff', 'right', 900);
  txt(`🔩${run.scrapGot}`, W - 20, 32, 12, '#ffe7a3', 'right', 700);
  drawItemHud();
  const cx = 140, cw = W - 300;
  if (run.keeper) drawKeeperHud();
  else if (run.phase === 'waves') {
    const prog = run.mode === 'endless' ? 1 - (run.nextBoss - run.t) / 90 : run.t / run.waveDur;
    segBar(cx, 26, cw, 9, prog, '#3f7dd6', '#9fd0ff', 10);
    if (isFinite(run.waveDur)) {   // 이번 판에 올 일: ⑂ 갈림길, ♪ 리듬 결투, ★ 황금 수송선
      const mark = (t0, s, c) => { if (t0) txt(s, cx + cw * Math.min(1, t0 / run.waveDur), 22, 13, c, 'center', 900); };
      if (!run.rushDone) mark(run.rushAt, '♪', '#ff7ad9');
      mark(run.gateAt, '⑂', '#9dffcf'); mark(run.treasureAt, '★', '#ffd166');
    }
    txt(run.arena ? '대장까지' : run.mode === 'stage' ? { boss: '챕터 보스까지', scout: '보스 선발대까지', leader: '정예 편대까지' }[stageEnd(run.stage)] : '보스까지', W / 2, 54, 12, '#cfe0f5', 'center', 700);
  } else if (run.phase === 'warning') txt('⚠ WARNING ⚠', W / 2, 46, 24, Math.floor(T * 6) % 2 ? '#ff4d4d' : '#ffd166', 'center', 900);
  else if (run.leaderE && !run.leaderE.dead) { const e = run.leaderE; segBar(cx - 4, 24, cw + 8, 12, e.hp / e.maxHp, '#ff3d5a', '#ff9a6b', 10); txt('정예 편대 대장', W / 2, 56, 13, '#ffd0d0', 'center', 800); }
  else if (boss) {
    const hp = boss.parts.reduce((s, p) => s + Math.max(0, p.hp), 0), mx = boss.parts.reduce((s, p) => s + p.maxHp, 0);
    segBar(cx - 4, 24, cw + 8, 12, hp / mx, '#ff3d5a', '#ff9a6b', 10);
    txt(boss.def.name, W / 2, 56, 13, '#ffd0d0', 'center', 800);
  }
  if (run.combo >= 2) {
    const k = clamp(run.comboT / 2.5, 0, 1), y = 168;
    ctx.globalAlpha = 0.4 + k * 0.6;
    txt(`${run.combo}`, W - 22, y, 34, '#ffd166', 'right', 900);
    txt('COMBO', W - 22, y + 18, 12, '#ffe7a3', 'right', 800);
    txt(`×${comboMul().toFixed(2)}`, W - 22, y + 34, 12, '#b9c8dc', 'right', 700);
    segBar(W - 92, y + 42, 70, 4, k, '#ffd166', '#fff3c4');
    ctx.globalAlpha = 1;
  }
  if (run.dangerT > 0) txt(`⚠ 위험 항로 ${Math.ceil(run.dangerT)}초 · 보상 ×2`, W / 2, 84, 14, '#ff8a8a', 'center', 900);
  if (run.beatBuff > 1) txt(`♪ 피해 +${Math.round((run.beatBuff - 1) * 100)}%`, 20, 120, 12, '#ffb3f5', 'left', 800);
  const low = P.hp < P.maxHp * 0.3;
  ctx.save(); if (S.lefty) ctx.translate(W - 230, 0);   // 왼손 모드: 체력 줄을 오른쪽으로
  if (run.mode === 'auto' && run.phase === 'rest') ctx.translate(0, -(H * 0.46));   // 표창 공방: 아래 칸 위로
  panel(10, H - 58, 210, 44, 12);
  txt('❤', 22, H - 30, 18, low ? '#ff5d5d' : '#ff8a8a', 'left', 900);
  segBar(46, H - 44, 162, 12, P.hp / P.maxHp, low ? '#ff3d3d' : '#3fd97a', low ? '#ff8a6b' : '#b8ffb0', Math.max(1, Math.round(P.maxHp / 20)));
  txt(`${Math.ceil(P.hp)} / ${P.maxHp}`, 208, H - 20, 11, '#dfe8f2', 'right', 700);
  ctx.restore();
  if (run.rush) drawRush();
  if (P.trap) drawTrap();
  if (run.rushSum) {
    const k = Math.min(1, (2.4 - run.rushSum.t) * 3);
    ctx.globalAlpha = k; panel(W / 2 - 170, H * 0.62 - 34, 340, 64, 16);
    txt(run.rushSum.text, W / 2, H * 0.62 - 6, 16, '#ffe6ff', 'center', 900); txt(run.rushSum.sub, W / 2, H * 0.62 + 18, 13, '#ffe7a3', 'center', 700); ctx.globalAlpha = 1;
  }
  const v = Math.max(run.hurtT / 0.6, low ? 0.35 + Math.sin(T * 6) * 0.15 : 0);
  if (v > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(220,20,40,${0.55 * v})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const b = run.banner;
  if (b) {
    const inK = clamp(b.t / 0.3, 0, 1), outK = clamp((b.life - b.t) / 0.4, 0, 1), k = Math.min(inK, outK);
    const y = b.kind === 'ult' ? H * 0.6 : b.kind === 'trap' ? H * 0.46 : H * 0.36, h = b.kind === 'boss' ? 130 : b.kind === 'chapter' ? 176 : 96;
    ctx.save(); ctx.globalAlpha = k;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    const c = { boss: '120,10,20', ult: '90,60,0', rush: '90,10,90', trap: '10,70,70', chapter: '6,14,40' }[b.kind] || '10,30,70';
    g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.2, `rgba(${c},.85)`); g.addColorStop(0.8, `rgba(${c},.85)`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, y - h / 2, W, h);
    if (b.kind === 'boss') {   // 경고 줄무늬
      ctx.save(); ctx.beginPath(); ctx.rect(0, y - h / 2, W, 12); ctx.rect(0, y + h / 2 - 12, W, 12); ctx.clip();
      ctx.fillStyle = '#ffd166'; ctx.fillRect(0, y - h / 2, W, h);
      ctx.fillStyle = '#1a1a1a'; for (let x = -40 + (T * 80) % 40; x < W + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + 20, y - h / 2); ctx.lineTo(x + 20 - 130, y + h / 2); ctx.lineTo(x - 130, y + h / 2); ctx.fill(); }
      ctx.restore();
    }
    const slide = (1 - inK) * 120;
    const col = { ult: '#ffe066', rush: '#ffb3f5', trap: '#7ff0dc' }[b.kind] || '#ffffff';
    if (b.kind === 'chapter') {   // 0.61 챕터 첫 판: 금빛 선과 「CHAPTER n」
      ctx.fillStyle = 'rgba(255,209,102,.9)'; const lw = Math.min(1, b.t / 0.8) * W * 0.36; ctx.fillRect(W / 2 - lw, y - h / 2 + 6, lw * 2, 2); ctx.fillRect(W / 2 - lw, y + h / 2 - 8, lw * 2, 2);
      txt(`CHAPTER ${b.ch}`, W / 2 - slide, y - 40, 18, '#ffd166', 'center', 800);
    }
    txt(b.title, W / 2 + slide, y + (b.sub ? 4 : 14), b.kind === 'stage' || b.kind === 'rush' || b.kind === 'chapter' ? 44 : 34, col, 'center', 900);
    if (b.sub) txt(b.sub, W / 2 - slide, y + 32, 15, '#e8eef7', 'center', 600);
    ctx.restore();
  }
}
function updateUltBtn() {
  const eb = $('emoBtn'), coopOn = !!(run.coop && net);
  if (eb.classList.contains('hidden') === coopOn) eb.classList.toggle('hidden', !coopOn);
  const b = $('ultBtn'), p = Math.floor(P.ult);
  b.style.setProperty('--p', p);
  b.classList.toggle('ready', p >= 100);
  const html = p >= 100 ? `<b>${st.F.ult.name}</b><small>누르기!</small>` : `<b>${p}%</b><small>궁극기</small>`;
  if (b.dataset.h !== html) { b.dataset.h = html; b.innerHTML = html; }
  const kb = $('skillBtn'), showK = skillOn() && state === 'play';   // 💣 중간 스킬 버튼: 폭탄 수와 기체의 기술
  if (kb.classList.contains('hidden') === showK) kb.classList.toggle('hidden', !showK);
  if (showK) {
    const K = SKILL[st.F.id] || SKILL.phoenix, kh = `<b>${K.icon}</b><small>${'●'.repeat(P.bombs)}${'○'.repeat(SKILL.max - P.bombs)}</small>`;
    if (kb.dataset.h !== kh) { kb.dataset.h = kh; kb.innerHTML = kh; kb.title = `${K.name}: ${K.desc} (X·C 키)`; }
    kb.classList.toggle('cd', P.bombs <= 0 || P.skCd > 0);
  }
  const tb = $('throwBtn'), showT = !!(run.arena && run.phase !== 'rest');   // 표창 공방: 🌀 던지기
  if (tb.classList.contains('hidden') === showT) tb.classList.toggle('hidden', !showT);
  if (showT) { const cd = Math.max(0, run.throwCd || 0); tb.style.setProperty('--p', Math.round(100 - cd / THROW_CD * 100)); tb.classList.toggle('cd', cd > 0); }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-8, 8) * shake, rnd(-8, 8) * shake);
  if (state === 'hangar' || !run) {
    drawBg(stageTheme(hangarStage));
    ctx.fillStyle = 'rgba(4,8,18,.25)'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return;
  }
  drawBg(run.theme);
  ctx.save(); ctx.translate(-cam.x, -cam.y);   // 표창 공방: 화면이 로봇을 따라간다
  if (run.arena) drawArenaFloor();
  drawFlak(); drawCols();
  drawDrops();
  drawGates();
  for (const e of foes) if (e.type !== 'boss') {
    if (e.type === 'm8' && e.mode === 'aim') { ctx.strokeStyle = `rgba(255,80,80,${0.4 + 0.4 * Math.sin(T * 20)})`; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(e.x, e.y + 20); ctx.lineTo(e.x, H); ctx.stroke(); ctx.setLineDash([]); }   // 연 기사 돌격 경고
    if (e.type === 'm7' && !e.seen) ctx.globalAlpha = 0.2;   // 숲에 숨은 딱정벌레
    drawFoe(e); ctx.globalAlpha = 1;
  }
  drawBoss();
  drawShots();
  drawHazards(false);
  drawObst(false); drawPlayer(); drawObst(true); drawFinger();
  drawEbul();
  drawLasers();
  drawFx();
  if (!run.arena) drawHazards(true);
  drawNums(); drawTut();
  ctx.restore();
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgba(255,250,235,${flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  drawHud();
  updateUltBtn();
  if (state === 'duel') Duel.draw(ctx, T);
  if (net && net.mode === 'guest' && run.cardWait) { panel(W / 2 - 170, H * 0.45 - 30, 340, 60, 16); txt(run.cardWait === 2 ? '방장이 잠깐 멈췄어요' : '방장이 카드를 고르는 중…', W / 2, H * 0.45 + 8, 18, '#ffe7a3', 'center', 800); }
}

