// 볼트윙 게임 본체 (손가락·키보드·아이템·스킬·병맛 사건·꾸미기·작은 강화) — js/game/ 파일들과 js/game.js는 한 이름 공간을 나눠 쓴다(index.html에 적힌 순서대로 읽음).
'use strict';
// ---------- 손가락·키보드 ----------
function toWorld(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
cv.addEventListener('pointerdown', e => {
  if (state === 'duel') { duelPtr[e.pointerId] = Duel.pressX(toWorld(e).x); return; }   // 리듬 결투: 누른 자리의 줄(손을 떼면 놓기)
  if (state !== 'play') return;
  onTap();
  if (P.trap) return;
  const p = toWorld(e);
  drag = { px: p.x, py: p.y, ox: P.tx, oy: P.ty, fx: p.x, fy: p.y, touch: e.pointerType !== 'mouse' };
  $('emoBar').classList.add('hidden');
  if (S.touch === 'above' && drag.touch) { P.tx = p.x + cam.x; P.ty = p.y - ABOVE + cam.y; }
  if (padMode() && drag.touch) { if (p.y < PAD_Y) { drag = null; return; } drag.pad = true; }   // 조종판: 판 안을 누른 자리가 중심
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (state === 'play' && e.pointerType === 'mouse' && S.mouse && !P.trap) {   // PC: 마우스 따라가기
    const m = toWorld(e); P.tx = m.x + cam.x; P.ty = m.y + cam.y; return;
  }
  if (!drag || state !== 'play' || P.trap) return;
  const p = toWorld(e); drag.fx = p.x; drag.fy = p.y;
  if (S.touch === 'above' && drag.touch) { P.tx = p.x + cam.x; P.ty = p.y - ABOVE + cam.y; return; }   // 기체가 손가락보다 위에 뜬다
  if (drag.pad) return;   // 조종판은 update에서 기울기만큼 움직인다
  const k = S.sens || 1.3;   // 민감도: 손가락을 조금만 움직여도 멀리 간다(손이 화면을 덜 가린다)
  const PB = bounds(); P.tx = clamp(drag.ox + (p.x - drag.px) * k, PB[0], PB[1]);
  P.ty = clamp(drag.oy + (p.y - drag.py) * k, PB[2], PB[3]);
});
const ABOVE = 150;
// 🕹️ 조종판: 화면 아래 판 안에서 누른 자리를 중심으로, 민 방향·거리만큼 그쪽으로 날아간다. 손을 떼면 멈춘다.
const PAD_Y = H * 0.68, PAD_R = 70;
const padMode = () => touchDevice && (S.touch || 'rel') === 'pad';
function padSteer(dt) {   // update에서 부른다: 민 거리만큼의 속도로
  if (!drag || !drag.pad || P.trap) return;
  let jx = drag.fx - drag.px, jy = drag.fy - drag.py; const m = Math.hypot(jx, jy);
  if (m > PAD_R) { drag.px = drag.fx - jx / m * PAD_R; drag.py = drag.fy - jy / m * PAD_R; jx = jx / m * PAD_R; jy = jy / m * PAD_R; }   // 너무 멀리 밀면 중심이 따라온다
  const v = (m < 8 ? 0 : 900 * st.speed * run.m.speed * dt) / PAD_R; P.tx = P.x + jx * v; P.ty = P.y + jy * v;
}
function drawPad() {
  if (!padMode() || state !== 'play' || run.phase === 'dead' || (run.arena && run.phase === 'rest')) return;
  const ox = cam.x, oy = cam.y; ctx.save();
  ctx.fillStyle = 'rgba(127,216,255,.05)'; ctx.strokeStyle = 'rgba(127,216,255,.16)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(ox + 14, oy + PAD_Y, W - 28, H - PAD_Y - 14, 26); ctx.fill(); ctx.stroke();
  if (drag && drag.pad) {
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.arc(ox + drag.px, oy + drag.py, PAD_R, 0, TAU); ctx.fill(); ctx.stroke();
    let jx = drag.fx - drag.px, jy = drag.fy - drag.py; const m = Math.hypot(jx, jy); if (m > PAD_R) { jx = jx / m * PAD_R; jy = jy / m * PAD_R; }
    ctx.fillStyle = 'rgba(127,216,255,.55)'; ctx.beginPath(); ctx.arc(ox + drag.px + jx, oy + drag.py + jy, 30, 0, TAU); ctx.fill();
  } else { ctx.fillStyle = 'rgba(200,230,255,.35)'; ctx.font = '700 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🕹️ 여기를 누르고 밀어서 조종', ox + W / 2, oy + (PAD_Y + H) / 2 + 6); }
  ctx.restore();
}
function drawFinger() {   // 손가락 자리를 옅게 보여 준다(기체가 어디 있는지 헷갈리지 않게)
  drawPad();
  if (!drag || !drag.touch || drag.pad || state !== 'play' || run.phase === 'dead' || P.down > 0) return;
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(drag.fx + cam.x, drag.fy + cam.y, 30, 0, TAU); ctx.stroke();
  if (S.touch === 'above') { ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(drag.fx + cam.x, drag.fy - 30 + cam.y); ctx.lineTo(P.x, P.y + 30); ctx.stroke(); ctx.setLineDash([]); }
}
function renderCtl(el) {
  el.innerHTML = '';
  const row = (title, opts, cur, set) => {
    const t = document.createElement('div'); t.className = 'acNote'; t.textContent = title; el.append(t);
    const r = document.createElement('div'); r.className = 'ctlRow';
    for (const [v, label] of opts) { const b = document.createElement('button'); b.textContent = label; if (v === cur) b.className = 'on'; b.addEventListener('click', () => { set(v); save(); A.sfx('click'); renderHangar(); }); r.append(b); }
    el.append(r);
  };
  row('움직이는 방식', [['rel', '👆 끌어서(기본)'], ['pad', '🕹️ 조종판'], ['above', '☝️ 기체를 손가락 위로']], S.touch || 'rel', v => { S.touch = v; });
  if ((S.touch || 'rel') === 'rel') row('민감도: 빠를수록 손가락을 조금만 움직여도 돼요', SENS.map(([v, l]) => [v, l]), S.sens || 1.3, v => { S.sens = v; });
  const n = document.createElement('div'); n.className = 'acNote';
  n.textContent = (S.touch || 'rel') === 'pad' ? '화면 아래 조종판 안을 누르고 가고 싶은 쪽으로 밀어요. 많이 밀수록 빨라지고, 손을 떼면 멈춰요.' : (S.touch === 'above') ? '기체가 손가락보다 한 뼘 위에 떠요. 손에 가리지 않지만 화면 맨 아래로는 못 내려가요.' : '팁: 화면 아래쪽 빈 곳에서 끌면 손이 기체를 가리지 않아요. 손가락을 기체 위에 둘 필요가 없어요.';
  el.append(n);
  row('피해 숫자', [[true, '🔢 보이기'], [false, '끄기']], S.dmgNum !== false, v => { S.dmgNum = v; });
}
const duelPtr = {};
const endDrag = e => { if (drag && drag.pad && P) { P.tx = P.x; P.ty = P.y; } drag = null; if (e && duelPtr[e.pointerId] !== undefined) { if (state === 'duel') Duel.release(duelPtr[e.pointerId]); delete duelPtr[e.pointerId]; } };
window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
window.addEventListener('pointerdown', () => { A.init(); if (state === 'hangar') A.music('hangar', 0); }, { capture: true });   // 소리는 화면을 한 번 누른 뒤에 켤 수 있다
document.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
  if (state === 'duel') {   // 리듬 결투: D F J K 또는 방향키
    const L = { d: 0, f: 1, j: 2, k: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (L !== undefined) { e.preventDefault(); if (!e.repeat) Duel.press(L); }
    return;
  }
  if (e.repeat && (e.key === ' ' || e.key === 'z')) return;
  keys[e.key] = true;
  if (e.key === ' ' || e.key === 'z') {
    e.preventDefault();
    if (state === 'play') { if (P.trap) tapTrap(); else if (run.rush) rushTap(); else useUlt(); }
  }
  if ((e.key === 'x' || e.key === 'X' || e.key === 'c' || e.key === 'C') && state === 'play' && run && !e.repeat) { if (run.arena) throwBlades(); else useSkill(); }
  if (e.key === 'p' || e.key === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); }
  if (state === 'cards' && ['1', '2', '3'].includes(e.key)) { const ids = $('cards').dataset.ids.split(','); if (ids[+e.key - 1]) takeCard(ids[+e.key - 1]); }
  if (state === 'hangar' && e.key === 'Enter' && document.activeElement.tagName !== 'INPUT' && $('gate').classList.contains('hidden')) startRun(hangarStage, selMode);
});
window.addEventListener('keyup', e => {
  keys[e.key] = false;
  if (state === 'duel') { const L = { d: 0, f: 1, j: 2, k: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 }[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (L !== undefined) Duel.release(L); }
});

let pausedAt = 0;
function pauseGame() { if (state !== 'play') return; state = 'pause'; drag = null; pausedAt = A.clock().t; $('pause').classList.remove('hidden'); $('resume').textContent = net && net.mode === 'guest' ? '돌아가기(게임은 계속 진행 중)' : '계속하기'; }
function resumeGame() {
  if (state !== 'pause') return;
  if (run.rush) { const d = A.clock().t - pausedAt; run.rush.notes.forEach(n => { n.t += d; }); run.rush.end += d; }   // 멈춘 만큼 음표를 미룬다
  state = 'play'; $('pause').classList.add('hidden');
}
// 화면을 끄거나 다른 앱으로 가면: 보통은 멈추고, 자동 출격이면 비운 시간을 재서 돌아왔을 때 보상
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'play' && run && run.mode === 'auto') { hiddenAt = Date.now(); S.idle.lastSeen = Date.now(); save(); }
    else pauseGame();
  } else if (hiddenAt) {
    const sec = (Date.now() - hiddenAt) / 1000; hiddenAt = 0;
    if (sec > 60 && state === 'play' && run && run.mode === 'auto') awayReward(sec, 'play');
  }
});

