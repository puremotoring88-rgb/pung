// 볼트윙 — 대기실: 같이 할 사람 찾기(공개 방 목록·빠른 참가)와 짧은 채팅.
// Supabase Realtime의 '보내기(broadcast)'와 '접속 중(presence)'만 쓴다. 채팅은 서버에 저장되지 않고, 지금 대기실에 있는 사람에게만 간다.
// 안전: 50글자, 2초에 한 번, 욕설·전화번호·주소(링크)·SNS 아이디·개인정보를 묻는 말은 보내는 쪽과 받는 쪽 모두에서 막는다. 사람별로 숨기기.
window.Lobby = (() => {
'use strict';
const URL = 'https://karluttarljwyutztbgx.supabase.co';
const KEY = 'sb_publishable_oT_Z6aYJ3uDZxcJeF3ArIA_4ivykkte';
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';
const CH = 'boltwing-lobby-v1', MAXLOG = 40;
const QUICK = ['안녕하세요 👋', '같이 하실 분?', '방 만들었어요!', '들어갈게요!', '고마워요 🙏', '잘했어요 👍', 'ㅋㅋㅋ', '한 판 더?'];
const BAD = /(씨발|시발|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|븅신|개새|새끼|좆|존나|졸라|섹스|느금|니애미|니미|애미|에미|창녀|꺼져|닥쳐|fuck|shit|bitch|sex|porn)/i;
const PRIV = /(\d[\d\s\-.]{7,}\d|https?:|www\.|\.com|\.kr|\.net|@\w|카톡|카카오|오픈채팅|오카|인스타|insta|디엠|\bdm\b|페메|텔레|telegram|디코|discord|라인아이디|전번|전화번호|폰번|번호\s*(좀|줘|알려)|주소\s*(좀|줘|알려)|몇\s*살|나이가?\s*(어떻게|몇)|어디\s*살|사는\s*곳|무슨\s*학교|학교\s*어디|몇\s*학년|사진\s*(좀|줘|보내)|만나요|만날래|실명|본명)/i;
let sb = null, ch = null, me = null, opt = null, log = [], people = {}, mute = new Set(), lastSend = 0, note = '', on = false, el = null, inp = null, last = '';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HIDDEN = new RegExp('[\\u0000-\\u001f\\u200b-\\u200f\\u2028-\\u202e]', 'g');   // 보이지 않는 글자
const clean = s => String(s || '').replace(HIDDEN, '').replace(/\s+/g, ' ').trim().slice(0, 50);
const why = t => BAD.test(t) ? '고운 말로 해 주세요.' : PRIV.test(t.replace(/\s/g, ' ')) ? '연락처·SNS·나이·학교·사는 곳처럼 나를 알 수 있는 말은 보낼 수 없어요.' : '';

function loadLib() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = res; s.onerror = () => rej(new Error('대기실에 연결하지 못했어요. 인터넷을 확인해 주세요.')); document.head.append(s); });
}
// 대기실에 들어간다(친구와 함께 칸을 열 때). o = { nick(), room(), join(code), onUi() }
async function open(o) {
  opt = o;
  if (on) { sync(); return; }
  on = true; note = '대기실에 들어가는 중…'; ui();
  try { await loadLib(); } catch (e) { on = false; note = e.message; ui(); return; }
  if (!on) return;
  sb = sb || window.supabase.createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  me = me || Math.random().toString(36).slice(2, 10);
  ch = sb.channel(CH, { config: { presence: { key: me }, broadcast: { self: true } } });
  ch.on('presence', { event: 'sync' }, () => { people = {}; const st = ch.presenceState(); for (const k in st) people[k] = st[k][0]; ui(); });
  ch.on('broadcast', { event: 'chat' }, ({ payload: p }) => {
    if (!p || typeof p.t !== 'string') return;
    const t = clean(p.t), n = clean(p.n).slice(0, 10);
    if (!t || why(t) || why(n)) return;   // 받는 쪽에서도 한 번 더 거른다
    log.push({ id: String(p.id || '').slice(0, 12), n, t, at: Date.now() }); if (log.length > MAXLOG) log.shift();
    ui();
  });
  ch.subscribe(st => {
    if (st === 'SUBSCRIBED') { note = ''; last = ''; sync(); ui(); }
    else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { note = '대기실 연결이 불안정해요. 잠시 뒤 다시 열어 주세요.'; ui(); }
  });
}
function close() {
  on = false; people = {}; log = []; note = '';
  if (ch) { try { ch.untrack(); sb.removeChannel(ch); } catch (e) { /* 무시 */ } ch = null; }
}
// 내 상태(이름, 공개한 방)를 대기실에 알린다
function sync() {
  if (!ch || !opt) return;
  const r = opt.room() || {}, s = { nick: clean(opt.nick()).slice(0, 10), room: r.pub ? r.code : null, n: r.n || 0, mode: r.mode || '', play: !!r.play };
  const k = JSON.stringify(s);
  if (k === last) return;
  last = k; ch.track(s).catch(() => {});
}
function send(text) {
  const t = clean(text);
  if (!t || !ch) return;
  if (Date.now() - lastSend < 2000) { note = '조금 천천히 보내 주세요.'; ui(); return; }
  const w = why(t); if (w) { note = w; ui(); return; }
  lastSend = Date.now(); note = '';
  ch.send({ type: 'broadcast', event: 'chat', payload: { id: me, n: clean(opt.nick()).slice(0, 10), t } });
  if (inp) inp.value = '';
}
const rooms = () => Object.entries(people).filter(([k, p]) => k !== me && p && p.room && !p.play && p.n < 3).map(([k, p]) => ({ k, ...p }));
function quick() { const r = rooms(); if (!r.length) { note = '지금 열린 공개 방이 없어요. 방을 만들고 "누구나 들어오기"를 켜 보세요!'; ui(); return; } opt.join(r[(Math.random() * r.length) | 0].room); }

