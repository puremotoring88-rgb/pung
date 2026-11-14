// 볼트윙 게임 본체 (친구와 함께·탈출 경주) — js/game/ 파일들과 js/game.js는 한 이름 공간을 나눠 쓴다(index.html에 적힌 순서대로 읽음).
'use strict';
// ---------- 친구와 함께(협동, 2~3명) ----------
// 방장의 기기가 판 전체를 계산하고, 친구는 자기 위치·궁극기만 보낸다. 방장은 1초에 20번 화면 상태를 보내 준다.
let net = null, coopMsg = '', coopMd = 'stage', foeSeq = 0, joinCode = '';
const netEv = [], allies = [];
const COOP_MAX = 3, PEER_PFX = 'skybot-v1-', ALLY_COL = ['#7fd8ff', '#ff9ad5'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanName = s => String(s || '').replace(/[<>&"'\n\r\t]/g, '').trim().slice(0, 8) || '조종사';
const myNick = () => { if (!S.nick) { S.nick = '조종사' + ((Math.random() * 900 + 100) | 0); save(); } return S.nick; };
// 소리·음악도 친구 화면에서 같이 나게(무기 발사음처럼 너무 잦은 소리는 빼고)
const rawSfx = A.sfx, rawMusic = A.music, QUIET = new Set(['vulcan', 'spread', 'laser', 'missile', 'drone', 'xp', 'scrap', 'click', 'hit']);
A.sfx = (n, ...r) => { if (net && net.mode === 'host' && !QUIET.has(n)) netEv.push(['a', n]); return rawSfx(n, ...r); };
A.music = (mood, th) => { if (net && net.mode === 'host' && state !== 'hangar') netEv.push(['m', mood, th]); return rawMusic(mood, th); };

function nearestShip(x, y) {
  let best = P, bd = P && !(P.down > 0) ? Math.hypot(P.x - x, P.y - y) : 1e9;
  if (net && net.mode === 'host') for (const a of allies) if (!(a.down > 0)) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } }
  return best || { x: W / 2, y: H };
}
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res; s.onerror = () => rej(new Error('연결 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    document.head.append(s);
  });
}
function netBroadcast(m) { if (net && net.mode === 'host') for (const a of allies) { try { if (a.conn.open) a.conn.send(m); } catch (e) { /* 끊긴 친구 */ } } }
function netEndOnce(win) {
  if (!(net && net.mode === 'host' && run && run.coop) || run.netEnded) return;
  run.netEnded = true;
  const sh = coopShare();
  const me = sh.find(x => x.id === 'host');   // 방장: 판에서 주운 고철을 내 몫으로 바꾼다(기여도가 낮으면 줄 수도 있다)
  S.scrap = Math.max(0, S.scrap + me.scrap - run.scrapGot); run.scrapGot = me.scrap;
  if (me.cores) addCores(me.cores);
  run.share = sh;
  netBroadcast({ t: 'end', win, stage: run.stage, mode: run.mode, score: run.score, scrap: run.scrapGot, kills: run.kills, wave: run.wave, parts: allies.map(a => [a.id, a.parts || 0]),
    sh: sh.map(x => [x.id, x.name, x.pct, x.scrap, x.cores]) });
}
// 0.64 함께 한 판의 보상: 모두 받고, 기여도(실제로 깎은 적 체력의 몫)에 따라 0.5배~ 더 받는다
const COOP_RW = { base: 0.5 };   // 똑같이 나누는 부분. 나머지 0.5는 기여도대로(2명이 50:50이면 둘 다 1배, 70:30이면 1.2배·0.8배)
function coopShare() {
  const ppl = [{ id: 'host', name: myNick() }, ...allies.map(a => ({ id: a.id, name: a.name }))], n = ppl.length;
  const D0 = run.dmgBy || {}, tot = ppl.reduce((s, p) => s + (D0[p.id] || 0), 0);
  const pool = run.scrapGot, cores = run.teamCores || 0;
  return ppl.map(p => {
    const share = tot > 0 ? (D0[p.id] || 0) / tot : 1 / n, k = COOP_RW.base + (1 - COOP_RW.base) * n * share;
    return { id: p.id, name: p.name, pct: Math.round(share * 100), k, scrap: Math.round(pool * k), cores: cores ? Math.max(1, Math.round(cores * k)) : 0 };
  });
}
const shareHtml = (rows, myId) => rows && rows.length > 1 ? `<div class="coopShare"><b>🤝 기여도</b>${rows.map(r => `<span class="${r[0] === myId ? 'me' : ''}"><em>${esc(r[1])}</em><i><b style="width:${r[2]}%"></b></i>${r[2]}% · 🔩${r[3]}${r[4] ? ` 💠${r[4]}` : ''}</span>`).join('')}<small>모두 받고, 적을 많이 맞힌 만큼 더 받아요.</small></div>` : '';
const roster = () => [{ name: myNick(), host: true }, ...allies.map(a => ({ name: a.name }))];
// 0.61 휴대폰에서 카톡 등 다른 앱에 다녀오면 브라우저가 게임을 잠재우고 연결 서버와의 줄이 끊긴다 → 방을 닫지 않고 같은 코드로 다시 잇는다
const PEER_SOFT = ['network', 'socket-error', 'socket-closed', 'server-error', 'disconnected'];
let rejoinCode = null, visAt = 0;
function peerRetry(peer) {
  if (!net || net.peer !== peer || peer.destroyed) return;
  net.retry = (net.retry || 0) + 1;
  if (net.retry > 12) { netFail('연결이 끊겼어요. 방을 다시 만들어 주세요.'); return; }
  net.status = '연결을 다시 잇는 중…'; if (state === 'hangar') renderHangar();
  setTimeout(() => { if (net && net.peer === peer && peer.disconnected && !peer.destroyed && !document.hidden) { try { peer.reconnect(); } catch (e) { /* 다음에 다시 */ } } }, 1500);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  visAt = Date.now();
  if (net && net.peer && net.peer.disconnected && !net.peer.destroyed) { try { net.peer.reconnect(); } catch (e) { /* 무시 */ } }
  if (rejoinCode && !net) { const c = rejoinCode; rejoinCode = null; setTimeout(() => joinRoom(c), 600); }
});
function netFail(msg) { coopMsg = msg; const wasGuest = net && net.mode === 'guest'; leaveRoom(); if (wasGuest && state !== 'hangar') showHangar(); else if (state === 'hangar') renderHangar(); }
function leaveRoom() {
  if (!net) return;
  const n = net; net = null;
  try { if (n.mode === 'guest' && n.conn && n.conn.open) n.conn.send({ t: 'bye' }); if (n.mode === 'host') for (const a of allies) if (a.conn.open) a.conn.send({ t: 'closed' }); } catch (e) { /* 무시 */ }
  setTimeout(() => { try { n.peer.destroy(); } catch (e) { /* 무시 */ } }, 300);
  allies.length = 0;
}