// 휴대폰: 전체 화면과 세로 고정(되는 기기에서만)
function goFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {}); }).catch(() => {});
}

$('emoBtn').addEventListener('pointerdown', e => { e.stopPropagation(); $('emoBar').classList.toggle('hidden'); });
$('ultBtn').addEventListener('pointerdown', e => { e.stopPropagation(); if (P && P.trap) tapTrap(); else if (run && run.rush) rushTap(); else useUlt(); });
$('throwBtn').addEventListener('pointerdown', e => { e.stopPropagation(); throwBlades(); });
$('skillBtn').addEventListener('pointerdown', e => { e.stopPropagation(); useSkill(); });
$('pauseBtn').addEventListener('click', pauseGame);
$('resume').addEventListener('click', resumeGame);
$('quit').addEventListener('click', () => { save(); if (run) Cloud.log('quit', { m: run.mode, s: run.stage, t: Math.round((Date.now() - (run.at0 || Date.now())) / 1000), k: run.kills }); $('pause').classList.add('hidden'); if (net && net.mode === 'guest') { leaveRoom(); showHangar(); return; } if (run && run.mode !== 'stage') endRun(false); else showHangar(); });
$('assistBtn').addEventListener('click', () => { assistOn = !assistOn; A.sfx('click'); renderHangar(); });
$('go').addEventListener('click', () => {
  A.init(); A.sfx('click');
  const go = () => selMode === 'escape' ? startEscape() : startRun(hangarStage, selMode);
  if (!S.seenHelp) { afterHelp = go; $('howto').classList.remove('hidden'); } else go();
});
function startEscape(o) {   // 탈출 작전(js/escape.js)
  $('hangar').classList.add('hidden'); A.music('escape', 0);
  const SND = { rope: 'tap', release: 'click', flap: 'tap', coin: 'scrap', hurt: 'hurt', phase: 'click', alarm: 'warning', boom: 'boomL', star: 'levelup' };
  const escAt = Date.now(); Cloud.log('start', { m: 'escape', s: 0, pl: S.plays, c: o && o.race ? 1 : 0 });   // 0.60
  Escape.start({
    sfx: k => A.sfx(SND[k] || 'click'),
    img: k => IMG[k] || null, frame: S.frame,
    best: () => S.records.escape || 0,
    gain: (sc, dist, stars) => { Cloud.log('end', { m: 'escape', s: 0, w: 1, t: Math.round((Date.now() - escAt) / 1000), d: Math.round(dist || 0), st: stars || 0 }); S.records.escapeStars = Math.max(S.records.escapeStars || 0, stars || 0); S.scrap += sc; S.records.escape = Math.max(S.records.escape || 0, dist); S.plays++; dcount('runs'); weekRoll(); S.week.pts += 1 + (stars || 0); save(); Rank.league(S.week.pts); },
    easy: () => (S.escEasy !== undefined ? S.escEasy : (S.records.escape || 0) < 500), setEasy: v => { S.escEasy = v; save(); },   // 🐢 연습 모드: 처음(최고 500m 전)엔 켜짐
    home: () => showHangar(), saveGhost, loadGhost,
  }, o);
}
// 탈출 작전 유령: 최고 기록의 맵 씨앗과 길(0.1초마다 자리)을 이 기기에만 둔다(계정마다 따로)
const ghostKey = () => { let u = ''; try { u = (JSON.parse(localStorage.getItem('boltwing.owner') || '{}') || {}).uid || ''; } catch (e) { /* 없음 */ } return 'boltwing.escGhost.' + u; };
function saveGhost(gh) { try { localStorage.setItem(ghostKey(), JSON.stringify(gh)); } catch (e) { /* 저장 공간 없음: 유령 없이 */ } }
function loadGhost() { try { const gh = JSON.parse(localStorage.getItem(ghostKey()) || 'null'); return gh && Array.isArray(gh.path) && gh.path.length > 5 ? gh : null; } catch (e) { return null; } }
// 탈출 작전 「같이 달리기」(로드맵 9-5): 방장이 맵 씨앗을 보내면 모두 같은 맵을 각자 기기에서 달리고, 0.1초마다 자리만 주고받는다
const ESC_BONUS = [0, 30, 15, 8];   // 순위 보너스 고철(2명 이상일 때)
const ESC_EV = ['tug', 'rescue', 'board', 'boardOk', 'unboard', 'help', 'flap'];   // 친구끼리 주고받는 일
const escNum = (v, a, b) => (typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : 0);
const escClean = m => ({ x: escNum(m.x, -1e3, 1e7), y: escNum(m.y, -500, 1500), ph: escNum(m.ph, 0, 7) | 0, h: escNum(m.h, 0, 3) | 0, d: escNum(m.d, 0, 1e6) | 0, over: m.over ? 1 : 0, bl: m.bl ? 1 : 0, ps: typeof m.ps === 'string' ? m.ps.slice(0, 64) : '', pp: m.pp ? 1 : 0, frame: frameOf(m.frame) ? m.frame : 'falcon' });
function escRace() {
  return {
    host: !!(net && net.mode === 'host'),
    others: () => {
      if (!net) return [];
      if (net.mode === 'host') return allies.filter(a => a.esc).map(a => Object.assign({ id: a.id, name: a.name, color: a.color }, a.esc));
      return (net.eps || []).filter(p => p[0] !== net.myId).map(p => Object.assign({ id: p[0], name: p[1], color: p[2] }, p[3]));
    },
    send: o => {
      if (!net) return;
      if (net.mode === 'guest') { if (net.conn && net.conn.open) net.conn.send(Object.assign({ t: 'ep' }, o)); return; }
      net.escMe = o;
      netBroadcast({ t: 'eps', l: [['host', myNick(), '#ffd166', o], ...allies.filter(a => a.esc).map(a => [a.id, a.name, a.color, a.esc])] });
    },
    again: () => { if (net && net.mode === 'host') escRaceHost(); },
    event: (to, e) => {   // 친구 한 명에게 보내는 일(로프·구출). 친구끼리는 방장을 거쳐 간다
      if (!net) return;
      if (net.mode === 'guest') { if (net.conn && net.conn.open) net.conn.send({ t: 'eev', to: String(to), e }); return; }
      const a = allies.find(x => x.id === to); if (a && a.conn.open) a.conn.send({ t: 'eev', from: 'host', e });
    },
    done: (rank, n) => { if (n < 2) return 0; const b = ESC_BONUS[rank] || 0; if (b) { S.scrap += b; save(); } if (rank === 1) A.sfx('levelup'); return b; },
  };
}
function escRaceHost() {
  if (!(net && net.mode === 'host')) return;
  const seed = (Math.random() * 4294967296) >>> 0;
  for (const a of allies) a.esc = null;
  netBroadcast({ t: 'esc', seed, roster: roster() });
  startEscape({ seed, race: escRace() });
}
function escRaceGuest(m) {
  net.eps = [];
  for (const id of ['away', 'howto', 'unlockPop']) { const el = $(id); if (el) el.classList.add('hidden'); }
  startEscape({ seed: m.seed >>> 0, race: escRace() });
}
$('awayOk').addEventListener('click', () => { A.sfx('part'); if (showPopup()) return; if ($('away').dataset.resume) { $('away').dataset.resume = ''; state = 'play'; } renderHangar(); });
// 처음 출격할 때는 하는 법부터
let afterHelp = null;
$('howtoOk').addEventListener('click', () => { $('howto').classList.add('hidden'); S.seenHelp = true; save(); A.sfx('click'); if (afterHelp) { const f = afterHelp; afterHelp = null; f(); } });
$('helpBtn').addEventListener('click', () => $('howto').classList.remove('hidden'));
$('mouseBtn').addEventListener('click', () => { S.mouse = !S.mouse; save(); renderHangar(); });
$('leftyBtn').addEventListener('click', () => { S.lefty = !S.lefty; save(); A.sfx('click'); renderHangar(); });
$('exportBtn').addEventListener('click', async () => {
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
  try { await navigator.clipboard.writeText(code); $('exportBtn').textContent = '복사했어요 ✔'; } catch (e) { window.prompt('이 코드를 복사해 두세요', code); }
  setTimeout(() => { $('exportBtn').textContent = '📤 저장 코드 복사'; }, 2500);
});
$('importBtn').addEventListener('click', () => {
  const code = window.prompt('저장 코드를 붙여 넣으세요(지금 기록은 바뀝니다)');
  if (!code) return;
  try { const o = JSON.parse(decodeURIComponent(escape(atob(code.trim())))); if (typeof o.scrap !== 'number') throw 0; localStorage.setItem(SAVE_KEY, JSON.stringify(o)); location.reload(); }
  catch (e) { window.alert('저장 코드가 올바르지 않습니다.'); }
});
$('resetBtn').addEventListener('click', () => { if (window.confirm('모든 기록을 지우고 처음부터 시작할까요? 되돌릴 수 없습니다.')) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } location.reload(); } });
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; openSlot = null; lookTry = null; if (S.newDot && S.newDot['tab:' + tab]) { delete S.newDot['tab:' + tab]; save(); } A.sfx('click'); renderHangar(); }));
$('musicBtn').addEventListener('click', () => { S.music = !S.music; A.setMusic(S.music); save(); renderHangar(); });
$('sfxBtn').addEventListener('click', () => { S.sfx = !S.sfx; A.setSfx(S.sfx); save(); renderHangar(); });
$('vibBtn').addEventListener('click', () => { S.vib = !S.vib; save(); buzz(40); renderHangar(); });
$('fsBtn').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else goFullscreen(); });
$('photo').addEventListener('click', showPhoto);
$('copy').addEventListener('click', async () => {
  const t = `${$('copy').dataset.text || ''}\n${location.origin}${location.pathname}`;   // 친구가 바로 들어올 수 있게 주소도 붙인다
  try { await navigator.clipboard.writeText(t); $('copy').textContent = '복사했어요! 카톡에 붙여 넣으세요 ✔'; } catch (e) { $('copy').textContent = t; }
  setTimeout(() => { $('copy').textContent = '📋 결과 복사해서 자랑하기'; }, 2500);
});

