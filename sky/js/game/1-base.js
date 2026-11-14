// 볼트윙(BOLTWING, by motive) — 세로 화면 비행 슈팅.
// 격납고에서 기체·무기·부품을 고르고, 한 판(약 3분)마다 보스를 잡으면 다음 스테이지가 열린다. 스테이지가 오를수록 어려워진다.
// 판 중에는 그물 함정(연타해서 탈출)과 비트 러시(박자에 맞춰 톡)가 끼어들어 흐름이 바뀐다.
// 0.62: 4,800줄 한 파일을 js/game/ 아래 여러 파일로 나눔(로드맵 13-7). 이 파일이 맨 처음.
'use strict';
const D = window.DATA, A = window.AudioKit, Art = window.Art;
const W = 540, H = 960, TAU = Math.PI * 2;
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const bgc = $('bg'), bctx = bgc.getContext('2d'), BGW = 1012, BGH = 1380;   // 비스듬히 눕힌 배경(입체감). 판이 화면보다 훨씬 커서 넓고 길게 그린다
const SKIES = ['linear-gradient(#2f7fd6, #8fc8f5 40%, #d8efff)', 'linear-gradient(#2a1650, #b0446a 40%, #ffb37a)', 'linear-gradient(#01030a, #0a1c3a 40%, #1d4a6e)', 'linear-gradient(#000, #0a0620 40%, #24124a)',
  'linear-gradient(#1a1d22, #4a4a48 40%, #8a8070)', 'linear-gradient(#6f8fb0, #c8dcea 40%, #eef6fb)', 'linear-gradient(#120806, #3a1a10 40%, #7a3018)', 'linear-gradient(#24402a, #6f9a6a 40%, #c9e0b8)', 'linear-gradient(#f2b8a0, #f6d8d0 40%, #e8e0f4)'];
// 맵 9가지: 0 바다 섬, 1 사막, 2 밤 도시, 3 우주, 4 공장, 5 설원, 6 화산, 7 정글, 8 구름 위 성. 스테이지마다 이 순서로 돈다(보스 5종과 엇갈려 회차마다 다른 조합)
const THEME_ORDER = [0, 1, 2, 5, 4, 7, 6, 8, 3];
const themeFor = stage => THEME_ORDER[((stage - 1) % THEME_ORDER.length + THEME_ORDER.length) % THEME_ORDER.length];
// 0.38 챕터(로드맵 10-1): 맵 하나 = 스테이지 5개(1-1 ~ 1-5). 스테이지 번호는 안에서 1, 2, 3…으로 이어지고 화면에는 「챕터-번호」로 보인다
const CH = 5, chOf = s => Math.ceil(s / CH), subOf = s => (s - 1) % CH + 1, stLabel = s => `${chOf(s)}-${subOf(s)}`;
const stageTheme = s => themeFor(chOf(s));   // 스테이지 모드의 맵은 챕터마다
const lvOf = s => 1 + (s - 1) / 3;            // 난이도 수준(예전 스테이지 번호쯤): 스테이지 3개마다 1씩
// 스테이지의 끝: 5번째 = 챕터 보스, 3번째 = 보스 선발대(다음 챕터 보스, 체력 절반), 1·2·4번째 = 정예 편대(대장 장갑기 + 호위)
const stageEnd = s => (subOf(s) === 5 ? 'boss' : subOf(s) === 3 ? 'scout' : 'leader');
const stageBossIdx = s => (subOf(s) === 5 ? (chOf(s) - 1) % 5 : chOf(s) % 5);
const END_NM = { boss: '👑 챕터 보스', scout: '⚔️ 보스 선발대', leader: '🛡️ 정예 편대' };
const recPow = s => Math.min(2200, 560 + 24 * (s - 1));   // 스테이지 권장 전투력(새 기체 약 575, Lv 5까지 약 1600, 0.63 한계 돌파까지 약 2290)
// 0.47 다음 챕터 문: 챕터 c의 첫 스테이지는 지금까지 모은 별이 (c-1)×STAR_GATE개 이상이어야 열린다(한 챕터 별 15개 중 7개꼴). 이미 깬 곳은 그대로
const STAR_GATE = 7;
const totalStars = () => Object.values(S.stars || {}).reduce((n, a) => n + (a || []).filter(Boolean).length, 0);
const chNeed = s => (chOf(s) - 1) * STAR_GATE;
const gateOk = s => subOf(s) !== 1 || chOf(s) === 1 || S.cleared >= s || totalStars() >= chNeed(s);
let skyTheme = -1;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ---------- 저장(이 기기의 브라우저에 남는다) ----------
const SAVE_KEY = 'skybot.v1';
const fresh = () => ({ next: 1, maxStage: 1, cleared: 0, best: 0, scrap: 0, parts: {}, equip: { engine: null, armor: null, chip: null, drone: null },
  weapons: { vulcan: 1, spread: 1 }, frame: 'falcon', weapon: 'vulcan', music: true, sfx: true, vib: true, plays: 0,
  stars: {}, claimed: {}, stats: { kills: 0, ults: 0, bestCombo: 0, bossSeen: [], nohit: 0, escapes: 0, perfects: 0 },
  records: { wave: 0, endlessScore: 0, rush: 0, rushTime: 0 }, idle: { zone: 1, best: 0, rate: 0, lastSeen: 0, on: false, total: 0 },
  pilot: { lv: 1, xp: 0 }, research: {}, daily: { date: '', picks: [], cnt: {}, claimed: {} }, attend: { days: 0, last: '' }, mouse: true, seenHelp: false, openV: 1, seenOpen: {}, newDot: {}, lefty: false, dojo: { open: 1, best: {}, song: 'random', sync: 0, spd: 1 } });
const VERSION = '0.63';
let S = fresh();
try {
  const old = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
  S = Object.assign(fresh(), old);
  if (old.plays > 0 && !old.openV) S.openAll = true;   // 0.17 전부터 하던 사람은 모두 열린 것으로
  if (old.plays > 0 && !old.growV) {   // 0.42: 열림 순서를 챕터에 맞춰 늦췄다. 이미 열려 있던 것은 그대로 둔다
    const c = old.cleared || 0, got = {}, keep = {};
    for (const [id, n] of [['turtle', 0], ['hornet', 0], ['phoenix', 5], ['spread', 0], ['laser', 2], ['missile', 4]]) if (c >= n) got[id] = 1;
    for (const [k, n] of [['tab:parts', 1], ['tab:look', 1], ['tab:book', 1], ['mode:endless', 2], ['tab:ship', 2], ['mode:coop', 2], ['tab:research', 3], ['mode:dojo', 3], ['tab:rank', 3], ['mode:escape', 3], ['mode:auto', 4], ['mode:rush', 5]]) if (c >= n) keep[k] = 1;
    S.got = got; S.openKeep = keep;
  }
  S.growV = 1;
  S.stats = Object.assign(fresh().stats, old.stats || {});
  S.records = Object.assign(fresh().records, old.records || {});
  S.idle = Object.assign(fresh().idle, old.idle || {});
  S.pilot = Object.assign(fresh().pilot, old.pilot || {});
  S.dojo = Object.assign(fresh().dojo, old.dojo || {});
} catch (e) { /* 저장소를 못 쓰는 환경 */ }
const save = () => { if (window.Cloud && Cloud.leaving) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } if (window.Cloud) Cloud.dirty(); };   // 로그인했으면 계정에도(잠시 모았다가)
A.setMusic(S.music); A.setSfx(S.sfx);
const buzz = ms => { if (S.vib && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* 진동 없는 기기 */ } } };

const frameOf = id => D.FRAMES.find(f => f.id === id);
const weaponOf = id => D.WEAPONS.find(w => w.id === id);
const unlocked = o => !o.unlock || S.cleared >= o.unlock || !!(S.got && S.got[o.id]);   // S.got = 0.42 전에 이미 열려 있던 기체·무기
const eqLv = id => (Object.values(S.equip).includes(id) ? D.PEFF(S.parts[id] || 1) : 0);   // 0.63: Lv 6부터는 효과가 조금씩(PEFF)
const starCount = () => Object.values(S.stars).reduce((a, s) => a + s.filter(Boolean).length, 0);

