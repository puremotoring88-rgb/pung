// 볼트윙 — 첫 화면의 한 줄: 평소에는 시·명언·응원 한 줄, 운영자가 공지를 올리면 공지, 받는 사람을 위한 편지 링크(?to=코드)로 들어오면 편지.
// 공지와 편지는 Supabase의 notices 표에 운영자가 직접 적는다(server/notice.sql). 게임은 notice() 함수로 읽기만 한다.
window.Notice = (() => {
'use strict';
const URL = 'https://karluttarljwyutztbgx.supabase.co', KEY = 'sb_publishable_oT_Z6aYJ3uDZxcJeF3ArIA_4ivykkte', SK = 'boltwing.notice';
// 시는 저작권 보호 기간이 끝난 작품에서 짧게, 나머지는 널리 알려진 옛말과 볼트윙이 쓴 한 줄
const LINES = [
  ['죽는 날까지 하늘을 우러러 / 한 점 부끄럼이 없기를', '윤동주, 「서시」'],
  ['별 하나에 추억과 / 별 하나에 사랑과', '윤동주, 「별 헤는 밤」'],
  ['어제도 가고 오늘도 갈 / 나의 길 새로운 길', '윤동주, 「새로운 길」'],
  ['모란이 피기까지는 / 나는 아직 나의 봄을 기다리고 있을 테요', '김영랑, 「모란이 피기까지는」'],
  ['천 리 길도 한 걸음부터', '노자'],
  ['아는 것을 안다 하고, 모르는 것을 모른다 하는 것이 아는 것이다', '공자, 『논어』'],
  ['가장 중요한 것은 눈에 보이지 않아', '생텍쥐페리, 『어린 왕자』'],
  ['오늘 피한 탄 하나가 내일의 나를 조금 더 단단하게 만든다', '볼트윙'],
  ['구름이 많은 날에도 그 위의 하늘은 맑다', '볼트윙'],
  ['처음부터 잘하는 사람은 없어. 다시 출격하는 사람만 있을 뿐', '볼트윙'],
  ['느려도 괜찮아. 멈추지만 않으면 결국 도착해', '볼트윙'],
  ['같은 것 둘이 만나면 한 단계 올라간다. 친구도 그렇다', '볼트윙'],
  ['어려운 판에서 배우는 게 제일 많다. 뇌는 틀린 곳에서 길을 새로 낸다', '볼트윙'],
  ['잘 자는 것도 실력이다. 배운 것은 자는 동안 단단해진다', '볼트윙'],
  ['오늘의 나는 어제의 나와만 겨루면 된다', '볼트윙'],
  ['지쳤다면 착륙해도 괜찮아. 하늘은 내일도 있어', '볼트윙'],
  ['누군가를 구하러 가는 길에서 가장 용감해진다', '볼트윙'],
  ['작은 고철도 모이면 날개가 된다', '볼트윙'],
];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const br = s => esc(s).replace(/\n/g, '<br>');   // 공지·편지: 줄 바꿈 그대로
const brLine = s => esc(s).replace(/\s*\/\s*/g, '<br>');   // 시: / 를 줄 바꿈으로
const mem = () => { try { return JSON.parse(localStorage.getItem(SK) || '{}'); } catch (e) { return {}; } };
const keep = m => { try { localStorage.setItem(SK, JSON.stringify(m)); } catch (e) { /* 무시 */ } };
let el = null, card = null;

function init() {
  el = document.getElementById('notice');
  const q = new URLSearchParams(location.search), code = (q.get('to') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (q.has('to')) { q.delete('to'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }   // 주소에서 편지 코드를 지운다
  const m = mem(), L = LINES[(Math.random() * LINES.length) | 0];
  card = { kind: 'line', body: L[0], who: L[1] };
  draw();
  fetch(`${URL}/rest/v1/rpc/notice`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_code: code || null }) })
    .then(r => (r.ok ? r.json() : [])).then(rows => {
      const to = rows.find(r => r.kind === 'to'), all = rows.find(r => r.kind === 'all');
      if (to) letter(to);
      if (all && m.closed !== all.at) { card = { kind: 'all', title: all.title, body: all.body, at: all.at }; draw(); }
    }).catch(() => {});
}
function draw() {
  if (!el || !card) return;
  el.classList.remove('hidden');
  if (card.kind === 'all') {
    el.className = 'notice all';
    el.innerHTML = `<b>📢 ${esc(card.title || '공지')}</b><p>${br(card.body)}</p><button class="nClose" title="닫기">✕</button>`;
    el.querySelector('.nClose').addEventListener('click', () => { const m = mem(); m.closed = card.at; keep(m); const L = LINES[(Math.random() * LINES.length) | 0]; card = { kind: 'line', body: L[0], who: L[1] }; draw(); });
  } else {
    el.className = 'notice';
    el.innerHTML = `<p>${brLine(card.body)}</p><small>— ${esc(card.who)}</small>`;
  }
}
function letter(n) {   // 받는 사람을 위한 편지: 크게 한 번 띄운다
  const box = document.createElement('div'); box.className = 'letter';
  box.innerHTML = `<div class="lCard"><div class="lTop">💌</div><b>${esc(n.title || '너에게 보내는 편지')}</b><p>${br(n.body)}</p><small>볼트윙을 만든 사람이 보냅니다</small><button>고마워요, 출격할게요 ✈️</button></div>`;
  box.querySelector('button').addEventListener('click', () => box.remove());
  document.getElementById('stage').append(box);
}
return { init };
})();