// ---------- 판 안의 아이템: 적이 가끔 떨어뜨린다(정예는 자주) ----------
const ITEMS = {
  magnet: { icon: '🧲', name: '자석 폭풍', dur: 8, desc: '고철·경험치가 모두 날아온다', c: '#9fd0ff' },
  orb: { icon: '🛡️', name: '방패 구슬', desc: '한 번 막아 준다', c: '#7fd8ff' },
  slow: { icon: '⏳', name: '느림보 시계', dur: 6, desc: '적 탄이 느려진다', c: '#c9b6ff' },
  bomb: { icon: '💣', name: '폭탄', desc: '탄을 지우고 적에게 큰 피해', c: '#ff8a5e' },
  rapid: { icon: '🔥', name: '과열 엔진', dur: 8, desc: '연사 2배', c: '#ffb347' },
  twin: { icon: '👥', name: '분신', dur: 10, desc: '양옆 분신이 같이 쏜다', c: '#9dffcf' },
  gold: { icon: '💰', name: '황금 시간', dur: 12, desc: '고철 2배', c: '#ffd166' },
  clover: { icon: '🍀', name: '네잎클로버', desc: '다음 카드 4장, 좋은 카드가 잘 나온다', c: '#6ee37a' },
};
const TIMED = ['magnet', 'slow', 'rapid', 'gold'];
const itemsOpen = () => Object.keys(ITEMS).filter(k => (GROW.itemLv[k] || 1) <= S.pilot.lv);   // 조종사 레벨이 오를수록 아이템이 하나씩 열린다
function dropItem(x, y, id) { drops.push({ kind: 'item', id: id || (Math.random() < 0.3 ? 'bomb' : pick(itemsOpen())), x, y, vy: 55, v: 1 }); }   // 폭탄(중간 스킬 충전)은 조금 더 자주
function useItem(id, who = P) {
  const it = ITEMS[id]; if (!it) return;
  if (id === 'bomb' && skillOn() && (who.bombs || 0) < SKILL.max && who.bombs !== undefined) {   // 폭탄은 모아 두었다가 중간 스킬로 쓴다(함께 할 때는 친구도)
    who.bombs++; say(`💣 +1 (${who.bombs}/${SKILL.max})`, who.x, who.y - 64, it.c, 20, 1.2); if (who === P) { A.sfx('part'); buzz(20); } return;
  }
  say(`${it.icon} ${it.name}!`, who.x, who.y - 64, it.c, 20, 1.3); A.sfx('part'); buzz(30);
  ringFx(who.x, who.y, 60, it.c);
  if (TIMED.includes(id)) run['it_' + id] = it.dur;
  else if (id === 'orb') who.orb = 1;
  else if (id === 'twin') who.twinT = it.dur;
  else if (id === 'clover') run.clover = true;
  else if (id === 'bomb') {
    flash = Math.max(flash, 0.6); shake = Math.max(shake, 0.8);
    for (const b of ebul) if (!b.net) drops.push({ kind: 'scrap', x: b.x, y: b.y, vy: 30, v: 1, small: true });
    ebul = [];
    for (const e of foes.slice()) if (!e.harmless) hitFoe(e, 140 * ultPow() * (e.isBoss ? 0.4 : 1), who === P ? null : who);
    explode(who.x, who.y - 120, 90, '#ffb06b');
  }
}
// ---------- 💣 중간 스킬: 폭탄 아이템을 3개까지 모았다가, 기체마다 다른 기술로 쓴다(위급할 때 보조 수단) ----------
const SKILL = {
  max: 3, start: 1, cd: 1.2,
  falcon: { icon: '🚀', name: '추적 미사일', desc: '적을 쫓는 큰 미사일 8발' },
  turtle: { icon: '🛡️', name: '방패 파동', desc: '둘레의 탄을 모두 지우고 1.5초 무적' },
  hornet: { icon: '🌀', name: '표창 회오리', desc: '표창 12개가 3초 동안 내 둘레를 돌며 넓게 퍼짐(적을 여러 번 베고 탄을 지움)' },
  phoenix: { icon: '💣', name: '불꽃 폭탄', desc: '앞으로 던진 폭탄이 크게 터짐' },
};
const skillOn = () => !!run && !run.arena;   // 0.43: 함께 할 때도 모두가 쓴다(참가자는 방장에게 부탁)
function useSkill() {
  if (state !== 'play' || !skillOn() || run.phase === 'dead' || run.phase === 'clear' || P.down > 0) return;
  if (P.trap) { tapTrap(); return; }
  if (net && net.mode === 'guest') {   // 참가자: 폭탄 수는 방장이 세고, 쓰기는 방장에게 부탁한다
    if (P.bombs > 0 && !(P.skAsk > T)) { P.skAsk = T + SKILL.cd; net.conn.send({ t: 'skill' }); }
    else if (P.bombs <= 0) say('💣 폭탄이 없어요 — 💣 아이템을 주우세요', P.x, P.y - 70, '#ff9a7a', 16, 1.2);
    return;
  }
  if (P.skCd > 0) return;
  if (P.bombs <= 0) { say('💣 폭탄이 없어요 — 💣 아이템을 주우세요', P.x, P.y - 70, '#ff9a7a', 16, 1.2); return; }
  P.bombs--; P.skCd = SKILL.cd; run.skills = (run.skills || 0) + 1;
  doSkill(P, st.F.id, ultPow());
  A.sfx('ult_' + st.F.ult.id); buzz(40);
}
function allySkill(a) {   // 방장 기기: 친구의 중간 스킬
  if (state !== 'play' || run.phase === 'dead' || run.phase === 'clear' || a.down > 0 || a.skCd > 0 || !(a.bombs > 0)) return;
  a.bombs--; a.skCd = SKILL.cd;
  doSkill(a, a.frame, ultPow() * a.dmg / st.dmg);
  A.sfx('charge');
}
function doSkill(who, id, pw) {
  const K = SKILL[id] || SKILL.phoenix, own = who === P ? null : who;
  say(`${K.icon} ${K.name}!`, who.x, who.y - 70, who === P ? '#ffd166' : who.color, 20, 1.1); shake = Math.max(shake, 0.4);
  if (id === 'falcon') {
    ebul = ebul.filter(b => b.net || Math.hypot(b.x - who.x, b.y - who.y) > 130);
    for (let i = 0; i < 8; i++) addShot(who.x + (i - 3.5) * 10, who.y - 10, (i - 3.5) * 110, -260, 40 * pw, { homing: true, r: 9, color: '#9fd8ff' });
  } else if (id === 'turtle') {
    ebul = ebul.filter(b => { if (b.net || Math.hypot(b.x - who.x, b.y - who.y) > 300) return true; drops.push({ kind: 'scrap', x: b.x, y: b.y, vy: 30, v: 1, small: true }); return false; });
    who.inv = Math.max(who.inv || 0, 1.5); ringFx(who.x, who.y, 300, '#9dffcf'); ringFx(who.x, who.y, 200, '#7bdc6b');
    for (const e of foes.slice()) if (!e.harmless && !e.civ && Math.hypot(e.x - who.x, e.y - who.y) < 300) hitFoe(e, 60 * pw * (e.isBoss ? 0.5 : 1), own);
  } else if (id === 'hornet') {
    // 0.48: 사방으로 흩어지던 표창 → 3초 동안 내 둘레를 돌며 넓게 퍼지는 회오리(닿는 적을 여러 번 베고, 지나는 길의 탄을 지움)
    ringFx(who.x, who.y, 120, '#ffe066');
    for (let i = 0; i < 12; i++) addShot(who.x, who.y, 0, 0, 16 * pw, { r: 15, pierce: 999, star: 3, eraser: true, color: '#ffe066', orb: { who, a0: i / 12 * TAU } });
  } else {
    const ty = Math.max(90, who.y - 300);
    (run.skBombs = run.skBombs || []).push({ x: who.x, y: ty, t: 0.45, pw, own });
    fx.push({ k: 'glyph', ch: '💣', x: who.x, y: who.y - 30, vx: 0, vy: (ty - who.y + 30) / 0.45, t: 0, life: 0.45, size: 30, color: '#fff' });
  }
}
function skillTick(dt) {
  if (P.skCd > 0) P.skCd -= dt;
  if (!run.skBombs || !run.skBombs.length) return;
  for (const b of run.skBombs) {
    if ((b.t -= dt) > 0) continue;
    flash = Math.max(flash, 0.45); shake = Math.max(shake, 0.8); A.sfx('boomL');
    ebul = ebul.filter(q => q.net || Math.hypot(q.x - b.x, q.y - b.y) > 250);
    explode(b.x, b.y, 110, '#ff8a3c'); ringFx(b.x, b.y, 250, '#ffb06b');
    for (const e of foes.slice()) if (!e.harmless && !e.civ && Math.hypot(e.x - b.x, e.y - b.y) < 250 + (e.r || 20)) hitFoe(e, 150 * b.pw * (e.isBoss ? 0.5 : 1), b.own);
  }
  run.skBombs = run.skBombs.filter(b => b.t > 0);
}
const itemOn = id => run && run['it_' + id] > 0;
function tickItems(dt) {
  for (const id of TIMED) if (run['it_' + id] > 0) { run['it_' + id] -= dt; if (run['it_' + id] <= 0 && P && !P.down) itemEnd(ITEMS[id]); }   // 0.52: 끝나면 알림
  for (const s of [P, ...allies]) if (s.twinT > 0) { s.twinT -= dt; if (s === P && s.twinT <= 0 && !P.down) itemEnd(ITEMS.twin); }
}
function itemEnd(it) {   // 시간제 효과가 끝났음을 기체 위에 짧게 알린다(탄이 왜 줄었는지 알 수 있게)
  if (!it || state !== 'play') return;
  say(`${it.icon} ${it.name} 끝!`, P.x, P.y - 64, '#c8d2e0', 17, 1.1); A.sfx('click'); ringFx(P.x, P.y, 50, it.c);
}
function drawItemHud() {   // 켜져 있는 아이템과 남은 시간
  let x = 18;
  for (const id of TIMED) {
    const v = run['it_' + id]; if (!(v > 0)) continue;
    panel(x - 6, 100, 58, 26, 10); txt(`${ITEMS[id].icon}${Math.ceil(v)}`, x + 23, 119, 14, ITEMS[id].c, 'center', 900); x += 64;
  }
  if (P.twinT > 0) { panel(x - 6, 100, 58, 26, 10); txt(`👥${Math.ceil(P.twinT)}`, x + 23, 119, 14, ITEMS.twin.c, 'center', 900); x += 64; }
  if (P.orb) { panel(x - 6, 100, 40, 26, 10); txt('🛡️', x + 14, 119, 14, '#fff', 'center', 900); x += 46; }
  if (run.clover) { panel(x - 6, 100, 40, 26, 10); txt('🍀', x + 14, 119, 14, '#fff', 'center', 900); }
}
function drawItemDrop(d) {
  const it = ITEMS[d.id] || ITEMS.bomb, k = 1 + Math.sin(T * 7 + d.x) * 0.1;
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow(it.c, 40), d.x - 34, d.y - 34, 68, 68); ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(d.x, d.y); ctx.scale(k, k);
  rrect(-17, -17, 34, 34, 12); ctx.fillStyle = 'rgba(8,14,28,.85)'; ctx.fill(); ctx.strokeStyle = it.c; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.icon, 0, 1); ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ---------- 병맛 사건: 가끔, 해롭지 않게, 웃기게 ----------