// ---------- 도전 과제(이루면 고철을 받는다) ----------
const GOALS = [
  { id: 'kill100', name: '첫 사냥꾼', desc: '적 100대 부수기', val: () => S.stats.kills, need: 100, reward: 40 },
  { id: 'kill1000', name: '하늘의 사냥꾼', desc: '적 1000대 부수기', val: () => S.stats.kills, need: 1000, reward: 160 },
  { id: 'boss5', name: '다섯 보스', desc: '서로 다른 보스 5종 잡기', val: () => S.stats.bossSeen.length, need: 5, reward: 120 },
  { id: 'stage10', name: '먼 하늘', desc: '스테이지 2-5 클리어', val: () => S.cleared, need: 10, reward: 200 },
  { id: 'combo50', name: '연쇄 폭발', desc: '콤보 50 만들기', val: () => S.stats.bestCombo, need: 50, reward: 80 },
  { id: 'escape10', name: '그물 탈출 장인', desc: '그물에서 10번 빠져나오기', val: () => S.stats.escapes, need: 10, reward: 60 },
  { id: 'perfect50', name: '박자 감각', desc: '비트 러시 PERFECT 50번', val: () => S.stats.perfects, need: 50, reward: 80 },
  { id: 'parts6', name: '수집가', desc: '부품 6종 모으기', val: () => Object.keys(S.parts).length, need: 6, reward: 100 },
  { id: 'ult30', name: '필살의 하늘', desc: '궁극기 30번 쓰기', val: () => S.stats.ults, need: 30, reward: 60 },
  { id: 'nohit', name: '털끝 하나', desc: '한 번도 안 맞고 보스 잡기', val: () => S.stats.nohit, need: 1, reward: 150 },
  { id: 'stars15', name: '별 모으기', desc: '별 15개 모으기', val: () => starCount(), need: 15, reward: 120 },
  { id: 'maxweapon', name: '장인', desc: '무기 하나를 Lv 5까지', val: () => Math.max(...Object.values(S.weapons)), need: 5, reward: 100 },
];
// ---------- 오래 하게 만드는 뼈대: 조종사 계급, 연구, 오늘의 임무, 출석 ----------
const RANKS = ['훈련병', '이등 조종사', '일등 조종사', '편대원', '편대장', '교관', '에이스', '더블 에이스', '하늘의 별', '전설'];
const rankName = lv => (lv <= RANKS.length ? RANKS[lv - 1] : `전설 ${lv - RANKS.length + 1}`);
// 성장 속도(사용자 2026-11-13: 너무 빠르다): 조종사 레벨 곡선, 고철 수입, 레벨에 따라 열리는 판 안 아이템, 도감에 올리려면 잡아야 하는 수
const GROW = { rc: 1.5, scrap: 0.7, foeBook: 10, multiLv: 4, partLv: { turbo: 1, plate: 1, power: 2, blink: 3, rapid: 3, regen: 4, gun: 5, magnet: 6, ultchip: 7, guard: 8, seeker: 10 }, itemLv: { orb: 1, bomb: 1, magnet: 1, slow: 3, rapid: 5, gold: 7, twin: 9, clover: 12 } };
const pilotNeed = lv => 120 + 60 * lv + 6 * lv * lv;
// 0.47 조종사 레벨 이정표: 큰 고철 + 보상으로만 얻는 꾸미기(사지 못함) + 칭호. 놓친 이정표는 다음 판 끝에 받는다
const PILOT_MS = { 15: { scrap: 300, look: 'paint:gold', nm: '🎨 황금 도색' }, 20: { scrap: 500, look: 'flame:plasma', nm: '🔥 플라스마 불꽃' }, 25: { scrap: 700, look: 'trail:comet', nm: '☄️ 혜성 꼬리' }, 30: { scrap: 1000, look: 'decal:dragon', nm: '🐉 용 스티커' }, 40: { scrap: 1500, nm: '칭호 「하늘의 주인」' }, 50: { scrap: 2000, nm: '칭호 「살아 있는 전설」' } };
const nextMs = () => Object.keys(PILOT_MS).map(Number).find(l => l > S.pilot.lv);
const partsAvail = () => D.PARTS.filter(p => !S.parts[p.id] && (GROW.partLv[p.id] || 1) <= S.pilot.lv);   // 부품도 조종사 레벨에 따라 하나씩
const nextPartLv = () => Math.min(...D.PARTS.filter(p => !S.parts[p.id]).map(p => GROW.partLv[p.id] || 1), 99);
function gainPilotXp(x) {   // 판이 끝날 때마다 조종사 경험치. 계급이 오르면 고철을 받는다
  let ups = 0, reward = 0; const lv0 = S.pilot.lv;
  S.pilot.xp += x;
  while (S.pilot.xp >= pilotNeed(S.pilot.lv)) { S.pilot.xp -= pilotNeed(S.pilot.lv); S.pilot.lv++; ups++; reward += 20 + 10 * S.pilot.lv; }
  const ms = []; S.msGot = S.msGot || {};
  for (const l of Object.keys(PILOT_MS).map(Number)) if (l <= S.pilot.lv && !S.msGot[l]) { const m = PILOT_MS[l]; S.msGot[l] = 1; reward += m.scrap; if (m.look) { S.owned = S.owned || {}; S.owned[m.look] = 1; } ms.push(`🎁 Lv ${l} 보상: ${m.nm} · 🔩${m.scrap}`); }
  S.scrap += reward;
  const opened = Object.keys(GROW.itemLv).filter(k => GROW.itemLv[k] > lv0 && GROW.itemLv[k] <= S.pilot.lv).map(k => ITEMS[k].icon + ' ' + ITEMS[k].name).concat(GROW.multiLv > lv0 && GROW.multiLv <= S.pilot.lv ? ['🔱 탄 +1 줍기'] : [], D.PARTS.filter(p => (GROW.partLv[p.id] || 1) > lv0 && (GROW.partLv[p.id] || 1) <= S.pilot.lv).map(p => '⚙️ 부품 ' + p.name), ms);
  return { ups, reward, opened };
}
// 연구: 고철로 사는 영구 강화(모든 기체에 적용)
const RESEARCH = [
  { id: 'hull', icon: '🛡️', name: '선체 강화', max: 10, cost: l => Math.round(GROW.rc * 25 * (l + 1)), desc: l => `최대 체력 +${5 * l}%` },
  { id: 'fire', icon: '💥', name: '화력 연구', max: 10, cost: l => Math.round(GROW.rc * 30 * (l + 1)), desc: l => `피해 +${3 * l}%` },
  { id: 'cycle', icon: '⚡', name: '연사 연구', max: 10, cost: l => Math.round(GROW.rc * 30 * (l + 1)), desc: l => `연사 +${2 * l}%` },
  { id: 'pull', icon: '🧲', name: '자석 연구', max: 5, cost: l => Math.round(GROW.rc * 20 * (l + 1)), desc: l => `줍는 범위 +${10 * l}%` },
  { id: 'core', icon: '🌟', name: '궁극 연구', max: 5, cost: l => Math.round(GROW.rc * 35 * (l + 1)), desc: l => `궁극기 충전 +${5 * l}%` },
  { id: 'salvage', icon: '🔩', name: '고철 수집', max: 10, cost: l => Math.round(GROW.rc * 30 * (l + 1)), desc: l => `얻는 고철 +${5 * l}%` },
  { id: 'learn', icon: '📈', name: '전투 학습', max: 5, cost: l => Math.round(GROW.rc * 30 * (l + 1)), desc: l => `판 중 경험치 +${6 * l}%` },
  { id: 'revive', icon: '💖', name: '긴급 수리', max: 3, cost: l => Math.round(GROW.rc * 150 * (l + 1)), desc: l => (l ? `판마다 한 번, 쓰러질 때 체력 ${20 + 10 * l}%로 다시 일어남` : '판마다 한 번, 쓰러질 때 다시 일어남') },
];
const rs = id => S.research[id] || 0;
// 오늘의 임무: 날마다 셋이 뽑힌다. 출석: 들어온 날마다 하나씩(빠져도 끊기지 않는다)
const DAILY = [
  { id: 'k', text: '적 80대 부수기', key: 'kills', need: 80, reward: 30 },
  { id: 'b', text: '보스 1번 잡기', key: 'boss', need: 1, reward: 40 },
  { id: 'p', text: '비트 러시 PERFECT 12번', key: 'perfect', need: 12, reward: 35 },
  { id: 'c', text: '콤보 25 만들기', key: 'combo', need: 25, reward: 30 },
  { id: 'u', text: '궁극기 3번 쓰기', key: 'ult', need: 3, reward: 25 },
  { id: 's', text: '고철 80개 모으기', key: 'scrap', need: 80, reward: 30 },
  { id: 'r', text: '3판 출격하기', key: 'runs', need: 3, reward: 25 },
  { id: 'e', text: '그물에서 2번 빠져나오기', key: 'escape', need: 2, reward: 30 },
];
const ATTEND = [20, 30, 40, 50, 60, 80, 150];
const popups = [];   // 차례로 띄울 알림(출석, 자리 비움 보상)
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function rollDaily() {
  const t = today();
  if (S.daily.date === t) return;
  let seed = [...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  const pool = DAILY.map(d => d.id), picks = [];
  while (picks.length < 3) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; picks.push(pool.splice(seed % pool.length, 1)[0]); }
  S.daily = { date: t, picks, cnt: {}, claimed: {} };
  if (S.attend.last !== t) {
    comebackGift(S.attend.last, t);
    S.attend.last = t; S.attend.days++;
    const r = ATTEND[(S.attend.days - 1) % 7];
    S.scrap += r;
    popups.push({ title: '출석!', html: `<div>${S.attend.days}번째 출석</div><div class="big">🔩 ${r}</div><div class="rules">날마다 들어오면 보상이 커지고, 7번째에 가장 큽니다. 며칠 빠져도 이어집니다.</div>` });
  }
  save();
}
const dcount = (key, n = 1, asMax) => { rollDaily(); const c = S.daily.cnt; c[key] = asMax ? Math.max(c[key] || 0, n) : (c[key] || 0) + n; };
function showPopup() {
  const p = popups.shift();
  if (!p) { $('away').classList.add('hidden'); return false; }
  $('away').querySelector('h2').textContent = p.title; $('awayTxt').innerHTML = p.html; $('away').classList.remove('hidden');
  return true;
}
// ---------- 0.56 친구 초대: ?ref=친구 코드로 들어온 새 조종사가 아이디를 만들고 1-1을 깨면 둘 다 고철(server/invite.sql) ----------
const REF_GIFT = 100, REF_KEY = 'boltwing.ref', REF_DONE = 'boltwing.refDone';
const GAME_URL = 'https://puremotoring88-rgb.github.io/pung/sky/';
const myRefUrl = () => GAME_URL + (window.Friend && Friend.code ? `?ref=${Friend.code}` : '');   // 내 초대 링크(아이디가 없으면 그냥 주소)
{ const q = new URLSearchParams(location.search).get('ref'); try { if (q && /^[A-Za-z0-9]{6}$/.test(q) && !localStorage.getItem(REF_DONE)) localStorage.setItem(REF_KEY, q.toUpperCase()); } catch (e) { /* 무시 */ } }
const refWait = () => { try { return !localStorage.getItem(REF_DONE) && localStorage.getItem(REF_KEY); } catch (e) { return null; } };
let refBusy = false, refOff = false, refAt = 0;
async function refTick() {   // 격납고를 그릴 때마다(2분에 한 번): 받을 초대 보상이 있는지 본다
  if (refBusy || refOff || !Cloud.uid || Date.now() - refAt < 120000) return;
  refBusy = true; refAt = Date.now();
  try {
    const code = refWait(); let got = false;
    if (code && S.cleared >= 1) {
      const r = await Cloud.call('ref_claim', { p_code: code });
      if (r === 'ok') { got = true; S.scrap += REF_GIFT; save(); popups.push({ title: '🎁 초대 보상', html: `<div>친구의 초대로 와서 1-1을 깼어요!</div><div class="big">🔩 ${REF_GIFT}</div><div class="rules">초대해 준 친구도 고철 ${REF_GIFT}를 받아요.</div>` }); A.sfx('levelup'); }
      try { localStorage.setItem(REF_DONE, '1'); localStorage.removeItem(REF_KEY); } catch (e) { /* 무시 */ }   // 받았든 못 받았든 이 기기는 한 번만
    }
    const n = Math.max(0, Math.min(30, (await Cloud.call('ref_collect', {})) | 0));
    if (n) { got = true; S.scrap += REF_GIFT * n; save(); popups.push({ title: '🤝 초대한 친구가 왔어요!', html: `<div>내 초대 링크로 온 친구 ${n}명이 1-1을 깼어요</div><div class="big">🔩 ${REF_GIFT * n}</div>` }); A.sfx('levelup'); }
    if (got && state === 'hangar' && $('away').classList.contains('hidden')) { showPopup(); renderHangar(); }
  } catch (e) { if (/PGRST202|Could not find the function/.test(String(e && e.message || e))) refOff = true; }   // 서버에 아직 없으면 조용히 쉰다
  refBusy = false;
}
async function shareInvite() {   // 🔗 초대 링크 보내기(공유 창이 되는 기기는 카톡 등으로 바로)
  if (window.Friend && !Friend.code && Cloud.uid) { try { await Friend.poll(true); } catch (e) { /* 무시 */ } }   // 아직 내 코드를 못 받았으면 먼저
  const fc = window.Friend && Friend.code, url = myRefUrl(), text = `⚡ 볼트윙 같이 하자! 설치 없이 바로 하는 로봇 비행 슈팅이야.${fc ? ` 이 링크로 와서 아이디를 만들고 1-1을 깨면 우리 둘 다 고철 🔩${REF_GIFT}!` : ''}`;
  if (navigator.share) { try { await navigator.share({ title: '볼트윙 BOLTWING', text, url }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; } }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); return 'copied'; } catch (e) { window.prompt('이 링크를 친구에게 보내세요', url); return false; }
}
function gainScrap(v) {   // 고철 얻기(고철 수집 연구가 적용된다)
  run.scrapCarry = (run.scrapCarry || 0) + v * GROW.scrap * (1 + 0.05 * rs('salvage')) * (run.gambler ? 2 : 1) * (itemOn('gold') ? 2 : 1) * (run.coop ? 1.2 : 1) * (run.comeback ? 1.5 : 1);   // 황금 시간 2배, 함께 하면 20% 더, 돌아온 조종사 1.5배
  const whole = Math.floor(run.scrapCarry);
  run.scrapCarry -= whole; S.scrap += whole; run.scrapGot += whole;
  if (whole) dcount('scrap', whole);
}