// --- 방장 ---
async function hostRoom(pub) {
  leaveRoom(); coopMsg = '';
  try { await loadPeer(); } catch (e) { coopMsg = e.message; renderHangar(); return; }
  const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random() * 32) | 0]).join('');
  const peer = new window.Peer(PEER_PFX + code);
  net = { mode: 'host', peer, code, pub: !!pub, status: '방을 여는 중…', snapT: 0 };
  renderHangar();
  peer.on('open', () => { if (net && net.peer === peer) { net.retry = 0; net.status = '친구를 기다리는 중'; renderHangar(); } });
  peer.on('disconnected', () => peerRetry(peer));
  peer.on('error', e => { if (net && net.peer === peer && PEER_SOFT.includes(e.type)) { peerRetry(peer); return; } if (net && net.peer === peer) netFail(e.type === 'unavailable-id' ? '방 코드가 겹쳤어요. 다시 만들어 주세요.' : `연결 오류(${e.type}). 잠시 뒤 다시 해 보세요.`); });
  peer.on('connection', c => {
    c.on('data', m => hostData(c, m));
    c.on('close', () => dropAlly(c));
    c.on('error', () => dropAlly(c));
  });
}
function hostData(c, m) {
  if (!net || net.mode !== 'host' || !m || typeof m !== 'object') return;
  let a = allies.find(x => x.conn === c);
  if (m.t === 'hi') {
    if (a) return;
    const playing = run && (state === 'play' || state === 'cards' || state === 'pause' || state === 'duel');
    if (allies.length >= COOP_MAX - 1 || playing) { c.send({ t: 'full', why: playing ? '방장이 지금 게임 중이에요. 판이 끝나면 다시 들어와 주세요.' : '방이 꽉 찼어요(최대 3명).' }); setTimeout(() => c.close(), 600); return; }
    const k = m.card || {}, num = (v, a0, b0, d) => (typeof v === 'number' && isFinite(v) ? clamp(v, a0, b0) : d);
    const F = frameOf(k.frame) || D.FRAMES[0], Wp = weaponOf(k.weapon) || D.WEAPONS[0];
    const used = allies.map(x => x.color);
    a = { id: c.peer, conn: c, name: cleanName(m.name), frame: F.id, wp: Wp, dmg: num(k.dmg, 1, Wp.dmg * 4, Wp.dmg), rate: num(k.rate, 1, Wp.rate * 2, Wp.rate),
      look: cleanLook(k.look), speed: num(k.speed, 0.6, 2, 1), hit: num(k.hit, 4, 16, 8), maxHp: Math.round(num(k.maxHp, 50, 400, 100)), color: ALLY_COL.find(x => !used.includes(x)) || ALLY_COL[0],
      x: W / 2, y: H - 190, tx: W / 2, ty: H - 190, lx: W / 2, bank: 0, hp: 100, inv: 0, ult: 0, fireT: 0, down: 0, parts: 0, swarm: 0, swT: 0, bombs: SKILL.start, skCd: 0 };
    a.hp = a.maxHp;
    allies.push(a);
    c.send({ t: 'welcome', id: c.peer, roster: roster() });
    netBroadcast({ t: 'roster', roster: roster() });
    A.sfx('part'); coopMsg = `${a.name} 님이 들어왔어요!`;
    if (state === 'hangar') renderHangar();
    return;
  }
  if (!a) return;
  if (m.t === 'in' && typeof m.x === 'number' && typeof m.y === 'number') { a.tx = clamp(m.x, 22, W - 22); a.ty = clamp(m.y, 90, H - 70); }
  else if (m.t === 'ult') allyUlt(a);
  else if (m.t === 'skill') allySkill(a);
  else if (m.t === 'ep') a.esc = escClean(m);   // 탈출 작전 같이 달리기: 친구 자리
  else if (m.t === 'eev' && m.e && ESC_EV.includes(m.e.k)) { if (m.to === 'host') Escape.netEvent(a.id, { k: m.e.k }); else { const b = allies.find(x => x.id === m.to); if (b && b.conn.open) b.conn.send({ t: 'eev', from: a.id, e: { k: m.e.k } }); } }
  else if (m.t === 'emo') emote(a, m.i);
  else if (m.t === 'bye') dropAlly(c);
}
function dropAlly(c) {
  const i = allies.findIndex(a => a.conn === c);
  if (i < 0) return;
  const a = allies.splice(i, 1)[0];
  try { c.close(); } catch (e) { /* 무시 */ }
  coopMsg = `${a.name} 님이 나갔어요`;
  if (run && state !== 'hangar') say(coopMsg, W / 2, H * 0.3, '#ffb3b3', 18, 1.6);
  netBroadcast({ t: 'roster', roster: roster() });
  if (state === 'hangar') renderHangar();
}
function coopBegin() {
  run.coop = true; run.rushDone = true;   // 협동에서는 리듬 결투를 쉰다(한 사람만 하게 되므로)
  run.teamK = 1 + 0.55 * allies.length; run.rescues = 0; run.teamUlts = 0;   // 사람이 많으면 적도 튼튼하게
  allies.forEach((a, i) => Object.assign(a, { x: W / 2 + (i ? 120 : -120), y: H - 170, tx: W / 2 + (i ? 120 : -120), ty: H - 170, lx: W / 2, hp: a.maxHp, down: 0, inv: 2, ult: 0, fireT: 0.3, parts: 0, swarm: 0, bank: 0 }));
  net.lastBn = null; net.snapT = 0; netEv.length = 0;
  netBroadcast({ t: 'start', stage: run.stage, mode: run.mode, roster: roster() });
}
function allyHurt(a, dmg) {
  if (SKY.god || a.inv > 0 || a.down > 0 || run.phase === 'dead' || run.phase === 'clear') return;
  if (a.orb) { a.orb = 0; a.inv = 0.8; ringFx(a.x, a.y, 46, ITEMS.orb.c); return; }
  a.hp -= dmg * (run.dmgTaken || 1); a.inv = 1.1;
  spark(a.x, a.y, 14, '#ff6b6b', 240, 0.45, 3);
  if (a.hp <= 0) {
    a.hp = 0; a.down = DOWN_T; a.wx = a.x; a.wy = a.y; a.resc = 0;
    explode(a.x, a.y, 60, a.color); say(`${a.name} 격추! 가까이 가서 구해 주세요`, a.x, a.y - 50, '#ff9a9a', 18, 1.8);
  }
}
// --- 함께여서 생기는 것: 구출, 연결 빔, 합동 궁극기, 짧은 말 ---
const DOWN_T = 10, LINK_R = 200, EMOTES = ['👍 좋아!', '🆘 살려줘!', '🙏 고마워!', '➡️ 이쪽으로!', '😂 ㅋㅋㅋ', '🔥 가즈아!'];
function cleanLook(o) { o = o && typeof o === 'object' ? o : {}; const r = {}; for (const c of Object.keys(LOOKS)) r[c] = LOOKS[c].list.some(x => x[0] === o[c]) ? o[c] : 'none'; r.tier = clamp(o.tier | 0, 0, TIERS.length - 1); return r; }
const lookStr = L => [L.paint, L.flame, L.trail, L.decal, L.tier || 0].join('|');
const lookParse = s => { const [paint, flame, trail, decal, tier] = String(s || '').split('|'); return cleanLook({ paint, flame, trail, decal, tier: +tier || 0 }); };
const shipsAlive = () => [P, ...allies].filter(s => s && !(s.down > 0));
const segDist = (px, py, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1, k = clamp(((px - a.x) * dx + (py - a.y) * dy) / L, 0, 1); return Math.hypot(px - a.x - dx * k, py - a.y - dy * k); };
function linkPairs() {   // 가까이 붙어 나는 두 기체 사이에 연결 빔이 생긴다
  const sh = shipsAlive(), out = [];
  if (sh.length < 2 || !run || run.phase === 'dead') return out;
  for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) { const d = Math.hypot(sh[i].x - sh[j].x, sh[i].y - sh[j].y); if (d > 36 && d < LINK_R) out.push([sh[i], sh[j]]); }
  return out;
}
function reviveShip(d, by) {
  d.down = 0; d.hp = Math.round(d.maxHp * (by ? 0.6 : 0.5)); d.inv = 2.5; d.resc = 0;
  if (d !== P) { d.x = d.tx; d.y = d.ty; }
  const nm = d === P ? myNick() : d.name, c = d === P ? '#ffd166' : d.color;
  ringFx(d.x, d.y, 70, c);
  if (by) { run.rescues = (run.rescues || 0) + 1; say(`💚 ${by.name || myNick()}이(가) ${nm}을(를) 구했다!`, W / 2, H * 0.36, '#9dffcf', 20, 1.8); A.sfx('heal'); }
  else say(`${nm} 복귀!`, d.x, d.y - 50, c, 18, 1.2);
}
function teamUlt(who) {   // 3초 안에 두 사람이 궁극기를 쓰면 합동 궁극기
  if (!run.coop) return;
  if (run.lastUlt && run.lastUlt.who !== who && run.t - run.lastUlt.t < 3) {
    run.lastUlt = null; run.teamUlts = (run.teamUlts || 0) + 1;
    run.banner = { kind: 'ult', title: '🤝 합동 궁극기!', sub: '둘이 맞추면 더 세다', t: 0, life: 1.6 };
    flash = Math.max(flash, 0.9); shake = Math.max(shake, 1); A.sfx('ult_nova');
    for (const b of ebul) drops.push({ kind: 'scrap', x: b.x, y: b.y, vy: 30, v: 1, small: true });
    ebul = [];
    for (const e of foes.slice()) if (!e.harmless) hitFoe(e, 220 * ultPow() * (e.isBoss ? 0.6 : 1));
    for (const s of shipsAlive()) ringFx(s.x, s.y, 200, '#ffe066');
  } else run.lastUlt = { who, t: run.t };
}
function emote(s, i) {
  i = i | 0; if (!EMOTES[i] || !run || state === 'hangar') return;
  if (s.emoT && performance.now() - s.emoT < 1500) return;   // 너무 자주는 못 보낸다
  s.emoT = performance.now();
  const nm = s === P ? myNick() : s.name;
  say(`${nm}: ${EMOTES[i]}`, clamp(s.x, 90, W - 90), s.y - 70, s === P ? '#ffd166' : s.color, 17, 1.8);
}
function sendEmote(i) {
  if (!(net && run && run.coop)) return;
  if (net.mode === 'guest') { if (net.conn && net.conn.open) net.conn.send({ t: 'emo', i }); }
  else emote(P, i);
  A.sfx('click'); $('emoBar').classList.add('hidden');
}
function coopTick(dt) {   // 방장만 계산한다
  for (const [a, b] of linkPairs()) {
    for (const e of foes) if (!e.dead && !e.inv && !e.harmless && segDist(e.x, e.y, a, b) < e.r + 6) hitFoe(e, 55 * ultPow() * dt * (e.isBoss ? 0.5 : 1), a === P ? null : a);
    for (const q of ebul) if (!q.dead && !q.net && segDist(q.x, q.y, a, b) < q.r + 4) { q.dead = true; spark(q.x, q.y, 3, '#9dffcf', 120, 0.25, 2); }
  }
  ebul = ebul.filter(q => !q.dead);
  for (const d of [P, ...allies]) {   // 구출: 격추된 친구 곁에 1.2초 머물면 바로 일으켜 세운다
    if (!(d.down > 0)) { d.resc = 0; continue; }
    const by = shipsAlive().find(s => Math.hypot(s.x - d.wx, s.y - d.wy) < 70);
    d.resc = by ? (d.resc || 0) + dt : Math.max(0, (d.resc || 0) - dt * 0.5);
    if (d.resc >= 1.2) reviveShip(d, by);
  }
}
function drawCoopLinks() {   // 방장·친구 화면 모두
  if (!run || !run.coop) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const [a, b] of linkPairs()) {
    const d = Math.hypot(a.x - b.x, a.y - b.y), al = 0.35 + 0.35 * (1 - d / LINK_R) + Math.sin(T * 20) * 0.1;
    ctx.strokeStyle = `rgba(157,255,207,${al})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const d of [P, ...allies]) {   // 격추된 자리: 구조 신호
    if (!(d && d.down > 0) || d.wx === undefined) continue;
    const pulse = 1 + Math.sin(T * 8) * 0.12;
    ctx.strokeStyle = 'rgba(255,154,154,.5)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(d.wx, d.wy, 70, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (d.resc > 0) { ctx.strokeStyle = '#9dffcf'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(d.wx, d.wy, 34, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, d.resc / 1.2)); ctx.stroke(); }
    ctx.font = `${26 * pulse}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🆘', d.wx, d.wy); ctx.textBaseline = 'alphabetic';
  }
}
function allyUlt(a) {
  if (a.ult < 100 || a.down > 0 || state !== 'play' || run.phase === 'dead' || run.phase === 'clear') return;
  a.ult = 0; a.swarm = 18; teamUlt(a.id);
  ebul = ebul.filter(b => Math.hypot(b.x - a.x, b.y - a.y) > 150);
  ringFx(a.x, a.y, 150, a.color); say(`${a.name}의 궁극기!`, a.x, a.y - 60, a.color, 20, 1.2); A.sfx('charge'); flash = Math.max(flash, 0.25);
}
function updateAllies(dt) {
  const fighting = run.phase !== 'dead' && run.phase !== 'clear';
  for (const a of allies) {
    if (a.down > 0) {
      if ((a.down -= dt) <= 0) reviveShip(a, null);
      continue;
    }
    const mv = 900 * a.speed * run.m.speed * dt, dx = a.tx - a.x, dy = a.ty - a.y, dl = Math.hypot(dx, dy);
    if (dl > mv) { a.x += dx / dl * mv; a.y += dy / dl * mv; } else { a.x = a.tx; a.y = a.ty; }
    a.bank += (clamp((a.x - a.lx) / Math.max(dt, 0.001) / 600, -1, 1) - a.bank) * Math.min(1, dt * 10); a.lx = a.x;
    if (a.inv > 0) a.inv -= dt;
    a.ult = Math.min(100, a.ult + 100 / FEEL.ultSec * dt); if (a.skCd > 0) a.skCd -= dt;
    if (fighting) {
      a.fireT -= dt;
      while (a.fireT <= 0) { fire(a, a.wp, a.dmg); a.fireT += 1 / (a.rate * run.m.rate * (run.evo && a.wp.id === 'vulcan' ? 2 : 1)); }
      if (a.swarm > 0 && (a.swT -= dt) <= 0) { a.swT = 0.04; a.swarm--; addShot(a.x + rnd(-20, 20), a.y, rnd(-320, 320), rnd(-260, -120), 22 * ultPow() * a.dmg / st.dmg, { homing: true, r: 6, color: '#ffe066', own: a }); }
    }
    for (const b of ebul) if (!b.dead && Math.hypot(a.x - b.x, a.y - b.y) < a.hit + b.r) { b.dead = true; allyHurt(a, run.d.dmg * (b.net ? 0.5 : 1)); }
    for (const l of lasers) {
      if (l.warn > 0) continue;
      const lx = a.x - l.x, ly = a.y - l.y, along = lx * Math.cos(l.a) + ly * Math.sin(l.a), perp = Math.abs(-lx * Math.sin(l.a) + ly * Math.cos(l.a));
      l.hitA = l.hitA || [];
      if (!l.hitA.includes(a.id) && along > 0 && perp < l.w / 2 + a.hit) { l.hitA.push(a.id); allyHurt(a, run.d.dmg * 1.6); }
    }
    for (const e of foes) if (!e.dead && !e.inv && !e.harmless && !(e.balloonT > 0) && Math.hypot(e.x - a.x, e.y - a.y) < e.r * 0.8 + a.hit) { allyHurt(a, run.d.dmg + 8); if (!e.isBoss) hitFoe(e, 30, a); }
    for (const d of drops) {
      if (d.dead || Math.hypot(a.x - d.x, a.y - d.y) > 34) continue;
      d.dead = true;
      if (d.kind === 'xp') { run.xp += d.v; A.sfx('xp'); }
      else if (d.kind === 'scrap') { gainScrap(d.v); A.sfx('scrap'); }
      else if (d.kind === 'heart') { a.hp = Math.min(a.maxHp, a.hp + d.v); say('+' + d.v, a.x, a.y - 40, '#6ee37a', 18); A.sfx('heal'); }
      else if (d.kind === 'item') useItem(d.id, a);
      else if (d.kind === 'up') takeUp(d.id, a);
      else if (d.kind === 'part') { a.parts++; say(`${a.name} 부품 획득!`, a.x, a.y - 50, '#ffd166', 18, 1.4); A.sfx('part'); }
    }
  }
  ebul = ebul.filter(b => !b.dead);
  if (P.down > 0 && (P.down -= dt) <= 0) reviveShip(P, null);
  if (P.down > 0 && run.phase !== 'dead' && allies.every(a => a.down > 0)) {   // 모두 격추되면 끝
    run.phase = 'dead'; run.endT = 2; A.sfx('boomL'); shake = 1.2; flash = 0.6;
  }
}
const r1 = v => Math.round(v), r2 = v => Math.round(v * 100) / 100;
function netTick(dt) {
  if (net.mode === 'guest') return;
  if (!run || !allies.length || !(state === 'play' || state === 'cards' || state === 'pause' || state === 'duel')) { netEv.length = 0; return; }
  if ((net.snapT -= dt) > 0) return;
  net.snapT = 0.05;
  const R = run, bn = R.banner && R.banner !== net.lastBn ? { kind: R.banner.kind, title: R.banner.title, sub: R.banner.sub, life: R.banner.life - R.banner.t } : null;
  net.lastBn = R.banner;
  const m = {
    t: 's', cw: state === 'cards' ? 1 : state === 'pause' ? 2 : 0, fl: r2(flash), sk: r2(shake), bn,
    r: { stage: R.stage, phase: R.phase, theme: R.theme, mode: R.mode, level: R.level, xp: r2(R.xp), xpNeed: R.xpNeed, score: R.score, scrapGot: R.scrapGot, combo: R.combo, comboT: r2(R.comboT),
      t: r2(R.t), waveDur: isFinite(R.waveDur) ? R.waveDur : -1, nextBoss: R.nextBoss, wave: R.wave, bossIdx: R.bossIdx, dangerT: r2(R.dangerT || 0), beatBuff: R.beatBuff || 1, gateAt: R.gateAt || 0, treasureAt: R.treasureAt || 0, msp: R.m.speed, it: TIMED.map(id => r2(R['it_' + id] || 0)), danceT: r2(R.danceT || 0) },
    p: [['host', r1(P.x), r1(P.y), r2(P.bank), r1(P.hp), P.maxHp, r2(P.down || 0), P.inv > 0 && P.inv < 50 ? 1 : 0, r1(P.ult), st.F.id, myNick(), '#ffd166', r2(P.twinT || 0), P.orb ? 1 : 0, lookStr(myLook()), r1(P.wx || 0), r1(P.wy || 0), r2(P.resc || 0), P.bombs || 0],
      ...allies.map(a => [a.id, r1(a.x), r1(a.y), r2(a.bank), r1(a.hp), a.maxHp, r2(a.down), a.inv > 0 ? 1 : 0, r1(a.ult), a.frame, a.name, a.color, r2(a.twinT || 0), a.orb ? 1 : 0, lookStr(a.look || {}), r1(a.wx || 0), r1(a.wy || 0), r2(a.resc || 0), a.bombs || 0])],
    f: foes.filter(e => !e.isBoss).slice(0, 120).map(e => [e.nid, e.type, r1(e.x), r1(e.y), r1(e.hp), r1(e.maxHp), e.flash > 0 ? 1 : 0, e.mod || 0, r1(e.sh || 0), r2(e.t), e.mode || 0, r1(e.vx || 0), r1(e.vy || 0), e.elite ? 1 : 0, e.r, e.balloonT > 0 ? 1 : 0, e.harmless ? 1 : 0]),
    b: boss ? { id: boss.def.id, t: r2(boss.t), p2: boss.p2 ? 1 : 0, inhale: r2(boss.inhale || 0), enraged: boss.enraged ? 1 : 0, mirror: r2(boss.mirror || 0), spin: r2(boss.spin || 0),
      parts: boss.parts.map(p => [r1(p.x), r1(p.y), p.r, r1(p.hp), r1(p.maxHp), p.dead ? 1 : 0, p.flash > 0 ? 1 : 0, p.dx || 0]) } : null,
    e: ebul.slice(0, 260).map(b => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.r, b.color, b.net ? 1 : 0, b.mine !== undefined ? r2(b.mine) : -1]),
    s: shots.slice(-220).map(s => [r1(s.x), r1(s.y), r1(s.vx), r1(s.vy), s.r, s.color, s.long ? 1 : 0, s.homing ? 1 : 0, s.star || 0]),
    d: drops.slice(0, 120).map(d => [d.kind, r1(d.x), r1(d.y), d.v, d.small ? 1 : 0, r1(d.vy || 0), d.id || 0]),
    l: lasers.map(l => [r1(l.x), r1(l.y), Math.round(l.a * 1000) / 1000, l.w, l.warn > 0 ? 1 : 0]),
    g: R.gates ? R.gates.map(g => [r1(g.x), r1(g.y), g.kind]) : null,
    ev: netEv.splice(0, 80),
  };
  netEv.length = 0;
  netBroadcast(m);
}

