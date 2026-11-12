// 볼트윙 — 계정(아이디·비밀번호)으로 기록 이어 하기. 기기가 바뀌어도 로그인하면 이어서 한다.
// 서버(Supabase)의 acct_* 함수로만 오간다(server/ranking.sql 3번). 비밀번호는 서버에서 bcrypt로 바꿔 저장한다.
// 다른 기기에서 그사이 저장했으면 덮어쓰지 않고 어느 기록을 쓸지 묻는다.
window.Cloud = (() => {
'use strict';
const URL = 'https://karluttarljwyutztbgx.supabase.co';
const KEY = 'sb_publishable_oT_Z6aYJ3uDZxcJeF3ArIA_4ivykkte';
const AK = 'boltwing.acct';   // 로그인 정보(아이디·접속표). 기록(S)과 따로 둬서 저장 코드에 섞이지 않게
let lastId = '', getS, saveKey, canReload, sfx, onUi, acct = null, timer = null, busy = false, msg = '', choose = null;

const read = () => { try { return JSON.parse(localStorage.getItem(AK) || 'null'); } catch (e) { return null; } };
const store = () => { try { if (acct) localStorage.setItem(AK, JSON.stringify(acct)); else localStorage.removeItem(AK); } catch (e) { /* 무시 */ } };
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
  if (acct) check(!!acct.dirty);   // 앱을 열 때 저절로 하는 저장보다 먼저, 이 기기에 안 올린 기록이 있었는지를 기준으로
  document.addEventListener('visibilitychange', () => { if (!acct) return; if (document.hidden) push(true); else if (canReload()) check(); });
  window.addEventListener('pagehide', () => { if (acct) push(true); });
}
// 게임이 저장할 때마다 불린다: 잠시 모았다가 올린다(자주 올리지 않게)
function dirty() { if (!acct) return; acct.dirty = true; store(); clearTimeout(timer); timer = setTimeout(() => push(), 15000); }

async function push(keepalive) {
  if (!acct || !acct.dirty || busy || choose) return;
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
  location.reload();
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
async function enter(kind, id, pw) {
  id = String(id || '').trim().toLowerCase(); lastId = id;
  if (!/^[a-z0-9_]{4,16}$/.test(id)) { msg = '아이디는 영어 소문자·숫자·_ 로 4~16글자예요.'; ui(); return; }
  if (String(pw || '').length < 6) { msg = '비밀번호는 6글자 이상이에요.'; ui(); return; }
  msg = kind === 'signup' ? '만드는 중…' : '로그인하는 중…'; ui();
  try {
    const token = await rpc(kind === 'signup' ? 'acct_signup' : 'acct_login', { p_uid: id, p_pw: pw });
    acct = { uid: id, token, at: null, dirty: true }; store(); msg = '';
    sfx('part');
    if (kind === 'signup') { await push(); msg = '계정을 만들고 지금 기록을 올렸어요. 다른 기기에서 이 아이디로 로그인하면 이어서 할 수 있어요.'; ui(); return; }
    const r = (await rpc('acct_load', { p_token: token }) || [])[0], S = getS();
    if (!r || !r.save) { await push(); msg = '로그인했어요. 이 기기 기록을 계정에 올렸어요.'; ui(); return; }
    if (!S.plays && !S.cleared) { apply(r.save, r.save_at); return; }   // 이 기기는 새것이면 바로 계정 기록으로
    choose = { save: r.save, at: r.save_at }; ui();
  } catch (e) { msg = why(e); ui(); }
}
async function logout() {
  if (!acct) return;
  await push();
  const t = acct.token; acct = null; store(); msg = '로그아웃했어요. 기록은 이 기기에도 남아 있어요.'; ui();
  rpc('acct_logout', { p_token: t }).catch(() => {});
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
  if (!acct) {
    add('<b>👤 계정</b> <small>기기가 바뀌어도 이어서 하려면</small>', 'acHead');
    const f = add('', 'acForm');
    const id = document.createElement('input'); id.placeholder = '아이디 (영어 소문자·숫자 4~16)'; id.maxLength = 16; id.autocapitalize = 'none'; id.autocomplete = 'username'; id.spellcheck = false; id.value = lastId;
    const pw = document.createElement('input'); pw.type = 'password'; pw.placeholder = '비밀번호 (6글자 이상)'; pw.maxLength = 64; pw.autocomplete = 'current-password';
    f.append(id, pw);
    const r = add('', 'acRow');
    r.append(btn('로그인', () => enter('login', id.value, pw.value), 'main'), btn('새로 만들기', () => enter('signup', id.value, pw.value)));
    add('이메일·실명은 받지 않아요. 비밀번호를 잊으면 되찾을 수 없으니 잘 기억해 두세요.', 'acNote');
  } else {
    const when = acct.last ? new Date(acct.last).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    add(`<b>👤 ${esc(acct.uid)}</b> <small>로그인됨 · ${acct.dirty ? '저장 대기 중' : when ? `☁️ ${when} 저장됨` : '☁️ 저장됨'}</small>`, 'acHead');
    const r = add('', 'acRow');
    r.append(btn('☁️ 지금 저장', async () => { acct.dirty = true; await push(); if (!msg) msg = '저장했어요.'; ui(); }, 'main'), btn('비밀번호 바꾸기', passwd), btn('로그아웃', logout));
    add('기록은 판이 끝나거나 앱을 닫을 때 저절로 계정에 저장돼요. 한 번에 한 기기에서만 로그인돼요.', 'acNote');
  }
  if (msg) add(esc(msg), 'acMsg');
}

return { init, dirty, render, check, get uid() { return acct && acct.uid; } };
})();