// ---------- 주간 도전(로드맵 6단계): 판마다 주간 별을 모아 25칸을 연다. 모두 무료, 지난주 못 받은 칸은 자동으로 받는다 ----------
const WEEK = { tiers: 25, step: 3 };   // 칸마다 주간 별 3개(일주일에 20판쯤이면 다 연다)
function weekReward(i) {   // i: 1~25
  if (i === 25) return { k: 'title', v: 150, icon: '🏆', txt: '칭호 「주간 완주자」 + 고철 150' };
  if (i === 10 || i === 20) return { k: 'look', v: 0, icon: '🎨', txt: '꾸미기 하나 무료' };
  if (i === 5 || i === 15) return { k: 'part', v: 0, icon: '⚙️', txt: '새 부품(다 모았으면 고철 60)' };
  if (i === 8 || i === 12 || i === 18 || i === 22) return { k: 'core', v: 2, icon: '💠', txt: '코어 2(한계 돌파 재료)' };   // 0.63
  return { k: 'scrap', v: 20 + i * 4, icon: '🔩', txt: `고철 ${20 + i * 4}` };
}
function weekKey(d = new Date()) { d = new Date(d); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }   // 그 주 월요일
function weekRoll() {
  S.week = S.week || { key: '', pts: 0, got: {} };
  const k = weekKey(); if (S.week.key === k) return;
  if (S.week.key) {   // 지난주에 열어 두고 못 받은 칸은 자동으로 준다(놓쳐서 잃는 일이 없게)
    const reach = Math.min(WEEK.tiers, Math.floor(S.week.pts / WEEK.step)), got = [];
    for (let i = 1; i <= reach; i++) if (!S.week.got[i]) got.push(weekGive(i));
    if (got.length) popups.push({ title: '지난주 도전 보상', html: `<div>받지 않은 칸 ${got.length}개를 챙겨 왔어요</div><div class="rules">${got.join('<br>')}</div>` });
  }
  S.week = { key: k, pts: 0, got: {} }; save();
}
function weekGive(i) {
  const r = weekReward(i); S.week.got[i] = 1;
  if (r.k === 'scrap') { S.scrap += r.v; return `🔩 고철 ${r.v}`; }
  if (r.k === 'core') { addCores(r.v); return `💠 코어 ${r.v}`; }
  if (r.k === 'title') { S.weekDone = (S.weekDone || 0) + 1; S.scrap += r.v; return `🏆 「주간 완주자」 + 고철 ${r.v}`; }
  if (r.k === 'part') {
    const cand = partsAvail();
    if (!cand.length) { S.scrap += 60; return '🔩 고철 60(지금 받을 수 있는 부품을 다 모았어요)'; }
    const p = pick(cand); S.parts[p.id] = 1; if (!S.equip[p.slot]) S.equip[p.slot] = p.id; return `${p.icon} 새 부품 ${p.name}`;
  }
  S.owned = S.owned || {};   // 꾸미기: 아직 없는 것 중 하나(값이 높은 것부터 가능성 크게)
  const cand = []; for (const cat of Object.keys(LOOKS)) for (const it of LOOKS[cat].list) if (it[3] && !S.owned[cat + ':' + it[0]]) cand.push([cat, it]);
  if (!cand.length) { S.scrap += 80; return '🔩 고철 80(꾸미기를 다 모았어요)'; }
  const [cat, it] = pick(cand); S.owned[cat + ':' + it[0]] = 1; return `🎨 ${LOOKS[cat].name.replace(/^\S+ /, '')}: ${it[1]}`;
}
const weekReach = () => Math.min(WEEK.tiers, Math.floor(S.week.pts / WEEK.step));
const weekOpen = () => { weekRoll(); let n = 0; for (let i = 1; i <= weekReach(); i++) if (!S.week.got[i]) n++; return n; };
function weekGain() {   // 결과 화면에서: 판마다 주간 별
  weekRoll();
  const win = $('rTitle').className === 'win';
  let n = 1 + (win ? 2 : 0);
  if (run) { n += { S: 2, A: 1 }[run.bossRank] || 0; n += Math.min(2, Math.floor((run.kills || 0) / 60)); }
  const before = weekReach(); S.week.pts += n; const after = weekReach(); save();
  return `<div class="wkGain">📅 주간 별 +${n} <small>${after > before ? `· 새 칸 ${after - before}개 열림! (임무 탭)` : `· 다음 칸까지 ${WEEK.step - S.week.pts % WEEK.step}`}</small></div>`;
}
function renderWeekly(el) {
  weekRoll();
  const reach = weekReach(), open = weekOpen();
  const end = new Date(); end.setDate(end.getDate() + (7 - (end.getDay() + 6) % 7)); end.setHours(0, 0, 0, 0);
  const left = Math.max(0, end - Date.now()), dd = Math.floor(left / 864e5), hh = Math.floor(left / 36e5) % 24;
  el.innerHTML = `<div class="wkHead"><b>⭐ ${S.week.pts}</b><span>${reach} / ${WEEK.tiers}칸</span><small>⏳ ${dd ? dd + '일 ' : ''}${hh}시간 남음 · 판을 할 때마다 별(이기면·랭크·많이 부수면 더)</small>${open ? `<button id="wkAll" class="btn">🎁 ${open}칸 받기</button>` : ''}</div>
    <div class="wkRow">${Array.from({ length: WEEK.tiers }, (_, k) => { const i = k + 1, r = weekReward(i), got = S.week.got[i], ok = i <= reach; return `<div class="wkCell${got ? ' got' : ok ? ' ok' : ''}${i % 5 === 0 ? ' big' : ''}" title="${r.txt}"><em>${i}</em><span>${got ? '✔' : r.icon}</span><i>${r.k === 'scrap' ? r.v : r.k === 'title' ? '칭호' : r.k === 'look' ? '꾸미기' : '부품'}</i></div>`; }).join('')}</div>`;
  const b = el.querySelector('#wkAll');
  if (b) b.addEventListener('click', () => {
    const got = []; for (let i = 1; i <= reach; i++) if (!S.week.got[i]) got.push(weekGive(i));
    save(); A.sfx('levelup');
    popups.push({ title: '🎁 주간 도전 보상', html: `<div class="rules">${got.join('<br>')}</div>` }); showPopup(); renderHangar();
  });
  requestAnimationFrame(() => { const row = el.querySelector('.wkRow'), c = row && row.children[Math.max(0, reach - 2)]; if (c) row.scrollLeft = c.offsetLeft - 8; });
}
// 주간 리그: 지난주 결과(서버가 정산)를 받으면 고철을 주고 알려 준다
function leagueGift(r, L) {
  const was = L[r.tier] || L[0], now = L[r.new_tier] || L[0], rw = Math.max(0, Math.min(400, r.reward | 0));
  S.scrap += rw; save();
  const mv = r.move === 'up' ? `<div class="big">⬆ ${now[0]} ${now[1]} 리그로 승급!</div>` : r.move === 'down' ? `<div>⬇ ${now[0]} ${now[1]} 리그로 내려가요. 이번 주에 다시 올라가 봐요!</div>` : `<div>${now[0]} ${now[1]} 리그에 그대로 있어요</div>`;
  popups.push({ title: '🏅 지난주 리그 결과', html: `<div>${was[0]} ${was[1]} 리그 · 조 ${r.pos}위 / ${r.n}명 · ⭐ ${r.pts}</div>${mv}<div class="big">🔩 ${rw}</div>` });
  if (r.move === 'up') A.sfx('levelup');
  if (state === 'hangar' && $('away').classList.contains('hidden')) { showPopup(); renderHangar(); }
}
// 돌아온 조종사: 3일 이상 쉬었다가 오면 반가운 선물(고철 + 다음 3판 고철 1.5배)
function comebackGift(last, t) {
  const p = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  if (!last) return;
  const gap = Math.round((p(t) - p(last)) / 864e5);
  if (gap < 3) return;
  const g = 60 + 20 * Math.min(gap, 7);
  S.scrap += g; S.comeback = 3;
  popups.push({ title: '돌아온 조종사, 반가워요!', html: `<div>${gap}일 만이에요</div><div class="big">🔩 ${g}</div><div>🎁 다음 3판은 고철 1.5배</div><div class="rules">쉬어도 잃는 건 없어요. 출석도 그대로 이어집니다.</div>` });
}
// 게임 모드: 스테이지(이야기처럼 하나씩), 무한 생존, 보스 러시, 자동 출격(방치)
const MODES = [
  { id: 'stage', icon: '🗺️', name: '스테이지', go: '출격! ▶', desc: '한 판 약 3분. 보스를 잡으면 다음 스테이지가 열리고 점점 어려워집니다. 스테이지마다 별 3개.' },
  { id: 'endless', icon: '♾️', name: '무한 생존', go: '버티기 시작 ▶', desc: '끝없이 몰려오는 적을 버팁니다. 30초마다 웨이브가 오르고 90초마다 보스가 나옵니다. 얼마나 오래 버티나!' },
  { id: 'rush', icon: '👑', name: '보스 러시', go: '보스 러시 ▶', desc: '보스 다섯을 쉬지 않고 연달아 잡습니다. 다 잡으면 걸린 시간이 기록됩니다. 보스마다 부품 상자!' },
  { id: 'auto', icon: '⭐', name: '표창 공방', go: '공방 열기 ▶', desc: '넓은 들판에서 로봇을 직접 몰아 싸웁니다. 로봇은 쏘지 않아요! 가장 좋은 표창들이 둘레를 돌며 닿는 적을 베니, 로봇을 몰아 적에게 들이대세요. 🌀 던지기(X키)로 표창을 쭉 퍼뜨렸다 거둘 수 있어요. 적을 쓰러뜨릴수록 표창이 생겨 쌓입니다. 40초를 버티면 대장 등장! 쓰러뜨리면 정비 시간에 쌓인 표창을 몰아서 합쳐요(같은 단계 둘 → 한 단계 위). 적을 많이 쓰러뜨리면 표창 폭풍. 꺼 두어도 비운 시간만큼 금화를 받아요(최대 8시간, 절반 속도). 구역 10을 넘기면 환생해서 영원히 강해집니다.' },
];
MODES.push({ id: 'dojo', icon: '🎵', name: '리듬 도장', go: '리듬 결투 ▶', desc: '비행은 쉬고 리듬 게임만! 8가지 장르 곡 중에 골라, 4줄로 떨어지는 음표를 박자에 맞춰 누릅니다. B 랭크 이상이면 다음 단계가 열립니다.' });
MODES.push({ id: 'escape', icon: '🪂', name: '탈출 작전', go: '탈출 시작 ▶', desc: '(시험판) 오른쪽으로 나아가요! 비행기 → 비상 탈출 → 로프로 흔들며 이동 → 새를 타고 … 누르기 하나로 합니다. 손맛을 시험하는 중이라 그림은 단순해요.' });
MODES.push({ id: 'coop', icon: '🤝', name: '친구와 함께', go: '함께 출격 ▶', desc: '친구 1~2명과 같은 하늘에서 함께 싸웁니다. 한 명이 방을 만들고 코드나 초대 링크를 보내면 됩니다. 휴대폰과 PC가 섞여도 됩니다.' });
let selMode = 'stage', dojoLv = 1;
const STAR_RULES = ['클리어', '체력 절반 이상 남기고 클리어', '콤보 30 이상 만들기'];
const STAR_REWARD = 10;
// 0.63 💠 코어: 무기·부품 한계 돌파(Lv 6~10)에 쓴다. 보스 처치(챕터 보스 2)·스테이지 첫 클리어·주간 도전에서
const maxGearLv = () => Math.max(1, ...Object.values(S.weapons || {}), ...Object.values(S.parts || {}));
function addCores(n) { S.cores = (S.cores || 0) + n; if (run) run.coresGot = (run.coresGot || 0) + n; }
// 손맛 숫자(해 보고 조정): 큰 적·정예를 부술 때 잠깐 멈춤(초), 보스 처치 느린 화면(초·빠르기), 피해 숫자 간격(초)
const FEEL = { ultInv: 2, ultLock: 0, ultSec: 50, stopBig: 0.065, stopElite: 0.045, stopBoss: 0.14, slowBoss: 1.5, slowK: 0.3, numGap: 0.16 };
let hitStop = 0, slowT = 0, dnums = [];

