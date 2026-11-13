// 볼트윙 — 계정(아이디·비밀번호)으로 기록 이어 하기. 기기가 바뀌어도 로그인하면 이어서 한다.
// 서버(Supabase)의 acct_* 함수로만 오간다(server/ranking.sql 3번). 비밀번호는 서버에서 bcrypt로 바꿔 저장한다.
// 다른 기기에서 그사이 저장했으면 덮어쓰지 않고 어느 기록을 쓸지 묻는다.
// 게임은 로그인해야 할 수 있다(첫 화면의 로그인 문). "로그인 유지"를 고르지 않으면 창을 닫을 때 로그아웃된다.
// 이 기기의 기록이 누구 것인지(OWN) 적어 두고, 다른 아이디로 들어오면 섞지 않는다. 로그아웃하면 이 기기 기록을 비운다(계정에 있으니까).
window.Cloud = (() => {
'use strict';
const URL = 'https://karluttarljwyutztbgx.supabase.co';
const KEY = 'sb_publishable_oT_Z6aYJ3uDZxcJeF3ArIA_4ivykkte';
const AK = 'boltwing.acct';   // 로그인 정보(아이디·접속표). 기록(S)과 따로 둬서 저장 코드에 섞이지 않게
const OWN = 'boltwing.owner';   // 이 기기 기록의 주인 { uid, at, dirty }
// 📴 혼자 하기(인터넷 없이): 주인이 LOCAL인 기록. 서버에 없는 유일한 사본이라, 계정이 이 기기를 쓰는 동안에는 SLOT에 따로 넣어 둔다.
const LOCAL = '@local', OFF = 'boltwing.offline', SLOT = 'boltwing.slot.' + LOCAL;
let offline = false, form = 'login';   // form: 로그인 칸 / 새로 만들기 칸
let leaving = false, lastId = '', getS, saveKey, canReload, sfx, onUi, acct = null, timer = null, busy = false, msg = '', choose = null;

const read = () => { try { return JSON.parse(localStorage.getItem(AK) || sessionStorage.getItem(AK) || 'null'); } catch (e) { return null; } };
const owner = () => { try { return JSON.parse(localStorage.getItem(OWN) || 'null'); } catch (e) { return null; } };
const store = () => {
  try {
    localStorage.removeItem(AK); sessionStorage.removeItem(AK);
    if (!acct) return;
    (acct.keep ? localStorage : sessionStorage).setItem(AK, JSON.stringify(acct));
    localStorage.setItem(OWN, JSON.stringify({ uid: acct.uid, at: acct.at || null, dirty: !!acct.dirty }));
  } catch (e) { /* 무시 */ }
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const why = e => {
  const m = String(e && e.message || e);
  return /taken/.test(m) ? '이미 있는 아이디예요. 다른 아이디를 골라 주세요.' : /bad id/.test(m) ? '아이디는 영어 소문자·숫자·_ 로 4~16글자예요.' : /bad word/.test(m) ? '쓸 수 없는 아이디예요.'
    : /bad pw/.test(m) ? '비밀번호는 6글자 이상이에요.' : /nope/.test(m) ? '아이디나 비밀번호가 맞지 않아요.' : /locked/.test(m) ? '여러 번 틀려서 10분 동안 잠겼어요. 잠시 뒤에 해 주세요.'
    : /session/.test(m) ? '다시 로그인해 주세요.' : /too big/.test(m) ? '기록이 너무 커서 저장하지 못했어요.' : /Failed to fetch|NetworkError/.test(m) ? '인터넷 연결을 확인해 주세요.' : '서버에 닿지 못했어요. 잠시 뒤 다시 해 주세요.';
};
function rpc(fn, body, keepalive) {
  return fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', keepalive: !!keepalive, headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.status === 204 ? null : r.json().catch(() => null); });
}
const summary = o => `조종사 Lv ${(o.pilot && o.pilot.lv) || 1} · 스테이지 ${o.cleared || 0}까지 클리어 · 🔩${o.scrap || 0} · ${o.plays || 0}번 출격`;
const ui = () => { if (onUi) onUi(); };
// 다른 기기에서 같은 아이디로 로그인하면 이 기기는 로그아웃된다(한 번에 한 기기). 이 기기 기록은 그대로 남는다.
function kicked() { if (acct) lastId = acct.uid; acct = null; store(); msg = '다른 기기에서 이 아이디로 로그인해서 여기는 로그아웃됐어요. 이 기기의 기록은 남아 있어요. 여기서 이어 하려면 다시 로그인하세요.'; }

function init(o) {
  getS = o.getS; saveKey = o.saveKey; canReload = o.canReload || (() => true); sfx = o.sfx || (() => {}); onUi = o.onUi;
  acct = read();
  if (acct) { if (acct.keep === undefined) acct.keep = true; store(); }   // 이 기능 전에 로그인해 둔 기기는 유지
  try {
    const own = owner();
    offline = !acct && !!(localStorage.getItem(OFF) || sessionStorage.getItem(OFF)) && !!own && own.uid === LOCAL;
    if (!offline) { localStorage.removeItem(OFF); sessionStorage.removeItem(OFF); }
  } catch (e) { offline = false; }
  if (acct) check(!!acct.dirty);   // 앱을 열 때 저절로 하는 저장보다 먼저, 이 기기에 안 올린 기록이 있었는지를 기준으로
  document.addEventListener('visibilitychange', () => { if (!acct) return; if (document.hidden) push(true); else if (canReload()) check(); });
  window.addEventListener('pagehide', () => { if (acct) push(true); });
  setInterval(() => { if (acct && !document.hidden && !busy && !choose && !leaving) check(); }, 60000);   // 0.47: 1분마다 확인 — 다른 기기에서 같은 아이디로 들어오면 여기는 곧 로그아웃
}
// 게임이 저장할 때마다 불린다: 잠시 모았다가 올린다(자주 올리지 않게)
function dirty() { if (!acct) return; acct.dirty = true; store(); clearTimeout(timer); timer = setTimeout(() => push(), 15000); }

async function push(keepalive) {
  if (!acct || !acct.dirty || busy || choose || leaving) return;   // 다른 기록으로 바꾸며 다시 여는 중에는 옛 기록을 올리지 않는다
  busy = true;
  try {
    const at = await rpc('acct_save', { p_token: acct.token, p_save: getS(), p_prev: acct.at || null }, keepalive);
    acct.at = at; acct.dirty = false; acct.last = Date.now(); store(); msg = '';
  } catch (e) {
    const m = String(e.message || e);
    if (/conflict/.test(m)) { busy = false; await check(); return; }
    if (/session/.test(m)) kicked();
    else msg = '☁️ 저장 실패: ' + why(e) + ' (기록은 이 기기에 남아 있어요)';
  }
  busy = false; ui();
}
function apply(save, at) {   // 계정 기록으로 바꾸고 다시 연다
  try { localStorage.setItem(saveKey, JSON.stringify(save)); } catch (e) { /* 무시 */ }
  acct.at = at; acct.dirty = false; acct.last = Date.now(); store();
  leaving = true; location.reload();
}
// 서버 기록과 맞춰 보기
async function check(wasDirty) {
  if (!acct || busy) return;
  const localChanged = wasDirty === undefined ? acct.dirty : wasDirty;
  try {
    const r = (await rpc('acct_load', { p_token: acct.token }) || [])[0];
    if (!r) { kicked(); ui(); return; }
    if (!r.save) { acct.at = null; acct.dirty = true; store(); await push(); return; }
    const same = r.save_at === acct.at || (acct.at && Math.abs(Date.parse(r.save_at) - Date.parse(acct.at)) < 1);
    if (!same) {   // 다른 기기에서 저장했다
      const S = getS();
      if (!localChanged || (!S.plays && !S.cleared)) { if (canReload()) apply(r.save, r.save_at); else { choose = { save: r.save, at: r.save_at }; ui(); } }
      else { choose = { save: r.save, at: r.save_at }; ui(); }
    } else if (acct.dirty) await push();
  } catch (e) { msg = '☁️ ' + why(e); ui(); }
}
function startFresh() {   // 이 기기 기록을 비우고 새로 시작(다시 열면 빈 기록이 계정에 올라간다)
  try { localStorage.removeItem(saveKey); } catch (e) { /* 무시 */ }
  acct.at = null; acct.dirty = true; store();
  leaving = true; location.reload();
}
async function enter(kind, id, pw, keep) {
  if (busy) return;
  id = String(id || '').replace(/[\s​-‏﻿]/g, '').toLowerCase(); lastId = id;   // 보이지 않는 글자·띄어쓰기는 뺀다
  if (!/^[a-z0-9_]{4,16}$/.test(id)) { msg = '아이디(위 칸)는 영어 소문자·숫자·_ 로 4~16글자예요. 한글 자판이면 영어로 바꿔 주세요.'; ui(); return; }
  if (String(pw || '').length < 6) { msg = '비밀번호(아래 칸)는 6글자 이상이면 돼요. 아무 글자나 괜찮아요.'; ui(); return; }
  msg = kind === 'signup' ? '만드는 중…' : '로그인하는 중…'; ui();
  try {
    const token = await rpc(kind === 'signup' ? 'acct_signup' : 'acct_login', { p_uid: id, p_pw: pw });
    let own = owner(), legacy;
    const S = getS();
    if (kind === 'signup' && (!own || own.uid === LOCAL) && (S.plays || S.cleared)) {
      // 0.47: 새 아이디는 묻지 않고 늘 처음부터(사용자 요청). 아이디 없이 하던 기록은 「인터넷 없이 혼자 하기」에 그대로 남는다.
      {
        try { localStorage.setItem(SLOT, localStorage.getItem(saveKey) || ''); } catch (e) { /* 무시 */ }
        acct = { uid: id, token, at: null, dirty: true, keep: !!keep };
        offline = false; try { localStorage.removeItem(OFF); sessionStorage.removeItem(OFF); } catch (e) { /* 무시 */ }
        startFresh(); return;
      }
    } else if (own && own.uid === LOCAL) {
      if (kind === 'signup') { own = null; legacy = false; try { localStorage.removeItem(SLOT); } catch (e) { /* 무시 */ } }   // 혼자 기록이 비어 있음
      else try { localStorage.setItem(SLOT, localStorage.getItem(saveKey) || ''); } catch (e) { /* 무시 */ }   // 혼자 하던 기록은 따로 넣어 두고 계정 기록으로
    }
    const mine = !!own && own.uid === id;
    if (legacy === undefined) legacy = !own && !!(S.plays || S.cleared);   // 계정이 생기기 전부터 이 기기에서 하던 기록
    acct = { uid: id, token, at: mine ? own.at : null, dirty: mine ? !!own.dirty : true, keep: !!keep };
    offline = false; try { localStorage.removeItem(OFF); sessionStorage.removeItem(OFF); } catch (e) { /* 무시 */ }
    sfx('part'); msg = '';
    if (own && !mine) {   // 이 기기 기록은 다른 아이디 것: 섞지 않고 내 계정 기록을 받거나 새로 시작
      const r = kind === 'login' ? (await rpc('acct_load', { p_token: token }) || [])[0] : null;
      if (r && r.save) apply(r.save, r.save_at); else startFresh();
      return;
    }
    store();
    if (kind === 'signup') { await push(); msg = legacy ? '계정을 만들고 이 기기에서 하던 기록을 올렸어요.' : '계정을 만들었어요. 즐거운 비행!'; ui(); return; }
    if (mine) { await check(acct.dirty); ui(); return; }
    const r = (await rpc('acct_load', { p_token: token }) || [])[0];
    if (!r || !r.save) { await push(); ui(); return; }
    if (!legacy) { apply(r.save, r.save_at); return; }   // 이 기기는 새것이면 바로 계정 기록으로
    choose = { save: r.save, at: r.save_at }; ui();
  } catch (e) { msg = why(e); ui(); }
}
// 📴 인터넷 없이 혼자 하기: 기록은 이 기기에만 쌓인다
function goOffline(keep) {
  try {
    const own = owner(), slot = localStorage.getItem(SLOT);
    (keep ? localStorage : sessionStorage).setItem(OFF, '1');
    localStorage.setItem(OWN, JSON.stringify({ uid: LOCAL }));
    if (own && own.uid === LOCAL) { offline = true; msg = ''; ui(); return; }   // 지금 기록이 바로 혼자 하던 기록
    if (!own && !slot) { offline = true; msg = ''; ui(); return; }   // 계정 전부터 하던 기록(또는 새 기록)을 그대로
    if (slot) localStorage.setItem(saveKey, slot); else localStorage.removeItem(saveKey);   // 계정 기록 자리에 혼자 하던 기록을 바꿔 끼운다
    localStorage.removeItem(SLOT);
  } catch (e) { /* 무시 */ }
  leaving = true; location.reload();
}
function leaveOffline() {   // 아이디로 들어가는 화면으로(혼자 하던 기록은 남는다)
  offline = false; msg = '';
  try { localStorage.removeItem(OFF); sessionStorage.removeItem(OFF); } catch (e) { /* 무시 */ }
  ui();
}
async function logout() {
  if (!acct) return;
  acct.dirty = true; await push();   // 마지막 기록을 꼭 올리고 나서
  if (!acct) return;   // 그사이 다른 기기 로그인으로 나가졌다
  if (acct.dirty) { msg = '☁️ 아직 계정에 저장하지 못해서 로그아웃하지 않았어요. 인터넷 연결을 확인해 주세요.'; ui(); return; }
  const t = acct.token; acct = null; store();
  try { localStorage.removeItem(saveKey); localStorage.removeItem(OWN); } catch (e) { /* 무시 */ }   // 기록은 계정에 있으니 이 기기에서는 비운다
  rpc('acct_logout', { p_token: t }, true).catch(() => {});
  leaving = true; location.reload();
}
async function passwd() {
  const o = window.prompt('지금 비밀번호'); if (!o) return;
  const n = window.prompt('새 비밀번호(6글자 이상)'); if (!n) return;
  if (n !== window.prompt('새 비밀번호를 한 번 더')) { window.alert('두 번 넣은 비밀번호가 달라요.'); return; }
  try { await rpc('acct_passwd', { p_token: acct.token, p_old: o, p_new: n }); msg = '비밀번호를 바꿨어요. 다른 기기는 다시 로그인해야 해요.'; } catch (e) { msg = why(e); }
  ui();
}

// 설정 칸의 계정 상자
function render(el) {
  el.innerHTML = '';
  const add = (html, cls = '', tag = 'div') => { const d = document.createElement(tag); if (cls) d.className = cls; d.innerHTML = html; el.append(d); return d; };
  const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'acBtn ' + cls; b.textContent = label; b.addEventListener('click', fn); return b; };
  if (choose) {
    add('<b>☁️ 어느 기록으로 이어 할까요?</b>', 'acHead');
    add('다른 기기에서 저장한 기록과 이 기기의 기록이 달라요. 고르지 않은 쪽은 사라져요.', 'acNote');
    const c = choose, S = getS();
    const r1 = add('', 'acRow'); r1.append(btn(`☁️ 계정 기록 쓰기 — ${summary(c.save)}`, () => apply(c.save, c.at), 'main wide'));
    const r2 = add('', 'acRow'); r2.append(btn(`📱 이 기기 기록으로 계정 덮어쓰기 — ${summary(S)}`, () => { acct.at = c.at; acct.dirty = true; store(); choose = null; push(); ui(); }, 'wide'));
    return;
  }
  if (!acct && offline) {   // 혼자 하기 중(설정 칸)
    add('<b>📴 혼자 하기 중</b> <small>인터넷 없이</small>', 'acHead');
    const r = add('', 'acRow'); r.append(btn('👤 아이디로 들어가기', leaveOffline, 'main'));
    add('기록은 이 기기에만 쌓여요. 기기를 바꾸거나 브라우저 기록을 지우면 사라질 수 있어요. 아이디를 새로 만들면 혼자 하던 기록이 계정으로 올라가요. 랭킹·친구와 함께는 인터넷과 아이디가 필요해요.', 'acNote');
  } else if (!acct) {
    // 0.54: 로그인 화면과 새로 만들기 화면을 나눈다(아이디를 안 쓰고 「새로 만들기」를 눌러 안 된다고 느끼던 문제)
    const su = form === 'signup';
    add(su ? '<b>✨ 새 아이디 만들기</b> <small>처음 오셨나요?</small>' : '<b>👤 로그인</b> <small>아이디로 들어와서 해요</small>', 'acHead');
    const f = add('', 'acForm');
    const lab = t => { const s = document.createElement('small'); s.className = 'acLab'; s.textContent = t; f.append(s); };
    const id = document.createElement('input'); id.placeholder = su ? '만들 아이디 (영어 소문자·숫자 4~16글자)' : '아이디'; id.maxLength = 16; id.autocapitalize = 'none'; id.autocomplete = 'username'; id.spellcheck = false; id.value = lastId;
    const pw = document.createElement('input'); pw.type = 'password'; pw.placeholder = su ? '비밀번호 (6글자 이상, 아무 글자)' : '비밀번호'; pw.maxLength = 64; pw.autocomplete = su ? 'new-password' : 'current-password';
    const pw2 = document.createElement('input'); pw2.type = 'password'; pw2.placeholder = '비밀번호 한 번 더'; pw2.maxLength = 64; pw2.autocomplete = 'new-password';
    if (su) { lab('① 아이디'); f.append(id); lab('② 비밀번호'); f.append(pw); lab('③ 비밀번호 확인'); f.append(pw2); } else f.append(id, pw);
    const kp = add('', 'acKeep', 'label'), keep = document.createElement('input'); keep.type = 'checkbox';
    kp.append(keep, document.createTextNode(' 이 기기에서 로그인 유지 (내 기기일 때만)'));
    const go = () => {
      if (su && pw.value !== pw2.value) { lastId = id.value; msg = '비밀번호와 확인이 서로 달라요. 똑같이 두 번 써 주세요.'; ui(); return; }
      enter(su ? 'signup' : 'login', id.value, pw.value, keep.checked);
    };
    const calm = () => { if (msg && !busy) { msg = ''; const m = el.querySelector('.acMsg'); if (m) m.remove(); } };   // 다시 쓰기 시작하면 앞 안내는 지운다
    [id, pw, pw2].forEach(x => x.addEventListener('input', calm));
    (su ? pw2 : pw).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const r = add('', 'acRow');
    if (su) r.append(btn('✨ 만들고 시작하기', go, 'main'), btn('← 로그인으로', () => { lastId = id.value; form = 'login'; msg = ''; ui(); }));
    else {
      r.append(btn('로그인', go, 'main'));
      const r2 = add('<span>처음 오셨나요?</span>', 'acRow acNew'); r2.append(btn('✨ 새 아이디 만들기', () => { lastId = id.value; form = 'signup'; msg = ''; ui(); }, 'main'));
    }
    add('이메일·실명은 받지 않아요. 비밀번호를 잊으면 되찾을 수 없으니 잘 기억해 두세요. 유지를 고르지 않으면 창을 닫을 때 로그아웃돼요.', 'acNote');
    const r2 = add('', 'acRow acSolo'); r2.append(btn('📴 인터넷 없이 혼자 하기', () => goOffline(keep.checked), 'wide'));
    add('혼자 하기 기록은 이 기기에만 쌓여요. 아이디 기록과는 따로라서 섞이지 않아요(새 아이디는 늘 처음부터).', 'acNote');
  } else {
    const when = acct.last ? new Date(acct.last).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    add(`<b>👤 ${esc(acct.uid)}</b> <small>로그인됨 · ${acct.dirty ? '저장 대기 중' : when ? `☁️ ${when} 저장됨` : '☁️ 저장됨'}</small>`, 'acHead');
    const r = add('', 'acRow');
    r.append(btn('☁️ 지금 저장', async () => { acct.dirty = true; await push(); if (!msg) msg = '저장했어요.'; ui(); }, 'main'), btn('비밀번호 바꾸기', passwd), btn('로그아웃', logout));
    add('기록은 판이 끝나거나 앱을 닫을 때 저절로 계정에 저장돼요. 한 번에 한 기기에서만 로그인돼요. 로그아웃하면 이 기기의 기록은 비워지고 계정에 남아요.', 'acNote');
  }
  if (msg) add(esc(msg), 'acMsg');
}

return { init, dirty, call: (fn, b) => (acct ? rpc(fn, Object.assign({ p_token: acct.token }, b)) : Promise.reject(new Error('session'))), keep: () => !!(acct && acct.keep), render, check, get uid() { return acct && acct.uid; }, get choosing() { return !!choose; }, get leaving() { return leaving; }, get offline() { return offline; } };
})();