// 화면: 입력 칸은 한 번만 만들어 두고 다시 그릴 때 그대로 옮겨 붙인다(쓰던 글이 지워지지 않게)
function render(box) {
  el = box; draw();
}
const ui = () => draw();
function draw() {
  if (!el || !el.isConnected) return;
  const keep = inp && document.activeElement === inp;
  el.innerHTML = '';
  const add = (html, cls, tag = 'div') => { const d = document.createElement(tag); d.className = cls; d.innerHTML = html; el.append(d); return d; };
  const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'cbtn ' + cls; b.textContent = label; b.addEventListener('click', fn); return b; };
  const n = Object.keys(people).length;
  add(`<b>💬 대기실</b> <small>${on ? `지금 ${n}명` : ''}</small>`, 'lbHead');
  if (!on) { const r = add('', 'cRow'); r.append(btn('대기실 들어가기', () => open(opt))); if (note) add(esc(note), 'cMsg'); return; }
  const rs = rooms();
  const rl = add('', 'lbRooms');
  if (!rs.length) rl.innerHTML = '<small>열린 공개 방이 아직 없어요</small>';
  for (const r of rs.slice(0, 6)) {
    const b = btn(`🏠 ${r.nick}의 방 · ${r.n}/3 · ${r.mode === 'endless' ? '무한 생존' : '스테이지'} — 들어가기`, () => opt.join(r.room), 'wide');
    rl.append(b);
  }
  const qr = add('', 'cRow'); qr.append(btn('⚡ 빠른 참가(아무 방이나)', quick, 'main'));
  const lg = add('', 'lbLog');
  const shown = log.filter(m => !mute.has(m.id));
  if (!shown.length) lg.innerHTML = '<small>아직 조용해요. 인사해 보세요!</small>';
  for (const m of shown.slice(-14)) {
    const row = document.createElement('div'); row.className = 'lbMsg' + (m.id === me ? ' me' : '');
    row.innerHTML = `<b>${esc(m.n)}</b> ${esc(m.t)}`;
    if (m.id !== me) { const h = document.createElement('button'); h.className = 'lbHide'; h.textContent = '숨기기'; h.title = '이 사람의 말을 더는 보지 않아요'; h.addEventListener('click', () => { mute.add(m.id); draw(); }); row.append(h); }
    lg.append(row);
  }
  const qk = add('', 'lbQuick');
  for (const q of QUICK) qk.append(btn(q, () => send(q)));
  if (!inp) {
    inp = document.createElement('input'); inp.maxLength = 50; inp.placeholder = '짧게 한마디 (50글자)'; inp.enterKeyHint = 'send';
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') send(inp.value); });
  }
  const ir = add('', 'cRow lbIn'); ir.append(inp, btn('보내기', () => send(inp.value)));
  if (keep) inp.focus();
  if (note) add(esc(note), 'cMsg');
  add('채팅은 저장되지 않고 지금 대기실에 있는 사람에게만 보여요. 연락처·SNS·나이·학교·사는 곳은 보낼 수 없어요. 불편한 말을 하는 사람은 [숨기기]를 누르고, 힘든 일이 있으면 어른께 알려 주세요.', 'cNote');
  lg.scrollTop = lg.scrollHeight;
}
return { open, close, sync, render, get on() { return on; } };
})();