// ---------- 그림 파일(있으면 쓰고 없으면 코드로 그린 그림) ----------
const IMG = {};
function loadImg(key) {
  const exts = ['png', 'webp', 'jpg'];
  const next = i => { if (i >= exts.length) return; const im = new Image(); im.onload = () => { IMG[key] = im; }; im.onerror = () => next(i + 1); im.src = `assets/${key}.${exts[i]}`; };
  next(0);
}
const ASSET_KEYS = ['falcon', 'turtle', 'hornet', 'phoenix'].map(k => 'ship-' + k).concat(['spider', 'whale', 'twins', 'knight', 'core'].map(k => 'boss-' + k), ['scout', 'weaver', 'diver', 'turret', 'splitter', 'tank', 'netter', 'treasure', 'm4', 'm5', 'm6', 'm7', 'm8'].map(k => 'enemy-' + k), ['civ-ddrone', 'civ-liner', 'obst-tower', 'obst-spire', 'obst-bldg'], ['esc-bird1', 'esc-bird2', 'esc-p-rope', 'esc-p-fly', 'esc-p-fall', 'esc-p-sit', 'esc-pilot', 'side-spider', 'side-whale', 'side-knight', 'side-twins']);
loadImg('esc-bg');   // 탈출 작전 배경(jpg)   // 그림 파일을 넣으면 여기에 이름을 적는다(예: 'ship-falcon', 'boss-spider'). 비어 있으면 찾지 않는다
ASSET_KEYS.forEach(loadImg);
// 맵 배경 그림(540×1600, 위아래 거울로 이어 붙인 것). 섬 자리에 높은 구조물이 선다
const BG_LANDS = { 0: [[130, 130], [432, 250], [122, 395], [432, 555], [148, 672]], 2: [[158, 129], [420, 263], [125, 397], [404, 520], [172, 665]],
  5: [[137, 157], [415, 110], [420, 305], [415, 500], [134, 616]], 6: [[100, 50], [415, 89], [134, 340], [425, 539], [127, 671]], 7: [[116, 134], [415, 96], [100, 349], [420, 413], [130, 680], [415, 628]] };   // 그림을 보고 적은 섬(구조물 설 자리). 4 공장은 어디나, 8 구름 위 성은 없음
[0, 1, 2, 3, 4, 5, 6, 7, 8].forEach(th => { const im = new Image(); im.onload = () => { const L = BG_LANDS[th]; Art.setFar(th, im, L ? L.flatMap(([x, y]) => [{ x, y, r: 62 }, { x, y: 1600 - y, r: 62 }]) : th === 1 || th === 4 ? null : []); }; im.src = `assets/bg-${th}.jpg`; });
const silCache = {};
function silhouette(key) {   // 그림 파일의 그림자(검은 실루엣)
  const im = IMG[key]; if (!im) return null;
  if (!silCache[key]) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(0, 0, c.width, c.height); silCache[key] = c; }
  return silCache[key];
}

// ---------- 판 상태 ----------
let state = 'hangar', run = null, P = null, st = null, boss = null;
let shots = [], foes = [], ebul = [], drops = [], fx = [], texts = [], lasers = [];
let T = 0, shake = 0, flash = 0, bgY = 0, nearY = 0, drag = null, keys = {}, hangarStage = Math.min(S.next, S.maxStage), tab = 'sortie';
const Q = { low: false, acc: 0, n: 0 };   // 느린 기기면 효과를 줄인다
const SKY = window.SKY = { god: false, get state() { return state; }, get run() { return run; }, get P() { return P; }, get S() { return S; }, get boss() { return boss; }, get feel() { return { hitStop, slowT, nums: dnums.length }; } };   // 점검용

function buildStats() {
  const F = frameOf(S.frame), Wp = weaponOf(S.weapon), wl = S.weapons[Wp.id] || 1;
  return {
    F, Wp,
    maxHp: Math.round((F.hp + 15 * eqLv('plate')) * (1 + 0.05 * rs('hull'))),
    speed: F.speed * (1 + 0.08 * eqLv('turbo')),
    hit: F.hit,
    invT: 1 + 0.25 * eqLv('blink'),
    regen: 0.4 * eqLv('regen'),
    dmg: Wp.dmg * (1 + 0.1 * (wl - 1)) * (1 + 0.07 * eqLv('power')) * (1 + 0.03 * rs('fire')),
    rate: Wp.rate * (1 + 0.07 * eqLv('rapid')) * (1 + 0.02 * rs('cycle')),
    ult: (1 + 0.12 * eqLv('ultchip')) * (1 + 0.05 * rs('core')),
    magnet: 80 * (1 + 0.25 * eqLv('magnet')) * (1 + 0.1 * rs('pull')),
    gun: eqLv('gun'), guard: eqLv('guard'), seeker: eqLv('seeker'),
  };
}