// --- 친구(참가자) ---
async function joinRoom(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { coopMsg = '방 코드는 5글자예요.'; renderHangar(); return; }
  leaveRoom(); coopMsg = '';
  try { await loadPeer(); } catch (e) { coopMsg = e.message; renderHangar(); return; }
  const peer = new window.Peer();
  net = { mode: 'guest', peer, code, status: '방을 찾는 중…', inT: 0, roster: [] };
  renderHangar();
  peer.on('open', id => {
    if (!net || net.peer !== peer) return;
    net.myId = id;
    const c = peer.connect(PEER_PFX + code, { reliable: true });
    net.conn = c;
    c.on('open', () => { const s = buildStats(); c.send({ t: 'hi', name: myNick(), card: { frame: S.frame, weapon: S.weapon, dmg: s.dmg, rate: s.rate, speed: s.speed, hit: s.hit, maxHp: s.maxHp, look: myLook() } }); });
    c.on('data', guestData);
    c.on('close', () => { if (!net || net.conn !== c) return; if (state === 'hangar' && (document.hidden || Date.now() - visAt < 5000)) { rejoinCode = net.code; leaveRoom(); coopMsg = '방장과 다시 잇는 중…'; renderHangar(); if (!document.hidden) { const k = rejoinCode; rejoinCode = null; setTimeout(() => joinRoom(k), 800); } return; } netFail('방장과 연결이 끊겼어요.'); });   // 0.61 다른 앱에 다녀오며 끊기면 다시 들어감
  });
  peer.on('error', e => { if (net && net.peer === peer && net.conn && net.conn.open && PEER_SOFT.includes(e.type)) { peerRetry(peer); return; } if (net && net.peer === peer) netFail(e.type === 'peer-unavailable' ? '그 코드의 방이 없어요. 코드를 다시 확인해 주세요.' : `연결 오류(${e.type}). 잠시 뒤 다시 해 보세요.`); });
}
function guestData(m) {
  if (!net || net.mode !== 'guest' || !m) return;
  if (m.t === 'welcome') { net.status = '방장이 출격을 누르면 함께 시작해요'; net.roster = m.roster || []; A.sfx('part'); if (state === 'hangar') renderHangar(); }
  else if (m.t === 'roster') { net.roster = m.roster || []; if (state === 'hangar') renderHangar(); }
  else if (m.t === 'full') netFail(m.why);
  else if (m.t === 'closed') netFail('방장이 방을 닫았어요.');
  else if (m.t === 'start') guestStart(m);
  else if (m.t === 's') applySnap(m);
  else if (m.t === 'end') guestEnd(m);
  else if (m.t === 'esc') escRaceGuest(m);
  else if (m.t === 'eev' && m.e && ESC_EV.includes(m.e.k)) Escape.netEvent(String(m.from), { k: m.e.k });
  else if (m.t === 'eps' && Array.isArray(m.l)) net.eps = m.l.slice(0, 3).map(p => [String(p[0]), cleanName(p[1]), ALLY_COL.concat('#ffd166').includes(p[2]) ? p[2] : '#9dffcf', escClean(p[3] || {})]);
}
function guestStart(m) {
  for (const id of ['away', 'howto']) $(id).classList.add('hidden');
  startRun(m.stage, m.mode === 'endless' ? 'endless' : 'stage');
  run.coop = true; run.rushDone = true; run.gateAt = 0; run.treasureAt = 0; run.spawnT = 1e9;
  allies.length = 0;
  net.roster = m.roster || net.roster;
}
function applySnap(m) {
  if (!run || !net || net.mode !== 'guest' || state === 'result' || state === 'hangar') return;
  const themeWas = run.theme;
  Object.assign(run, m.r);
  if (run.waveDur < 0) run.waveDur = Infinity;
  run.m.speed = m.r.msp || 1;
  if (m.r.it) TIMED.forEach((id, i) => { run['it_' + id] = m.r.it[i]; });
  if (run.theme !== themeWas) skyTheme = -1;
  if (m.bn) run.banner = Object.assign({ t: 0 }, m.bn);
  run.cardWait = m.cw;
  flash = Math.max(flash, m.fl || 0); shake = Math.max(shake, m.sk || 0);
  const old = new Map(allies.map(a => [a.id, a]));
  allies.length = 0;
  for (const s of m.p) {
    if (s[0] === net.myId) {
      if (s[4] < P.hp - 0.5) { run.hurtT = 0.6; A.sfx('hurt'); buzz(70); shake = Math.max(shake, 0.4); spark(P.x, P.y, 14, '#ff6b6b', 240, 0.45, 3); }
      if (s[6] > 0 && !(P.down > 0)) { explode(P.x, P.y, 60, st.F.color); A.sfx('boomL'); buzz([100, 50, 200]); }
      P.hp = s[4]; P.maxHp = s[5]; P.down = s[6]; P.inv = s[7] ? 0.2 : 0; P.ult = s[8];
      P.twinT = s[12] || 0; P.orb = s[13] || 0; P.wx = s[15]; P.wy = s[16]; P.resc = s[17] || 0; P.bombs = s[18] || 0;
      continue;
    }
    const o = old.get(s[0]);
    allies.push({ id: s[0], x: o ? o.x : s[1], y: o ? o.y : s[2], nx: s[1], ny: s[2], bank: s[3], hp: s[4], maxHp: s[5], down: s[6], inv: s[7], ult: s[8], frame: s[9], name: s[10], color: s[11],
      twinT: s[12] || 0, orb: s[13] || 0, look: o && o.lookS === s[14] ? o.look : lookParse(s[14]), lookS: s[14], wx: s[15], wy: s[16], resc: s[17] || 0, trT: o ? o.trT : 0, emoT: o ? o.emoT : 0 });
  }
  const fo = new Map(foes.map(e => [e.nid, e]));
  foes = m.f.map(f => { const o = fo.get(f[0]); return { nid: f[0], type: f[1], x: o ? o.x : f[2], y: o ? o.y : f[3], nx: f[2], ny: f[3], hp: f[4], maxHp: f[5], flash: f[6] ? 0.05 : 0, mod: f[7] || undefined, sh: f[8], t: f[9], mode: f[10] || undefined, vx: f[11], vy: f[12], elite: !!f[13], r: f[14], balloonT: f[15] ? 1 : 0, harmless: !!f[16] }; });
  if (m.b) {
    const def = D.BOSSES.find(b => b.id === m.b.id) || D.BOSSES[0], op = boss && boss.def === def ? boss.parts : [];
    boss = { def, t: m.b.t, p2: !!m.b.p2, inhale: m.b.inhale, enraged: !!m.b.enraged, mirror: m.b.mirror, spin: m.b.spin,
      parts: m.b.parts.map((p, i) => ({ x: op[i] ? op[i].x : p[0], y: op[i] ? op[i].y : p[1], nx: p[0], ny: p[1], r: p[2], hp: p[3], maxHp: p[4], dead: !!p[5], flash: p[6] ? 0.05 : 0, dx: p[7] })) };
  } else boss = null;
  ebul = m.e.map(b => { const o = { x: b[0], y: b[1], vx: b[2], vy: b[3], r: b[4], color: b[5] }; if (b[6]) { o.net = true; o.spin = T * 4; } if (b[7] >= 0) o.mine = b[7]; return o; });
  shots = m.s.map(s => ({ x: s[0], y: s[1], vx: s[2], vy: s[3], r: s[4], color: s[5], long: !!s[6], homing: !!s[7], star: s[8] || 0, t: 0 }));
  drops = m.d.map(d => ({ kind: d[0], x: d[1], y: d[2], v: d[3], small: !!d[4], vy: d[5], id: d[6] || undefined }));
  lasers = m.l.map(l => ({ x: l[0], y: l[1], a: l[2], w: l[3], warn: l[4] ? 1 : 0, dur: 1 }));
  run.gates = m.g ? m.g.map(g => ({ x: g[0], y: g[1], kind: g[2] })) : null;
  for (const ev of m.ev || []) {
    if (ev[0] === 'x') explode(ev[1], ev[2], ev[3], ev[4]);
    else if (ev[0] === 'r') ringFx(ev[1], ev[2], ev[3], ev[4]);
    else if (ev[0] === 's') say(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6]);
    else if (ev[0] === 'a') rawSfx(ev[1]);
    else if (ev[0] === 'm') rawMusic(ev[1], ev[2]);
  }
}
function guestTick(dt) {
  bgY += dt * 45; nearY += dt * 120;
  if (run.banner) { run.banner.t += dt; if (run.banner.t > run.banner.life) run.banner = null; }
  if (run.hurtT > 0) run.hurtT -= dt;
  if (!(P.down > 0)) {
    const ks = 420 * st.speed * run.m.speed * (run.hzSlow || 1) * (P.iceT > 0 ? 0.55 : 1);
    if (keys.ArrowLeft || keys.a) P.tx -= ks * dt;
    if (keys.ArrowRight || keys.d) P.tx += ks * dt;
    if (keys.ArrowUp || keys.w) P.ty -= ks * dt;
    if (keys.ArrowDown || keys.s) P.ty += ks * dt;
    P.tx = clamp(P.tx, 22, W - 22); P.ty = clamp(P.ty, 90, H - 70);
    const mv = 900 * st.speed * run.m.speed * dt, dx = P.tx - P.x, dy = P.ty - P.y, dl = Math.hypot(dx, dy);
    if (dl > mv) { P.x += dx / dl * mv; P.y += dy / dl * mv; } else { P.x = P.tx; P.y = P.ty; }
  }
  P.bank += (clamp((P.x - P.lx) / Math.max(dt, 0.001) / 600, -1, 1) - P.bank) * Math.min(1, dt * 10); P.lx = P.x;
  P.ga += dt * 3;
  const k = Math.min(1, dt * 14);
  for (const a of allies) { a.x += (a.nx - a.x) * k; a.y += (a.ny - a.y) * k; }
  for (const e of foes) { e.x += (e.nx - e.x) * k; e.y += (e.ny - e.y) * k; e.t += dt; if (e.flash > 0) e.flash -= dt; }
  if (boss) { boss.t += dt; for (const p of boss.parts) { p.x += (p.nx - p.x) * k; p.y += (p.ny - p.y) * k; if (p.flash > 0) p.flash -= dt; } }
  for (const s of shots) { s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt; }
  for (const b of ebul) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.net) b.spin += dt * 4; }
  for (const d of drops) d.y += d.vy * dt;
  if (run.gates) for (const g of run.gates) g.y += 85 * dt;
  trailFx(P, myLook(), dt); for (const a of allies) trailFx(a, a.look, dt);
  tickFx(dt);
  if ((net.inT -= dt) <= 0 && net.conn && net.conn.open) { net.inT = 0.05; net.conn.send({ t: 'in', x: r1(P.x), y: r1(P.y) }); }
}
function guestEnd(m) {
  if (!run || state === 'result') return;
  state = 'result'; $('hud').classList.add('hidden'); $('pause').classList.add('hidden');
  const mine = (m.parts.find(p => p[0] === net.myId) || [0, 0])[1];
  for (let i = 0; i < mine; i++) grantPart();
  const my = (m.sh || []).find(x => x[0] === net.myId), myScrap = my ? my[3] : m.scrap, myCores = my ? my[4] : 0;   // 0.64 기여도대로 받은 내 몫
  S.scrap += myScrap; if (myCores) addCores(myCores); S.coop = (S.coop || 0) + 1;
  const pxp = Math.round(m.score / 600 + m.kills * 0.35 + (m.win ? 25 : 0)), up = gainPilotXp(pxp);
  save(); rawSfx(m.win ? 'clear' : 'fail'); rawMusic('hangar', 0);
  $('rTitle').innerHTML = m.mode === 'endless' ? `<small>함께 · 무한 생존</small>WAVE ${m.wave}` : `<small>함께 · STAGE ${stLabel(m.stage)}</small>${m.win ? '클리어!' : '모두 격추'}`;
  $('rTitle').className = m.win ? 'win' : 'lose';
  $('rStars').innerHTML = '';
  $('rStats').innerHTML = [`<div class="big">${m.score.toLocaleString()}<small>점(팀)</small></div>`, `<div>팀 처치 <b>${m.kills}</b></div>`,
    `<div>받은 고철 🔩 <b>${myScrap}</b>${myCores ? ` · 💠 코어 <b>${myCores}</b>` : ''}</div>`, shareHtml(m.sh, net.myId), run.partsGot.length ? `<div class="gold">새 부품: ${run.partsGot.join(', ')}</div>` : '',
    `<div>조종사 경험치 +${pxp} · Lv ${S.pilot.lv} ${rankName(S.pilot.lv)}${up.ups ? ` <b class="gold">승급! 🔩+${up.reward}</b>` : ''}${up.opened && up.opened.length ? `<br><b class="gold">🔓 새로 열림: ${up.opened.join(', ')}</b>` : ''}</div>`,
    '<div class="rules">스테이지 별과 랭크는 혼자 할 때 기록됩니다. 방장이 다시 출격하면 자동으로 함께 시작해요.</div>'].filter(Boolean).join('');
  const btns = $('rBtns'); btns.innerHTML = '';
  const b = document.createElement('button'); b.className = 'btn big'; b.textContent = '방에서 기다리기';
  b.addEventListener('click', () => { A.sfx('click'); selMode = 'coop'; showHangar(); }); btns.append(b);
  const b2 = document.createElement('button'); b2.className = 'btn sub'; b2.textContent = '방 나가기';
  b2.addEventListener('click', () => { A.sfx('click'); leaveRoom(); showHangar(); }); btns.append(b2);
  $('copy').dataset.text = `⚡ 볼트윙 친구와 함께 ${m.mode === 'endless' ? 'WAVE ' + m.wave : 'STAGE ' + m.stage + (m.win ? ' 클리어' : '')} · 팀 점수 ${m.score.toLocaleString()}`;
  $('result').classList.remove('hidden'); resultFx();
}

