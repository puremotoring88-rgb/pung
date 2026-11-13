// 볼트윙(by motive) — 친구·귓속말(로드맵 12-2·12-3). 서버 함수 fr_*(server/friends.sql)로만 오간다.
// 로그인한 사람만 쓸 수 있다. 로그인 아이디 대신 무작위 「친구 코드」로 서로 찾고, 상대가 수락해야 친구가 된다.
// 귓속말은 친구끼리만, 서버를 거쳐 받는 사람만 가져가고(가져가면 지움) 이 기기에도 저장하지 않는다. 대기실 채팅과 같은 말 거르기.
window.Friend = (() => {
'use strict';
let pc = 0, opt = null, code = null, whisper = true, reqs = 0, list = [], ready = null, note = '', el = null, busy = false, chat = null, inp = null, addInp = null;
const chats = {}, unread = {}, pops = [];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const call = (fn, b) => window.Cloud.call(fn, b || {});
const why = t => (window.Lobby && window.Lobby.why ? window.Lobby.why(t) : '');
const HIDDEN = new RegExp('[\\u0000-\\u001f\\u200b-\\u200f\\u2028-\\u202e]', 'g');
const clean = s => String(s || '').replace(HIDDEN, '').replace(/\s+/g, ' ').trim().slice(0, 50);
const ERR = { 'no user': '그 친구 코드를 가진 사람이 없어요. 코드를 다시 확인해 주세요.', self: '내 코드예요 😄', blocked: '이 사람과는 친구가 될 수 없어요.', full: '친구는 50명까지예요.', 'too many': '수락을 기다리는 신청이 너무 많아요. 조금 기다려 주세요.', 'their full': '상대가 받은 신청이 꽉 찼어요.', 'not friend': '친구끼리만 보낼 수 있어요.', slow: '조금 천천히 보내 주세요.', closed: '이 친구는 지금 귓속말을 받지 않아요.', bad: '보낼 수 없는 말이에요.', session: '다시 로그인해 주세요.' };
const why2 = e => { const m = String(e && e.message || e); for (const k in ERR) if (m.includes(k)) return ERR[k]; return /Failed to fetch|NetworkError/.test(m) ? '인터넷 연결을 확인해 주세요.' : '서버에 닿지 못했어요. 잠시 뒤 다시 해 주세요.'; };
const missing = e => /PGRST202|Could not find the function/.test(String(e && e.message || e));

function init(o) { opt = o; setTimeout(poll, 2500); setInterval(poll, 20000); setInterval(showPop, 1000); }
// 20초마다: 내 상태 알리기 + 받은 귓속말·초대 가져오기
async function poll(force) {
  if (!window.Cloud || !window.Cloud.uid || (document.hidden && !force) || ready === false) return;
  try {
    const r = await call('fr_poll', { p_nick: opt.nick(), p_lv: opt.lv(), p_st: opt.st(), p_room: opt.room() || '' });
    ready = true; code = r.code; whisper = r.whisper !== false;
    const before = reqs; reqs = r.reqs | 0;
    if (reqs > before) push({ kind: 'req', text: `📨 친구 신청이 왔어요 (${reqs})` });
    for (const m of r.box || []) receive(m);
    if (el && el.isConnected) await refresh(); else { if (++pc % 3 === 1) { try { list = (await call('fr_list')) || []; } catch (e) { /* 무시 */ } } badge(); }   // 0.57: 창이 닫혀 있어도 1분에 한 번 목록(격납고 친구 수)
  } catch (e) { if (missing(e)) { ready = false; draw(); } }
}
async function refresh() {
  try { list = (await call('fr_list')) || []; } catch (e) { if (missing(e)) ready = false; }
  draw(); badge();
}
function receive(m) {
  const body = clean(m.body), nick = clean(m.nick).slice(0, 10), c = String(m.code || '');
  if (!c || why(nick)) return;
  if (m.kind === 'w') {
    if (!body || why(body)) return;   // 받는 쪽에서도 한 번 더 거른다
    (chats[c] = chats[c] || []).push({ me: false, t: body }); if (chats[c].length > 30) chats[c].shift();
    if (chat !== c || !(el && el.isConnected)) { unread[c] = (unread[c] || 0) + 1; push({ kind: 'w', c, text: `💬 ${nick}: ${body}` }); }
    opt.sfx('xp');
  } else if (m.kind === 'inv' && /^[A-Z0-9]{5}$/.test(body)) {
    push({ kind: 'inv', c, room: body, text: `🎮 친구 ${nick}님이 같이 하자고 초대했어요` });
    opt.sfx('levelup');
  }
}
const badge = () => { if (opt.badge) opt.badge(reqs + Object.values(unread).reduce((a, b) => a + b, 0), list.filter(f => f.rel === 'ok').length, list.filter(f => f.rel === 'ok' && f.online).length); };

// 알림 띠: 격납고에 있을 때만 보여 준다(게임 중엔 모아 두었다가)
function push(p) { p.at = Date.now(); pops.push(p); if (pops.length > 5) pops.shift(); badge(); }
let popEl = null;
function showPop() {
  if (!opt || !opt.canPop() || !pops.length || (popEl && popEl.isConnected)) return;
  const p = pops.shift(); if (Date.now() - p.at > 120000 && p.kind === 'inv') return;
  popEl = document.createElement('div'); popEl.className = 'frPop';
  popEl.innerHTML = `<span>${esc(p.text)}</span>`;
  const row = document.createElement('div');
  const b = (t, fn, cls = '') => { const x = document.createElement('button'); x.className = 'cbtn ' + cls; x.textContent = t; x.addEventListener('click', () => { popEl.remove(); fn(); }); row.append(x); };
  if (p.kind === 'inv') b('들어가기', () => opt.join(p.room), 'main');
  if (p.kind === 'w') b('답장', () => { chat = p.c; unread[p.c] = 0; opt.openPanel(); }, 'main');
  if (p.kind === 'req') b('보기', () => opt.openPanel(), 'main');
  b('닫기', () => {});
  popEl.append(row); document.body.append(popEl);
  setTimeout(() => { if (popEl && popEl.isConnected) popEl.remove(); }, p.kind === 'inv' ? 20000 : 9000);
}

// 행동
async function act(fn, b, ok) {
  if (busy) return; busy = true; note = ''; draw();
  try { const r = await call(fn, b); if (ok) note = ok(r) || ''; } catch (e) { note = why2(e); }
  busy = false; await refresh();
}
const request = c => { c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 6) { note = '친구 코드는 6글자예요.'; draw(); return; } return act('fr_request', { p_code: c }, r => (r === 'friends' ? '🤝 친구가 되었어요!' : '📨 친구 신청을 보냈어요. 상대가 수락하면 친구가 돼요.')); };
async function send(c, text) {
  const t = clean(text); if (!t) return;
  const w = why(t); if (w) { note = w; draw(); return; }
  try { await call('fr_send', { p_code: c, p_kind: 'w', p_body: t }); (chats[c] = chats[c] || []).push({ me: true, t }); note = ''; if (inp) inp.value = ''; }
  catch (e) { note = why2(e); }
  draw();
}
async function invite(f) {
  note = '방을 준비하는 중…'; draw();
  const room = await opt.ensureRoom();
  if (!room) { note = '방을 만들지 못했어요.'; draw(); return; }
  try { await call('fr_send', { p_code: f.code, p_kind: 'inv', p_body: room }); note = `🎮 ${f.nick}님을 방 ${room}에 초대했어요!`; } catch (e) { note = why2(e); }
  draw();
}

// 화면(친구와 함께 칸 안)
function render(box) { el = box; draw(); if (ready !== false) refresh(); }
function draw() {
  if (!el || !el.isConnected) return;
  const keepAdd = addInp && document.activeElement === addInp, keepInp = inp && document.activeElement === inp;
  el.innerHTML = '';
  const add = (html, cls) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; el.append(d); return d; };
  const btn = (t, fn, cls = '') => { const b = document.createElement('button'); b.className = 'cbtn ' + cls; b.textContent = t; b.disabled = busy; b.addEventListener('click', fn); return b; };
  const ok = list.filter(f => f.rel === 'ok'), on = ok.filter(f => f.online);
  add(`<b>🤝 친구</b> <small>${ready ? `${ok.length}명 · 접속 ${on.length}명` : ''}</small>`, 'frHead');
  if (!window.Cloud || !window.Cloud.uid) { add('친구는 아이디로 로그인하면 쓸 수 있어요.', 'cNote'); return; }
  if (ready === false) { add('친구 기능은 준비 중이에요(서버 설정을 하면 켜져요).', 'cNote'); return; }
  if (!code) { add('불러오는 중…', 'cNote'); return; }
  const mine = add(`내 친구 코드 <b class="frCode">${esc(code)}</b>`, 'frMine');
  const ir = add('<small>🔗 내 초대 링크로 온 친구가 아이디를 만들고 1-1을 깨면 둘 다 고철을 받아요.</small>', 'cRow frRef'); ir.append(btn('🔗 초대 링크 보내기', async () => { const r = await opt.share(); if (r === 'copied') { note = '초대 링크를 복사했어요. 카톡에 붙여 넣으세요!'; draw(); } }, 'main'));
  mine.append(btn('복사', async () => { try { await navigator.clipboard.writeText(code); note = '친구 코드를 복사했어요. 친구에게 알려 주세요!'; } catch (e) { window.prompt('내 친구 코드', code); } draw(); }));
  if (!addInp) { addInp = document.createElement('input'); addInp.maxLength = 8; addInp.placeholder = '친구 코드 6글자'; addInp.className = 'code'; addInp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') request(addInp.value); }); }
  const ar = add('', 'cRow'); ar.append(addInp, btn('➕ 친구 신청', () => request(addInp.value)));
  if (keepAdd) addInp.focus();
  for (const f of list.filter(x => x.rel === 'in')) {
    const r = add(`📨 <b>${esc(f.nick)}</b> <small>Lv ${f.lv}</small> 님이 친구 신청을 했어요`, 'frReq');
    const rr = document.createElement('div'); rr.className = 'cRow';
    rr.append(btn('수락', () => act('fr_answer', { p_code: f.code, p_ok: true }, () => `🤝 ${f.nick}님과 친구가 되었어요!`), 'main'), btn('거절', () => act('fr_answer', { p_code: f.code, p_ok: false })), btn('차단', () => { if (window.confirm(`${f.nick}님을 차단할까요? 다시 신청·귓속말·초대를 못 해요.`)) act('fr_remove', { p_code: f.code, p_block: true }); }));
    r.append(rr);
  }
  const fl = add('', 'frList');
  if (!ok.length) fl.innerHTML = '<small>아직 친구가 없어요. 친구 코드를 주고받거나 대기실에서 ➕ 친구를 눌러 보세요.</small>';
  const ST = { play: '🛩️ 게임 중', room: '🏠 방에 있음' };
  for (const f of ok) {
    const row = document.createElement('div'); row.className = 'frF' + (f.online ? ' on' : '');
    row.innerHTML = `<i class="dot"></i><span class="lv">Lv ${f.lv}</span><b>${esc(f.nick)}</b><small>${f.online ? ST[f.st] || '접속 중' : '접속 안 함'}</small>${unread[f.code] ? `<em class="frUn">${unread[f.code]}</em>` : ''}`;
    if (f.online && f.room && f.st !== 'play') row.append(btn('🏠 들어가기', () => opt.join(f.room), 'mini main'));
    else if (f.online && f.st !== 'play') row.append(btn('🎮 초대', () => invite(f), 'mini'));
    row.append(btn(chat === f.code ? '💬 닫기' : '💬', () => { chat = chat === f.code ? null : f.code; unread[f.code] = 0; draw(); badge(); }, 'mini'));
    row.append(btn('⋯', () => {
      const a = window.prompt(`${f.nick}님\n1 = 친구 끊기\n2 = 차단(다시 신청·귓속말·초대 못 함)\n번호를 적어 주세요`, '');
      if (a === '1') act('fr_remove', { p_code: f.code, p_block: false }, () => '친구를 끊었어요.');
      if (a === '2') act('fr_remove', { p_code: f.code, p_block: true }, () => '차단했어요.');
    }, 'mini'));
    fl.append(row);
    if (chat === f.code) {   // 귓속말 창
      const cw = document.createElement('div'); cw.className = 'frChat';
      const lg = document.createElement('div'); lg.className = 'lbLog';
      const ms = chats[f.code] || [];
      lg.innerHTML = ms.length ? ms.slice(-20).map(m => `<div class="lbMsg${m.me ? ' me' : ''}"><b>${m.me ? '나' : esc(f.nick)}</b> ${esc(m.t)}</div>`).join('') : '<small>둘만 보는 귓속말이에요. 저장되지 않아요.</small>';
      cw.append(lg);
      const qk = document.createElement('div'); qk.className = 'lbQuick';
      for (const q of (window.Lobby && window.Lobby.QUICK) || []) qk.append(btn(q, () => send(f.code, q)));
      cw.append(qk);
      if (!inp) { inp = document.createElement('input'); inp.maxLength = 50; inp.placeholder = '귓속말 (50글자)'; inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && chat) send(chat, inp.value); }); }
      const ir = document.createElement('div'); ir.className = 'cRow lbIn'; ir.append(inp, btn('보내기', () => send(f.code, inp.value))); cw.append(ir);
      fl.append(cw); setTimeout(() => { lg.scrollTop = lg.scrollHeight; }, 0);
      if (keepInp) inp.focus();
    }
  }
  for (const f of list.filter(x => x.rel === 'out')) {
    const r = add(`⏳ <b>${esc(f.nick)}</b>님이 수락하기를 기다리는 중`, 'frOut');
    r.append(btn('취소', () => act('fr_remove', { p_code: f.code, p_block: false })));
  }
  const sr = add('', 'cRow');
  sr.append(btn(whisper ? '🔔 귓속말 받는 중 → 받지 않기' : '🔕 귓속말 받지 않는 중 → 받기', () => act('fr_set', { p_whisper: !whisper }, () => { whisper = !whisper; return whisper ? '귓속말을 받아요.' : '귓속말을 받지 않아요.'; })));
  if (note) add(esc(note), 'cMsg');
  add('귓속말은 친구끼리만, 저장되지 않아요. 연락처·SNS·나이·학교·사는 곳은 보낼 수 없어요. 불편한 친구는 ⋯ → 끊기·차단을 하고, 힘든 일이 있으면 어른께 알려 주세요.', 'cNote');
}
return { init, render, request, poll, get code() { return code; }, get ready() { return ready; } };
})();
