// 볼트윙 게임 본체 (격납고) — js/game/ 파일들과 js/game.js는 한 이름 공간을 나눠 쓴다(index.html에 적힌 순서대로 읽음).
'use strict';
// ---------- 격납고 ----------
let openSlot = null;
function shipCanvas(id, w = 200, h = 130, s = 1.6) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  drawShipAt(c.getContext('2d'), id, w / 2, h / 2 - 6, s, 0, 0, false); return c;
}
function showHangar() {
  netEndOnce(false);
  state = 'hangar';
  Forge.show(false); $('forge').classList.remove('rest'); $('fRest').classList.add('hidden'); cam.x = cam.y = 0; $('ultBtn').classList.remove('hidden');
  for (const id of ['cards', 'pause', 'result', 'hud']) $(id).classList.add('hidden');
  $('hangar').classList.remove('hidden');
  run = null;
  A.music('hangar', 0);
  renderHangar();
}
const statBar = (label, k, val) => `<div class="stat"><span>${label}</span><i><b style="width:${Math.round(clamp(k, 0.04, 1) * 100)}%"></b></i><em>${val}</em></div>`;
// ---------- 0.57 내 정보 줄(별명·칭호·전투력·아이디)과 어디서나 여는 친구 창 ----------
let frStat = { alert: 0, n: 0, on: 0 };
function frBtnHtml() { return `👥 친구${frStat.n ? ` <small>${frStat.on}/${frStat.n}</small>` : ''}${frStat.alert ? `<em class="frUn">${frStat.alert}</em>` : ''}`; }
function renderMe() {
  const me = $('me'); if (!me) return;
  const T = TIERS[myTierV];
  me.innerHTML = `<div class="meL">${Rank.gem(S.pilot.lv)}<b class="meNick">${esc(myNick())}</b><button class="meEdit" title="별명 바꾸기">${/^조종사\d+$/.test(myNick()) ? "✏️ 별명 정하기" : "✏️"}</button><small class="meTitle" style="color:${T.c}">「${esc(titleName())}」</small></div>`
    + `<button class="meFr">${frBtnHtml()}</button>`
    + `<div class="meSub">⚡ ${powerOf(buildStats()).toLocaleString()} · ${T.name} · ${Cloud.uid ? `👤 ${esc(Cloud.uid)} <i>(아이디는 나만 보여요)</i>` : Cloud.guest ? '👤 손님 <i>(아이디 없이 하는 중)</i>' : '📴 혼자 하기'}</div>`;
  me.querySelector('.meEdit').addEventListener('click', editNick);
  me.querySelector('.meFr').addEventListener('click', openFriends);
}
function editNick() {
  A.sfx('click');
  const n = (window.prompt('새 별명 (한글·영어·숫자 2~10글자)', myNick()) || '').trim();
  if (!n || n === S.nick) return;
  const p = Rank.nickProblem(n); if (p) { window.alert(p); return; }
  S.nick = n; save(); A.sfx('part'); renderHangar();
  if (window.Friend) Friend.poll(true);   // 친구들에게도 바로 새 별명
}
function openFriends() {
  A.sfx('click');
  let w = $('frWin');
  if (!w) { w = document.createElement('div'); w.id = 'frWin'; w.innerHTML = '<div class="fwIn glass"><div class="fwHead"><b>👥 친구</b><button class="fwX">닫기</button></div><div class="fwBody"></div></div>'; document.body.append(w); w.querySelector('.fwX').addEventListener('click', () => { w.classList.add('hidden'); renderHangar(); }); w.addEventListener('click', e => { if (e.target === w) { w.classList.add('hidden'); renderHangar(); } }); }
  w.classList.remove('hidden');
  const body = w.querySelector('.fwBody'); body.innerHTML = '';
  if (!Cloud.uid) {
    body.innerHTML = '<p class="note">친구 목록·친구 신청·귓속말은 아이디가 있어야 써요. 아이디를 만들면 지금 기록을 그대로 가져갈 수 있어요.</p>';
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = '✨ 아이디 만들기'; b.addEventListener('click', () => { w.classList.add('hidden'); Cloud.toSignup(); }); body.append(b);
    return;
  }
  body.insertAdjacentHTML('beforeend', '<p class="note">친구 코드를 서로 알려 주고 신청하면 친구가 돼요. 친구가 접속하면 초록 점, 💬로 귓속말, 🎮로 같이 하기 초대.</p>');
  const box = document.createElement('div'); box.className = 'friends'; body.append(box); Friend.render(box);
}
// 0.63 무기·부품 Lv 10까지: Lv 6부터는 「한계 돌파」(💠 코어 + 조종사 레벨)
const lvDots = lv => `<span class="lvDots">${Array.from({ length: D.MAX_LV }, (_, i) => `<i class="${i + 1 <= lv ? 'on' : ''}${i >= D.BREAK_LV ? ' brk' : ''}"></i>`).join('')}</span>`;
function upButton(kind, lv, apply) {   // kind 'w' 무기 / 'p' 부품
  const t = lv + 1, cost = kind === 'w' ? D.WEAPON_COST(lv) : D.PART_COST(lv), core = t > D.BREAK_LV ? D.CORE_NEED[kind](t) : 0, plv = D.PILOT_GATE[t] || 0;
  const u = document.createElement('button');
  if (S.pilot.lv < plv) { u.className = 'up gateUp'; u.textContent = `🔒 조종사 Lv ${plv}`; u.disabled = true; u.title = `Lv ${t} 한계 돌파는 조종사 Lv ${plv}부터`; return u; }
  u.className = 'up' + (core ? ' brkUp' : '');
  u.textContent = `${core ? '💠 돌파' : '강화'} 🔩${cost}${core ? ` 💠${core}` : ''}`;
  u.disabled = S.scrap < cost || (S.cores || 0) < core;
  if (core && (S.cores || 0) < core) u.title = `💠 코어가 ${core - (S.cores || 0)}개 모자라요(보스를 잡으면 나와요)`;
  u.addEventListener('click', ev => { ev.stopPropagation(); if (S.scrap < cost || (S.cores || 0) < core) return; S.scrap -= cost; S.cores = (S.cores || 0) - core; apply(t); if (core) A.sfx('levelup'); save(); A.sfx('buy'); renderHangar(); });
  return u;
}
function renderHangar() {
  $('scrap').textContent = `🔩 ${S.scrap}${S.cores || maxGearLv() >= D.BREAK_LV ? ` · 💠 ${S.cores || 0}` : ''}`;
  unlockCheck(); titleCheck(); Rank.leagueCheck(); refTick();
  renderMe();
  $('bestTxt').textContent = `최고 ${S.best.toLocaleString()} · ★${starCount()}`;
  if (!isOpen('tab:' + tab)) tab = 'sortie'; if (!isOpen('mode:' + selMode)) selMode = 'stage';
  S.newDot = S.newDot || {};
  document.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.classList.toggle('hidden', !isOpen('tab:' + b.dataset.tab)); b.classList.toggle('newDot', !!S.newDot['tab:' + b.dataset.tab]); });
  { const on = document.querySelector('.tabs button.on'), nav = document.querySelector('.tabs'); if (on) nav.scrollLeft = on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2; }
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + tab));
  if (tab === 'rank') Rank.render($('tab-rank'));
  if (tab === 'settings' && !$('acctBox').contains(document.activeElement)) Cloud.render($('acctBox'));
  if (tab === 'settings') renderCtl($('ctlBox'));
  if (tab === 'look') { renderLook($('tab-look')); $('tab-look').append(lookSetsBox()); }
  if (tab === 'book') renderBook($('tab-book'));
  const claimable = GOALS.filter(g => !S.claimed[g.id] && g.val() >= g.need).length + weekOpen();
  $('goalBadge').textContent = claimable || '';
  $('goalBadge').classList.toggle('hidden', !claimable);
  const mb = $('modes'); mb.innerHTML = '';
  for (const m of MODES.filter(m => isOpen('mode:' + m.id))) {
    const b = document.createElement('button'); b.className = (m.id === selMode ? 'on' : '') + (S.newDot['mode:' + m.id] ? ' newDot' : '');
    b.innerHTML = `<span>${m.icon}</span>${m.name}`;
    b.addEventListener('click', () => { selMode = m.id; if (S.newDot['mode:' + m.id]) { delete S.newDot['mode:' + m.id]; save(); } A.sfx('click'); renderHangar(); });
    mb.append(b);
  }
  const M = MODES.find(m => m.id === selMode);
  const rec = { escape: `최고 ${(S.records.escape || 0).toLocaleString()} m · ${'⭐'.repeat(S.records.escapeStars || 0)}${'☆'.repeat(3 - (S.records.escapeStars || 0))}`, stage: `최고 스테이지 ${S.cleared} · 별 ★${starCount()}`, endless: `최고 WAVE ${S.records.wave} · 최고 점수 ${S.records.endlessScore.toLocaleString()}`,
    rush: `최고 ${S.records.rush} / 5${S.records.rushTime ? ` · 최단 ${fmt(S.records.rushTime)}` : ''}`, auto: `구역 ${S.idle.zone} · 최고 ${S.idle.best} · 💰${Forge.fmt(S.forge.gold)} · 최고 표창 Lv ${S.forge.maxLv} · ✨ 별조각 ${S.forge.shards}` }[selMode];
  $('modeInfo').innerHTML = `<b>${M.icon} ${M.name}</b><br>${M.desc}<br><small>📊 ${rec || `열린 단계 ${S.dojo.open} / 8`}</small>`;
  { const nt = nextOpenTip(); if (nt) $('modeInfo').insertAdjacentHTML('beforeend', `<div class="nextOpen">${nt}</div>`); }
  if (Cloud.guest && S.plays >= 1 && (S.guestAskAt || 0) <= S.plays) {   // 0.55: 손님으로 한 판 이상 했으면 아이디 만들기 권유(나중에 = 3판 뒤 다시)
    const gc = document.createElement('div'); gc.className = 'guestAsk';
    gc.innerHTML = `<b>💾 기록을 지키세요</b><br><small>아이디를 만들면 지금 기록을 그대로 가져가고, 다른 기기에서도 이어 하고, 랭킹·친구·주간 리그를 쓸 수 있어요.${refWait() ? ` 친구 초대 보상 🔩${REF_GIFT}도 받을 수 있어요.` : ""}</small>`;
    const r = document.createElement('div'); r.className = 'gaRow';
    const b1 = document.createElement('button'); b1.className = 'main'; b1.textContent = '✨ 아이디 만들기'; b1.onclick = () => { A.sfx('click'); Cloud.toSignup(); };
    const b2 = document.createElement('button'); b2.textContent = '나중에'; b2.onclick = () => { S.guestAskAt = S.plays + 3; save(); A.sfx('click'); renderHangar(); };
    r.append(b1, b2); gc.append(r); $('modeInfo').append(gc);
  }
  if (selMode === 'dojo') {
    dojoLv = Math.min(dojoLv, S.dojo.open);
    const row = document.createElement('div'); row.className = 'dojoLv';
    for (let lv = 1; lv <= 8; lv++) {
      const b = document.createElement('button'), best = S.dojo.best[lv];
      b.className = lv === dojoLv ? 'on' : ''; b.disabled = lv > S.dojo.open;
      b.innerHTML = `Lv ${lv}${best ? `<i>${best}</i>` : lv > S.dojo.open ? ' 🔒' : ''}`;
      b.addEventListener('click', () => { dojoLv = lv; A.sfx('click'); renderHangar(); });
      row.append(b);
    }
    $('modeInfo').append(row);
    const sr = document.createElement('div'); sr.className = 'dojoLv dojoSong';   // 곡 고르기
    [{ id: 'random', name: '🎲 아무 곡', genre: '' }, ...(A.SONGS || [])].forEach(s => {
      const b = document.createElement('button'); b.className = S.dojo.song === s.id ? 'on' : '';
      b.innerHTML = s.genre ? `${s.name}<i>${s.genre}</i>` : s.name;
      b.addEventListener('click', () => { S.dojo.song = s.id; save(); A.sfx('click'); renderHangar(); });
      sr.append(b);
    });
    $('modeInfo').append(sr);
    const vr = document.createElement('div'); vr.className = 'dojoLv dojoSong';   // 음표 내려오는 빠르기(빠른 걸 좋아하는 사람용)
    [[0.8, '🐢 느긋'], [1, '보통'], [1.25, '빠르게'], [1.5, '아주 빠르게'], [1.8, '⚡ 번개']].forEach(([v, l]) => {
      const b = document.createElement('button'); b.className = (S.dojo.spd || 1) === v ? 'on' : ''; b.innerHTML = `${l}<i>×${v}</i>`;
      b.addEventListener('click', () => { S.dojo.spd = v; save(); A.sfx('click'); renderHangar(); });
      vr.append(b);
    });
    const vt = document.createElement('div'); vt.className = 'acNote'; vt.textContent = '음표 빠르기: 빠를수록 음표 사이가 넓어져 보기 쉬워요(박자와 판정은 같아요). 단계가 오르면 곡도 빨라져요.';
    $('modeInfo').append(vt, vr);
    const sy = document.createElement('div'); sy.className = 'dojoSync';   // 싱크(이어폰이면 소리가 늦게 들린다)
    const sb = (t, v) => { const b = document.createElement('button'); b.textContent = t; b.addEventListener('click', () => { S.dojo.sync = v === 0 ? 0 : Math.max(-250, Math.min(250, S.dojo.sync + v)); save(); A.sfx('click'); renderHangar(); }); return b; };
    sy.append(document.createTextNode(`🎧 싱크 ${S.dojo.sync > 0 ? '+' : ''}${S.dojo.sync}ms `), sb('−10', -10), sb('+10', 10), sb('0', 0));
    const tip = document.createElement('small'); tip.textContent = ' 판정이 늘 늦게 나오면 +, 빠르면 − (블루투스 이어폰은 보통 +100~200)';
    sy.append(tip); $('modeInfo').append(sy);
  }
  $('stageMap').classList.toggle('hidden', selMode !== 'stage' && !(selMode === 'coop' && net && net.mode === 'host'));
  if (selMode === 'coop') $('modeInfo').append(coopPanel());
  $('stTip').classList.toggle('hidden', selMode !== 'stage');
  $('go').textContent = M.go;
  $('go').disabled = selMode === 'coop' && !(net && net.mode === 'host' && allies.length);
  const canAssist = selMode === 'stage' && (S.fails || {})[hangarStage] >= 2;
  $('assistBtn').classList.toggle('hidden', !canAssist);
  if (!canAssist) assistOn = false;
  $('assistBtn').innerHTML = `${assistOn ? '✅' : '⬜'} 🛟 지원 출격 <small>(체력·화력 +25%, 이 판은 별 2·3과 S·A 랭크 없음)</small>`;
  const s2 = buildStats();
  const pv = $('preview'); pv.innerHTML = '';
  const shipBox = document.createElement('div'); shipBox.className = 'pvShip';
  shipBox.append(liveShip(260, 170, 2.2)); shipBox.title = '눌러서 크게 보기'; shipBox.addEventListener('click', showGrowth);
  const pw = powerOf(s2);
  pv.append(shipBox); growthFx(shipBox, pw);
  const eqIcons = Object.keys(D.SLOTS).map(k => { const p = D.PARTS.find(x => x.id === S.equip[k]); return p ? `<span title="${p.name}">${p.icon}<sup>${S.parts[p.id]}</sup></span>` : '<span class="empty">＋</span>'; }).join('');
  pv.insertAdjacentHTML('beforeend', `<div class="pvInfo"><small class="pvTtl" style="color:${TIERS[myTierV].c}">「${titleName()}」 ${myNick()}</small><b>${s2.F.name}</b><span>${s2.Wp.name} Lv ${S.weapons[s2.Wp.id] || 1}</span><div class="eq">${eqIcons}</div>
    ${statBar('체력', s2.maxHp / 230, s2.maxHp)}${statBar('속도', s2.speed / 1.8, Math.round(s2.speed * 100) + '%')}${statBar('화력', s2.dmg * s2.rate / 110, Math.round(s2.dmg * s2.rate))}
    ${powerLine(pw, myTierV)}<div class="ultLine">🌟 ${s2.F.ult.name}</div></div>`);
  const map = $('stageMap'); map.innerHTML = '';
  for (let s = 1; s <= S.maxStage + 2; s++) {
    const open = s <= S.maxStage, en = stageEnd(s), bd = D.BOSSES[stageBossIdx(s)], stars = S.stars[s] || [], loop = (chOf(s) - 1) / 9 | 0;
    if (subOf(s) === 1) map.insertAdjacentHTML('beforeend', `<div class="chHead">챕터 ${chOf(s)} · ${D.THEMES[stageTheme(s)].name}${loop ? ` · ${loop + 1}회차` : ''}</div>`);
    const n = document.createElement('button');
    const gated = open && !gateOk(s);
    n.className = 'node' + (s === hangarStage ? ' on' : '') + (open && !gated ? '' : ' locked') + (S.cleared >= s ? ' done' : '');
    const rk = (S.ranks || {})[s];
    n.innerHTML = `<span class="num ch">${stLabel(s)}</span><span class="nm"><b>${en === 'leader' ? END_NM.leader : END_NM[en] + ' ' + bd.name}</b><small>${en === 'boss' ? '챕터 마지막 · 진짜 보스' : en === 'scout' ? '다음 챕터 보스의 선발대(체력 절반)' : '커다란 대장 전차와 호위'} · <span class="rp${pw < recPow(s) ? ' low' : ''}">⚡${recPow(s)}</span></small></span>${rk ? `<span class="rank r${rk}">${rk}</span>` : ''}<span class="st">${[0, 1, 2].map(i => `<em class="${stars[i] ? 'on' : ''}">★</em>`).join('')}</span>${gated ? `<span class="lock gateNeed">⭐${totalStars()}/${chNeed(s)}</span>` : open ? '' : '<span class="lock">🔒</span>'}`;
    if (open) n.addEventListener('click', () => { hangarStage = s; A.sfx('click'); renderHangar(); });
    map.append(n);
  }
  const hEn = stageEnd(hangarStage), bd = D.BOSSES[stageBossIdx(hangarStage)];
  $('stTip').innerHTML = `<b>스테이지 ${stLabel(hangarStage)}</b> · ${D.THEMES[stageTheme(hangarStage)].name} · 끝에 <b>${hEn === 'leader' ? END_NM.leader : END_NM[hEn] + ' ' + bd.name}</b><br><small>${hEn === 'leader' ? '대장 전차가 둥근 탄과 조준 탄을 쏘고 호위를 부릅니다. 대장을 부수면 클리어!' : bd.tip}</small><br><small class="rules">${STAR_RULES.map((r, i) => `${(S.stars[hangarStage] || [])[i] ? '★' : '☆'} ${r}`).join(' · ')}</small>`;
  if (!gateOk(hangarStage)) $('stTip').insertAdjacentHTML('afterbegin', `<div class="gateLine">🚪 챕터 ${chOf(hangarStage)}의 문을 열려면 별 <b>⭐${chNeed(hangarStage)}개</b>가 필요해요 (지금 ⭐${totalStars()}개 · ${chNeed(hangarStage) - totalStars()}개 더)<br><small>앞 스테이지를 다시 해서 ★ 체력 절반 이상 남기기 · ★ 콤보 30을 채워 보세요.</small></div>`);
  {   // 권장 전투력: 모자라면 강화하러 가는 길을 알려 준다
    const rp = recPow(hangarStage), gap = rp - pw, up = ['arms', 'parts', 'research'].find(t => isOpen('tab:' + t));
    $('stTip').insertAdjacentHTML('beforeend', `<div class="recLine${gap > 0 ? ' low' : ''}">⚡ 권장 전투력 <b>${rp.toLocaleString()}</b> · 내 전투력 <b>${pw.toLocaleString()}</b> ${gap > 0 ? `<em>(${gap.toLocaleString()} 모자라요)</em>` : '✅'}</div>`
      + (gap > rp * 0.1 ? `<small class="recHelp">조금 어려울 수 있어요. 앞 스테이지에서 고철을 모아 무기·부품·연구를 강화하면 쉬워져요.${up ? ' <button class="recGo">🔧 강화하러 가기</button>' : ''}</small>` : ''));
    const go = $('stTip').querySelector('.recGo');
    if (go) go.addEventListener('click', () => { const b = document.querySelector(`.tabs button[data-tab="${up}"]`); if (b) b.click(); });
  }
  if (tab === 'sortie') requestAnimationFrame(() => { const on = map.querySelector('.node.on'); if (on) map.scrollTop = on.offsetTop - map.clientHeight / 2; });
  const fr = $('frames'); fr.innerHTML = '';
  for (const f of D.FRAMES) {
    const open = unlocked(f), d = document.createElement('button');
    d.className = 'card' + (S.frame === f.id ? ' on' : '') + (open ? '' : ' locked');
    d.append(shipCanvas(f.id));
    d.insertAdjacentHTML('beforeend', `<b>${f.name}</b><small>${f.desc}</small>${statBar('체력', f.hp / 160, f.hp)}${statBar('속도', f.speed / 1.4, Math.round(f.speed * 100) + '%')}<small class="ult">🌟 ${f.ult.name}<br>${f.ult.desc}</small><small class="ult">${SKILL[f.id] ? `${SKILL[f.id].icon} 💣스킬 ${SKILL[f.id].name}<br>${SKILL[f.id].desc}` : ''}</small>` + (open ? '' : `<small class="lockTxt">🔒 스테이지 ${stLabel(f.unlock)} 클리어 시 열림</small>`));
    d.addEventListener('click', () => { if (!open) return; S.frame = f.id; save(); A.sfx('click'); renderHangar(); });
    fr.append(d);
  }
  const wp = $('weapons'); wp.innerHTML = '';
  for (const w of D.WEAPONS) {
    const open = unlocked(w), lv = S.weapons[w.id] || 1, d = document.createElement('div');
    d.className = 'card' + (S.weapon === w.id ? ' on' : '') + (open ? '' : ' locked');
    d.innerHTML = `<b><span class="wIcon" style="background:${w.color};color:${w.color}"></span>${w.name} <small>Lv ${lv}</small></b><small>${w.desc}</small>${statBar('피해', w.dmg * (w.pellets || 1) / 30, Math.round(w.dmg * (1 + 0.1 * (lv - 1))))}${statBar('연사', w.rate / 10, w.rate + '/초')}<div>${lvDots(lv)}</div>` + (open ? '' : `<small class="lockTxt">🔒 스테이지 ${stLabel(w.unlock)} 클리어 시 열림</small>`);
    if (open && lv < D.MAX_LV) d.append(upButton('w', lv, t => { S.weapons[w.id] = t; }));
    else if (open) d.insertAdjacentHTML('beforeend', '<small class="ult">💠 최고 단계</small>');
    d.addEventListener('click', () => { if (!open) return; S.weapon = w.id; if (!S.weapons[w.id]) S.weapons[w.id] = 1; save(); A.sfx('click'); renderHangar(); });
    wp.append(d);
  }
  const sl = $('slots'); sl.innerHTML = '';
  for (const [slot, label] of Object.entries(D.SLOTS)) {
    const id = S.equip[slot], p = D.PARTS.find(x => x.id === id), d = document.createElement('button');
    d.className = 'slot' + (p ? ' filled' : '') + (openSlot === slot ? ' open' : '');
    d.innerHTML = p ? `<span class="ic">${p.icon}</span><b>${p.name}</b> Lv ${S.parts[id]}<i>${label} · ${p.desc(D.PEFF(S.parts[id]))}</i>` : `<span class="ic">＋</span><b>${label}</b><i>비어 있음 · 눌러서 고르기</i>`;
    d.addEventListener('click', () => { openSlot = openSlot === slot ? null : slot; A.sfx('click'); renderHangar(); });
    sl.append(d);
  }
  const pl = $('partList'); pl.innerHTML = '';
  if (openSlot) {
    const owned = D.PARTS.filter(p => p.slot === openSlot && S.parts[p.id]);
    const total = D.PARTS.filter(p => p.slot === openSlot).length;
    pl.insertAdjacentHTML('beforeend', `<p class="note">${D.SLOTS[openSlot]} 부품 ${owned.length} / ${total}종</p>`);
    if (!owned.length) pl.insertAdjacentHTML('beforeend', '<p class="note">아직 없어요. 보스를 잡거나 큰 장갑기를 부수면 부품 상자가 나옵니다.</p>');
    for (const p of owned) {
      const lv = S.parts[p.id], on = S.equip[openSlot] === p.id, row = document.createElement('div');
      row.className = 'pRow' + (on ? ' on' : '');
      row.innerHTML = `<span class="ic">${p.icon}</span><span class="tx"><b>${p.name}</b> <small style="opacity:.7">Lv ${lv}</small> ${lvDots(lv)}<small>${p.desc(D.PEFF(lv))}${lv < D.MAX_LV ? ` → ${p.desc(D.PEFF(lv + 1))}` : ' (최고 단계)'}</small></span>`;
      const eq = document.createElement('button');
      eq.className = on ? 'eq' : ''; eq.textContent = on ? '빼기' : '끼우기';
      eq.addEventListener('click', () => { S.equip[openSlot] = on ? null : p.id; save(); A.sfx('click'); renderHangar(); });
      row.append(eq);
      if (lv < D.MAX_LV) row.append(upButton('p', lv, t => { S.parts[p.id] = t; }));
      pl.append(row);
    }
  } else pl.innerHTML = `<p class="note">칸을 누르면 가진 부품이 나옵니다. 모은 부품 ${Object.keys(S.parts).length} / ${D.PARTS.length}종</p>`;
  $('pilot').innerHTML = `<span class="lv">Lv ${S.pilot.lv} ${rankName(S.pilot.lv)}</span><i><b style="width:${S.pilot.xp / pilotNeed(S.pilot.lv) * 100}%"></b></i><em>${Math.floor(S.pilot.xp)} / ${pilotNeed(S.pilot.lv)}</em>${(() => { const nx = Object.keys(GROW.itemLv).filter(k => GROW.itemLv[k] > S.pilot.lv).sort((a, b) => GROW.itemLv[a] - GROW.itemLv[b])[0]; const ml = nextMs(); return nx ? `<small class="pNext">Lv ${GROW.itemLv[nx]}에 ${ITEMS[nx].icon} ${ITEMS[nx].name} 열림</small>` : ml ? `<small class="pNext">Lv ${ml} 🎁 ${PILOT_MS[ml].nm} + 🔩${PILOT_MS[ml].scrap}</small>` : ''; })()}`;
  const rl = $('research'); rl.innerHTML = '';
  for (const r of RESEARCH) {
    const lv = rs(r.id), row = document.createElement('div');
    row.className = 'pRow' + (lv >= r.max ? ' on' : '');
    row.innerHTML = `<span class="ic">${r.icon}</span><span class="tx"><b>${r.name}</b> <em style="font-style:normal;opacity:.7">${lv} / ${r.max}</em><small>${r.desc(lv)}${lv < r.max ? ` → ${r.desc(lv + 1)}` : ' (완료)'}</small></span>`;
    if (lv < r.max) {
      const cost = r.cost(lv), u = document.createElement('button');
      u.textContent = `연구 🔩${cost}`; u.disabled = S.scrap < cost;
      u.addEventListener('click', () => { if (S.scrap < cost) return; S.scrap -= cost; S.research[r.id] = lv + 1; save(); A.sfx('buy'); renderHangar(); });
      row.append(u);
    }
    rl.append(row);
  }
  rollDaily();
  renderWeekly($('weekly'));
  { const iv = $('invite'); iv.innerHTML = '';   // 0.56 친구 초대 칸
    const fc = window.Friend && Friend.code;
    iv.insertAdjacentHTML('beforeend', fc ? `<div>내 초대 링크 <small>${esc(myRefUrl().replace('https://', ''))}</small></div>` : `<div><small>${Cloud.uid ? '버튼을 누르면 내 초대 링크를 보내요.' : '아이디가 있어야 초대 보상을 받아요. 링크는 지금도 보낼 수 있어요.'}</small></div>`);
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = '🔗 초대 링크 보내기';
    b.addEventListener('click', async () => { const r = await shareInvite(); if (r === 'copied') { b.textContent = '✅ 복사했어요! 카톡에 붙여 넣으세요'; setTimeout(() => { b.textContent = '🔗 초대 링크 보내기'; }, 2500); } });
    iv.append(b);
    iv.insertAdjacentHTML('beforeend', `<div class="rules">친구가 링크로 들어와 아이디를 만들고 1-1을 깨면 친구와 나 모두 고철 ${REF_GIFT}. 새로 만든 아이디만, 한 사람에 한 번만 돼요.</div>`);
  }
  const at = $('attend'); at.innerHTML = '';
  const cyc = (S.attend.days - 1) % 7;
  ATTEND.forEach((r, i) => at.insertAdjacentHTML('beforeend', `<div class="${i <= cyc ? 'got' : ''} ${i === cyc ? 'today' : ''}">${i + 1}일<br>🔩${r}${i <= cyc ? '<br>✔' : ''}</div>`));
  const dl = $('daily'); dl.innerHTML = '';
  let dailyOpen = 0;
  for (const id of S.daily.picks) {
    const d = DAILY.find(x => x.id === id), v = Math.min(S.daily.cnt[d.key] || 0, d.need), done = v >= d.need, got = S.daily.claimed[id], row = document.createElement('div');
    row.className = 'goal' + (got ? ' got' : done ? ' done' : '');
    row.innerHTML = `<span class="tx"><b>${got ? '✔ ' : ''}${d.text}</b><i><b style="width:${v / d.need * 100}%"></b></i></span><span class="rw">${v}/${d.need}<br>🔩${d.reward}</span>`;
    if (done && !got) {
      dailyOpen++;
      const b = document.createElement('button'); b.textContent = '받기';
      b.addEventListener('click', () => { S.daily.claimed[id] = true; S.scrap += d.reward; save(); A.sfx('part'); renderHangar(); });
      row.append(b);
    }
    dl.append(row);
  }
  if (dailyOpen) { $('goalBadge').textContent = claimable + dailyOpen; $('goalBadge').classList.remove('hidden'); }
  $('mouseBtn').textContent = S.mouse ? '🖱 마우스 따라가기' : '🖱 끌어서 움직이기';
  $('leftyBtn').textContent = S.lefty ? '🤚 왼손 모드' : '✋ 오른손 모드';
  $('stage').classList.toggle('lefty', !!S.lefty);
  $('verTxt').textContent = `볼트윙 v${VERSION} · 음악과 효과음은 코드로 만든 소리입니다 · 지금까지 ${S.plays}번 출격 · made by motive`;
  const gl = $('goals'); gl.innerHTML = '';
  for (const g of GOALS) {
    const v = Math.min(g.val(), g.need), done = v >= g.need, got = S.claimed[g.id], row = document.createElement('div');
    row.className = 'goal' + (got ? ' got' : done ? ' done' : '');
    row.innerHTML = `<span class="tx"><b>${got ? '✔ ' : ''}${g.name}</b><small>${g.desc}</small><i><b style="width:${v / g.need * 100}%"></b></i></span><span class="rw">${v}/${g.need}<br>🔩${g.reward}</span>`;
    if (done && !got) {
      const b = document.createElement('button'); b.textContent = '받기';
      b.addEventListener('click', () => { S.claimed[g.id] = true; S.scrap += g.reward; save(); A.sfx('part'); renderHangar(); });
      row.append(b);
    }
    gl.append(row);
  }
  $('musicBtn').textContent = S.music ? '🎵 음악' : '🎵 꺼짐';
  $('sfxBtn').textContent = S.sfx ? '🔊 효과음' : '🔇 꺼짐';
  $('vibBtn').textContent = S.vib ? '📳 진동' : '📴 꺼짐';
  ['musicBtn', 'sfxBtn', 'vibBtn'].forEach((id, i) => $(id).classList.toggle('off', ![S.music, S.sfx, S.vib][i]));
}

