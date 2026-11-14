// 볼트윙 게임 본체 마지막 — 시작·전체 화면·뒤로 가기. 앞부분은 js/game/1-base.js ~ 8-coop.js(같은 이름 공간).
'use strict';
// ---------- 시작 ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bgc.width = BGW; bgc.height = BGH;   // 배경은 크게 늘여 눕히므로 기본 해상도로 충분
  document.documentElement.style.setProperty('--u', $('stage').getBoundingClientRect().width / 100 + 'px');
}
window.addEventListener('resize', resize);
resize();
rollDaily();
Forge.init({
  S, sfx: n => A.sfx(n),
  toast: t => { if (run) say(t, W / 2, H * 0.28, '#ffd166', 22, 2); },
  merged: lv => { if (run && P) { ringFx(P.x, P.y, 50, Forge.tierOf(lv)); } },
  reborn: () => { if (run && run.mode === 'auto') nextZone(1, 'ZONE 1', '환생! 처음부터 더 강하게'); save(); },
});
{ const q = new URLSearchParams(location.search).get('room'); if (q) { selMode = 'coop'; joinCode = q.toUpperCase().slice(0, 5); } }   // 초대 링크로 들어오면
Notice.init();   // 첫 화면의 한 줄·공지·편지
try { const nn = localStorage.getItem('boltwing.newNick'); if (nn) { S.nick = nn; localStorage.removeItem('boltwing.newNick'); save(); } } catch (e) { /* 무시 */ }   // 0.57: 새 아이디를 만들 때 쓴 별명
Rank.init({ S, save, sfx: n => A.sfx(n), ver: VERSION, gift: leagueGift });
// 로그인 문: 로그인하지 않았거나 어느 기록을 쓸지 고르는 중이면 첫 화면을 덮는다
let gateJoin = !!(joinCode && selMode === 'coop');   // 초대 링크로 왔으면 로그인한 뒤에 방에 들어간다
let gateWas = false;
const gateUi = () => {
  const open = (!Cloud.uid && !Cloud.offline) || Cloud.choosing;
  $('gate').classList.toggle('hidden', !open);
  if (open) { gateWas = true; Cloud.render($('gateBox')); return; }
  if (state === 'hangar' && (gateWas || (document.querySelector('.guestAsk') && !Cloud.guest))) renderHangar();   // 로그인 문이 닫히면 내 정보 줄·안내를 새로
  if (gateWas && Cloud.uid) { try { localStorage.removeItem('boltwing.newNick'); } catch (e) { /* 무시 */ } }   // 다시 열지 않고 들어왔으면 별명은 이미 들어가 있다
  gateWas = false;
  if (gateJoin) { gateJoin = false; joinRoom(joinCode); }
};
Cloud.init({ ver: VERSION, getS: () => S, saveKey: SAVE_KEY, canReload: () => state === 'hangar' && !net, sfx: n => A.sfx(n), onUi: () => { Cloud.render($('acctBox')); gateUi(); } });
// 0.60 이름 없는 플레이 기록: 열기·창 닫기
const openAt = Date.now();
Cloud.log('open', { pl: S.plays, cl: S.cleared, lv: S.pilot.lv, a: Cloud.uid ? 'a' : Cloud.guest ? 'g' : 'o', mob: matchMedia('(pointer: coarse)').matches ? 1 : 0 });
setTimeout(() => Cloud.flush(), 4000);
window.addEventListener('pagehide', () => { Cloud.log('bye', { t: Math.round((Date.now() - openAt) / 1000), pl: S.plays }); Cloud.flush(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) Cloud.flush(true); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});   // 인터넷 없이도 열리게
renderHangar();
gateUi();
SKY.net = () => net; SKY.allies = allies; SKY.host = hostRoom; SKY.join = joinRoom;
// 자동 출격을 켜 둔 채 나갔다가 다시 열면: 비운 시간만큼 보상
if (S.idle.on && S.idle.lastSeen && Date.now() - S.idle.lastSeen > 120000) awayReward((Date.now() - S.idle.lastSeen) / 1000, 'hangar');
S.idle.on = false; save();
if (popups.length && $('away').classList.contains('hidden')) showPopup();   // 출석 알림
// 배경 그림을 미리 만들어 둔다(처음 출격할 때 멈칫하지 않게)
setTimeout(() => { for (let i = 0; i < 4; i++) { Art.far(i); Art.near(i); } D.FRAMES.forEach(f => Art.ship(f.id, f.color)); Object.keys(D.ENEMIES).forEach(k => { Art.enemy(k); Art.enemy(k, true); Art.enemyShadow(k); }); }, 50);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now; T += dt;
  let gdt = dt;   // 손맛: 잠깐 멈춤·느린 화면(협동 중에는 쓰지 않음)
  if (hitStop > 0) { hitStop -= dt; gdt = 0; } else if (slowT > 0) { slowT -= dt; gdt = dt * FEEL.slowK; }
  if (state === 'duel') { Duel.update(dt); tickFx(dt); }
  else if (state === 'play') {
    if (net && net.mode === 'guest') guestTick(dt); else if (gdt > 0 || net) update(net ? dt : gdt);
    Q.acc += dt; Q.n++;
    if (Q.n >= 120) { if (!Q.low && Q.acc / Q.n > 0.024) Q.low = true; Q.acc = 0; Q.n = 0; }   // 평균 40프레임 아래면 효과를 줄인다
  } else if (state === 'hangar') { bgY += dt * 30; nearY += dt * 70; tickFx(dt); }
  if (net) netTick(dt); else netEv.length = 0;
  draw();
  requestAnimationFrame(loop);
}
SKY.start = startRun; SKY.ult = () => { P.ult = 100; useUlt(); }; SKY.tap = onTap; SKY.trap = () => catchInNet();
SKY.rest = () => enterRest(true); SKY.item = id => useItem(id, P); SKY.gag = g => gagEvent(g); SKY.drop = id => dropItem(P.x, P.y - 120, id); SKY.foes = () => foes; SKY.drops = () => drops;
// ---------- ⛶ 전체 화면 · 뒤로 가기로 실수로 꺼지지 않게 ----------
const fsEl = document.documentElement, fsCan = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFull() {
  try {
    if (fsOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); }
  } catch (e) { /* 안 되는 기기 */ }
  A.sfx('click');
}
{ const ib = $('instBtn'); if (ib) { ib.addEventListener('click', () => { A.sfx('click'); addHome(); }); markHome(); } }   // 0.67 📲 홈 화면에 추가
{
  const fb = $('fullBtn');
  if (fb) {
    if (!fsCan || window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) fb.classList.add('hidden');   // 홈 화면 앱은 이미 전체 화면
    fb.addEventListener('click', toggleFull);
    const mark = () => { fb.textContent = fsOn() ? '🗗' : '⛶'; fb.title = fsOn() ? '전체 화면 끄기' : '전체 화면'; };
    document.addEventListener('fullscreenchange', mark); document.addEventListener('webkitfullscreenchange', mark); mark();
  }
}
let exitOK = false, guardArmed = false;
const armGuard = () => { if (guardArmed) return; try { history.pushState({ bw: 1 }, ''); guardArmed = true; } catch (e) { /* 무시 */ } };
armGuard();
window.addEventListener('pointerdown', () => { if (!guardArmed) armGuard(); }, true);   // 손가락으로 한 번 만진 뒤에 걸어야 휴대폰 뒤로 가기에 걸린다
window.addEventListener('popstate', () => {
  if (exitOK) return;
  guardArmed = false; armGuard();
  if (state === 'play') pauseGame();
  if (document.getElementById('exitAsk')) return;
  const bx = document.createElement('div'); bx.id = 'exitAsk';
  bx.innerHTML = `<div class="exIn"><b>볼트윙을 끝낼까요?</b><small>${window.Cloud && Cloud.uid && !Cloud.keep() ? '「로그인 유지」를 켜지 않아서, 끝내면 다음에 다시 로그인해야 해요.' : '기록은 저장돼 있어요.'}</small>
    <div><button class="exStay">계속하기</button><button class="exGo">끝내기</button></div></div>`;
  bx.querySelector('.exStay').addEventListener('click', () => { bx.remove(); A.sfx('click'); });
  bx.querySelector('.exGo').addEventListener('click', () => {
    exitOK = true; bx.remove(); save();
    history.go(-2);
    setTimeout(() => { exitOK = false; guardArmed = false; armGuard(); try { window.close(); } catch (e) { /* 무시 */ } }, 600);   // 처음 연 페이지라 뒤로 갈 곳이 없으면 그대로 남는다
  });
  document.body.append(bx);
});
requestAnimationFrame(loop);