// ---------- 수집과 자랑(로드맵 5단계): 도감·보스 무훈·칭호·꾸미기 세트·결과 사진 카드 ----------
const MAP_ICON = ['🏝️', '🏜️', '🌃', '🌌', '🏭', '❄️', '🌋', '🌿', '🏰'];
const MEDALS = [['kill', '⚔️', '처치'], ['five', '🔥', '5번 처치'], ['nohit', '🛡️', '안 맞고 잡기'], ['fast', '⚡', '기준 시간 안에']];
function bk() {
  if (!S.book) {   // 도감이 생기기 전 기록에서 채워 넣는다(깬 스테이지의 맵, 만난 보스, 나올 수 있었던 적)
    S.book = { maps: {}, foes: {}, boss: {}, hz: {} };
    for (let s = 1; s <= Math.min(S.maxStage, 9); s++) if (S.plays) S.book.maps[stageTheme(s)] = 1;
    (S.stats.bossSeen || []).forEach(i => { const b = D.BOSSES[i % D.BOSSES.length]; if (b) S.book.boss[b.id] = { k: 1, nohit: 0, fast: 0, best: 0 }; });
    if (S.stats.kills > 0) for (const [k, e] of Object.entries(D.ENEMIES)) if ((e.from || 1) <= S.cleared + 1 && k !== 'treasure') S.book.foes[k] = GROW.foeBook;
  }
  for (const k of ['maps', 'foes', 'boss', 'hz']) S.book[k] = S.book[k] || {}; return S.book;
}
function bookMark(cat, key) {
  const B = bk();
  B[cat][key] = (B[cat][key] || 0) + 1;
  const first = cat === 'foes' ? B[cat][key] === GROW.foeBook : B[cat][key] === 1;   // 적은 여러 번 잡아야 도감에 오른다
  if (!first || !run || state !== 'play') return;
  const nm = cat === 'maps' ? MAP_ICON[key] + ' ' + D.THEMES[key].name : cat === 'foes' ? (D.ENEMIES[key] || {}).name : cat === 'hz' ? HZ_NM[key] : '';
  if (nm) say(`📖 도감에 새로: ${nm}`, W / 2, H * (cat === 'maps' ? 0.5 : 0.46), '#ffd166', 18, 2);
  S.newDot = S.newDot || {}; S.newDot['tab:book'] = 1;
}
function bossRecord(id, nohit, fast, bt) {
  const B = bk(), r = B.boss[id] = B.boss[id] || { k: 0, nohit: 0, fast: 0, best: 0 }, before = medalsOf(id).length;
  r.k++; if (nohit) r.nohit = 1; if (fast) r.fast = 1; if (!r.best || bt < r.best) r.best = Math.round(bt * 10) / 10;
  const after = medalsOf(id);
  if (after.length > before) { say(`🎖️ 보스 무훈: ${MEDALS.find(m => m[0] === after[after.length - 1])[2]}!`, W / 2, H * 0.5, '#ffd166', 22, 2.6); S.newDot = S.newDot || {}; S.newDot['tab:book'] = 1; }
}
function medalsOf(id) { const r = bk().boss[id]; if (!r) return []; return MEDALS.map(m => m[0]).filter(k => k === 'kill' ? r.k >= 1 : k === 'five' ? r.k >= 5 : r[k]); }
function bookCount() {
  const B = bk(), foeKeys = Object.keys(D.ENEMIES), hzKeys = Object.keys(HZ_NM);
  const parts = [
    ['maps', Object.keys(B.maps).length, D.THEMES.length],
    ['foes', foeKeys.filter(k => (B.foes[k] || 0) >= GROW.foeBook).length, foeKeys.length],
    ['boss', D.BOSSES.reduce((s, b) => s + medalsOf(b.id).length, 0), D.BOSSES.length * MEDALS.length],
    ['routes', Object.keys(S.routes || {}).length, Object.keys(ROUTES).length],
    ['hz', hzKeys.filter(k => B.hz[k]).length, hzKeys.length],
  ];
  const got = parts.reduce((s, p) => s + p[1], 0), total = parts.reduce((s, p) => s + p[2], 0);
  return { parts, got, total, pct: Math.floor(got / total * 100) };
}
// 칭호: 이름 위에 붙는 작은 글. 조건을 채우면 얻고, 도감에서 골라 단다
const TITLES = [
  { id: 'rookie', name: '새내기 조종사', hint: '처음부터', ok: () => true },
  { id: 'hunter', name: '사냥꾼', hint: '적 500대 부수기', ok: () => S.stats.kills >= 500 },
  { id: 'hunter2', name: '하늘의 포식자', hint: '적 3000대 부수기', ok: () => S.stats.kills >= 3000 },
  { id: 'explorer', name: '하늘 탐험가', hint: '맵 9곳 모두 날기', ok: () => Object.keys(bk().maps).length >= D.THEMES.length },
  { id: 'weather', name: '날씨 박사', hint: '하늘의 사건 모두 겪기', ok: () => Object.keys(HZ_NM).every(k => bk().hz[k]) },
  { id: 'route', name: '항로 개척자', hint: '갈림길 항로 10가지 모두', ok: () => Object.keys(S.routes || {}).length >= Object.keys(ROUTES).length },
  { id: 'untouch', name: '털끝도 못 건드려', hint: '보스 3종을 안 맞고 잡기', ok: () => D.BOSSES.filter(b => (bk().boss[b.id] || {}).nohit).length >= 3 },
  { id: 'flash', name: '번개 사냥꾼', hint: '보스 5종을 기준 시간 안에', ok: () => D.BOSSES.every(b => (bk().boss[b.id] || {}).fast) },
  ...D.BOSSES.map(b => ({ id: 'b_' + b.id, name: `${b.name} 사냥꾼`, hint: `${b.name} 5번 잡기`, ok: () => ((bk().boss[b.id] || {}).k || 0) >= 5 })),
  { id: 'combo', name: '연쇄 폭발 장인', hint: '콤보 100', ok: () => S.stats.bestCombo >= 100 },
  { id: 'weekly', name: '주간 완주자', hint: '주간 도전 25칸 모두', ok: () => (S.weekDone || 0) >= 1 },
  { id: 'rhythm', name: '박자의 신', hint: '리듬 도장 8단계 열기', ok: () => S.dojo.open >= 8 },
  { id: 'ace', name: '에이스', hint: '성장 단계 「에이스」', ok: () => myTierV >= 4 },
  { id: 'myth', name: '신화의 조종사', hint: '성장 단계 「신화」', ok: () => myTierV >= 6 },
  { id: 'half', name: '도감 수집가', hint: '도감 50%', ok: () => bookCount().pct >= 50 },
  { id: 'full', name: '도감 박사', hint: '도감 100%', ok: () => bookCount().pct >= 100 },
  { id: 'vet', name: '베테랑 조종사', hint: '조종사 Lv 15', ok: () => S.pilot.lv >= 15 },
  { id: 'guard', name: '하늘의 수호자', hint: '조종사 Lv 20', ok: () => S.pilot.lv >= 20 },
  { id: 'legend', name: '전설의 조종사', hint: '조종사 Lv 30', ok: () => S.pilot.lv >= 30 },
  { id: 'sky40', name: '하늘의 주인', hint: '조종사 Lv 40', ok: () => S.pilot.lv >= 40 },
  { id: 'sky50', name: '살아 있는 전설', hint: '조종사 Lv 50', ok: () => S.pilot.lv >= 50 },
];
const titleName = () => (TITLES.find(t => t.id === S.title && t.ok()) || TITLES[0]).name;
function titleCheck() {   // 새로 얻은 칭호 알림
  S.titleSeen = S.titleSeen || { rookie: 1 };
  const got = TITLES.filter(t => !S.titleSeen[t.id] && t.ok()); if (!got.length) return;
  got.forEach(t => { S.titleSeen[t.id] = 1; }); S.newDot = S.newDot || {}; S.newDot['tab:book'] = 1; save();
  if (document.getElementById('unlockPop')) return;
  const bx = document.createElement('div'); bx.id = 'unlockPop';
  bx.innerHTML = `<div class="upIn"><small>🎖️ 새 칭호를 얻었어요!</small>${got.slice(0, 4).map(t => `<div class="upItem"><span>🎖️</span><b>「${t.name}」</b><i>${t.hint}</i></div>`).join('')}${got.length > 4 ? `<i>외 ${got.length - 4}개</i>` : ''}<i>📖 도감에서 골라 달 수 있어요</i><button>좋아요</button></div>`;
  bx.querySelector('button').addEventListener('click', () => { bx.remove(); A.sfx('click'); });
  document.body.append(bx); A.sfx('levelup');
}
function renderBook(el) {
  if (S.newDot && S.newDot['tab:book']) { delete S.newDot['tab:book']; save(); }
  const B = bk(), C = bookCount();
  const sec = (title, n, tot, body) => `<div class="bkSec glass"><h3>${title}<em>${n} / ${tot}</em></h3>${body}</div>`;
  const cell = (on, icon, name, sub) => `<div class="bkCell${on ? '' : ' off'}"><span>${on ? icon : '❔'}</span><b>${on ? name : '???'}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
  const P0 = Object.fromEntries(C.parts.map(p => [p[0], p]));
  let h = `<div class="bkTop glass"><b>📖 도감 ${C.pct}%</b><div class="tierBar" style="--tc:#ffd166"><b style="width:${C.pct}%"></b></div><small>${C.got} / ${C.total} · 모을수록 칭호가 열려요</small></div>`;
  h += sec('🎖️ 칭호', TITLES.filter(t => t.ok()).length, TITLES.length, `<div class="ttlList">${TITLES.map(t => { const ok = t.ok(), on = titleName() === t.name; return `<button class="ttl${ok ? '' : ' off'}${on ? ' on' : ''}" data-t="${t.id}" ${ok ? '' : 'disabled'}><b>${ok ? '「' + t.name + '」' : '🔒 ???'}</b><i>${t.hint}</i></button>`; }).join('')}</div>`);
  h += sec('👑 보스 무훈', P0.boss[1], P0.boss[2], D.BOSSES.map(b => { const ms = medalsOf(b.id), r = B.boss[b.id]; return `<div class="bkBoss${r ? '' : ' off'}"><b>${r ? b.name : '???'}</b><span>${MEDALS.map(m => `<em class="${ms.includes(m[0]) ? 'on' : ''}" title="${m[2]}">${m[1]}</em>`).join('')}</span><i>${r ? `${r.k}번 · 최고 ${r.best ? r.best + '초' : '-'}` : '아직 못 만남'}</i></div>`; }).join('') + `<small class="bkNote">${MEDALS.map(m => m[1] + ' ' + m[2]).join(' · ')}</small>`);
  h += sec('🗺️ 맵', P0.maps[1], P0.maps[2], `<div class="bkGrid">${D.THEMES.map((t, i) => cell(B.maps[i], MAP_ICON[i], t.name, B.maps[i] ? `${B.maps[i]}번` : '')).join('')}</div>`);
  h += sec('👾 적', P0.foes[1], P0.foes[2], `<div class="bkGrid">${Object.keys(D.ENEMIES).map(k => { const im = IMG['enemy-' + k]; const n = B.foes[k] || 0, ok = n >= GROW.foeBook; return cell(ok, im ? `<img src="${im.src}" alt="">` : '👾', D.ENEMIES[k].name, ok ? `${n}대` : n ? `${n} / ${GROW.foeBook}` : ''); }).join('')}</div>`);
  h += sec('🧭 항로', P0.routes[1], P0.routes[2], `<div class="bkGrid">${Object.keys(ROUTES).map(k => cell((S.routes || {})[k], ROUTES[k].icon, ROUTES[k].name, ['일반', '희귀', '전설'][ROUTES[k].tier])).join('')}</div>`);
  h += sec('🌦️ 하늘의 사건', P0.hz[1], P0.hz[2], `<div class="bkGrid">${Object.keys(HZ_NM).map(k => { const [ic, ...nm] = HZ_NM[k].split(' '); return cell(B.hz[k], ic, nm.join(' ')); }).join('')}</div>`);
  el.innerHTML = h;
  el.querySelectorAll('.ttl[data-t]').forEach(b => b.addEventListener('click', () => { S.title = b.dataset.t; save(); A.sfx('click'); renderHangar(); }));
}
// 꾸미기 세트: 네 칸을 맞추면 특별한 빛이 더해진다(모습만, 힘은 그대로)
const LOOK_SETS = [
  { id: 'bolt', name: '⚡ 번개 세트', need: { paint: 'yellow', flame: 'blue', trail: 'star', decal: 'bolt' }, c: '#fff36a' },
  { id: 'spring', name: '🌸 봄꽃 세트', need: { paint: 'pink', flame: 'pink', trail: 'petal', decal: 'flower' }, c: '#ffb3d9' },
  { id: 'heart', name: '❤️ 하트 세트', need: { paint: 'red', flame: 'pink', trail: 'heart', decal: 'heart' }, c: '#ff5d7a' },
  { id: 'night', name: '🌙 밤하늘 세트', need: { paint: 'night', flame: 'violet', trail: 'star', decal: 'crown' }, c: '#c58bff' },
  { id: 'rainbow', name: '🌈 무지개 세트', need: { flame: 'rainbow', trail: 'rainbow', decal: 'star' }, c: 'rainbow' },
  { id: 'jungle', name: '🍀 숲 세트', need: { paint: 'green', flame: 'green', trail: 'note', decal: 'cat' }, c: '#4dff9e' },
];
const setOf = L => L && LOOK_SETS.find(s => Object.keys(s.need).every(k => L[k] === s.need[k]));
function shipSetFx(g, look, t, size) {
  const s = setOf(look); if (!s) return;
  const col = s.c === 'rainbow' ? `hsl(${(Math.round(t * 8) * 30) % 360},100%,62%)` : s.c;
  g.save(); g.globalCompositeOperation = 'lighter';
  g.strokeStyle = col; g.globalAlpha = 0.45 + 0.2 * Math.sin(t * 4); g.lineWidth = 2;
  g.beginPath(); g.arc(0, 4, size * 0.56 + Math.sin(t * 3) * 2, 0, TAU); g.stroke();
  g.globalAlpha = 0.9; g.font = '12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col;
  const ch = lookOf('decal', look.decal)[2] || '✦';
  for (let i = 0; i < 2; i++) { const a = -t * 1.6 + i * Math.PI; g.fillText(ch, Math.cos(a) * size * 0.56, 4 + Math.sin(a) * size * 0.56); }
  g.restore();
}
function lookSetsBox() {
  const L = myLook(), box = document.createElement('div'); box.className = 'lkCat';
  box.innerHTML = `<b>✨ 꾸미기 세트 <small>(네 칸을 맞추면 특별한 빛 · 모습만 바뀌어요)</small></b><div class="setList">${LOOK_SETS.map(s => {
    const ks = Object.keys(s.need), n = ks.filter(k => L[k] === s.need[k]).length, done = n === ks.length;
    return `<div class="setRow${done ? ' on' : ''}"><b>${s.name}</b><span>${ks.map(k => `<em class="${L[k] === s.need[k] ? 'on' : ''}">${lookOf(k, s.need[k])[1]}</em>`).join('')}</span><i>${done ? '✨ 완성!' : `${n} / ${ks.length}`}</i></div>`;
  }).join('')}</div>`;
  return box;
}
// 결과 사진 카드: 맵 그림 위에 내 기체·칭호·점수를 한 장으로
function photoCard() {
  const c = document.createElement('canvas'); c.width = 720; c.height = 1090; const g = c.getContext('2d');   // 0.56: 아래 130px은 QR 띠
  const th = run ? run.theme : stageTheme(hangarStage), far = Art.far(th);
  g.drawImage(far, 0, 0, far.width, Math.min(far.height, far.width * 960 / 720), 0, 0, 720, 960);
  const sh = g.createLinearGradient(0, 0, 0, 960); sh.addColorStop(0, 'rgba(4,8,18,.75)'); sh.addColorStop(0.35, 'rgba(4,8,18,.2)'); sh.addColorStop(0.62, 'rgba(4,8,18,.35)'); sh.addColorStop(1, 'rgba(4,8,18,.92)');
  g.fillStyle = sh; g.fillRect(0, 0, 720, 960);
  const tc = TIERS[myTierV].c;
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '900 54px sans-serif'; g.fillText('BOLTWING', 360, 86);
  g.font = '600 22px sans-serif'; g.fillStyle = '#b9c8dc'; g.fillText(`${MAP_ICON[th]} ${D.THEMES[th].name}`, 360, 124);
  const L = myLook();
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(Art.glow(tc, 60), 160, 160, 400, 400); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  drawShipAt(g, S.frame, 360, 350, 4.2, -0.18, 1.3, false, L);
  const title = $('rTitle').innerText.replace(/\s+/g, ' ').trim();
  g.fillStyle = '#ffd166'; g.font = '800 44px sans-serif'; g.fillText(title, 360, 610);
  const big = document.querySelector('#rStats .big'), score = run ? run.score : big ? +big.textContent.replace(/[^\d]/g, '') : 0;
  g.fillStyle = '#fff'; g.font = '900 76px sans-serif'; g.fillText(score.toLocaleString(), 360, 700);
  g.font = '600 24px sans-serif'; g.fillStyle = '#cfe0f5';
  const line = run ? [`최대 콤보 ${run.maxCombo}`, `처치 ${run.kills}`, run.bossRank ? `보스 ${run.bossRank} 랭크` : ''].filter(Boolean).join('  ·  ') : '';
  g.fillText(line, 360, 744);
  g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(60, 790, 600, 110);
  g.textAlign = 'left'; g.fillStyle = tc; g.font = '700 22px sans-serif'; g.fillText(`「${titleName()}」`, 84, 830);
  g.fillStyle = '#fff'; g.font = '800 32px sans-serif'; g.fillText(myNick(), 84, 874);
  g.textAlign = 'right'; g.fillStyle = tc; g.font = '700 22px sans-serif'; g.fillText(`${TIERS[myTierV].name} · ⚡${powerOf(buildStats()).toLocaleString()}`, 636, 830);
  g.fillStyle = '#9fb3c8'; g.font = '600 20px sans-serif'; g.fillText(`${frameOf(S.frame).name} · 도감 ${bookCount().pct}% · ${new Date().toLocaleDateString('ko-KR')}`, 636, 874);
  // 0.56 아래 띠: 찍으면 바로 하는 QR(아이디가 있으면 내 초대 링크)
  g.fillStyle = '#070b16'; g.fillRect(0, 960, 720, 130); g.fillStyle = 'rgba(255,209,102,.5)'; g.fillRect(0, 960, 720, 2);
  try { QR.draw(g, myRefUrl(), 40, 972, 106); } catch (e) { /* 그리지 못하면 글자만 */ }
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '800 28px sans-serif'; g.fillText('📱 카메라로 찍으면 바로 플레이', 172, 1012);
  g.fillStyle = '#b9c8dc'; g.font = '600 20px sans-serif'; g.fillText('설치 없이 무료 · 뽑기·광고 없음', 172, 1046);
  g.fillStyle = '#7f93ab'; g.font = '600 17px sans-serif'; g.fillText(GAME_URL.replace('https://', ''), 172, 1072);
  return c;
}
function showPhoto() {
  const c = photoCard(), bx = document.createElement('div'); bx.id = 'photoPop';
  const url = c.toDataURL('image/png');
  bx.innerHTML = `<div class="phIn"><img src="${url}" alt="결과 사진 카드"><div class="row"><button class="btn" id="phShare">📤 공유하기</button><a class="btn sub" id="phSave" download="boltwing.png" href="${url}">💾 저장</a><button class="btn sub" id="phX">닫기</button></div><small>휴대폰에서는 사진을 길게 눌러도 저장돼요</small></div>`;
  document.body.append(bx); A.sfx('click');
  bx.querySelector('#phX').addEventListener('click', () => bx.remove());
  bx.addEventListener('click', e => { if (e.target === bx) bx.remove(); });
  const sb = bx.querySelector('#phShare');
  c.toBlob(blob => {
    const file = new File([blob], 'boltwing.png', { type: 'image/png' });
    if (!(navigator.canShare && navigator.canShare({ files: [file] }))) { sb.remove(); return; }
    sb.addEventListener('click', () => { navigator.share({ files: [file], text: `⚡ 볼트윙 ${myRefUrl()}` }).catch(() => {}); });
  }, 'image/png');
}
// ---------- 첫 10분: 처음엔 스테이지만, 판을 하고 깰수록 모드·탭이 하나씩 열린다(숫자는 해 보고 조정) ----------
const OPENS = [
  { k: 'tab:arms', icon: '🔫', name: '무기 강화', need: { plays: 1 }, tip: '모은 고철로 무기를 강하게 만들어요.' },
  { k: 'tab:goals', icon: '🏅', name: '임무', need: { plays: 1 }, tip: '오늘의 임무와 도전 과제로 고철을 받아요.' },
  { k: 'tab:parts', icon: '⚙️', name: '부품', need: { cleared: 2 }, tip: '보스가 떨어뜨린 부품을 끼우면 더 강해져요.' },
  { k: 'tab:look', icon: '🎨', name: '꾸미기', need: { cleared: 3 }, tip: '도색·불꽃·꼬리·스티커로 내 기체를 꾸며요.' },
  { k: 'mode:coop', icon: '🤝', name: '친구와 함께', need: { cleared: 3 }, tip: '친구 1~2명과 같은 하늘에서 싸워요.' },
  { k: 'tab:book', icon: '📖', name: '도감·칭호', need: { cleared: 3 }, tip: '만난 맵·적·보스 무훈을 모으고 칭호를 달아요.' },
  { k: 'mode:endless', icon: '♾️', name: '무한 생존', need: { cleared: 5 }, tip: '끝없이 몰려오는 적을 얼마나 버틸까요?' },
  { k: 'tab:ship', icon: '✈️', name: '기체 고르기', need: { cleared: 5 }, tip: '새 기체가 열렸어요. 기체마다 궁극기가 달라요.' },
  { k: 'tab:research', icon: '🔬', name: '연구', need: { cleared: 7 }, tip: '오래 쌓이는 강화. 고철을 더 벌게도 해 줘요.' },
  { k: 'mode:dojo', icon: '🎵', name: '리듬 도장', need: { cleared: 8 }, tip: '비행은 쉬고 리듬 게임만! 곡 8개.' },
  { k: 'tab:rank', icon: '🏆', name: '랭킹', need: { cleared: 7 }, tip: '다른 조종사들과 점수를 겨뤄요.' },
  { k: 'mode:auto', icon: '⭐', name: '표창 공방', need: { cleared: 13 }, tip: '로봇을 직접 몰아 표창으로 베는 넓은 들판.' },
  { k: 'mode:escape', icon: '🪂', name: '탈출 작전(시험판)', need: { cleared: 10 }, tip: '누르기 하나로 로프를 걸어 흔들며 나아가는 새 모드!' },
  { k: 'mode:rush', icon: '👑', name: '보스 러시', need: { cleared: 20 }, tip: '보스 다섯을 쉬지 않고 연달아!' },
];
const openCond = o => S.plays >= (o.need.plays || 0) && S.cleared >= (o.need.cleared || 0);
const isOpen = k => { if (S.openAll || (S.openKeep && S.openKeep[k]) || k === 'tab:sortie' || k === 'tab:settings' || k === 'mode:stage') return true; if (k === 'mode:coop' && joinCode) return true; const o = OPENS.find(x => x.k === k); return !o || openCond(o); };
function nextOpenTip() {   // 다음에 열릴 것 한 줄
  const n = OPENS.find(o => !isOpen(o.k)); if (!n) return '';
  const grp = OPENS.filter(o => !isOpen(o.k) && JSON.stringify(o.need) === JSON.stringify(n.need)).map(o => o.icon + ' ' + o.name).join(' · ');
  return `🔒 ${n.need.cleared ? `스테이지 ${stLabel(n.need.cleared)}를 깨면` : '한 판 해 보면'} 열려요: ${grp}`;
}
function unlockCheck() {   // 새로 열린 것이 있으면 축하 창
  S.seenOpen = S.seenOpen || {}; S.newDot = S.newDot || {};
  const got = OPENS.filter(o => isOpen(o.k) && !S.seenOpen[o.k]); if (!got.length) return;
  got.forEach(o => { S.seenOpen[o.k] = 1; if (!S.openAll) S.newDot[o.k] = 1; }); save();
  if (S.openAll || document.getElementById('unlockPop')) return;
  const bx = document.createElement('div'); bx.id = 'unlockPop';
  bx.innerHTML = `<div class="upIn"><small>🔓 새로 열렸어요!</small>${got.map(o => `<div class="upItem"><span>${o.icon}</span><b>${o.name}</b><i>${o.tip}</i></div>`).join('')}<button>좋아요</button></div>`;
  bx.querySelector('button').addEventListener('click', () => { bx.remove(); A.sfx('click'); });
  document.body.append(bx); A.sfx('levelup');
}
function drawTut() {   // 첫 판에만: 손가락 안내
  if (!run.tut || run.mode !== 'stage') return;
  run.tutMv = (run.tutMv || 0) + Math.abs(P.x - (run.tutLx ?? P.x)) + Math.abs(P.y - (run.tutLy ?? P.y)); run.tutLx = P.x; run.tutLy = P.y;
  let msg = null, hand = false;
  if (run.tutMv < 260 && run.t < 14) { msg = touchDevice ? '화면을 끌어서 움직여요 · 총은 알아서 쏴요' : '마우스나 방향키로 움직여요 · 총은 알아서 쏴요'; hand = true; }
  else if (run.t < 22 && run.t > 3) msg = '적을 부수면 경험치! 차면 강화 카드를 골라요';
  else if (P.ult >= 100 && !run.ults && run.t < 120) msg = touchDevice ? '🌟 궁극기 준비! 오른쪽 아래 버튼을 눌러요' : '🌟 궁극기 준비! Space 키를 눌러요';
  if (!msg) return;
  ctx.save(); ctx.globalAlpha = 0.85 + 0.15 * Math.sin(T * 5);
  ctx.fillStyle = 'rgba(6,12,24,.7)'; ctx.fillRect(40, H - 330, W - 80, 46);
  txt(msg, W / 2, H - 300, 17, '#fff', 'center', 700);
  if (hand) { const hx = W / 2 + Math.sin(T * 2.4) * 120; ctx.font = '44px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('👆', hx, H - 200); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.beginPath(); ctx.moveTo(W / 2 - 120, H - 240); ctx.lineTo(W / 2 + 120, H - 240); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
}
// ---------- 성장이 보이게: 전투력과 성장 단계(단계가 오르면 기체 모습이 바뀐다). 숫자는 해 보고 조정 ----------
const TIERS = [
  { p: 0, name: '견습', c: '#9fb3c8', fx: '기본 모습' },
  { p: 680, name: '정비 완료', c: '#7fd8ff', fx: '엔진 불꽃이 커진다' },
  { p: 820, name: '강화', c: '#4dff9e', fx: '날개 끝에 빛' },
  { p: 980, name: '정예', c: '#c58bff', fx: '몸 둘레에 빛' },
  { p: 1160, name: '에이스', c: '#ffb347', fx: '불꽃 꼬리' },
  { p: 1350, name: '전설', c: '#ff7ad9', fx: '빛 구슬이 돈다' },
  { p: 1540, name: '신화', c: '#ffd166', fx: '황금 고리' },
  { p: 1850, name: '초월', c: '#b98cff', fx: '보라 고리가 하나 더' },   // 0.63 한계 돌파 뒤
  { p: 2150, name: '천공', c: '#7af0ff', fx: '별빛이 흩날린다' },
];
function powerOf(s) {   // 전투력: 화력(초당 피해)·체력·속도·드론·궁극기를 한 숫자로
  return Math.round(s.dmg * s.rate * 4 + s.maxHp * 1.5 + s.speed * 100 + (s.gun + s.guard + s.seeker) * 40 + s.ult * 60 + s.regen * 30 + s.magnet * 0.3);
}
function tierOf(pw) { let k = 0; TIERS.forEach((t, i) => { if (pw >= t.p) k = i; }); return k; }
let myTierV = 0, lastPow = -1;
function liveShip(w, h, s, opt = {}) {   // 격납고: 둥실거리며 천천히 몸을 돌리는 기체
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  let t0 = 0, last = performance.now();
  const anim = now => {
    if (!c.isConnected) return;
    t0 += Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, w, h);
    const L = myLook(), bank = Math.sin(t0 * (opt.spin || 0.7)) * (opt.tilt || 0.55);
    drawShipAt(g, S.frame, w / 2, h / 2 - 6 + Math.sin(t0 * 1.6) * 4, s, bank, t0, false, L);
    if (c.flash > 0) { c.flash -= 0.03; g.globalCompositeOperation = 'lighter'; g.globalAlpha = c.flash; g.drawImage(Art.glow(TIERS[myTierV].c, 60), w / 2 - h * 0.6, h / 2 - h * 0.6, h * 1.2, h * 1.2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim); return c;
}
function powerLine(pw, tr) {   // 전투력 + 다음 단계까지 막대
  const T0 = TIERS[tr], T1 = TIERS[tr + 1], k = T1 ? (pw - T0.p) / (T1.p - T0.p) : 1;
  return `<div class="pwr" style="--tc:${T0.c}"><span>⚡ 전투력 <b>${pw.toLocaleString()}</b></span><em>${T0.name}</em></div>
    <div class="tierBar" style="--tc:${T0.c}"><b style="width:${Math.round(clamp(k, 0, 1) * 100)}%"></b></div>
    <small class="tierNext">${T1 ? `다음 「${T1.name}」까지 ${(T1.p - pw).toLocaleString()} · ${T1.fx}` : '최고 단계!'}</small>`;
}
function showGrowth() {   // 기체 크게 보기: 천천히 돌고, 단계 목록이 보인다
  const pw = powerOf(buildStats()), tr = tierOf(pw);
  const bx = document.createElement('div'); bx.id = 'growth';
  bx.innerHTML = `<div class="gwIn"><b class="gwT">${frameOf(S.frame).name} · <span style="color:${TIERS[tr].c}">${TIERS[tr].name}</span></b><div class="gwShip"></div>${powerLine(pw, tr)}
    <ol class="gwList">${TIERS.map((t, i) => `<li class="${i <= tr ? 'on' : ''}${i === tr ? ' now' : ''}" style="--tc:${t.c}"><i></i><b>${t.name}</b><span>${t.fx}</span><em>${t.p ? t.p.toLocaleString() : '-'}</em></li>`).join('')}</ol>
    <small>무기·부품·연구를 강화하거나 조종사 레벨이 오르면 전투력이 올라요.</small><button class="gwX">닫기</button></div>`;
  bx.querySelector('.gwShip').append(liveShip(360, 260, 3, { spin: 0.45, tilt: 0.8 }));
  const close = () => { bx.remove(); A.sfx('click'); };
  bx.addEventListener('click', e => { if (e.target === bx || e.target.classList.contains('gwX')) close(); });
  document.body.append(bx); A.sfx('click');
}
function growthFx(box, pw) {   // 강화 순간: 전투력 +N, 단계가 오르면 크게 축하
  const old = lastPow; lastPow = pw;
  const tr = tierOf(pw); if (old < 0) { myTierV = tr; titleCheck(); return; }
  const up = tr > myTierV; myTierV = tr;
  if (old < 0 || pw === old) return;
  const d = pw - old, pop = document.createElement('div'); pop.className = 'pwPop' + (d < 0 ? ' down' : '');
  pop.textContent = `⚡ ${d > 0 ? '+' : ''}${d.toLocaleString()}`; box.append(pop);
  const cv = box.querySelector('canvas'); if (cv && d > 0) cv.flash = up ? 1 : 0.5;
  if (up) { A.sfx('levelup'); const tp = document.createElement('div'); tp.className = 'tierUp'; tp.style.setProperty('--tc', TIERS[tr].c); tp.innerHTML = `<small>성장 단계</small><b>${TIERS[tr].name}</b><span>${TIERS[tr].fx}</span>`; box.append(tp); setTimeout(() => tp.remove(), 2600); }
  setTimeout(() => pop.remove(), 1300);
}
function shipAura(g, tier, t, size, sx) {   // 성장 단계에 따른 빛(몸 뒤)
  if (tier < 3) return;
  const c = TIERS[tier].c, k = 0.32 + 0.1 * Math.sin(t * 3);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = k;
  g.drawImage(Art.glow(c, 50), -size * 0.8, -size * 0.8, size * 1.6, size * 1.6);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function shipTierFx(g, tier, t, size, sx) {   // 성장 단계에 따른 빛(몸 앞)
  if (tier < 2) return;
  const c = TIERS[tier].c;
  g.globalCompositeOperation = 'lighter';
  const p = 0.7 + 0.3 * Math.sin(t * 6);
  for (const s of [-1, 1]) g.drawImage(Art.glow(c, 12), s * size * 0.42 * sx - 9 * p, 2 - 9 * p, 18 * p, 18 * p);   // 날개 끝 빛
  if (tier >= 4) for (let i = 0; i < 3; i++) { const yy = size * 0.45 + ((t * 120 + i * 17) % 40), a = 1 - ((t * 120 + i * 17) % 40) / 40; g.globalAlpha = a; g.drawImage(Art.glow(c, 10), -6 + Math.sin(t * 9 + i) * 4, yy, 12, 12); }   // 불꽃 꼬리
  g.globalAlpha = 1;
  if (tier >= 5) for (let i = 0; i < 3; i++) { const a = t * 2.2 + i * TAU / 3, r = size * 0.62; g.drawImage(Art.glow(c, 14), Math.cos(a) * r - 7, Math.sin(a) * r * 0.75 - 7, 14, 14); }   // 도는 빛 구슬
  if (tier >= 6) { g.strokeStyle = `rgba(255,209,102,${0.35 + 0.25 * Math.sin(t * 4)})`; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 0, size * 0.7, size * 0.55, 0, 0, TAU); g.stroke(); }   // 황금 고리
  if (tier >= 7) { g.strokeStyle = `rgba(185,140,255,${0.4 + 0.25 * Math.sin(t * 3 + 1)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, size * 0.82, size * 0.4, t * 0.9, 0, TAU); g.stroke(); }   // 0.63 초월: 기울어 도는 보라 고리
  if (tier >= 8) for (let i = 0; i < 6; i++) { const k = (t * 0.6 + i / 6) % 1, a = i * 2.1 + Math.floor(t * 0.6 + i / 6) * 1.7, r = size * (0.4 + 0.6 * k); g.globalAlpha = 1 - k; g.drawImage(Art.glow('#7af0ff', 8), Math.cos(a) * r - 4, Math.sin(a) * r - 4, 8, 8); }   // 천공: 흩날리는 별빛
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
// 스테이지가 오를수록 적이 단단해지고 탄이 빨라진다
const L = () => (run && run.mode === 'stage' ? Math.floor(lvOf(run.stage)) : run ? run.stage : 1);   // 지금 판의 난이도 수준(스테이지 모드는 챕터 번호 대신 lvOf)
// 0.58 난이도 따라잡기(사용자: 1-3에서 적이 안 보이고 보스가 녹는다). 판 안에서 카드·줍기로 세진 만큼 적·보스 체력도 일부 따라 올라간다.
const DIFF = { hp: 0.4, chase: 0.55 };   // hp: 수준 1마다 적 체력 +40%(전엔 32%), chase: 판 안 화력 증가분의 55%만큼 적 체력도 늘림
const runPow = () => run ? run.m.dmg * run.m.rate * (1 + 0.35 * run.m.multi) * (1 + 0.25 * (run.m.drones || 0)) : 1;   // 판을 시작할 때 1
const foeK = () => (run && run.mode !== 'auto' ? 1 + DIFF.chase * Math.max(0, runPow() - 1) : 1);
const diffFor = s => ({
  hp: 1 + DIFF.hp * (s - 1),
  bs: Math.min(1.6, 1 + 0.05 * (s - 1)),
  fr: Math.min(1.8, 1 + 0.06 * (s - 1)),
  dmg: Math.min(32, 10 + 2 * (s - 1)),
  iv: Math.max(0.55, 1.9 - 0.12 * (s - 1)),
});

let assistOn = false;
function startRun(stage, md = 'stage') {
  A.init();
  if (touchDevice) goFullscreen();
  if (md === 'auto') stage = S.idle.zone;
  if (md === 'rush' || md === 'endless') stage = 1;
  if (md === 'dojo') { dojoLv = Math.min(dojoLv, S.dojo.open); stage = dojoLv; }
  if (md === 'coop') { if (!(net && net.mode === 'host' && allies.length)) { coopMsg = net && net.mode === 'guest' ? '방장이 출격을 누르면 함께 시작해요' : '먼저 방을 만들고 친구가 들어올 때까지 기다려 주세요'; renderHangar(); return; } md = coopMd; if (md === 'escape') { escRaceHost(); return; } }
  if (md === 'stage' && !gateOk(stage)) { A.sfx('click'); hangarStage = stage; renderHangar(); const tp = $('stTip'); if (tp) { tp.classList.remove('gateShake'); void tp.offsetWidth; tp.classList.add('gateShake'); } return; }   // 별이 모자라면 출격 대신 안내
  st = buildStats();
  const assist = md === 'stage' && assistOn && (S.fails || {})[stage] >= 2;
  if (assist) { st.maxHp = Math.round(st.maxHp * 1.25); st.dmg *= 1.25; }
  const isSt = md === 'stage', th0 = isSt ? stageTheme(stage) : themeFor(stage);   // 스테이지 모드: 챕터 맵·완만한 난이도
  shots = []; foes = []; ebul = []; drops = []; fx = []; texts = []; lasers = []; boss = null; shake = 0; flash = 0;
  run = { stage, t: 0, phase: 'waves', waveDur: 110, spawnT: 1.2, warnT: 0, endT: 0, chain: 0, score: 0, kills: 0, scrapGot: 0, partsGot: [],
    level: 1, xp: 0, xpNeed: 15, taken: {}, d: diffFor(isSt ? lvOf(stage) : stage), theme: th0, loop: isSt ? (chOf(stage) - 1) / 5 | 0 : (stage - 1) / 5 | 0,
    combo: 0, comboT: 0, maxCombo: 0, hits: 0, hurtT: 0, ults: 0,
    rushAt: rnd(42, 58), rush: null, rushDone: false, rushSum: null,
    banner: { kind: 'stage', title: `STAGE ${isSt ? stLabel(stage) : stage}`, sub: D.THEMES[th0].name + (isSt ? ' · 끝에 ' + END_NM[stageEnd(stage)] + (powerOf(buildStats()) < recPow(stage) * 0.9 ? ' · ⚠️ 권장 전투력보다 낮아요' : '') : ''), t: 0, life: 2.6 },
    m: { dmg: 1, rate: 1, multi: 0, pierce: 0, drones: 0, magnet: 1, ult: 1, speed: 1, barrier: 0 },
    mode: md, wave: 1, bossCount: 0, nextBoss: 90, bossIdx: 0, startedAt: Date.now(), zone0: stage, assist };
  if (md === 'endless') { run.waveDur = Infinity; run.banner = { kind: 'stage', title: 'WAVE 1', sub: '무한 생존 · 얼마나 버틸까?', t: 0, life: 2.6 }; }
  if (md === 'rush') { run.d = diffFor(Math.max(3, lvOf(S.cleared))); run.phase = 'warning'; run.warnT = 2.5; run.rushDone = true; run.banner = { kind: 'boss', title: 'BOSS RUSH', sub: '보스 다섯 연속!', t: 0, life: 2.4 }; }
  run.gateAt = md === 'stage' || md === 'endless' ? 32 : 0; run.treasureAt = md === 'stage' || md === 'endless' ? 80 : 0;
  Forge.show(false); $('forge').classList.remove('rest'); $('fRest').classList.add('hidden'); $('ultBtn').classList.remove('hidden'); cam.x = cam.y = 0;
  if (md === 'auto') { run.d.hp = Math.pow(1.22, stage - 1); run.goldStart = S.forge.earned; run.rushDone = true; run.waveDur = 45; run.rushAt = rnd(15, 30); run.banner = { kind: 'stage', title: `ZONE ${stage}`, sub: '사방에서 온다! 피하면서 싸우자', t: 0, life: 2.6 }; S.idle.on = true; S.idle.lastSeen = Date.now(); keepAwake(true); }
  run.at0 = Date.now(); Cloud.log('start', { m: md, s: stage, pl: S.plays, c: run.coop ? 1 : 0 });   // 0.60 이름 없는 기록
  if (/fast/.test(location.hash)) { run.waveDur = md === 'endless' ? Infinity : 26; run.rushAt = 8; run.nextBoss = 30; if (md === 'auto') run.waveDur = 14; if (run.gateAt) { run.gateAt = 4; run.treasureAt = 14; } }   // 점검용: 빨리 보기
  P = { x: W / 2, y: H - 190, tx: W / 2, ty: H - 190, lx: W / 2, bank: 0, hp: st.maxHp, maxHp: st.maxHp, inv: 2, ult: 0, fireT: 0, droneT: 0, seekT: 2,
    barrierReady: false, barrierT: 0, ultKind: null, ultT: 0, swarmQ: 0, swarmT: 0, ga: 0, novaR: 0, trap: null, bombs: SKILL.start, skCd: 0 };
  if (md === 'auto') arenaStart();
  run.tut = S.plays === 0 && md === 'stage';   // 첫 판 안내
  if (S.comeback > 0 && !run.coop) { run.comeback = true; S.comeback--; run.banner.sub += ` · 🎁 고철 1.5배(${S.comeback}판 남음)`; }
  if (md === 'stage' && subOf(stage) === 1) {   // 0.61 챕터 첫 판: 큰 챕터 카드와 속도선
    run.banner = { kind: 'chapter', ch: chOf(stage), title: `${MAP_ICON[th0]} ${D.THEMES[th0].name}`, sub: run.banner.sub.replace(D.THEMES[th0].name + ' · ', ''), t: 0, life: 3.4 };
    for (let i = 0; i < 36; i++) fx.push({ k: 'streak', x: rnd(0, W), y: rnd(-H, 0), vx: 0, vy: rnd(900, 1400), t: 0, life: rnd(0.8, 1.6), color: 'rgba(200,225,255,.55)', size: rnd(1, 2.5) });
  }
  S.plays++; dcount('runs'); save();
  state = 'play';
  for (const id of ['hangar', 'cards', 'pause', 'result']) $(id).classList.add('hidden');
  $('hud').classList.remove('hidden');
  A.music('stage', run.theme);
  if (md === 'dojo') { state = 'duel'; $('hud').classList.add('hidden'); Duel.start({ level: dojoLv, title: '리듬 도장', song: S.dojo.song, sync: S.dojo.sync, speed: S.dojo.spd, onEnd: dojoEnd }); }
  if (net && net.mode === 'host' && allies.length && (md === 'stage' || md === 'endless')) coopBegin();
}

