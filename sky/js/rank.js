// 볼트윙(by motive) — 랭킹. Supabase에 별명·보석·점수만 올린다(실명·이메일 없음).
// 게임을 하면 모두 자동으로 올라간다(설정에서 빠질 수 있음). 1~3위만이 아니라 모든 사람이 '구역'과 내 순위를 본다.
// 게임은 표를 직접 만지지 못하고 서버 함수 submit_score / board / my_rank 로만 오간다(server/ranking.sql).
window.Rank = (() => {
'use strict';
const URL = 'https://karluttarljwyutztbgx.supabase.co';
const KEY = 'sb_publishable_oT_Z6aYJ3uDZxcJeF3ArIA_4ivykkte';   // 공개용 열쇠(누구나 봐도 되는 키)
const MODES = [['league', '🏅 주간 리그'], ['stage', '🗺️ 스테이지'], ['endless', '♾️ 무한 생존'], ['rush', '👑 보스 러시'], ['dojo', '🎵 리듬 도장']];
// 이름 앞 보석: 조종사 계급(Lv)이 오를수록 귀한 보석
const GEMS = [[40, '다이아', '#bff6ff'], [30, '루비', '#ff4d6d'], [20, '사파이어', '#4c9bff'], [15, '에메랄드', '#3fe39a'], [10, '금', '#ffd166'], [6, '은', '#dfe7f2'], [3, '동', '#d08a4a'], [1, '강철', '#8f9aa8']];
// 구역: 순위가 높을수록 더 높은 하늘. 상위 몇 %인지로 정해서, 사람이 많아져도 누구나 자기 구역이 있다
const ZONES = [[0.01, '🚀', '우주', '#ff9df0'], [0.05, '🌌', '성층권', '#b48cff'], [0.15, '✨', '오로라', '#5ee6c8'], [0.3, '☁️', '구름 위', '#9fd0ff'], [0.5, '🌤️', '하늘', '#ffd166'], [1, '🛫', '활주로', '#b9c8dc']];
const BAD = /(씨발|시발|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|개새|좆|존나|졸라|섹스|느금|니애미|애미|에미|창녀|fuck|shit|bitch|sex|porn)/i;
let S, save, sfx, ver = '', view = { mode: 'league', week: true }, cache = {};

const gemOf = lv => GEMS.find(g => lv >= g[0]) || GEMS[GEMS.length - 1];
const gem = lv => { const g = gemOf(lv); return `<i class="gem" style="--c:${g[2]}" title="${g[1]} (조종사 Lv ${lv})"></i>`; };
const zoneIdx = (pos, total) => ZONES.findIndex(z => pos <= Math.ceil(total * z[0]));
const zoneTag = (pos, total) => { const z = ZONES[zoneIdx(pos, total)]; return `<em class="zone" style="--c:${z[3]}">${z[1]} ${z[2]}</em>`; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const nickProblem = n => (!/^[가-힣a-zA-Z0-9_]{2,10}$/.test(n) ? '별명은 한글·영어·숫자로 2~10글자(띄어쓰기·기호 없이)' : BAD.test(n) ? '쓸 수 없는 말이 들어 있어요' : '');
const why = e => { const m = String(e && e.message || e); return /bad word/.test(m) ? '쓸 수 없는 말이 들어 있어요' : /bad nick/.test(m) ? '별명 모양이 맞지 않아요' : /too fast/.test(m) ? '조금 뒤에 다시 올려 주세요' : /bad score/.test(m) ? '기록이 이상해서 올리지 않았어요' : /Failed to fetch|NetworkError/.test(m) ? '인터넷 연결을 확인해 주세요' : '랭킹 서버에 닿지 못했어요'; };
const fmtScore = (mode, r) => (mode === 'dojo' ? '' : Number(r.score).toLocaleString());

function rpc(fn, body) {
  return fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.status === 204 ? null : r.json().catch(() => null); });
}
function init(o) {
  S = o.S; save = o.save; sfx = o.sfx || (() => {}); ver = o.ver || ''; gift = o.gift || null;
  S.rank = S.rank || {};
  if (!S.rank.dev) S.rank.dev = uuid();
  if (!S.nick || nickProblem(S.nick)) S.nick = '조종사' + ((Math.random() * 9000 + 1000) | 0);   // 처음엔 자동 별명, 언제든 바꿀 수 있다
  save();
}
const joined = () => !S.rank.off;

// ---------- 주간 리그(server/league.sql): 주간 별로 30명 조 안에서 겨루고, 주가 바뀌면 위 20% 승급·아래 20% 강등 ----------
const LEAGUE = [['🛩️', '훈련', '#b9c8dc'], ['🦅', '독수리', '#d08a4a'], ['⚡', '번개', '#ffd166'], ['🌪️', '폭풍', '#5ee6c8'], ['☄️', '혜성', '#b48cff'], ['👑', '전설', '#ff9df0']];
const lgTag = t => { const L = LEAGUE[t] || LEAGUE[0]; return `<em class="zone" style="--c:${L[2]}">${L[0]} ${L[1]} 리그</em>`; };
const noLg = e => /PGRST202|Could not find the function|does not exist/.test(String(e && e.message || e));   // 서버에 리그 함수가 아직 없을 때
const lgCut = n => ({ up: n >= 5 ? Math.ceil(n * 0.2) : n >= 2 ? 1 : 0, down: n >= 5 ? Math.floor(n * 0.2) : 0 });
let lg = null, gift = null;   // lg: 마지막으로 받은 내 리그 정보, gift: 지난주 결과를 받으면 부르는 게임 쪽 함수
function lgGot(d) {   // 서버 답: 내 조 + (있으면) 받지 않은 지난주 결과
  if (!d) return d; lg = d; S.rank.lgTier = d.tier;
  if (d.result && gift) rpc('league_claim', { p_device: S.rank.dev }).then(r => { if (r) gift(r, LEAGUE); }).catch(() => {});
  return d;
}
function lgMine(d) { const rows = (d && d.rows) || [], me = rows.find(r => r.me); return me ? { pos: Number(me.pos), n: rows.length } : null; }
// 주간 별이 늘 때마다(결과 화면): 올리고, box가 있으면 한 줄 보여 준다
function league(pts, box) {
  if (!joined()) return;
  const line = box ? document.createElement('div') : null;
  if (line) { line.className = 'rankLine'; line.textContent = '🏅 리그에 올리는 중…'; box.append(line); }
  rpc('league_submit', { p_device: S.rank.dev, p_pts: pts, p_nick: S.nick, p_lv: S.pilot.lv })
    .then(lgGot).then(d => { cache.league = null;
      const m = lgMine(d); if (!line) return;
      if (!m) { line.textContent = '🏅 리그에 올렸어요'; return; }
      const c = lgCut(m.n), zone = m.pos <= c.up ? ' · <b class="lgUp">⬆ 승급권</b>' : c.down && m.pos > m.n - c.down ? ' · <b class="lgDown">⬇ 강등권</b>' : '';
      line.innerHTML = `🏅 ${lgTag(d.tier)} 조 <b>${m.pos}위</b> / ${m.n}명${zone}`;
    })
    .catch(e => { if (!line) return; if (noLg(e)) line.remove(); else line.textContent = '🏅 ' + why(e); });
}
function leagueView(el, add, stat) {
  const end = new Date(); end.setDate(end.getDate() + (7 - (end.getDay() + 6) % 7)); end.setHours(0, 0, 0, 0);
  const left = Math.max(0, end - Date.now()), dd = Math.floor(left / 864e5), hh = Math.floor(left / 36e5) % 24;
  const list = add('<p class="note">불러오는 중…</p>', 'rkList');
  add(`판을 하면 모이는 <b>주간 별</b>로 겨뤄요. 같은 리그 사람 30명이 한 조. 주가 바뀌면(월요일) 조에서 위 20%는 승급, 아래 20%는 강등(5명 이상일 때), 쉬는 주에는 그대로예요. 보상 고철: 기본 20+리그×10, 1·2·3등 150·100·70 더, 승급 50 더. 리그: ${LEAGUE.map(L => L[0] + ' ' + L[1]).join(' → ')}.`, 'note');
  const show = d => {
    const rows = d.rows || [], m = lgMine(d), c = lgCut(rows.length);
    stat.innerHTML = `${lgTag(d.tier)} ${m ? `조 <b>${m.pos}위</b> / ${rows.length}명` : '이번 주는 아직 참가 전'} · ⏳ ${dd ? dd + '일 ' : ''}${hh}시간 남음`;
    if (!d.joined) { list.innerHTML = `<p class="note">이번 주에 한 판 하면 ${lgTag(d.tier)}의 조에 들어가요!</p>`; return; }
    let html = '';
    rows.forEach((r, i) => {
      const pos = Number(r.pos), cls = pos <= c.up ? ' lgU' : c.down && pos > rows.length - c.down ? ' lgD' : '';
      if (i === c.up && c.up) html += '<div class="rkGap lgLine">⬆ 여기까지 승급</div>';
      if (c.down && pos === rows.length - c.down + 1) html += '<div class="rkGap lgLine down">⬇ 여기부터 강등</div>';
      html += `<div class="rk${r.me ? ' me' : ''}${cls}"><span class="pos">${['🥇', '🥈', '🥉'][pos - 1] || pos}</span><span class="who">${gem(r.lv)}${esc(r.nick)}</span><b>⭐ ${Number(r.pts).toLocaleString()}</b></div>`;
    });
    list.innerHTML = html;
  };
  if (!joined()) { stat.textContent = '랭킹에서 빠져 있어서 리그에도 참가하지 않아요'; list.innerHTML = ''; return; }
  if (cache.league && Date.now() - cache.league.t < 30000) { show(cache.league.d); return; }
  rpc('league_board', { p_device: S.rank.dev }).then(lgGot)
    .then(d => { cache.league = { t: Date.now(), d }; if (list.isConnected) show(d); })
    .catch(e => { if (list.isConnected) { list.innerHTML = `<p class="note">${noLg(e) ? "🏅 주간 리그 서버를 준비하는 중이에요. 조금만 기다려 주세요!" : why(e)}</p>`; stat.textContent = ''; } });
}
// 격납고를 열 때 한 번: 지난주 결과가 있으면 받는다
function leagueCheck() { if (S && joined() && S.rank.lgSeen !== new Date().toDateString()) { S.rank.lgSeen = new Date().toDateString(); rpc('league_board', { p_device: S.rank.dev }).then(lgGot).catch(() => {}); } }

// 판이 끝났을 때: 자동으로 올리고 결과 화면에 이번 주 순위와 구역을 보여 준다
function after(mode, score, info, ok = true) {
  const box = document.getElementById('rStats');
  if (!ok || !box || !joined()) return;
  const line = document.createElement('div'); line.className = 'rankLine';
  line.textContent = '🏆 랭킹에 올리는 중…'; box.append(line);
  rpc('submit_score', { p_device: S.rank.dev, p_mode: mode, p_score: Math.round(score), p_nick: S.nick, p_lv: S.pilot.lv, p_info: info, p_ver: ver })
    .then(() => rpc('my_rank', { p_device: S.rank.dev, p_mode: mode, p_week: true }))
    .then(r => {
      cache = {};
      const m = r && r[0];
      if (!m) { line.textContent = '🏆 올렸어요'; return; }
      line.innerHTML = `🏆 이번 주 ${zoneTag(m.pos, m.total)} <b>${m.pos}위</b> / ${m.total}명 <small>· 격납고 🏆 랭킹에서 자세히</small>`;
    })
    .catch(e => { line.textContent = '🏆 ' + why(e); });
}

// 격납고의 랭킹 칸
function render(el) {
  el.innerHTML = '';
  const add = (html, cls = '', tag = 'div') => { const d = document.createElement(tag); if (cls) d.className = cls; d.innerHTML = html; el.append(d); return d; };
  const g = gemOf(S.pilot.lv);
  const me = add(`${gem(S.pilot.lv)}<b>${esc(S.nick)}</b> <small>${g[1]} 보석 · 조종사 Lv ${S.pilot.lv}${joined() ? '' : ' · 랭킹에서 빠져 있음'}</small><div class="rkStat">불러오는 중…</div>`, 'rkMe');
  const row = add('', 'rkRow');
  const b1 = document.createElement('button'); b1.className = 'rkBtn'; b1.textContent = '✏️ 별명 바꾸기';
  b1.addEventListener('click', () => { const n = (window.prompt('새 별명(한글·영어·숫자 2~10글자, 실명·학교 이름은 쓰지 마세요)', S.nick) || '').trim(); if (!n || n === S.nick) return; const p = nickProblem(n); if (p) { window.alert(p); return; } S.nick = n; save(); sfx('part'); render(el); });
  const b2 = document.createElement('button'); b2.className = 'rkBtn sub'; b2.textContent = joined() ? '랭킹에서 빠지기' : '랭킹에 다시 참여';
  b2.addEventListener('click', () => { if (joined() && !window.confirm('앞으로의 기록을 올리지 않을까요? (이미 올린 이번 주 기록은 다음 주에 주간 순위에서 사라져요)')) return; S.rank.off = !S.rank.off; save(); render(el); });
  row.append(b1, b2);
  if (/^조종사\d+$/.test(S.nick)) add('지금 별명은 자동으로 붙은 이름이에요. 마음에 드는 별명으로 바꿔 보세요! (실명·학교 이름 말고)', 'rkHint');
  const chips = add('', 'rkChips');
  for (const [id, label] of MODES) { const b = document.createElement('button'); b.textContent = label; b.className = view.mode === id ? 'on' : ''; b.addEventListener('click', () => { view.mode = id; sfx('click'); render(el); }); chips.append(b); }
  if (view.mode === 'league') { leagueView(el, add, me.querySelector('.rkStat')); return; }
  const wk = add('', 'rkChips small');
  for (const [w, label] of [[true, '이번 주'], [false, '전체']]) { const b = document.createElement('button'); b.textContent = label; b.className = view.week === w ? 'on' : ''; b.addEventListener('click', () => { view.week = w; sfx('click'); render(el); }); wk.append(b); }
  const zl = add(ZONES.map(z => `<em class="zone" style="--c:${z[3]}">${z[1]} ${z[2]}<small>${z[0] < 1 ? `상위 ${z[0] * 100}%` : '나머지'}</small></em>`).join(''), 'rkZones');
  zl.title = '순위가 높을수록 더 높은 하늘. 사람이 늘어도 누구나 자기 구역이 있어요';
  const list = add('<p class="note">불러오는 중…</p>', 'rkList');
  add('구역은 이번 주(또는 전체) 순위가 상위 몇 %인지로 정해져요. 보석은 조종사 계급: 강철 → 동(Lv 3) → 은(6) → 금(10) → 에메랄드(15) → 사파이어(20) → 루비(30) → 다이아(40). 친구와 함께 한 판·지원 출격은 올라가지 않아요.', 'note');
  const stat = me.querySelector('.rkStat');
  const show = rows => {
    const mine = rows.find(r => r.me), shown = rows.filter(r => r.shown);
    if (mine) {
      const zi = zoneIdx(mine.pos, mine.total);
      let next = '';
      if (zi > 0) {   // 한 구역 위로 가려면 몇 점이 필요한가
        const cutPos = Math.ceil(mine.total * ZONES[zi - 1][0]), cut = rows.find(r => r.pos === cutPos);
        if (cut && view.mode !== 'dojo') next = ` · ${ZONES[zi - 1][1]} ${ZONES[zi - 1][2]}까지 <b>${Math.max(1, Number(cut.score) - Number(mine.score) + 1).toLocaleString()}점</b>`;
        else if (cut) next = ` · 다음 구역: ${ZONES[zi - 1][1]} ${ZONES[zi - 1][2]}`;
      }
      stat.innerHTML = `${view.week ? '이번 주' : '전체'} ${zoneTag(mine.pos, mine.total)} <b>${mine.pos}위</b> / ${mine.total}명 · 상위 ${Math.max(1, Math.round(mine.pos / mine.total * 100))}%${next}`;
    } else stat.textContent = joined() ? '이 모드에서는 아직 기록이 없어요. 한 판 하면 자동으로 올라가요!' : '';
    if (!shown.length) { list.innerHTML = '<p class="note">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!</p>'; return; }
    let html = '', prev = 0, zPrev = -1;
    for (const r of shown) {
      const zi = zoneIdx(r.pos, r.total);
      if (prev && r.pos > prev + 1) html += '<div class="rkGap">⋯</div>';
      if (zi !== zPrev) { const z = ZONES[zi]; html += `<div class="rkZoneHead" style="--c:${z[3]}">${z[1]} ${z[2]} 구역</div>`; zPrev = zi; }
      html += `<div class="rk${r.me ? ' me' : ''}"><span class="pos">${['🥇', '🥈', '🥉'][r.pos - 1] || r.pos}</span><span class="who">${gem(r.lv)}${esc(r.nick)}<small>${esc(r.info || '')}</small></span><b>${fmtScore(view.mode, r)}</b></div>`;
      prev = r.pos;
    }
    list.innerHTML = html;
    const meRow = list.querySelector('.rk.me');
    if (meRow && Number(mine.pos) > 8) { const jump = document.createElement('button'); jump.className = 'rkBtn sub rkJump'; jump.textContent = `⬇ 내 자리(${mine.pos}위)로`; jump.addEventListener('click', () => meRow.scrollIntoView({ behavior: 'smooth', block: 'center' })); list.before(jump); }
  };
  const k = view.mode + view.week;
  if (cache[k] && Date.now() - cache[k].t < 30000) { show(cache[k].rows); return; }
  rpc('board', { p_mode: view.mode, p_week: view.week, p_device: S.rank.dev, p_top: 100, p_near: 5 })
    .then(rows => { rows = (rows || []).map(r => ({ ...r, pos: Number(r.pos), total: Number(r.total) })); cache[k] = { t: Date.now(), rows }; if (list.isConnected) show(rows); })
    .catch(e => { if (list.isConnected) { list.innerHTML = `<p class="note">${why(e)}</p>`; stat.textContent = ''; } });
}

return { init, after, render, gem, gemOf, league, leagueCheck, LEAGUE, get lg() { return lg; } };
})();