// --- 그리기: 친구 기체 ---
function drawAllies() {
  drawCoopLinks();
  for (const a of allies) {
    if (a.down > 0) { txt(`${a.name} 구조 신호 · ${Math.ceil(a.down)}초 뒤 자동 복귀`, clamp(a.wx || a.x, 120, W - 120), (a.wy || a.y) + 56, 12, '#ff9a9a', 'center', 800); continue; }
    if (a.inv > 0 && Math.floor(T * 20) % 2) continue;
    if (a.twinT > 0) { ctx.globalAlpha = 0.5; for (const s of [-1, 1]) drawShipAt(ctx, a.frame, a.x + s * 46, a.y + 6, 0.55, a.bank || 0, T, false, a.look); ctx.globalAlpha = 1; }
    drawShipAt(ctx, a.frame, a.x, a.y, 0.9, a.bank || 0, T, hasGround(), a.look);
    if (a.orb) { ctx.strokeStyle = 'rgba(127,216,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, 38, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 0.55; ctx.strokeStyle = a.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y, 32, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    txt(a.name, a.x, a.y + 48, 12, a.color, 'center', 800);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(a.x - 22, a.y + 54, 44, 4);
    ctx.fillStyle = a.hp < a.maxHp * 0.3 ? '#ff5d5d' : '#3fd97a'; ctx.fillRect(a.x - 22, a.y + 54, 44 * clamp(a.hp / a.maxHp, 0, 1), 4);
  }
  if (P && P.down > 0 && run.phase !== 'dead') {
    panel(W / 2 - 150, H * 0.55 - 28, 300, 56, 14);
    txt(`격추! ${Math.ceil(P.down)}초 뒤 복귀 · 친구가 오면 바로`, W / 2, H * 0.55 + 8, 17, '#ff9a9a', 'center', 900);
  }
}

// --- 격납고: 친구와 함께 칸 ---
function coopPanel() {
  const box = document.createElement('div'); box.className = 'coopBox';
  const add = (html, tag = 'div', cls = '') => { const el = document.createElement(tag); if (cls) el.className = cls; el.innerHTML = html; box.append(el); return el; };
  const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'cbtn ' + cls; b.textContent = label; b.addEventListener('click', () => { A.init(); A.sfx('click'); fn(); }); return b; };
  const nameRow = add('<span>내 이름</span>', 'label', 'cRow');
  const ni = document.createElement('input'); ni.maxLength = 8; ni.value = myNick(); ni.disabled = !!net;
  ni.addEventListener('change', () => { S.nick = cleanName(ni.value); ni.value = S.nick; save(); });
  nameRow.append(ni);
  if (!net) {
    const r1b = add('', 'div', 'cRow'); r1b.append(btn('🌐 공개 방 만들기', () => hostRoom(true), 'main'), btn('🔒 비공개 방 만들기', () => hostRoom(false)));
    const r2b = add('', 'div', 'cRow');
    const ci = document.createElement('input'); ci.placeholder = '방 코드 5글자'; ci.maxLength = 5; ci.value = joinCode; ci.className = 'code';
    ci.addEventListener('input', () => { joinCode = ci.value.toUpperCase(); });
    r2b.append(ci, btn('들어가기', () => joinRoom(ci.value)));
    add('<b>🌐 공개 방</b>: 대기실 목록에 떠서 모르는 사람도 들어와요. <b>🔒 비공개 방</b>: 코드나 초대 링크를 받은 친구만 들어와요. 친구 방에 들어가려면 아래에 코드를 넣으세요. 최대 3명.', 'div', 'cNote');
  } else if (net.mode === 'host') {
    add(`<small>방 코드 · ${net.pub ? '🌐 공개 방(대기실에 보여서 누구나)' : '🔒 비공개 방(코드·링크를 받은 사람만)'}</small><b>${net.code}</b>`, 'div', 'cCode');
    { const cr = add('', 'div', 'cRow'); cr.append(btn('📋 방 코드 복사', async () => { try { await navigator.clipboard.writeText(net.code); coopMsg = `방 코드 ${net.code}를 복사했어요. 카톡에 붙여 넣으세요!`; } catch (e) { window.prompt('이 방 코드를 친구에게 보내세요', net.code); } renderHangar(); }, 'main')); }   // 0.61: 코드만 따로 복사
    const pr = add('', 'div', 'cRow');
    pr.append(btn(net.pub ? '🌐 공개 중 → 비공개로 바꾸기' : '🔒 비공개 중 → 공개로 바꾸기', () => { net.pub = !net.pub; Lobby.sync(); renderHangar(); }, net.pub ? 'main' : ''));
    const r = add('', 'div', 'cRow');
    r.append(btn('🔗 초대 링크 복사', async () => {
      const link = `${GAME_URL}?room=${net.code}${window.Friend && Friend.code ? `&ref=${Friend.code}` : ""}`;
      try { await navigator.clipboard.writeText(link); coopMsg = '초대 링크를 복사했어요. 카톡에 붙여 넣으세요!'; } catch (e) { window.prompt('이 링크를 친구에게 보내세요', link); }
      renderHangar();
    }), btn('방 닫기', () => { leaveRoom(); coopMsg = ''; renderHangar(); }, 'off'));
    const mr = add('', 'div', 'cRow');
    mr.append(btn(coopMd === 'stage' ? '✅ 스테이지' : '스테이지', () => { coopMd = 'stage'; renderHangar(); }), btn(coopMd === 'endless' ? '✅ 무한 생존' : '무한 생존', () => { coopMd = 'endless'; renderHangar(); }), btn(coopMd === 'escape' ? '✅ 🏃 탈출 경주' : '🏃 탈출 경주', () => { coopMd = 'escape'; renderHangar(); }));
    add(`👥 ${roster().map(p => esc(p.name) + (p.host ? '(방장)' : '')).join(' · ')}`, 'div', 'cList');
    add(`${esc(net.status)}${allies.length ? ` — 준비되면 <b>함께 출격</b>을 누르세요. ${coopMd === 'stage' ? `스테이지 ${stLabel(hangarStage)}로 갑니다(아래 지도에서 바꾸기).` : coopMd === 'escape' ? '모두 같은 맵에서 탈출 작전을 달려요(각자 하트 3개, 멀리 간 순서로 고철 보너스).' : ''}` : ''}`, 'div', 'cNote');
  } else {
    add(`<small>들어간 방</small><b>${net.code}</b>`, 'div', 'cCode');
    add(`👥 ${(net.roster || []).map(p => esc(p.name) + (p.host ? '(방장)' : '')).join(' · ') || '…'}`, 'div', 'cList');
    add(esc(net.status), 'div', 'cNote');
    const r = add('', 'div', 'cRow'); r.append(btn('방 나가기', () => { leaveRoom(); coopMsg = ''; renderHangar(); }, 'off'));
  }
  if (coopMsg) add(esc(coopMsg), 'div', 'cMsg');
  add('함께 하면: 사람 수만큼 적이 튼튼해지고 고철은 20% 더 · 둘이 가까이 날면 <b>연결 빔</b>(적을 지지고 탄을 막음) · 격추된 친구 곁에 가면 <b>구출</b> · 3초 안에 같이 궁극기를 쓰면 <b>합동 궁극기</b> · 💬로 짧은 말 · 카드는 방장이 고름 · 리듬 결투는 쉼', 'div', 'cNote');
  box.append(friendEl); if (!($('frWin') && !$('frWin').classList.contains('hidden'))) Friend.render(friendEl);   // 친구 창이 열려 있으면 그쪽을 그대로
  box.append(lobbyEl);
  if (!Lobby.on && !Lobby.full) Lobby.open(lobbyOpt); else Lobby.sync();   // 0.67: 꽉 찼으면 「다시 들어가 보기」를 누를 때만
  Lobby.render(lobbyEl);
  return box;
}
// 대기실(공개 방 찾기·채팅)
const lobbyEl = document.createElement('div'); lobbyEl.className = 'lobby';
const lobbyOpt = {
  nick: () => myNick(),
  room: () => net && net.mode === 'host' ? { pub: net.pub, code: net.code, n: 1 + allies.length, mode: coopMd, play: state !== 'hangar' } : null,
  join: code => { A.sfx('click'); joinRoom(code); },
  lv: () => S.pilot.lv,
  status: () => state !== 'hangar' ? 'play' : net ? 'room' : '',
  onInvite: () => A.sfx('levelup'),
  ensureRoom: () => new Promise(res => {   // 0.49 대기실 초대: 방이 없으면 비공개 방을 열고 코드를 돌려준다
    if (net) return res(net.code || null);
    hostRoom(false); const t0 = Date.now();
    const iv = setInterval(() => { if (net && net.mode === 'host' && net.peer && net.peer.open) { clearInterval(iv); res(net.code); } else if (!net || Date.now() - t0 > 10000) { clearInterval(iv); res(null); } }, 200);
  }),
};
setInterval(() => { if (Lobby.on) Lobby.sync(); }, 3000);
// 0.50 친구·귓속말(js/friend.js)
const friendEl = document.createElement('div'); friendEl.className = 'friends';
Friend.init({
  nick: () => myNick(), lv: () => S.pilot.lv, st: lobbyOpt.status, room: () => (net && net.mode === 'host' ? net.code : ''),
  sfx: n => A.sfx(n), join: lobbyOpt.join, ensureRoom: lobbyOpt.ensureRoom, share: shareInvite,
  badge: (alert, n, on) => { frStat = { alert, n, on }; const b = document.querySelector('#me .meFr'); if (b) b.innerHTML = frBtnHtml(); },
  canPop: () => state === 'hangar' && $('gate').classList.contains('hidden'),
  openPanel: () => { selMode = 'coop'; if (tab !== 'sortie') { const b = document.querySelector('.tabs button[data-tab="sortie"]'); if (b) b.click(); } renderHangar(); },
});

$('fGo').addEventListener('click', leaveRest);
EMOTES.forEach((t, i) => { const b = document.createElement('button'); b.textContent = t; b.addEventListener('pointerdown', e => { e.stopPropagation(); sendEmote(i); }); $('emoBar').append(b); });