const CRITTER = { duck: '🦆', pizza: '🛵' };
const PA = ['기장입니다. 오늘 하늘은 맑고, 적은 많겠습니다.', '로봇 여러분, 기름칠은 하셨나요?', '방금 그 탄은 못 본 걸로 하겠습니다.', '이 비행은 고철 마일리지가 적립됩니다. 아마도.', '잠깐! 신발 끈… 아, 로봇은 신발이 없구나.', '오늘의 운세: 왼쪽으로 피하면 좋은 일이 생김.', '관제탑: 너무 잘해서 좀 무섭습니다.'];
function gagEvent(force) {
  const opts = ['duck', 'dance', 'pizza', 'balloon', 'monday', 'pa'];
  const g = force || pick(opts.filter(o => o !== run.lastGag)); run.lastGag = g;
  if (g === 'duck') {
    const fromL = Math.random() < 0.5, y0 = rnd(180, 380);
    for (let i = 0; i < 7; i++) addFoe('duck', fromL ? -40 - Math.abs(i - 3) * 34 : W + 40 + Math.abs(i - 3) * 34, y0 + (i - 3) * 22, { vx: fromL ? 150 : -150, harmless: true, emoji: '🦆' });
    run.ducks = 7; run.duckHit = 0;
    run.banner = { kind: 'stage', title: '🦆 꽥꽥', sub: '오리 떼가 지나갑니다 (쏴도 됩니다… 아마)', t: 0, life: 2 };
  } else if (g === 'dance') {
    run.danceT = 4.5; A.sfx('rush');
    run.banner = { kind: 'rush', title: '🕺 댄스 타임?!', sub: '적들이 갑자기 춤을 춘다. 지금이야!', t: 0, life: 2 };
  } else if (g === 'pizza') {
    addFoe('pizza', -50, rnd(200, 320), { vx: 95, harmless: true, emoji: '🛵', hp: 1, maxHp: 1 });
    say('🍕 배달 드론: "주문하신 피자 왔습니다~"', W / 2, H * 0.3, '#ffd166', 18, 2.2);
  } else if (g === 'balloon') {
    let n = 0;
    for (const e of foes) if (!e.isBoss && !e.harmless && e.type !== 'treasure') { e.balloonT = 5; n++; }
    if (!n) { gagEvent(); return; }
    run.banner = { kind: 'stage', title: '🎈 뿅!', sub: '적들이 풍선이 됐다. 터뜨려!', t: 0, life: 1.8 }; A.sfx('charge');
  } else if (g === 'monday') {
    run.mondayT = 6;
    run.banner = { kind: 'stage', title: '🐌 월요병', sub: '적들이 갑자기 너무 피곤해졌다', t: 0, life: 2 };
  } else {
    run.banner = { kind: 'stage', title: '📢 안내 방송', sub: pick(PA), t: 0, life: 2.6 }; A.sfx('click');
  }
}
function tickGags(dt) {
  if (run.danceT > 0) run.danceT -= dt;
  if (run.mondayT > 0) run.mondayT -= dt;
  if (run.mode === 'auto' || run.mode === 'dojo') return;
  if (run.gagAt === undefined) run.gagAt = rnd(28, 50);
  if (run.phase === 'waves' && !run.gates && run.t >= run.gagAt) { run.gagAt = run.t + rnd(38, 65); if (Math.random() < 0.75) gagEvent(); }
  if (boss && run.phase === 'boss' && !boss.entering && !(boss.sneezeT > 0) && !boss.sneezed && Math.random() < dt / 30) {   // 보스 재채기(한 판에 한 번)
    boss.sneezeT = 2.2; boss.sneezed = true; say('에… 에… 에취!!', boss.x, boss.y + 120, '#ffffff', 30, 1.8);
    A.sfx('boomS');
    for (let i = 0; i < 40 && fx.length < fxCap(); i++) { const a = rnd(0.2, Math.PI - 0.2), v = rnd(150, 420); fx.push({ k: 'spark', x: boss.x, y: boss.y + 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.6, 1.2), color: pick(['#ff7ad9', '#ffd166', '#7fd8ff', '#9dffcf']), size: rnd(3, 6) }); }
  }
}
function critterAI(e, dt) {   // 해롭지 않은 손님
  e.t += dt; e.x += e.vx * dt; e.y += Math.sin(e.t * 5 + e.x * 0.01) * 30 * dt;
  if (e.x < -160 || e.x > W + 160) e.gone = true;
}
function critterDown(e) {
  if (e.type === 'duck') {
    say('꽥!', e.x, e.y - 20, '#ffe066', 20, 0.8); drops.push({ kind: 'scrap', x: e.x, y: e.y, vy: 70, v: 1 });
    if (++run.duckHit >= 7) { say('🏆 오리 사냥꾼! 고철 +10', W / 2, H * 0.32, '#ffd166', 24, 2); gainScrap(10); }
  } else if (e.type === 'pizza') {
    say('🍕 맛있게 드세요~', e.x, e.y - 20, '#ffd166', 20, 1.4);
    for (let i = 0; i < 3; i++) drops.push({ kind: 'heart', x: e.x + (i - 1) * 24, y: e.y, vy: 60, v: 15 });
  }
}
function drawEmojiFoe(e) {
  ctx.save(); ctx.translate(e.x, e.y + Math.sin(T * 10 + e.x) * 2);
  if (e.vx > 0) ctx.scale(-1, 1);   // 가는 쪽을 보게
  ctx.font = `${e.type === 'pizza' ? 40 : 32}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e.emoji || CRITTER[e.type] || '❓', 0, 0); ctx.textBaseline = 'alphabetic'; ctx.restore();
  if (e.type === 'pizza') { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🍕', e.x + 18, e.y - 22); }
}
function drawBalloon(e) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.sin(T * 3 + e.x) * 0.15);
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 18); ctx.quadraticCurveTo(6, 30, 0, 44); ctx.stroke();
  ctx.font = `${Math.max(28, e.r * 1.8)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎈', 0, 0); ctx.textBaseline = 'alphabetic'; ctx.restore();
}

// ---------- 격납고 꾸미기: 도색·엔진 불꽃·꼬리·스티커 ----------
const LOOKS = {
  paint: { name: '🎨 도색', list: [['none', '기본', null, 0], ['red', '빨강', '#ff4d4d', 40], ['orange', '주황', '#ff9a3c', 40], ['yellow', '노랑', '#ffd93c', 40], ['green', '초록', '#3fe37a', 40], ['sky', '하늘', '#4cc9ff', 40], ['navy', '남색', '#4c6bff', 60], ['violet', '보라', '#b46bff', 60], ['pink', '분홍', '#ff7ad9', 60], ['silver', '은빛', '#9aa6b4', 80], ['night', '먹물', '#2a2f3a', 100, 8], ['gold', '황금', '#ffc83a', -1, 15]] },
  flame: { name: '🔥 엔진 불꽃', list: [['none', '기본', null, 0], ['blue', '파랑', '#4cc9ff', 30], ['green', '초록', '#4dff9e', 30], ['violet', '보라', '#c58bff', 40], ['pink', '분홍', '#ff7ad9', 40], ['white', '하양', '#ffffff', 50], ['rainbow', '무지개', 'rainbow', 150, 10], ['plasma', '플라스마', '#38ffe0', -1, 20]] },
  trail: { name: '✨ 꼬리', list: [['none', '없음', null, 0], ['smoke', '연기', 'smoke', 40], ['star', '별가루', '✦', 60], ['heart', '하트', '♥', 60], ['note', '음표', '♪', 60], ['petal', '꽃잎', '❀', 80, 5], ['rainbow', '무지개', 'rainbow', 160, 12], ['comet', '혜성', '☄', -1, 25]] },
  decal: { name: '🏷️ 스티커', list: [['none', '없음', null, 0], ['star', '별', '⭐', 30], ['bolt', '번개', '⚡', 30], ['heart', '하트', '❤️', 30], ['fire', '불꽃', '🔥', 40], ['flower', '꽃', '🌸', 40], ['cat', '고양이', '🐱', 60], ['crown', '왕관', '👑', 120, 15], ['dragon', '용', '🐉', -1, 30]] },
};
const lookOf = (cat, id) => LOOKS[cat].list.find(x => x[0] === id) || LOOKS[cat].list[0];
function myLook() { S.look = S.look || {}; return { paint: S.look.paint || 'none', flame: S.look.flame || 'none', trail: S.look.trail || 'none', decal: S.look.decal || 'none', tier: myTierV }; }
const paintCache = {};
function paintedShip(id, paint) {   // 원래 그림의 밝고 어두운 결은 두고 색만 바꾼다
  const F = frameOf(id), base = IMG['ship-' + id] || Art.ship(id, F.color), hex = lookOf('paint', paint)[2];
  if (!hex) return base;
  const key = id + paint;
  if (!paintCache[key]) {
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const g = c.getContext('2d');
    g.drawImage(base, 0, 0); g.globalCompositeOperation = 'color'; g.globalAlpha = paint === 'night' ? 0.95 : 0.85; g.fillStyle = hex; g.fillRect(0, 0, c.width, c.height);
    if (paint === 'night') { g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.fillRect(0, 0, c.width, c.height); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(base, 0, 0);
    paintCache[key] = c;
  }
  return paintCache[key];
}
const flameColor = (look, F) => { const v = look && lookOf('flame', look.flame)[2]; return v === 'rainbow' ? `hsl(${(Math.round(T * 8) * 30) % 360},100%,60%)` : v || F.color; };   // 빛 그림을 저장해 두므로 색을 12가지로만
function trailFx(s, look, dt) {   // 기체 뒤로 꼬리를 남긴다
  if (!look || look.trail === 'none' || Q.low || s.down > 0) return;
  if ((s.trT = (s.trT || 0) - dt) > 0) return;
  s.trT = look.trail === 'smoke' ? 0.05 : 0.07;
  const v = lookOf('trail', look.trail)[2], x = s.x + rnd(-7, 7), y = s.y + 30;
  if (!v) return;
  if (v === 'smoke') fx.push({ k: 'smoke', x, y, vx: rnd(-10, 10), vy: 120, t: 0, life: 0.7, size: 9 });
  else if (v === 'rainbow') for (const dx of [-6, 0, 6]) fx.push({ k: 'spark', x: s.x + dx, y, vx: 0, vy: 200, t: 0, life: 0.5, color: `hsl(${(T * 300 + dx * 20) % 360},100%,62%)`, size: 5 });
  else fx.push({ k: 'glyph', ch: v, x, y, vx: rnd(-30, 30), vy: rnd(110, 170), t: 0, life: 0.8, size: rnd(12, 18), color: { '✦': '#fff3a0', '♥': '#ff7ad9', '♪': '#9fd0ff', '❀': '#ffb3d9', '☄': '#7af0ff' }[v] || '#fff' });
}
let lookTry = null;   // 꾸미기 미리보기: 사지 않은 것을 눌러 보면 입혀 보기만 한다(사기는 「사기」 버튼으로만)
function lookCanBuy(cat, item) { const lv = item[4] || 0; return S.pilot.lv >= lv; }
function renderLook(el) {
  el.innerHTML = '';
  const L = myLook(); if (lookTry) L[lookTry.cat] = lookTry.id;
  const pv = document.createElement('div'); pv.className = 'lkPreview';
  const c = document.createElement('canvas'); c.width = 300; c.height = 210; pv.append(c); el.append(pv);
  let t0 = 0; const g = c.getContext('2d');
  const tp = []; let tT = 0;   // 0.63: 미리보기에도 꼬리(판 안의 trailFx와 같은 모양을 이 캔버스에 그린다)
  const trailPv = (sx, sy) => {
    const v = lookOf('trail', L.trail)[2];
    if (v && (tT -= 1 / 60) <= 0) {
      tT = v === 'smoke' ? 0.05 : 0.07;
      const y = sy + 46, x = sx + rnd(-7, 7);
      if (v === 'smoke') tp.push({ k: 's', x, y, vx: rnd(-10, 10), vy: 120, t: 0, life: 0.7, size: 9 });
      else if (v === 'rainbow') for (const dx of [-6, 0, 6]) tp.push({ k: 'p', x: sx + dx, y, vx: 0, vy: 200, t: 0, life: 0.5, color: `hsl(${(t0 * 300 + dx * 20) % 360},100%,62%)`, size: 5 });
      else tp.push({ k: 'g', ch: v, x, y, vx: rnd(-30, 30), vy: rnd(110, 170), t: 0, life: 0.8, size: rnd(12, 18), color: { '✦': '#fff3a0', '♥': '#ff7ad9', '♪': '#9fd0ff', '❀': '#ffb3d9', '☄': '#7af0ff' }[v] || '#fff' });
    }
    for (let i = tp.length - 1; i >= 0; i--) {
      const p = tp[i]; p.t += 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60;
      if (p.t >= p.life) { tp.splice(i, 1); continue; }
      const a = 1 - p.t / p.life; g.globalAlpha = a;
      if (p.k === 's') { g.fillStyle = 'rgba(200,210,225,.5)'; g.beginPath(); g.arc(p.x, p.y, p.size * (1 + p.t * 1.6), 0, TAU); g.fill(); }
      else if (p.k === 'p') { g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * a + 1, 0, TAU); g.fill(); }
      else { g.fillStyle = p.color; g.font = `${Math.round(p.size)}px sans-serif`; g.textAlign = 'center'; g.fillText(p.ch, p.x, p.y); }
    }
    g.globalAlpha = 1;
  };
  const anim = () => { if (!c.isConnected) return; t0 += 1 / 60; g.clearRect(0, 0, 300, 210); const sx = 150 + Math.sin(t0 * 0.9) * 40; trailPv(sx, 95); drawShipAt(g, S.frame, sx, 95, 2.3, Math.sin(t0 * 0.9 + 1.2) * 0.35, t0, false, L); requestAnimationFrame(anim); };
  anim();
  if (lookTry) {   // 입혀 보기 중: 직접 「사기」를 눌러야 고철을 쓴다
    const it = LOOKS[lookTry.cat].list.find(x => x[0] === lookTry.id), cost = it[3], gift = cost < 0, can = !gift && lookCanBuy(lookTry.cat, it), enough = S.scrap >= cost;
    const bar = document.createElement('div'); bar.className = 'lkTry';
    bar.innerHTML = `<span>👀 입혀 보는 중: <b>${it[1]}</b></span><small>${gift ? `🎁 조종사 Lv ${it[4]}에 닿으면 선물로 받아요(살 수 없음)` : !can ? `🔒 조종사 Lv ${it[4]}부터 살 수 있어요` : enough ? `사면 고철 🔩${S.scrap} → 🔩${S.scrap - cost}` : `고철이 🔩${cost - S.scrap} 모자라요`}</small>
      <div>${gift ? '' : `<button class="lkBuy"${can && enough ? '' : ' disabled'}>🔩 ${cost}로 사기</button>`}<button class="lkCancel">그만 보기</button></div>`;
    if (!gift) bar.querySelector('.lkBuy').addEventListener('click', () => {
      if (!can || S.scrap < cost) return;
      S.scrap -= cost; S.owned[lookTry.cat + ':' + lookTry.id] = 1; S.look[lookTry.cat] = lookTry.id; lookTry = null; A.sfx('part'); save(); renderHangar();
    });
    bar.querySelector('.lkCancel').addEventListener('click', () => { lookTry = null; A.sfx('click'); renderHangar(); });
    el.append(bar);
  }
  S.owned = S.owned || {};
  for (const cat of Object.keys(LOOKS)) {
    const box = document.createElement('div'); box.className = 'lkCat';
    box.innerHTML = `<b>${LOOKS[cat].name}</b>`;
    const row = document.createElement('div'); row.className = 'lkRow';
    for (const it of LOOKS[cat].list) {
      const [id, name, val, cost, lv] = it, key = cat + ':' + id, own = !cost || S.owned[key], on = (S.look[cat] || 'none') === id, can = lookCanBuy(cat, it), trying = !!lookTry && lookTry.cat === cat && lookTry.id === id;
      const b = document.createElement('button'); b.className = 'lkItem' + (on ? ' on' : '') + (own ? '' : ' lock') + (trying ? ' try' : '');
      const sw = cat === 'paint' ? `<i style="background:${val || frameOf(S.frame).color}"></i>` : cat === 'flame' ? `<i style="background:${val === 'rainbow' ? 'linear-gradient(90deg,#f55,#fd5,#5f8,#5cf,#c5f)' : val || frameOf(S.frame).color}"></i>` : `<em>${val === 'smoke' ? '☁' : val === 'rainbow' ? '🌈' : val || '－'}</em>`;
      b.innerHTML = `${sw}<span>${name}</span><small>${trying ? '👀 보는 중' : on ? '사용 중' : own ? '고르기' : cost < 0 ? `🎁 Lv ${lv}` : !can ? `🔒 Lv ${lv}` : `🔩 ${cost}`}</small>`;
      b.addEventListener('click', () => {
        A.sfx('click');
        if (!own) { lookTry = { cat, id }; renderHangar(); return; }   // 안 산 것은 입혀 보기만
        lookTry = null; S.look[cat] = id; save(); renderHangar();
      });
      row.append(b);
    }
    box.append(row); el.append(box);
  }
  const n = document.createElement('p'); n.className = 'note'; n.textContent = '꾸미기는 모습만 바꿔요(힘은 그대로). 친구와 함께 할 때 친구 화면에도 보여요.'; el.append(n);
}

// ---------- 손가락에 가리지 않게: 조작 방식과 민감도 ----------
const SENS = [[1.3, '보통'], [1.7, '빠르게'], [2.2, '아주 빠르게']];

// ---------- 작은 강화(줍자마자 바로 적용, 흐름이 끊기지 않는다) ----------
const UPGR = {
  dmg: { icon: '⚔️', c: '#ff8a5e', w: 3, txt: '화력 +6%', on: () => { run.m.dmg += 0.06; } },
  rate: { icon: '⚡', c: '#ffe066', w: 3, txt: '연사 +6%', on: () => { run.m.rate += 0.06; } },
  speed: { icon: '👟', c: '#7fd8ff', w: 1.4, txt: '속도 +4%', on: () => { run.m.speed += 0.04; } },
  magnet: { icon: '🌀', c: '#c9b6ff', w: 1, txt: '줍는 거리 +15%', on: () => { run.m.magnet += 0.15; } },
  multi: { icon: '🔱', c: '#9dffcf', w: 0.6, txt: '탄 +1', on: () => { run.m.multi += 1; run.upMulti = (run.upMulti || 0) + 1; } },
};
function dropUp(x, y) {
  const ids = Object.keys(UPGR).filter(k => k !== 'multi' || ((run.upMulti || 0) < 2 && S.pilot.lv >= GROW.multiLv));
  let r = Math.random() * ids.reduce((a, k) => a + UPGR[k].w, 0), id = ids[0];
  for (const k of ids) if ((r -= UPGR[k].w) <= 0) { id = k; break; }
  drops.push({ kind: 'up', id, x, y, vy: 60, v: 1 });
}
function takeUp(id, who) {
  const u = UPGR[id]; if (!u) return;
  u.on(); run.ups = (run.ups || 0) + 1;
  say(`${u.icon} ${u.txt}`, who.x, who.y - 54, u.c, 16, 0.9); A.sfx('xp');
}
function drawUpDrop(d) {
  const u = UPGR[d.id] || UPGR.dmg, k = 1 + Math.sin(T * 9 + d.x) * 0.12;
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow(u.c, 24), d.x - 22, d.y - 22, 44, 44); ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(d.x, d.y); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(8,14,28,.8)'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill(); ctx.strokeStyle = u.c; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(u.icon, 0, 1); ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

