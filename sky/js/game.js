// 볼트윙(BOLTWING, by motive) — 세로 화면 비행 슈팅.
// 격납고에서 기체·무기·부품을 고르고, 한 판(약 3분)마다 보스를 잡으면 다음 스테이지가 열린다. 스테이지가 오를수록 어려워진다.
// 판 중에는 그물 함정(연타해서 탈출)과 비트 러시(박자에 맞춰 톡)가 끼어들어 흐름이 바뀐다.
(() => {
'use strict';
const D = window.DATA, A = window.AudioKit, Art = window.Art;
const W = 540, H = 960, TAU = Math.PI * 2;
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const bgc = $('bg'), bctx = bgc.getContext('2d'), BGW = 1012, BGH = 1380;   // 비스듬히 눕힌 배경(입체감). 판이 화면보다 훨씬 커서 넓고 길게 그린다
const SKIES = ['linear-gradient(#2f7fd6, #8fc8f5 40%, #d8efff)', 'linear-gradient(#2a1650, #b0446a 40%, #ffb37a)', 'linear-gradient(#01030a, #0a1c3a 40%, #1d4a6e)', 'linear-gradient(#000, #0a0620 40%, #24124a)'];
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
  pilot: { lv: 1, xp: 0 }, research: {}, daily: { date: '', picks: [], cnt: {}, claimed: {} }, attend: { days: 0, last: '' }, mouse: true, seenHelp: false, lefty: false, dojo: { open: 1, best: {} } });
const VERSION = '0.3';
let S = fresh();
try {
  const old = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
  S = Object.assign(fresh(), old);
  S.stats = Object.assign(fresh().stats, old.stats || {});
  S.records = Object.assign(fresh().records, old.records || {});
  S.idle = Object.assign(fresh().idle, old.idle || {});
  S.pilot = Object.assign(fresh().pilot, old.pilot || {});
  S.dojo = Object.assign(fresh().dojo, old.dojo || {});
} catch (e) { /* 저장소를 못 쓰는 환경 */ }
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } };
A.setMusic(S.music); A.setSfx(S.sfx);
const buzz = ms => { if (S.vib && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* 진동 없는 기기 */ } } };

const frameOf = id => D.FRAMES.find(f => f.id === id);
const weaponOf = id => D.WEAPONS.find(w => w.id === id);
const unlocked = o => !o.unlock || S.cleared >= o.unlock;
const eqLv = id => (Object.values(S.equip).includes(id) ? S.parts[id] || 1 : 0);
const starCount = () => Object.values(S.stars).reduce((a, s) => a + s.filter(Boolean).length, 0);

// ---------- 도전 과제(이루면 고철을 받는다) ----------
const GOALS = [
  { id: 'kill100', name: '첫 사냥꾼', desc: '적 100대 부수기', val: () => S.stats.kills, need: 100, reward: 40 },
  { id: 'kill1000', name: '하늘의 사냥꾼', desc: '적 1000대 부수기', val: () => S.stats.kills, need: 1000, reward: 160 },
  { id: 'boss5', name: '다섯 보스', desc: '서로 다른 보스 5종 잡기', val: () => S.stats.bossSeen.length, need: 5, reward: 120 },
  { id: 'stage10', name: '먼 하늘', desc: '스테이지 10 클리어', val: () => S.cleared, need: 10, reward: 200 },
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
const pilotNeed = lv => 80 + 40 * lv;
function gainPilotXp(x) {   // 판이 끝날 때마다 조종사 경험치. 계급이 오르면 고철을 받는다
  let ups = 0, reward = 0;
  S.pilot.xp += x;
  while (S.pilot.xp >= pilotNeed(S.pilot.lv)) { S.pilot.xp -= pilotNeed(S.pilot.lv); S.pilot.lv++; ups++; reward += 20 + 10 * S.pilot.lv; }
  S.scrap += reward;
  return { ups, reward };
}
// 연구: 고철로 사는 영구 강화(모든 기체에 적용)
const RESEARCH = [
  { id: 'hull', icon: '🛡️', name: '선체 강화', max: 10, cost: l => 25 * (l + 1), desc: l => `최대 체력 +${5 * l}%` },
  { id: 'fire', icon: '💥', name: '화력 연구', max: 10, cost: l => 30 * (l + 1), desc: l => `피해 +${3 * l}%` },
  { id: 'cycle', icon: '⚡', name: '연사 연구', max: 10, cost: l => 30 * (l + 1), desc: l => `연사 +${2 * l}%` },
  { id: 'pull', icon: '🧲', name: '자석 연구', max: 5, cost: l => 20 * (l + 1), desc: l => `줍는 범위 +${10 * l}%` },
  { id: 'core', icon: '🌟', name: '궁극 연구', max: 5, cost: l => 35 * (l + 1), desc: l => `궁극기 충전 +${5 * l}%` },
  { id: 'salvage', icon: '🔩', name: '고철 수집', max: 10, cost: l => 30 * (l + 1), desc: l => `얻는 고철 +${5 * l}%` },
  { id: 'learn', icon: '📈', name: '전투 학습', max: 5, cost: l => 30 * (l + 1), desc: l => `판 중 경험치 +${6 * l}%` },
  { id: 'revive', icon: '💖', name: '긴급 수리', max: 3, cost: l => 150 * (l + 1), desc: l => (l ? `판마다 한 번, 쓰러질 때 체력 ${20 + 10 * l}%로 다시 일어남` : '판마다 한 번, 쓰러질 때 다시 일어남') },
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
function gainScrap(v) {   // 고철 얻기(고철 수집 연구가 적용된다)
  run.scrapCarry = (run.scrapCarry || 0) + v * (1 + 0.05 * rs('salvage')) * (run.gambler ? 2 : 1);
  const whole = Math.floor(run.scrapCarry);
  run.scrapCarry -= whole; S.scrap += whole; run.scrapGot += whole;
  if (whole) dcount('scrap', whole);
}

// 게임 모드: 스테이지(이야기처럼 하나씩), 무한 생존, 보스 러시, 자동 출격(방치)
const MODES = [
  { id: 'stage', icon: '🗺️', name: '스테이지', go: '출격! ▶', desc: '한 판 약 3분. 보스를 잡으면 다음 스테이지가 열리고 점점 어려워집니다. 스테이지마다 별 3개.' },
  { id: 'endless', icon: '♾️', name: '무한 생존', go: '버티기 시작 ▶', desc: '끝없이 몰려오는 적을 버팁니다. 30초마다 웨이브가 오르고 90초마다 보스가 나옵니다. 얼마나 오래 버티나!' },
  { id: 'rush', icon: '👑', name: '보스 러시', go: '보스 러시 ▶', desc: '보스 다섯을 쉬지 않고 연달아 잡습니다. 다 잡으면 걸린 시간이 기록됩니다. 보스마다 부품 상자!' },
  { id: 'auto', icon: '⭐', name: '표창 공방', go: '공방 열기 ▶', desc: '로봇은 알아서 싸우고, 나는 표창을 키웁니다. 시간이 지나면 표창이 생기고 같은 단계 둘을 끌어 합치면 한 단계 위! 가장 좋은 표창 다섯이 적에게 날아갑니다. 화면을 톡톡 두드리면 표창 폭풍. 꺼 두어도 비운 시간만큼 금화를 받아요(최대 8시간, 절반 속도). 구역 10을 넘기면 환생해서 영원히 강해집니다.' },
];
MODES.push({ id: 'dojo', icon: '🎵', name: '리듬 도장', go: '리듬 결투 ▶', desc: '비행은 쉬고 리듬 게임만! 4줄로 떨어지는 음표를 박자에 맞춰 누릅니다. B 랭크 이상이면 다음 단계가 열립니다.' });
MODES.push({ id: 'coop', icon: '🤝', name: '친구와 함께', go: '함께 출격 ▶', desc: '친구 1~2명과 같은 하늘에서 함께 싸웁니다. 한 명이 방을 만들고 코드나 초대 링크를 보내면 됩니다. 휴대폰과 PC가 섞여도 됩니다.' });
let selMode = 'stage', dojoLv = 1;
const STAR_RULES = ['클리어', '체력 절반 이상 남기고 클리어', '콤보 30 이상 만들기'];
const STAR_REWARD = 15;

// ---------- 그림 파일(있으면 쓰고 없으면 코드로 그린 그림) ----------
const IMG = {};
function loadImg(key) {
  const exts = ['png', 'webp', 'jpg'];
  const next = i => { if (i >= exts.length) return; const im = new Image(); im.onload = () => { IMG[key] = im; }; im.onerror = () => next(i + 1); im.src = `assets/${key}.${exts[i]}`; };
  next(0);
}
const ASSET_KEYS = [];   // 그림 파일을 넣으면 여기에 이름을 적는다(예: 'ship-falcon', 'boss-spider'). 비어 있으면 찾지 않는다
ASSET_KEYS.forEach(loadImg);

// ---------- 판 상태 ----------
let state = 'hangar', run = null, P = null, st = null, boss = null;
let shots = [], foes = [], ebul = [], drops = [], fx = [], texts = [], lasers = [];
let T = 0, shake = 0, flash = 0, bgY = 0, nearY = 0, drag = null, keys = {}, hangarStage = Math.min(S.next, S.maxStage), tab = 'sortie';
const Q = { low: false, acc: 0, n: 0 };   // 느린 기기면 효과를 줄인다
const SKY = window.SKY = { god: false, get state() { return state; }, get run() { return run; }, get P() { return P; }, get S() { return S; } };   // 점검용

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

// 스테이지가 오를수록 적이 단단해지고 탄이 빨라진다
const diffFor = s => ({
  hp: 1 + 0.32 * (s - 1),
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
  if (md === 'coop') { if (!(net && net.mode === 'host' && allies.length)) { coopMsg = net && net.mode === 'guest' ? '방장이 출격을 누르면 함께 시작해요' : '먼저 방을 만들고 친구가 들어올 때까지 기다려 주세요'; renderHangar(); return; } md = coopMd; }
  st = buildStats();
  const assist = md === 'stage' && assistOn && (S.fails || {})[stage] >= 2;
  if (assist) { st.maxHp = Math.round(st.maxHp * 1.25); st.dmg *= 1.25; }
  shots = []; foes = []; ebul = []; drops = []; fx = []; texts = []; lasers = []; boss = null; shake = 0; flash = 0;
  run = { stage, t: 0, phase: 'waves', waveDur: 110, spawnT: 1.2, warnT: 0, endT: 0, chain: 0, score: 0, kills: 0, scrapGot: 0, partsGot: [],
    level: 1, xp: 0, xpNeed: 8, taken: {}, d: diffFor(stage), theme: (stage - 1) % 4, loop: (stage - 1) / 5 | 0,
    combo: 0, comboT: 0, maxCombo: 0, hits: 0, hurtT: 0, ults: 0,
    rushAt: rnd(42, 58), rush: null, rushDone: false, rushSum: null,
    banner: { kind: 'stage', title: `STAGE ${stage}`, sub: D.THEMES[(stage - 1) % 4].name, t: 0, life: 2.6 },
    m: { dmg: 1, rate: 1, multi: 0, pierce: 0, drones: 0, magnet: 1, ult: 1, speed: 1, barrier: 0 },
    mode: md, wave: 1, bossCount: 0, nextBoss: 90, bossIdx: 0, startedAt: Date.now(), zone0: stage, assist };
  if (md === 'endless') { run.waveDur = Infinity; run.banner = { kind: 'stage', title: 'WAVE 1', sub: '무한 생존 · 얼마나 버틸까?', t: 0, life: 2.6 }; }
  if (md === 'rush') { run.d = diffFor(Math.max(3, S.cleared)); run.phase = 'warning'; run.warnT = 2.5; run.rushDone = true; run.banner = { kind: 'boss', title: 'BOSS RUSH', sub: '보스 다섯 연속!', t: 0, life: 2.4 }; }
  run.gateAt = md === 'stage' || md === 'endless' ? 32 : 0; run.treasureAt = md === 'stage' || md === 'endless' ? 80 : 0;
  Forge.show(md === 'auto'); $('ultBtn').classList.toggle('hidden', md === 'auto');
  if (md === 'auto') { run.d.hp = Math.pow(1.22, stage - 1); run.goldStart = S.forge.earned; run.rushDone = true; run.waveDur = 45; run.rushAt = rnd(15, 30); run.banner = { kind: 'stage', title: `ZONE ${stage}`, sub: '표창 공방 · 두면 알아서 싸워요', t: 0, life: 2.6 }; S.idle.on = true; S.idle.lastSeen = Date.now(); keepAwake(true); }
  if (/fast/.test(location.hash)) { run.waveDur = md === 'endless' ? Infinity : 26; run.rushAt = 8; run.nextBoss = 30; if (md === 'auto') run.waveDur = 14; if (run.gateAt) { run.gateAt = 4; run.treasureAt = 14; } }   // 점검용: 빨리 보기
  P = { x: W / 2, y: H - 190, tx: W / 2, ty: H - 190, lx: W / 2, bank: 0, hp: st.maxHp, maxHp: st.maxHp, inv: 2, ult: 0, fireT: 0, droneT: 0, seekT: 2,
    barrierReady: false, barrierT: 0, ultKind: null, ultT: 0, swarmQ: 0, swarmT: 0, ga: 0, novaR: 0, trap: null };
  S.plays++; dcount('runs'); save();
  state = 'play';
  for (const id of ['hangar', 'cards', 'pause', 'result']) $(id).classList.add('hidden');
  $('hud').classList.remove('hidden');
  A.music('stage', run.theme);
  if (md === 'dojo') { state = 'duel'; $('hud').classList.add('hidden'); Duel.start({ level: dojoLv, title: '리듬 도장', onEnd: dojoEnd }); }
  if (net && net.mode === 'host' && allies.length && (md === 'stage' || md === 'endless')) coopBegin();
}

// ---------- 효과 ----------
const fxCap = () => (Q.low ? 260 : 700);
function spark(x, y, n, color, sp = 220, life = 0.5, size = 3) {
  if (Q.low) n = Math.ceil(n / 2);
  for (let i = 0; i < n && fx.length < fxCap(); i++) {
    const a = rnd(0, TAU), v = rnd(0.3, 1) * sp;
    fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(life * 0.6, life), color, size: rnd(size * 0.6, size) });
  }
}
// 폭발: 불덩이 + 연기 + 파편 + 불똥 + 충격파
function explode(x, y, size, color = '#ffb06b') {
  if (net && net.mode === 'host') netEv.push(['x', x | 0, y | 0, size | 0, color]);
  const n = Math.max(2, Math.round(size / 8));
  for (let i = 0; i < n && fx.length < fxCap(); i++) fx.push({ k: 'fire', x: x + rnd(-size, size) * 0.3, y: y + rnd(-size, size) * 0.3, vx: rnd(-40, 40), vy: rnd(-40, 40), t: 0, life: rnd(0.35, 0.6), size: size * rnd(0.6, 1.1) });
  if (!Q.low) for (let i = 0; i < n; i++) fx.push({ k: 'smoke', x: x + rnd(-size, size) * 0.4, y: y + rnd(-size, size) * 0.4, vx: rnd(-20, 20), vy: rnd(10, 40), t: 0, life: rnd(0.8, 1.4), size: size * rnd(0.8, 1.4) });
  for (let i = 0; i < n * 2 && fx.length < fxCap(); i++) { const a = rnd(0, TAU), v = rnd(120, 360); fx.push({ k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.4, 0.9), size: rnd(2, 4), rot: rnd(0, 6), vr: rnd(-12, 12) }); }
  spark(x, y, n * 2, color, 300, 0.5, 3);
  fx.push({ k: 'ring', x, y, r: size * 1.4, t: 0, life: 0.45, color: '#fff3c4' });
}
function ringFx(x, y, r, color) { fx.push({ k: 'ring', x, y, r, t: 0, life: 0.45, color }); if (net && net.mode === 'host') netEv.push(['r', x | 0, y | 0, r | 0, color]); }
function say(text, x, y, color, size = 22, life = 1.2) { texts.push({ text, x, y, color, size, t: 0, life }); if (net && net.mode === 'host') netEv.push(['s', text, x | 0, y | 0, color, size, life]); }

// ---------- 적 ----------
function addFoe(type, x, y, o) {
  const E = D.ENEMIES[type], hp = E.hp * run.d.hp;
  const e = Object.assign({ nid: ++foeSeq, type, x, y, vx: 0, vy: 0, r: E.r, hp, maxHp: hp, t: 0, fireT: rnd(0.6, 1.6), flash: 0, xp: E.xp, score: E.score, elite: !!E.elite }, o);
  const ec = run.dangerT > 0 ? 0.45 : run.stage >= 3 && run.mode !== 'auto' ? Math.min(0.3, 0.04 + 0.025 * run.stage) : 0;
  if (type !== 'treasure' && Math.random() < ec) {   // 정예: 방패(먼저 깎아야 함), 쾌속(빠름), 폭발(부서지면 탄을 뿌림)
    e.mod = pick(['shield', 'swift', 'volatile']); e.xp = Math.ceil(e.xp * 1.5) + 1; e.score *= 2;
    if (e.mod === 'shield') e.sh = e.maxHp * 0.7;
  }
  foes.push(e);
  return e;
}
const angTo = e => { const s = nearestShip(e.x, e.y); return Math.atan2(s.y - e.y, s.x - e.x); };
function eShot(x, y, a, sp, o) {
  const v = sp * run.d.bs;
  ebul.push(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 7, color: '#ff5d8f' }, o));
}
function fan(x, y, a, n, spread, sp, o) { for (let i = 0; i < n; i++) eShot(x, y, a + (n > 1 ? -spread / 2 + spread * i / (n - 1) : 0), sp, o); }
function ring(x, y, n, off, sp, o) { for (let i = 0; i < n; i++) eShot(x, y, off + TAU * i / n, sp, o); }

function spawnWave() {
  const s = run.stage, extra = Math.min(3, (s - 1) / 2 | 0);
  const opts = [['line', 3], ['weave', 3], ['column', 2]];
  if (s >= 2) opts.push(['dive', 2], ['turret', 2], ['net', 1.2]);
  if (s >= 3) opts.push(['split', 2]);
  if (s >= 4) opts.push(['tank', 1]);
  let roll = Math.random() * opts.reduce((a, o) => a + o[1], 0), kind = opts[0][0];
  for (const [k, w] of opts) { if ((roll -= w) <= 0) { kind = k; break; } }
  if (kind === 'net' && foes.some(e => e.type === 'netter')) kind = 'line';   // 그물기는 한 번에 하나만
  if (kind === 'line') { const n = 4 + extra, gap = (W - 120) / (n - 1); for (let i = 0; i < n; i++) addFoe('scout', 60 + gap * i, -30 - (i % 2) * 30, { vy: 150 }); }
  else if (kind === 'column') { const x = rnd(70, W - 70); for (let i = 0; i < 4 + extra; i++) addFoe('scout', x, -30 - i * 55, { vy: 170 }); }
  else if (kind === 'weave') { const bx = rnd(130, W - 130); for (let i = 0; i < 4 + extra; i++) addFoe('weaver', bx, -30 - i * 60, { bx, ph: i * 0.7 }); }
  else if (kind === 'dive') { for (let i = 0; i < 2 + (extra >> 1); i++) addFoe('diver', i % 2 ? W - rnd(80, 160) : rnd(80, 160), -30 - i * 40, { mode: 'in', ty: rnd(140, 300) }); }
  else if (kind === 'turret') { addFoe('turret', rnd(100, W - 100), -40, { ty: rnd(130, 250) }); addFoe('scout', 70, -60, { vy: 160 }); addFoe('scout', W - 70, -60, { vy: 160 }); }
  else if (kind === 'split') { for (let i = 0; i < 2 + (extra >> 1); i++) addFoe('splitter', rnd(80, W - 80), -40 - i * 70); }
  else if (kind === 'tank') addFoe('tank', W / 2 + rnd(-120, 120), -50, { ty: rnd(150, 220) });
  else if (kind === 'net') addFoe('netter', rnd(90, W - 90), -40, { ty: rnd(150, 230), fireT: 2 });
}

function foeAI(e, dt) {
  e.t += dt;
  const fr = run.d.fr;
  switch (e.type) {
    case 'scout':
      e.y += e.vy * dt; e.x += e.vx * dt;
      if (run.stage >= 2 && !e.shot && e.y > 230) { e.shot = true; if (Math.random() < 0.4) eShot(e.x, e.y, angTo(e), 230); }
      break;
    case 'weaver':
      e.y += 105 * dt; e.x = e.bx + Math.sin(e.t * 2.4 + e.ph) * 95;
      if (run.stage >= 3 && (e.fireT -= dt) <= 0) { e.fireT = 2.6 / fr; eShot(e.x, e.y, angTo(e), 210, { color: '#c58bff' }); }
      break;
    case 'diver':
      if (e.mode === 'in') { e.y += 300 * dt; if (e.y >= e.ty) { e.mode = 'wait'; e.w = 0.65; } }
      else if (e.mode === 'wait') { if ((e.w -= dt) <= 0) { e.mode = 'go'; const a = angTo(e), v = 520 * run.d.bs; e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; } }
      else { e.x += e.vx * dt; e.y += e.vy * dt; }
      break;
    case 'turret':
      if (e.t < 9) { if (e.y < e.ty) e.y += 90 * dt; if ((e.fireT -= dt) <= 0) { e.fireT = 1.7 / fr; fan(e.x, e.y + 12, angTo(e), 3, 0.35, 195, { color: '#ffb347' }); } }
      else e.y += 90 * dt;
      break;
    case 'splitter':
      e.y += 85 * dt; e.x += Math.sin(e.t * 1.6) * 45 * dt;
      break;
    case 'tank':
      if (e.t < 13) { if (e.y < e.ty) e.y += 45 * dt; if ((e.fireT -= dt) <= 0) { e.fireT = 2.3 / fr; ring(e.x, e.y, 10, e.t, 150, { color: '#ff8a5e' }); } }
      else e.y += 55 * dt;
      break;
    case 'treasure':   // 천천히 가로질러 지나간다. 놓치면 끝
      e.x += e.vx * dt; e.y = e.by + Math.sin(e.t * 1.5) * 18;
      if (e.x > W + 90) { e.gone = true; say('황금 수송선이 도망쳤다…', W / 2, H * 0.3, '#c9d2dc', 22, 1.6); }
      break;
    case 'netter':   // 그물을 쏜다. 맞으면 움직일 수 없게 된다
      if (e.t < 12) {
        if (e.y < e.ty) e.y += 80 * dt;
        e.x += Math.sin(e.t * 1.2) * 50 * dt;
        if ((e.fireT -= dt) <= 0 && !P.trap) { e.fireT = 4.5 / fr; eShot(e.x, e.y + 16, angTo(e), 170, { net: true, r: 15, color: '#7ff0dc' }); A.sfx('net'); }
      } else e.y += 90 * dt;
      break;
  }
  if (e.type !== 'boss' && (e.y > H + 80 || e.x < -100 || e.x > W + 100 || e.y < -400)) e.gone = true;
}

// ---------- 보스 ----------
function spawnBoss() {
  const idx = run.mode === 'rush' ? run.bossIdx : run.mode === 'endless' ? run.bossCount % 5 : (run.stage - 1) % 5, def = D.BOSSES[idx];
  const hp = def.hp * run.d.hp * (1 + 0.15 * run.loop) * (run.mode === 'auto' ? 0.35 : 1);
  boss = { def, idx, t: 0, x: W / 2, y: -170, entering: true, tm: {}, parts: [], spin: 0, inhale: 0, mirror: 0, stream: 0, tx: W / 2, slash: 0 };
  const lay = { spider: [[0, 70]], whale: [[0, 90]], twins: [[-135, 56], [135, 56]], knight: [[0, 60]], core: [[0, 82]] }[def.id];
  for (const [dx, r] of lay) {
    const part = { type: 'boss', isBoss: true, x: W / 2 + dx, y: -170, dx, r, hp, maxHp: hp, t: 0, flash: 0, xp: 0, score: 0, inv: true };
    foes.push(part); boss.parts.push(part);
  }
  run.hitsAtBoss = run.hits; run.bossStart = run.t;
  A.music('boss', run.theme);
  run.banner = { kind: 'boss', title: def.name, sub: def.tip, t: 0, life: 3.4 };
}

function addLaser(src, a, warn, dur) { lasers.push({ src, x: src.x, y: src.y, a, warn, dur, w: 26, hit: false }); A.sfx('charge'); }

function bossAI(dt) {
  const b = boss, fr = run.d.fr, L = run.loop;
  const alive = b.parts.filter(p => !p.dead);
  if (!alive.length) return;
  if (b.entering) {
    b.y += (175 - b.y) * Math.min(1, dt * 1.4);
    if (b.y > 170) { b.entering = false; b.parts.forEach(p => { p.inv = false; }); }
  } else b.t += dt;
  const ev = (k, iv) => {
    if (b.entering) return false;
    if (b.tm[k] === undefined) b.tm[k] = iv * 0.6;
    if ((b.tm[k] -= dt) <= 0) { b.tm[k] += iv; return true; }
    return false;
  };
  const hpFrac = b.parts.reduce((s, p) => s + Math.max(0, p.hp), 0) / b.parts.reduce((s, p) => s + p.maxHp, 0);
  const ph = b.entering ? 1 : hpFrac < 1 / 3 ? 3 : hpFrac < 2 / 3 ? 2 : 1;
  if (ph > (b.ph || 1)) {   // 단계가 바뀔 때: 잠깐 무적이 되며 모습이 바뀐다
    b.ph = ph; b.phT = 1.1;
    b.parts.forEach(p => { if (!p.dead) p.inv = true; });
    run.banner = { kind: 'boss', title: `${b.def.name} · ${ph}단계`, sub: ph === 2 ? '공격이 거세진다!' : '마지막 발악!', t: 0, life: 1.6 };
    shake = Math.max(shake, 0.9); flash = 0.35; A.sfx('charge'); buzz([60, 40, 60]);
  }
  if (b.phT > 0 && (b.phT -= dt) <= 0) b.parts.forEach(p => { p.inv = false; });
  const p2 = ph >= 2, p3 = ph >= 3;
  b.p2 = p2;
  const main = alive[0];
  switch (b.def.id) {
    case 'spider':
      b.x = W / 2 + Math.sin(b.t * 0.7) * 150;
      if (ev('ring', 0.85 / fr)) ring(b.x, b.y + 20, 14 + 2 * L, b.t * 0.6, 165, { color: '#ffb347' });
      if (ev('aim', 2.6 / fr)) fan(b.x, b.y + 30, angTo(main), 3, 0.25, 235);
      if (p2 && ev('mine', 2.1 / fr)) ebul.push({ x: rnd(60, W - 60), y: b.y + 40, vx: 0, vy: 140, r: 13, color: '#ff3d3d', mine: 1.4 });
      if (p2 && ev('web', 7)) { eShot(b.x, b.y + 40, angTo(main), 160, { net: true, r: 16, color: '#7ff0dc' }); A.sfx('net'); }   // 거미줄 그물
      if (p3 && ev('spiral', 0.14 / fr)) for (const s of [1, -1]) eShot(b.x, b.y + 10, s * b.t * 2.2, 150, { color: '#ffd166', r: 6 });   // 두 겹 소용돌이
      break;
    case 'whale':
      b.x = W / 2 + Math.sin(b.t * 0.4) * 110;
      if (ev('fan', 1.7 / fr)) { fan(b.x, b.y + 50, angTo(main), 5, 0.6, 195, { color: '#7fd8ff' }); if (p2) fan(b.x, b.y + 50, Math.PI / 2, 9, 1.8, 150, { color: '#7fd8ff' }); }
      if (ev('pup', 5)) { addFoe('scout', 60, -20, { vy: 170 }); addFoe('scout', W - 60, -20, { vy: 170 }); }
      if (p3 && ev('wall', 3.2 / fr)) {   // 틈이 하나뿐인 물방울 벽
        const gap = rnd(80, W - 80);
        for (let x = 20; x < W; x += 34) if (Math.abs(x - gap) > 46) ebul.push({ x, y: b.y + 60, vx: 0, vy: 130 * run.d.bs, r: 9, color: '#9fe0ff' });
      }
      if (b.inhale > 0) {
        b.inhale -= dt;
        if (Math.random() < 0.6) fx.push({ k: 'streak', x: rnd(0, W), y: rnd(b.y + 120, H), vx: 0, vy: -520, t: 0, life: 0.6, color: 'rgba(200,240,255,.7)', size: 2 });
      } else if (ev('inhale', 8.5)) { b.inhale = 2.6; say('숨을 들이쉰다! 아래로 버텨!', W / 2, H * 0.5, '#9fe0ff', 26, 1.8); A.sfx('charge'); }
      break;
    case 'twins': {
      b.x = W / 2 + Math.sin(b.t * 0.5) * 40;
      const [Lp, Rp] = b.parts, enr = alive.length === 1;
      if (enr && !b.enraged) { b.enraged = true; say('남은 쪽이 화났다!', W / 2, H * 0.4, '#ff8a8a', 28, 1.6); }
      if (!Lp.dead) {
        if (ev('Lb', (enr ? 1.6 : 2.4) / fr)) b.stream = 8 + 2 * L;
        if (b.stream > 0 && ev('Ls', 0.1)) { b.stream--; eShot(Lp.x, Lp.y + 30, angTo(Lp), 270, { color: '#ff6b6b' }); }
      }
      if (!Rp.dead) {
        b.spin += dt * 2.4 * (enr ? 1.4 : 1);
        if (ev('Rs', 0.11 / fr)) for (let k = 0; k < 2; k++) eShot(Rp.x, Rp.y, b.spin + k * Math.PI, 170, { color: '#c58bff' });
      }
      if (enr && ev('laser', p3 ? 2.6 : 4)) addLaser(main, angTo(main), p3 ? 0.8 : 1.0, 0.6);
      if (p3 && ev('cross', 3.6)) for (const a of [Math.PI / 2 - 0.5, Math.PI / 2 + 0.5]) addLaser(main, a, 1.0, 0.5);
      break;
    }
    case 'knight':
      if (ev('dash', (p2 ? 1.9 : 2.6) / fr)) { b.tx = rnd(90, W - 90); b.slash = 1; }
      b.x += (b.tx - b.x) * Math.min(1, dt * 5);
      if (b.slash === 1 && Math.abs(b.tx - b.x) < 8) {
        b.slash = p2 ? 2 : 0; b.slashT = 0.35;
        fan(b.x, b.y + 40, Math.PI / 2, 7 + L, 1.3, 245, { color: '#e0e8ff' });
      }
      if (b.slash === 2 && (b.slashT -= dt) <= 0) {
        b.slash = 0; fan(b.x, b.y + 40, Math.PI / 2, 8 + L, 1.5, 200, { color: '#e0e8ff' });
        if (p3) for (const a of [Math.PI / 2 - 0.7, Math.PI / 2 + 0.7]) fan(b.x, b.y + 40, a, 5, 0.25, 280, { color: '#ffffff', r: 6 });   // X자 베기
      }
      if (b.mirror > 0) b.mirror -= dt;
      else if (ev('mirror', p3 ? 5.5 : 8)) { b.mirror = 2.6; say('거울 방패! 내 탄이 되돌아온다', W / 2, H * 0.45, '#9fc8ff', 24, 1.6); }
      main.shield = b.mirror > 0;
      break;
    case 'core':
      b.x = W / 2;
      b.spin += dt * (p2 ? 1.3 : 1.0);
      if (p3) b.spin -= dt * 2.6;   // 마지막 단계: 거꾸로 돈다
      if (ev('sp', 0.13 / fr)) { const arms = p3 ? 6 : 4; for (let k = 0; k < arms; k++) eShot(b.x, b.y, b.spin + k * TAU / arms, 175, { color: p3 ? '#ff8a8a' : '#7cf0c0' }); }
      if (ev('ring', 3 / fr)) ring(b.x, b.y, 16 + 2 * L, 0, 140, { color: '#ffd166' });
      if (p2 && ev('laser', 3.4)) addLaser(main, angTo(main), 0.9, 0.5);
      break;
  }
  for (const p of b.parts) {
    p.x = b.x + p.dx;
    p.y = b.y + (b.def.id === 'twins' ? Math.sin(b.t * 1.3 + p.dx) * 12 : 0);
  }
}

function bossDown() {
  run.phase = 'clear'; run.endT = run.mode === 'stage' ? 3.6 : 2.6; run.chain = 14;
  ebul.forEach(b => spark(b.x, b.y, 3, b.color, 80, 0.3, 2)); ebul = []; lasers = [];
  if (P.trap) freeTrap(true);
  const x = boss.x, y = boss.y;
  if (run.mode !== 'auto' || Math.random() < 0.25) drops.push({ kind: 'part', x, y, vy: 40, v: 1 });
  for (let i = 0; i < 10 + run.stage; i++) drops.push({ kind: 'scrap', x: x + rnd(-80, 80), y: y + rnd(-40, 40), vy: rnd(20, 90), v: run.mode === 'auto' ? 2 : 3 });
  run.score += 5000 * run.stage;
  if (run.mode === 'auto') say('💰 ' + Forge.fmt(Forge.addGold(30 * Math.pow(1.17, run.stage - 1))), W / 2, H * 0.36, '#ffd166', 26, 1.8);
  if (!S.stats.bossSeen.includes(boss.idx)) S.stats.bossSeen.push(boss.idx);
  dcount('boss');
  if (run.hits === run.hitsAtBoss) { S.stats.nohit = 1; say('노피격 격파!', W / 2, H * 0.32, '#7fffd4', 30, 2.4); }
  // 보스 랭크: 정해진 시간(par) 안에 적게 맞고 잡을수록 높다. S·A면 고철 덤
  const bt = run.t - run.bossStart, hits = run.hits - run.hitsAtBoss, par = (boss.def.par || 45) + 3 * Math.min(run.stage, 10);
  const rank = run.assist ? 'C' : hits === 0 && bt <= par ? 'S' : hits <= 1 && bt <= par * 1.3 ? 'A' : hits <= 3 && bt <= par * 1.8 ? 'B' : 'C';
  run.bossRank = rank; run.bossTime = bt;
  const bonus = { S: 6, A: 3, B: 1, C: 0 }[rank];
  for (let i = 0; i < bonus; i++) drops.push({ kind: 'scrap', x: x + rnd(-60, 60), y: y + rnd(-30, 30), vy: rnd(30, 80), v: 5 });
  say(`${rank} 랭크 · ${bt.toFixed(1)}초`, W / 2, H * 0.4, { S: '#ffd166', A: '#9dffcf', B: '#9fd0ff', C: '#c9d2dc' }[rank], 34, 2.6);
  if (run.mode === 'stage') { S.ranks = S.ranks || {}; const old = S.ranks[run.stage]; if (!old || 'SABC'.indexOf(rank) < 'SABC'.indexOf(old)) S.ranks[run.stage] = rank; }
  A.sfx('boomL'); shake = 1.4; flash = 1; buzz([80, 60, 160]);
}

// ---------- 그물 함정: 걸리면 움직일 수 없고, 화면을 연타해서 빠져나온다 ----------
function catchInNet() {
  P.trap = { g: 0.12, t: 0 };
  drag = null;
  A.sfx('net'); buzz([50, 40, 50]);
  run.banner = { kind: 'trap', title: '그물에 걸렸다!', sub: '화면을 빠르게 연타해서 빠져나와!', t: 0, life: 1.6 };
}
function tapTrap() {
  if (!P.trap) return;
  P.trap.g += 0.11;
  A.sfx('tap'); buzz(12);
  spark(P.x + rnd(-20, 20), P.y + rnd(-20, 20), 3, '#7ff0dc', 180, 0.3, 2);
  if (P.trap.g >= 1) freeTrap(true);
}
function freeTrap(byTap) {
  P.trap = null; P.inv = Math.max(P.inv, 0.8);
  if (byTap) {
    S.stats.escapes++; dcount('escape');
    P.ult = Math.min(100, P.ult + 8);
    ringFx(P.x, P.y, 60, '#7ff0dc'); spark(P.x, P.y, 24, '#bffff0', 320, 0.5, 3);
    say('탈출!', P.x, P.y - 60, '#7ff0dc', 30, 1);
    A.sfx('escape');
  }
}

// ---------- 비트 러시: 음악 박자에 맞춰 톡! 맞히면 내 앞으로 박자 빔이 나간다 ----------
const RUSH_NOTES = 16, PERFECT = 0.085, GOOD = 0.17, LANE_X = 92, NOTE_SPEED = 300;
function startRush() {
  const c = A.clock(), beat = 60 / c.bpm;
  const first = c.t0 + Math.ceil((c.t + 1.8 - c.t0) / beat) * beat;   // 다음 박자부터(준비 시간 1.8초)
  const notes = [];
  for (let i = 0; i < RUSH_NOTES; i++) {
    notes.push({ t: first + i * beat, j: null });
    if (run.stage >= 3 && i < RUSH_NOTES - 1 && i % 4 === 2 && Math.random() < 0.6) notes.push({ t: first + (i + 0.5) * beat, j: null, half: true });   // 엇박
  }
  run.rush = { notes, beat, perfect: 0, good: 0, miss: 0, chain: 0, end: notes[notes.length - 1].t + 0.4, judge: null, judgeT: 0 };
  run.rushDone = true;
  run.banner = { kind: 'rush', title: 'BEAT RUSH', sub: '박자에 맞춰 화면을 톡!', t: 0, life: 1.8 };
  A.sfx('rush'); buzz(40);
}
function rushTap() {
  const r = run.rush, now = A.clock().t;
  let best = null, bd = 9;
  for (const n of r.notes) { if (n.j) continue; const d = Math.abs(now - n.t); if (d < bd) { bd = d; best = n; } }
  if (!best || bd > GOOD) { A.sfx('tap'); return; }   // 박자가 아닐 때 누르면 아무 일 없음(벌 없음)
  const perfect = bd <= PERFECT;
  best.j = perfect ? 'p' : 'g';
  r.chain++;
  if (perfect) { r.perfect++; S.stats.perfects++; dcount('perfect'); } else r.good++;
  r.judge = perfect ? 'PERFECT' : 'GOOD'; r.judgeT = 0.5;
  A.sfx(perfect ? 'perfect' : 'good'); buzz(perfect ? 20 : 10);
  beatStrike(perfect ? 1 : 0.55);
}
function beatStrike(k) {   // 박자 빔: 내 앞 세로 줄의 적을 한꺼번에 때린다
  const pw = ultPow();
  for (const e of foes.slice()) if (Math.abs(e.x - P.x) < 55 + e.r && e.y < P.y) hitFoe(e, 42 * k * pw);
  ebul = ebul.filter(b => !(Math.abs(b.x - P.x) < 50 && b.y < P.y && b.y > P.y - 260 && !b.net));
  fx.push({ k: 'beam', x: P.x, y: P.y, t: 0, life: 0.18, w: 70 * k + 30 });
  P.ult = Math.min(100, P.ult + 2.5 * k);
}
function updateRush() {
  const r = run.rush, now = A.clock().t;
  for (const n of r.notes) if (!n.j && now - n.t > GOOD) { n.j = 'm'; r.miss++; r.chain = 0; r.judge = 'MISS'; r.judgeT = 0.4; }
  if (r.judgeT > 0) r.judgeT -= 1 / 60;
  if (now > r.end) {
    const total = r.notes.length, reward = r.perfect + Math.floor(r.good / 2);
    S.scrap += reward; run.scrapGot += reward;
    const great = r.perfect >= total * 0.75;
    if (great) P.ult = Math.min(100, P.ult + 30);
    run.rushSum = { text: `PERFECT ${r.perfect} · GOOD ${r.good} · MISS ${r.miss}`, sub: `고철 +${reward}${great ? ' · 완벽한 박자! 궁극기 +30' : ''}`, t: 0 };
    if (great) A.sfx('levelup');
    run.rush = null;
  }
}

// ---------- 리듬 결투(중간 보스): 비행을 멈추고 리듬 게임에만 집중 ----------
function startDuelEvent() {
  run.rushDone = true;
  state = 'duel'; drag = null;
  $('hud').classList.add('hidden');
  ebul = []; lasers = [];
  Duel.start({ level: Math.min(8, run.stage + run.loop * 2 + (run.mode === 'endless' ? run.wave >> 1 : 0)), title: '중간 보스', onEnd: duelEnd });
}
function duelEnd(r) {
  state = 'play'; $('hud').classList.remove('hidden');
  A.music('stage', run.theme);
  S.stats.perfects += r.p; dcount('perfect', r.p);
  const rw = { S: [40, 100, 1.25], A: [25, 60, 1.15], B: [15, 35, 1.08], C: [6, 15, 1], D: [0, 0, 1] }[r.rank];
  if (rw[0]) gainScrap(rw[0]);
  P.ult = Math.min(100, P.ult + rw[1]);
  if (rw[2] > 1) run.beatBuff = Math.max(run.beatBuff || 1, rw[2]);
  if (r.rank === 'D') hurtPlayer(run.d.dmg);   // DJ의 반격
  P.inv = Math.max(P.inv, 1.5);
  run.rushSum = { text: `리듬 결투 ${r.rank} 랭크 · 정확도 ${Math.round(r.acc * 100)}%`, sub: r.rank === 'D' ? 'DJ가 도망치며 한 방 날렸다!' : `고철 +${rw[0]} · 궁극기 +${rw[1]}${rw[2] > 1 ? ` · 이번 판 피해 +${Math.round((rw[2] - 1) * 100)}%` : ''}`, t: 0 };
}
function dojoEnd(r) {
  state = 'result'; $('hud').classList.add('hidden');
  const lv = r.level, order = 'SABCD', old = S.dojo.best[lv];
  if (!old || order.indexOf(r.rank) < order.indexOf(old)) S.dojo.best[lv] = r.rank;
  const pass = order.indexOf(r.rank) <= 2, opened = pass && lv === S.dojo.open && lv < 8;
  if (opened) S.dojo.open = lv + 1;
  const reward = Math.round({ S: 20, A: 12, B: 6, C: 2, D: 0 }[r.rank] * (1 + 0.25 * (lv - 1)));
  S.scrap += reward; S.stats.perfects += r.p; dcount('perfect', r.p);
  save(); A.music('hangar', 0);
  $('rTitle').innerHTML = `<small>리듬 도장 Lv ${lv}</small>${r.rank} 랭크`; $('rTitle').className = pass ? 'win' : 'lose';
  $('rStars').innerHTML = '';
  $('rStats').innerHTML = [`<div class="big">${Math.round(r.acc * 100)}<small>% 정확도</small></div>`,
    `<div>PERFECT <b>${r.p}</b> · GREAT <b>${r.g}</b> · GOOD <b>${r.o}</b> · MISS <b>${r.m}</b></div>`,
    `<div>최고 콤보 <b>${r.maxCombo}</b> / ${r.total} · 이 단계 최고 <b class="gold">${S.dojo.best[lv]}</b></div>`,
    `<div>얻은 고철 🔩 <b>${reward}</b></div>`, opened ? `<div class="gold">🔓 Lv ${lv + 1} 열림!</div>` : pass ? '' : '<div>B 랭크 이상이면 다음 단계가 열립니다.</div>'].join('');
  const btns = $('rBtns'); btns.innerHTML = '';
  const mk = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', () => { A.sfx('click'); fn(); }); btns.append(b); };
  if (lv < S.dojo.open) mk(`Lv ${lv + 1} 도전 ▶`, 'big', () => { dojoLv = lv + 1; startRun(1, 'dojo'); });
  mk('다시 하기', lv < S.dojo.open ? 'sub' : 'big', () => { dojoLv = lv; startRun(1, 'dojo'); });
  mk('격납고', 'sub', showHangar);
  Rank.after('dojo', lv * 1000 + Math.round(r.acc * 999), `Lv ${lv} · ${r.rank} 랭크 · 정확도 ${Math.round(r.acc * 100)}%`);
  $('copy').dataset.text = `🎵 볼트윙 리듬 도장 Lv ${lv} ${r.rank} 랭크 · 정확도 ${Math.round(r.acc * 100)}% · 콤보 ${r.maxCombo}`;
  $('result').classList.remove('hidden');
}

// ---------- 갈림길: 위험 항로(강한 적, 보상 2배)와 보급 항로(회복) 중 하나를 지나간다 ----------
function spawnGates() {
  run.gateLast = run.t;
  run.gates = [{ x: W * 0.27, y: -90, kind: 'danger' }, { x: W * 0.73, y: -90, kind: 'supply' }];
  say('갈림길! 한쪽 문을 지나가세요', W / 2, H * 0.3, '#ffffff', 24, 2); A.sfx('charge');
}
function updateGates(dt) {
  for (const g of run.gates) {
    g.y += 85 * dt;
    if (run.phase !== 'dead' && [P, ...allies].some(s => !(s.down > 0) && Math.abs(s.x - g.x) < 70 && Math.abs(s.y - g.y) < 40)) { chooseGate(g.kind); return; }
  }
  if (run.gates[0].y > H + 100) run.gates = null;
}
function chooseGate(kind) {
  run.gates = null;
  if (kind === 'danger') { run.dangerT = 22; run.banner = { kind: 'boss', title: '위험 항로', sub: '22초 동안 강한 적이 몰려온다 · 보상 2배!', t: 0, life: 2 }; A.sfx('warning'); buzz([80, 40, 80]); }
  else {
    if (!run.gambler) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.35); for (const a of allies) if (!(a.down > 0)) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.35); }
    for (let i = 0; i < 8; i++) drops.push({ kind: 'scrap', x: P.x + rnd(-80, 80), y: P.y - 200 + rnd(-40, 40), vy: 60, v: 2 });
    if (Math.random() < 0.15) drops.push({ kind: 'part', x: P.x, y: P.y - 250, vy: 50, v: 1 });
    run.banner = { kind: 'trap', title: '보급 항로', sub: '체력 회복과 고철 보급', t: 0, life: 1.8 }; A.sfx('heal');
  }
  ringFx(P.x, P.y, 90, kind === 'danger' ? '#ff5d5d' : '#6ee37a');
}
function drawGates() {
  if (!run.gates) return;
  for (const g of run.gates) {
    const c = g.kind === 'danger' ? '#ff5d5d' : '#6ee37a', y = g.y;
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow(c, 60), g.x - 95, y - 80, 190, 150); ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 9; ctx.strokeStyle = '#0b0f18';
    ctx.beginPath(); ctx.moveTo(g.x - 70, y + 40); ctx.lineTo(g.x - 70, y - 10); ctx.arc(g.x, y - 10, 70, Math.PI, 0); ctx.lineTo(g.x + 70, y + 40); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = c; ctx.stroke();
    txt(g.kind === 'danger' ? '⚠ 위험 항로' : '✚ 보급 항로', g.x, y - 4, 18, c, 'center', 900);
    txt(g.kind === 'danger' ? '강한 적 · 보상 ×2' : '회복 · 고철', g.x, y + 20, 12, '#ffffff', 'center', 700);
  }
}

// ---------- 내 로봇: 쏘기와 드론 ----------
function addShot(x, y, vx, vy, dmg, o) {
  shots.push(Object.assign({ x, y, vx, vy, dmg, pierce: 0, r: 5, color: st.Wp.color, hits: [], t: 0 }, o));
}
function fire(sh = P, Wp = st.Wp, base = st.dmg) {   // sh = 쏘는 기체(나 또는 친구)
  const m = run.m, evo = run.evo, mine = sh === P, dmg = base * m.dmg * (run.beatBuff || 1), pierce = (Wp.pierce || 0) + m.pierce, n = 1 + m.multi;
  const shot = (x, y, vx, vy, d, o) => addShot(x, y, vx, vy, d, Object.assign({ color: Wp.color, own: mine ? null : sh }, o));
  if (mine) A.sfx(Wp.id);
  if (Wp.id === 'spread') {
    const k = Wp.pellets + 2 * m.multi + (evo ? 4 : 0), arc = Wp.arc + 0.08 * m.multi + (evo ? 0.25 : 0);
    for (let i = 0; i < k; i++) {
      const a = -Math.PI / 2 - arc / 2 + arc * i / (k - 1), o = { pierce: pierce + (evo ? 1 : 0) };
      if (evo) { o.color = '#ff8a3c'; o.r = 7; }   // 진화: 용의 숨결
      shot(sh.x, sh.y - 24, Math.cos(a) * Wp.speed, Math.sin(a) * Wp.speed, dmg, o);
    }
  } else if (Wp.id === 'missile') {
    const k = n * (evo ? 2 : 1);   // 진화: 군집 미사일
    for (let i = 0; i < k; i++) shot(sh.x + (i - (k - 1) / 2) * 14, sh.y - 18, (i - (k - 1) / 2) * 120 + rnd(-40, 40), -300, dmg, { homing: true, pierce, r: 6, boom: !!evo });
  } else if (Wp.id === 'laser' && evo) {   // 진화: 프리즘 빔
    for (let i = 0; i < n; i++) for (const a of [-0.12, 0, 0.12]) shot(sh.x + (i - (n - 1) / 2) * 14, sh.y - 26, Math.sin(a) * Wp.speed, -Math.cos(a) * Wp.speed, dmg, { pierce: 99, r: 5, long: true, color: '#ffb3f5' });
  } else {
    const gat = evo && Wp.id === 'vulcan';   // 진화: 폭풍 개틀링
    for (let i = 0; i < n; i++) {
      const o = { pierce, r: Wp.id === 'laser' ? 4 : gat ? 7 : 5, long: Wp.id === 'laser' };
      if (gat) o.color = '#fff3a0';
      shot(sh.x + (i - (n - 1) / 2) * 14, sh.y - 26, Wp.id === 'vulcan' ? rnd(-25, 25) : 0, -Wp.speed, dmg * (gat ? 1.1 : 1), o);
    }
  }
  fx.push({ k: 'muzzle', x: sh.x, y: sh.y - 30, t: 0, life: 0.06, color: Wp.color });
}function droneSpots() {
  const n = (st.gun ? 1 : 0) + run.m.drones, spots = [[-44, 16], [44, 16], [-72, 30], [72, 30]];
  return spots.slice(0, n).map(([dx, dy], i) => ({ x: P.x + dx, y: P.y + dy + Math.sin(T * 4 + i) * 3, part: st.gun && i === 0 }));
}
const guardCount = () => (st.guard ? (st.guard >= 3 ? 2 : 1) : 0);
const guardSpots = () => Array.from({ length: guardCount() }, (_, i) => ({ x: P.x + Math.cos(P.ga + i * Math.PI) * 52, y: P.y + Math.sin(P.ga + i * Math.PI) * 52 }));

function useUlt() {
  if (net && net.mode === 'guest') { if (P.ult >= 100) { net.conn.send({ t: 'ult' }); P.ult = 0; } return; }   // 참가자: 방장에게 부탁
  if (state !== 'play' || run.phase === 'dead' || run.phase === 'clear' || P.ult < 100 || P.down > 0) return;
  P.ult = 0; run.ults++; S.stats.ults++; dcount('ult');
  if (P.trap) freeTrap(true);   // 궁극기를 쓰면 그물도 터진다
  const u = st.F.ult;
  A.sfx('ult_' + u.id); buzz(60);
  run.banner = { kind: 'ult', title: u.name, sub: '', t: 0, life: 1.3 };
  shake = Math.max(shake, 0.6);
  if (u.id === 'laser') { P.ultKind = 'laser'; P.ultT = 3; }
  else if (u.id === 'bulwark') { P.ultKind = 'bulwark'; P.ultT = 5; }
  else if (u.id === 'swarm') { P.swarmQ = 30; P.swarmT = 0; }
  else if (u.id === 'nova') {
    P.ultKind = 'nova'; P.ultT = 0.7; P.novaR = 0; flash = 0.8;
    P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.35);
    for (const e of foes.slice()) hitFoe(e, 260 * ultPow());
    for (const b of ebul) drops.push({ kind: 'scrap', x: b.x, y: b.y, vy: 30, v: 1, small: true });
    ebul = [];
  }
}
const ultPow = () => st.dmg * run.m.dmg / st.Wp.dmg * run.d.hp;   // 궁극기·박자 빔도 내 화력과 스테이지에 맞춰 세진다

// 화면을 톡 눌렀을 때: 그물에 걸렸으면 연타, 비트 러시 중이면 박자, 아니면 두 번 톡톡으로 궁극기
let lastTap = 0;
function onTap() {
  if (state !== 'play' || run.phase === 'dead') return;
  if (P.trap) { tapTrap(); return; }
  if (run.rush) { rushTap(); return; }
  if (run.mode === 'auto') { Forge.tap(); return; }
  const now = performance.now();
  if (now - lastTap < 280) useUlt();
  lastTap = now;
}

// ---------- 맞히기·맞기 ----------
function hitFoe(e, dmg, own) {
  if (e.inv || e.dead || e.gone) return;
  if (e.sh > 0) {
    const a = Math.min(e.sh, dmg); e.sh -= a; dmg -= a; e.flash = 0.04;
    if (e.sh <= 0) { ringFx(e.x, e.y, e.r * 1.6, '#7fd8ff'); A.sfx('barrier'); }
    if (dmg <= 0) return;
  }
  e.hp -= dmg; e.flash = 0.06;
  if (own && own !== P) own.ult = Math.min(100, own.ult + dmg / run.d.hp * 0.09 * run.m.ult);
  else P.ult = Math.min(100, P.ult + dmg / run.d.hp * 0.09 * st.ult * run.m.ult);
  if (e.hp <= 0) killFoe(e);
  else A.sfx('hit');
}
const comboMul = () => 1 + Math.min(run.combo, 50) * 0.02;
function killFoe(e) {
  e.dead = true;
  run.kills++; S.stats.kills++; dcount('kills');
  run.combo++; run.comboT = 2.5; run.maxCombo = Math.max(run.maxCombo, run.combo);
  if (run.combo % 10 === 0) say(`${run.combo} 콤보!`, e.x, e.y - 30, '#ffd166', 26, 1);
  run.score += Math.round(e.score * comboMul());
  explode(e.x, e.y, e.isBoss ? 90 : e.r * 1.6, e.isBoss ? '#ffd166' : '#ffb06b');
  A.sfx(e.r > 25 ? 'boomL' : 'boomS');
  if (e.r > 25) { shake = Math.max(shake, 0.5); buzz(40); }
  if (e.isBoss) {
    if (boss.parts.every(p => p.dead)) bossDown();
    return;
  }
  const dm = run.dangerT > 0 ? 2 : 1;   // 위험 항로에서는 보상 2배
  if (e.mod === 'volatile') ring(e.x, e.y, 8, rnd(0, 1), 150, { color: '#ff9a3c' });
  if (e.type === 'treasure') {
    for (let i = 0; i < 16; i++) drops.push({ kind: 'scrap', x: e.x + rnd(-60, 60), y: e.y + rnd(-30, 30), vy: rnd(30, 90), v: 2 });
    if (Math.random() < 0.3) drops.push({ kind: 'part', x: e.x, y: e.y, vy: 50, v: 1 });
    drops.push({ kind: 'heart', x: e.x + 20, y: e.y, vy: 60, v: 20 });
    say('황금 수송선 격파! 고철이 쏟아진다', W / 2, H * 0.3, '#ffd166', 26, 2); flash = 0.4;
  }
  if (run.mode === 'auto') { const gv = Forge.addGold((e.elite ? 4 : 1) * Math.pow(1.17, run.stage - 1)); if (!Q.low && Math.random() < 0.5) say('💰' + Forge.fmt(gv), e.x, e.y - 10, '#ffd166', 13, 0.6); }
  if (e.xp) drops.push({ kind: 'xp', x: e.x, y: e.y, vy: 60, v: e.xp * dm });
  if (dm > 1 && Math.random() < 0.5) drops.push({ kind: 'scrap', x: e.x, y: e.y, vy: 70, v: 1 });
  if (Math.random() < (run.mode === 'auto' ? 0.2 : 0.3) || e.elite) drops.push({ kind: 'scrap', x: e.x + rnd(-10, 10), y: e.y, vy: 70, v: e.elite ? 6 : 1 });
  if (Math.random() < 0.02) drops.push({ kind: 'heart', x: e.x, y: e.y, vy: 60, v: 20 });
  if (e.elite && Math.random() < 0.15) drops.push({ kind: 'part', x: e.x, y: e.y, vy: 50, v: 1 });
  if (e.type === 'splitter') for (const s of [-1, 1]) addFoe('scout', e.x + s * 12, e.y, { vy: 180, vx: s * 90, xp: 1 });
}
function hurtPlayer(dmg) {
  if (SKY.god || P.inv > 0 || P.ultKind === 'bulwark' || run.phase === 'dead' || run.phase === 'clear') return;
  if (run.m.barrier && P.barrierReady) {
    P.barrierReady = false; P.barrierT = 16; P.inv = 0.5;
    A.sfx('barrier'); ringFx(P.x, P.y, 40, '#7fd8ff');
    return;
  }
  P.hp -= dmg * (run.dmgTaken || 1); P.inv = st.invT; run.hits++; run.hurtT = 0.6;
  if (run.combo >= 10) say('콤보 끊김', P.x, P.y - 60, '#ff9a9a', 20, 1);
  run.combo = 0;
  shake = Math.max(shake, 0.5);
  A.sfx('hurt'); buzz(70); spark(P.x, P.y, 18, '#ff6b6b', 260, 0.5, 3);
  if (P.hp <= 0 && rs('revive') && !run.revived) {   // 긴급 수리 연구: 판마다 한 번 다시 일어난다
    run.revived = true; P.hp = Math.round(P.maxHp * (0.2 + 0.1 * rs('revive'))); P.inv = 3; P.trap = null;
    ebul = []; flash = 0.8; ringFx(P.x, P.y, 120, '#ff9ad5');
    run.banner = { kind: 'ult', title: '긴급 수리!', sub: '', t: 0, life: 1.5 }; A.sfx('part'); buzz(120);
    return;
  }
  if (P.hp <= 0 && net && net.mode === 'host' && allies.some(a => a.down <= 0)) {   // 협동: 친구가 살아 있으면 6초 뒤 복귀
    P.hp = 0; P.down = 6; P.inv = 99; P.trap = null;
    explode(P.x, P.y, 60, st.F.color); say('격추! 6초 뒤 복귀 — 친구가 버티는 중', W / 2, H * 0.4, '#ff9a9a', 22, 1.8);
    return;
  }
  if (P.hp <= 0) {
    P.hp = 0; run.phase = 'dead'; run.endT = 2; P.trap = null; run.rush = null;
    explode(P.x, P.y, 80, st.F.color); A.sfx('boomL'); shake = 1.4; flash = 0.7; buzz([100, 50, 200]);
  }
}
function grantPart() {
  const cand = D.PARTS.filter(p => !S.parts[p.id]);
  if (!cand.length) { S.scrap += 25; run.scrapGot += 25; say('부품을 다 모았다! 고철 +25', P.x, P.y - 70, '#ffd166', 22, 1.6); A.sfx('scrap'); save(); return; }
  const p = pick(cand);
  S.parts[p.id] = 1;
  if (!S.equip[p.slot]) S.equip[p.slot] = p.id;   // 빈 칸이면 다음 판부터 바로 끼워진다
  run.partsGot.push(`${p.icon} ${p.name}`);
  say(`새 부품! ${p.icon} ${p.name}`, W / 2, H * 0.5, '#ffd166', 30, 2.2);
  A.sfx('part'); buzz(50); save();
}

// ---------- 레벨 업 카드: 등급(일반·희귀·영웅), 대가 카드, 무기 진화 ----------
const EVOS = {   // 무기마다 조건 카드를 모으면 진화 카드가 나온다
  vulcan: { need: 'rate', n: 2, name: '폭풍 개틀링', icon: '🌪️', desc: '연사 2배, 탄이 굵고 세진다' },
  spread: { need: 'multi', n: 2, name: '용의 숨결', icon: '🐉', desc: '갈래 +4, 불꽃 탄이 적 하나를 더 뚫는다' },
  laser: { need: 'pierce', n: 2, name: '프리즘 빔', icon: '🔺', desc: '레이저가 셋으로 갈라지고 모든 적을 뚫는다' },
  missile: { need: 'drone', n: 1, name: '군집 미사일', icon: '🐝', desc: '미사일 2배, 맞으면 작은 폭발' },
};
const EVO_HINT = { rate: '연사 강화 2번', multi: '탄 갈래 2번', pierce: '관통 2번', drone: '임시 드론 1번' };
const CURSES = [
  { id: 'glass', name: '유리 대포', icon: '💎', desc: '피해 +60%, 대신 최대 체력 -30%' },
  { id: 'overheat', name: '과열 엔진', icon: '♨️', desc: '연사 +50%, 대신 받는 피해 +30%' },
  { id: 'gambler', name: '도박꾼', icon: '🎲', desc: '고철 2배, 대신 이번 판 회복 효과 없음' },
];
const SCALE = { dmg: k => `피해 +${Math.round(20 * k)}%`, rate: k => `연사 +${Math.round(18 * k)}%`, magnet: k => `줍는 범위 +${Math.round(40 * k)}%`,
  heal: k => `체력 ${Math.round(Math.min(100, 40 * k))}% 회복`, maxhp: k => `최대 체력 +${Math.round(20 * k)}`, ult: k => `궁극기 충전 +${Math.round(30 * k)}%`, speed: k => `이동 속도 +${Math.round(12 * k)}%` };
const RARE = { common: 1, rare: 1.6, hero: 2.5 };
function rollCards() {
  let pool = D.CARDS.filter(c => !c.max || (run.taken[c.id] || 0) < c.max);
  if (P.hp > P.maxHp * 0.85 || run.gambler) pool = pool.filter(c => c.id !== 'heal');
  const choice = [];
  while (choice.length < 3 && pool.length) {
    const c = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    const r = SCALE[c.id] ? (Math.random() < 0.08 ? 'hero' : Math.random() < 0.27 ? 'rare' : 'common') : 'common';
    choice.push({ ...c, rarity: r, mult: RARE[r], desc: SCALE[c.id] ? SCALE[c.id](RARE[r]) : c.desc });
  }
  const curses = CURSES.filter(c => !run.taken[c.id]);
  if (curses.length && run.level >= 3 && Math.random() < 0.18) choice[choice.length - 1] = { ...pick(curses), rarity: 'curse', mult: 1 };
  const evo = EVOS[st.Wp.id];
  if (evo && !run.evo && (run.taken[evo.need] || 0) >= evo.n) choice[0] = { id: 'evo', name: evo.name, icon: evo.icon, desc: '무기 진화! ' + evo.desc, rarity: 'evo', mult: 1 };
  return choice;
}
function openCards() {
  drag = null;
  A.sfx('levelup');
  const choice = rollCards();
  run.cardChoice = choice;
  if (run.mode === 'auto') {
    const ids = choice.map(c => c.id);
    const want = ids.includes('evo') ? 'evo' : P.hp < P.maxHp * 0.4 && ids.includes('heal') ? 'heal' : AUTO_CARDS.find(id => ids.includes(id)) || ids[0];
    state = 'cards'; takeCard(want);
    const c = choice.find(x => x.id === want);
    say(`${c.icon} ${c.name}`, P.x, P.y - 70, '#9dffcf', 22, 1.4);
    return;
  }
  state = 'cards';
  const box = $('cardsBox'); box.innerHTML = '';
  choice.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'pickCard ' + c.rarity;
    b.style.animationDelay = i * 0.08 + 's';
    const tag = { rare: '희귀', hero: '영웅', curse: '대가', evo: '진화' }[c.rarity];
    const have = run.taken[c.id] ? `<i>지금 ${run.taken[c.id]}번 고름</i>` : '';
    b.innerHTML = `<span class="ic">${c.icon}</span><span>${tag ? `<em>${tag}</em>` : ''}<b>${i + 1}. ${c.name}</b>${c.desc}${have}</span>`;
    b.addEventListener('click', () => takeCard(c.id));
    box.append(b);
  });
  const evo = EVOS[st.Wp.id];
  $('cardsLv').innerHTML = `Lv ${run.level}` + (evo && !run.evo ? `<small style="display:block;opacity:.7;font-size:.7em">진화 조건: ${EVO_HINT[evo.need]} → ${evo.icon} ${evo.name}</small>` : '');
  $('cards').dataset.ids = choice.map(c => c.id).join(',');
  $('cards').classList.remove('hidden');
}
function takeCard(id) {
  if (state !== 'cards') return;
  const m = run.m, c = (run.cardChoice || []).find(x => x.id === id) || { mult: 1 }, k = c.mult || 1;
  run.taken[id] = (run.taken[id] || 0) + 1;
  if (id === 'dmg') m.dmg *= 1 + 0.2 * k;
  else if (id === 'rate') m.rate *= 1 + 0.18 * k;
  else if (id === 'multi') m.multi++;
  else if (id === 'pierce') m.pierce++;
  else if (id === 'drone') m.drones++;
  else if (id === 'magnet') m.magnet *= 1 + 0.4 * k;
  else if (id === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * Math.min(1, 0.4 * k));
  else if (id === 'maxhp') { P.maxHp += Math.round(20 * k); P.hp += Math.round(20 * k); }
  else if (id === 'ult') m.ult *= 1 + 0.3 * k;
  else if (id === 'speed') m.speed *= 1 + 0.12 * k;
  else if (id === 'barrier') { m.barrier = 1; P.barrierReady = true; }
  else if (id === 'glass') { m.dmg *= 1.6; P.maxHp = Math.round(P.maxHp * 0.7); P.hp = Math.min(P.hp, P.maxHp); }
  else if (id === 'overheat') { m.rate *= 1.5; run.dmgTaken = 1.3; }
  else if (id === 'gambler') run.gambler = true;
  else if (id === 'evo') { run.evo = true; const ev = EVOS[st.Wp.id]; run.banner = { kind: 'ult', title: `진화! ${ev.name}`, sub: ev.desc, t: 0, life: 2.2 }; flash = 0.6; A.sfx('part'); buzz([40, 30, 80]); }
  A.sfx('click');
  $('cards').classList.add('hidden');
  state = 'play';
}
// ---------- 자동 조종: 날아오는 탄을 미리 보고 가장 안전한 곳으로, 적 아래로 붙는다 ----------
const AUTO_STEPS = [[0, 0], [-60, 0], [60, 0], [0, -50], [0, 50], [-50, -40], [50, -40], [-50, 40], [50, 40], [-120, 0], [120, 0], [-90, 60], [90, 60]];
const AUTO_CARDS = ['dmg', 'multi', 'rate', 'drone', 'pierce', 'barrier', 'ult', 'maxhp', 'magnet', 'speed', 'heal'];
function autoPilot(dt) {
  if (P.trap) { run.autoTap = (run.autoTap || 0) - dt; if (run.autoTap <= 0) { run.autoTap = 0.12; tapTrap(); } return; }
  if (run.rush) { const now = A.clock().t; for (const n of run.rush.notes) if (!n.j && now - n.t > 0.1 && now - n.t < 0.16) { rushTap(); break; } }   // 자동은 GOOD 정도만
  if (P.ult >= 100 && (boss || foes.length > 6 || P.hp < P.maxHp * 0.35)) useUlt();
  let target = null, bd = 1e9;
  for (const e of foes) { if (e.inv || e.y > P.y - 40 || e.y < 0) continue; const d = Math.abs(e.x - P.x) + (P.y - e.y) * 0.3 - (e.isBoss ? 200 : 0); if (d < bd) { bd = d; target = e; } }
  let wantX = target ? target.x : W / 2;
  const floor = run.mode === 'auto' ? H - 380 : H - 80, wantY = boss && boss.inhale > 0 ? floor - 10 : floor - 150;
  const near = drops.find(d => d.kind !== 'xp' && Math.hypot(d.x - P.x, d.y - P.y) < 160);
  if (near && !boss) wantX = near.x;
  let best = [P.x, P.y], bs = Infinity;
  for (const [dx, dy] of AUTO_STEPS) {
    const x = clamp(P.x + dx, 30, W - 30), y = clamp(P.y + dy, 160, floor);
    let danger = 0;
    for (const b of ebul) {
      for (const tt of [0.08, 0.22, 0.4]) {
        const k = Math.min(1, tt / 0.3), px = P.x + (x - P.x) * k, py = P.y + (y - P.y) * k;
        if (Math.hypot(b.x + b.vx * tt - px, b.y + b.vy * tt - py) < st.hit + b.r + 16) danger += (b.net ? 3 : 1) * (1.2 - tt);
      }
    }
    for (const e of foes) if (!e.inv && Math.hypot(e.x - x, e.y - y) < e.r + 36) danger += 2;
    for (const l of lasers) { const ddx = x - l.x, ddy = y - l.y; if (Math.abs(-ddx * Math.sin(l.a) + ddy * Math.cos(l.a)) < l.w + 24 && ddx * Math.cos(l.a) + ddy * Math.sin(l.a) > 0) danger += 3; }
    const sc = danger * 100 + Math.abs(x - wantX) * 0.15 + Math.abs(y - wantY) * 0.08;
    if (sc < bs) { bs = sc; best = [x, y]; }
  }
  P.tx = best[0]; P.ty = best[1];
}
function awayReward(sec, where) {   // 자리를 비운 동안의 보상
  const min = Math.min(sec, 8 * 3600) / 60, rate = Math.max(S.idle.rate, 1 + S.idle.best * 0.4);
  const got = Math.floor(rate * min * 0.5), gold = Math.floor((S.forge.rate || 0) * min * 0.5);
  if (got < 1 && gold < 1) return;
  S.scrap += got; S.idle.total += got; S.forge.gold += gold; save();
  popups.push({ title: '어서 와요!', html: `<div>자리를 비운 동안 <b>${min >= 60 ? (min / 60).toFixed(1) + '시간' : Math.round(min) + '분'}</b></div><div>공방 로봇이 모은 것</div><div class="big">🔩 ${got}</div><div class="big">💰 ${Forge.fmt(gold)}</div><div class="rules">구역 ${S.idle.best}까지 간 기록을 바탕으로, 직접 켜 둘 때의 절반 속도로 계산합니다(최대 8시간).</div>` });
  if (where === 'play') { state = 'pause'; $('away').dataset.resume = '1'; }
  showPopup();
}

// ---------- 한 프레임 ----------
function update(dt) {
  if (run.mode === 'auto') {
    autoPilot(dt);
    if (Date.now() - S.idle.lastSeen > 5000) {   // 5초마다 시간과 벌이 속도를 적어 둔다
      const mins = (Date.now() - run.startedAt) / 60000;
      if (mins > 0.5) S.idle.rate = S.idle.rate ? S.idle.rate * 0.9 + (run.scrapGot / mins) * 0.1 : run.scrapGot / mins;
      if (mins > 0.5) { const gr = (S.forge.earned - run.goldStart) / mins; S.forge.rate = S.forge.rate ? S.forge.rate * 0.9 + gr * 0.1 : gr; }
      S.idle.lastSeen = Date.now(); save();
    }
  }
  run.t += dt;
  bgY += dt * 45; nearY += dt * 120;
  if (run.banner) { run.banner.t += dt; if (run.banner.t > run.banner.life) run.banner = null; }
  if (run.rushSum && (run.rushSum.t += dt) > 2.4) run.rushSum = null;
  if (run.hurtT > 0) run.hurtT -= dt;
  if (run.comboT > 0 && (run.comboT -= dt) <= 0) run.combo = 0;
  // 움직이기: 손가락이나 방향키가 가리키는 곳으로 기체 속도만큼 따라간다(그물에 걸리면 못 움직인다)
  const ks = 420 * st.speed * run.m.speed;
  if (!P.trap) {
    if (keys.ArrowLeft || keys.a) P.tx -= ks * dt;
    if (keys.ArrowRight || keys.d) P.tx += ks * dt;
    if (keys.ArrowUp || keys.w) P.ty -= ks * dt;
    if (keys.ArrowDown || keys.s) P.ty += ks * dt;
  } else { P.tx = P.x; P.ty = P.y; }
  if (boss && boss.inhale > 0 && run.phase === 'boss' && !P.trap) {   // 고래가 숨을 들이쉬면 입 앞까지 끌려간다
    const pull = 170 * dt, side = Math.sign(boss.x - P.x) * 60 * dt, stop = boss.y + 125;
    const ny = Math.max(stop, P.ty - pull), moved = P.ty - ny;
    P.ty = ny; P.tx += side;
    if (drag) { drag.oy -= moved; drag.ox += side; }
    if (Math.hypot(P.x - boss.x, P.y - boss.y) < 130) hurtPlayer(run.d.dmg);
  }
  P.tx = clamp(P.tx, 22, W - 22); P.ty = clamp(P.ty, 90, run.mode === 'auto' ? H - 370 : H - 70);
  const maxMove = 900 * st.speed * run.m.speed * dt, dx = P.tx - P.x, dy = P.ty - P.y, dl = Math.hypot(dx, dy);
  if (dl > maxMove) { P.x += dx / dl * maxMove; P.y += dy / dl * maxMove; } else { P.x = P.tx; P.y = P.ty; }
  P.bank += (clamp((P.x - P.lx) / Math.max(dt, 0.001) / 600, -1, 1) - P.bank) * Math.min(1, dt * 10);   // 옆으로 움직이면 기체가 기운다
  P.lx = P.x;
  if (P.inv > 0) P.inv -= dt;
  if (run.phase !== 'dead' && !run.gambler) P.hp = Math.min(P.maxHp, P.hp + st.regen * dt);
  P.ult = Math.min(100, P.ult + 0.5 * dt * st.ult);
  if (run.m.barrier && !P.barrierReady && (P.barrierT -= dt) <= 0) P.barrierReady = true;
  P.ga += dt * 3;
  if (net && net.mode === 'host') updateAllies(dt);
  if (P.trap) {   // 그물: 조금씩 다시 조여 오고, 7초가 지나면 저절로 풀리지만 다친다
    P.trap.t += dt; P.trap.g = Math.max(0, P.trap.g - 0.22 * dt);
    if (P.trap.t > 7) { freeTrap(false); hurtPlayer(run.d.dmg); }
  }
  // 비트 러시
  if (run.phase === 'waves' && !run.rushDone && !run.coop && run.t >= run.rushAt && !P.trap) { startDuelEvent(); return; }
  if (run.phase === 'waves' && run.gateAt && run.t >= run.gateAt) { run.gateAt = 0; spawnGates(); }
  if (run.phase === 'waves' && run.treasureAt && run.t >= run.treasureAt) {
    run.treasureAt = 0; run.treasureLast = run.t;
    if (Math.random() < 0.7) { addFoe('treasure', -70, 200, { vx: 75, by: 200 }); say('★ 황금 수송선 출현! 놓치지 마!', W / 2, H * 0.3, '#ffd166', 26, 2); A.sfx('rush'); }
  }
  if (run.gates) updateGates(dt);
  if (run.dangerT > 0) run.dangerT -= dt;
  if (run.rush) updateRush();

  const fighting = run.phase !== 'dead' && run.phase !== 'clear';
  if (run.mode === 'auto') {   // 표창 공방: 표창이 생기고, 장착한 표창이 적에게 날아간다
    Forge.tick(dt, true);
    const eq = Forge.equipped();
    run.starT = (run.starT || 0) - dt * (Forge.fever ? 3 : 1);
    if (fighting && run.starT <= 0 && eq.length && foes.length) {
      run.starIdx = ((run.starIdx || 0) + 1) % eq.length;
      run.starT = 0.9 / eq.length;
      const lv = eq[run.starIdx], a = P.ga + run.starIdx * TAU / eq.length, sx = P.x + Math.cos(a) * 50, sy = P.y + Math.sin(a) * 50;
      let best = null, bd = 1e9;
      for (const e of foes) { if (e.inv || e.dead) continue; const dd = Math.hypot(e.x - sx, e.y - sy); if (dd < bd) { bd = dd; best = e; } }
      const ang = best ? Math.atan2(best.y - sy, best.x - sx) : -Math.PI / 2;
      addShot(sx, sy, Math.cos(ang) * 640, Math.sin(ang) * 640, Forge.starDmg(lv), { star: lv, r: 10, homing: true, color: Forge.tierOf(lv), pierce: lv >= 10 ? 1 : 0 });
    }
  }
  if (fighting && !(P.down > 0)) {
    P.fireT -= dt;
    while (P.fireT <= 0) { fire(); P.fireT += 1 / (st.rate * run.m.rate * (P.trap ? 0.5 : 1) * (run.evo && st.Wp.id === 'vulcan' ? 2 : 1)); }
    if ((P.droneT -= dt) <= 0) {
      P.droneT = 0.22;
      const sp = droneSpots();
      for (const d of sp) addShot(d.x, d.y - 10, 0, -900, d.part ? 3 + 2 * st.gun : st.dmg * 0.5, { r: 3, color: '#b8f7ff' });
      if (sp.length) A.sfx('drone');
    }
    if (st.seeker && (P.seekT -= dt) <= 0) {
      P.seekT = 3.2 - 0.3 * st.seeker;
      for (const s of [-1, 1]) addShot(P.x + s * 20, P.y, s * 160, -200, 12 * (1 + 0.2 * st.seeker), { homing: true, r: 6, color: '#ffb86b' });
      A.sfx('missile');
    }
  }
  // 궁극기
  if (P.swarmQ > 0 && (P.swarmT -= dt) <= 0) {
    P.swarmT = 0.04; P.swarmQ--;
    addShot(P.x + rnd(-20, 20), P.y, rnd(-320, 320), rnd(-260, -120), 22 * ultPow(), { homing: true, r: 6, color: '#ffe066', pierce: 0 });
  }
  if (P.ultT > 0) {
    P.ultT -= dt;
    const pw = ultPow();
    if (P.ultKind === 'laser') {
      for (const e of foes.slice()) if (Math.abs(e.x - P.x) < 38 + e.r && e.y < P.y) hitFoe(e, 320 * pw * dt);
      ebul = ebul.filter(b => !(Math.abs(b.x - P.x) < 40 && b.y < P.y));
    } else if (P.ultKind === 'bulwark') {
      ebul = ebul.filter(b => { if (Math.hypot(b.x - P.x, b.y - P.y) < 70) { drops.push({ kind: 'scrap', x: b.x, y: b.y, vy: 20, v: 1, small: true }); return false; } return true; });
      for (const e of foes.slice()) if (Math.hypot(e.x - P.x, e.y - P.y) < 60 + e.r) hitFoe(e, 200 * pw * dt);
    } else if (P.ultKind === 'nova') P.novaR += dt * 1400;
    if (P.ultT <= 0) P.ultKind = null;
  }

  // 적 나오기와 보스(비트 러시 중에는 적이 덜 나온다)
  if (run.phase === 'waves') {
    if (run.mode === 'endless') {
      const w = 1 + Math.floor(run.t / 30);
      if (w !== run.wave) { run.wave = w; run.d = diffFor(1 + (w - 1) * 0.6); run.stage = Math.min(9, 1 + (w / 2 | 0)); run.banner = { kind: 'stage', title: `WAVE ${w}`, sub: '더 세게 몰려온다!', t: 0, life: 1.8 }; A.sfx('rush'); }
      if (!run.rushDone && run.t >= run.rushAt) { /* 아래에서 처리 */ }
      if (run.t >= run.nextBoss && !run.rush) { run.phase = 'warning'; run.warnT = 3; A.sfx('warning'); buzz([200, 100, 200]); }
      if (run.rushDone && run.t > run.rushAt + 80) { run.rushDone = false; run.rushAt = run.t + rnd(10, 25); }   // 리듬 결투가 가끔 다시 온다
      if (!run.gateAt && !run.gates && run.t > (run.gateLast || 0) + 100) run.gateAt = run.t + 5;
      if (!run.treasureAt && run.t > (run.treasureLast || 0) + 120) run.treasureAt = run.t + 10;
    }
    if ((run.spawnT -= dt * (run.dangerT > 0 ? 1.6 : 1)) <= 0) { spawnWave(); run.spawnT = run.d.iv * (run.mode === 'endless' ? 0.85 : 1 - 0.35 * Math.min(1, run.t / run.waveDur)) * rnd(0.8, 1.2); }
    if (run.t >= run.waveDur && !run.rush) { run.phase = 'warning'; run.warnT = 3; A.sfx('warning'); buzz([200, 100, 200]); }
  } else if (run.phase === 'warning') {
    if ((run.warnT -= dt) <= 0) { run.phase = 'boss'; spawnBoss(); }
  }
  if (boss && run.phase === 'boss') bossAI(dt);
  for (const e of foes) { if (e.type !== 'boss') foeAI(e, dt * (e.mod === 'swift' ? 1.6 : 1)); if (e.flash > 0) e.flash -= dt; }

  // 내 탄
  for (const s of shots) {
    s.t += dt;
    if (s.homing) {
      let best = null, bd = 1e9;
      for (const e of foes) { if (e.dead || e.inv || e.y < -20) continue; const d = Math.hypot(e.x - s.x, e.y - s.y); if (d < bd) { bd = d; best = e; } }
      const sp = Math.min(720, Math.hypot(s.vx, s.vy) + 900 * dt);
      let a = Math.atan2(s.vy, s.vx);
      if (best && s.t > 0.12) { let da = Math.atan2(best.y - s.y, best.x - s.x) - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; a += clamp(da, -7 * dt, 7 * dt); }
      s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
      if (!Q.low && Math.random() < 0.5) fx.push({ k: 'smoke', x: s.x, y: s.y, vx: 0, vy: 0, t: 0, life: 0.4, size: 10 });
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.y < -40 || s.y > H + 40 || s.x < -40 || s.x > W + 40 || s.t > 4) { s.dead = true; continue; }
    for (const e of foes) {
      if (e.dead || e.inv || s.hits.includes(e)) continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) > e.r + s.r) continue;
      if (e.shield) {   // 거울 방패: 탄이 되돌아온다(절반만, 느리게)
        if (Math.random() < 0.5) eShot(s.x, s.y, angTo({ x: s.x, y: s.y }), 170, { color: '#9fc8ff', r: 6 });
        A.sfx('reflect'); s.dead = true; break;
      }
      hitFoe(e, s.dmg, s.own);
      s.hits.push(e);
      if (s.boom) { for (const o of foes) if (o !== e && !o.dead && Math.hypot(o.x - s.x, o.y - s.y) < 46 + o.r) hitFoe(o, s.dmg * 0.5); explode(s.x, s.y, 14, '#ffb86b'); }
      spark(s.x, s.y, 2, s.color, 120, 0.2, 2);
      if (s.pierce-- <= 0) { s.dead = true; break; }
    }
  }
  shots = shots.filter(s => !s.dead);

  // 적 탄
  const gs = guardSpots();
  for (const b of ebul) {
    if (b.mine !== undefined) {
      b.vy *= 1 - dt * 1.2; b.mine -= dt;
      if (b.mine <= 0) { b.dead = true; ring(b.x, b.y, 10 + run.loop * 2, rnd(0, 1), 160, { color: '#ff7070' }); explode(b.x, b.y, 30, '#ff6b6b'); A.sfx('boomS'); continue; }
    }
    if (b.net) b.spin = (b.spin || 0) + dt * 4;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y > H + 20 || b.y < -40 || b.x < -20 || b.x > W + 20) { b.dead = true; continue; }
    for (const g of gs) if (!b.net && Math.hypot(g.x - b.x, g.y - b.y) < 14 + b.r) { b.dead = true; spark(b.x, b.y, 4, '#9ff3ff', 120, 0.25, 2); }
    if (!b.dead && run.phase !== 'dead' && Math.hypot(P.x - b.x, P.y - b.y) < st.hit + b.r) {
      b.dead = true;
      if (b.net) {
        if (P.ultKind === 'bulwark' || P.inv > 0 || P.trap) continue;
        if (run.m.barrier && P.barrierReady) { P.barrierReady = false; P.barrierT = 16; A.sfx('barrier'); ringFx(P.x, P.y, 40, '#7fd8ff'); continue; }
        catchInNet();
      } else hurtPlayer(run.d.dmg);
    }
  }
  ebul = ebul.filter(b => !b.dead);

  // 광선
  for (const l of lasers) {
    if (l.warn > 0) { l.x = l.src.x; l.y = l.src.y; if ((l.warn -= dt) <= 0) { A.sfx('beam'); shake = Math.max(shake, 0.4); } continue; }
    l.dur -= dt;
    const ddx = P.x - l.x, ddy = P.y - l.y, along = ddx * Math.cos(l.a) + ddy * Math.sin(l.a), perp = Math.abs(-ddx * Math.sin(l.a) + ddy * Math.cos(l.a));
    if (!l.hit && along > 0 && perp < l.w / 2 + st.hit) { l.hit = true; hurtPlayer(run.d.dmg * 1.6); }
  }
  lasers = lasers.filter(l => l.warn > 0 || l.dur > 0);

  // 몸으로 부딪히기
  if (run.phase !== 'dead') for (const e of foes) {
    if (e.dead || e.inv) continue;
    if (Math.hypot(e.x - P.x, e.y - P.y) < e.r * 0.8 + st.hit) {
      hurtPlayer(run.d.dmg + 8);
      if (!e.isBoss) hitFoe(e, 30);
    }
  }
  foes = foes.filter(e => !e.dead && !e.gone);

  // 줍기
  const mag = st.magnet * run.m.magnet;
  for (const d of drops) {
    if (d.dead) continue;
    const dd = Math.hypot(P.x - d.x, P.y - d.y);
    if (run.phase !== 'dead' && !(P.down > 0) && (dd < mag || run.phase === 'clear')) { const v = 700 * dt / Math.max(dd, 1); d.x += (P.x - d.x) * Math.min(1, v); d.y += (P.y - d.y) * Math.min(1, v); }
    else d.y += d.vy * dt;
    if (d.y > H + 30) { d.dead = true; continue; }
    if (run.phase !== 'dead' && !(P.down > 0) && dd < 26) {
      d.dead = true;
      if (d.kind === 'xp') { run.xp += d.v * (1 + 0.06 * rs('learn')); A.sfx('xp'); }
      else if (d.kind === 'scrap') { gainScrap(d.v); A.sfx('scrap'); }
      else if (d.kind === 'heart') { if (!run.gambler) P.hp = Math.min(P.maxHp, P.hp + d.v); A.sfx('heal'); say('+' + d.v, P.x, P.y - 40, '#6ee37a', 22); }
      else if (d.kind === 'part') grantPart();
    }
  }
  drops = drops.filter(d => !d.dead);

  tickFx(dt);
  if (run.phase === 'clear') {
    if (run.chain > 0 && Math.random() < dt * 8) { run.chain--; explode(boss.x + rnd(-90, 90), boss.y + rnd(-60, 60), rnd(40, 70), pick(['#ffd166', '#ff8a5e', '#fff'])); A.sfx('boomS'); }
    if ((run.endT -= dt) <= 0) afterBoss();
  } else if (run.phase === 'dead') {
    if ((run.endT -= dt) <= 0) { if (run.mode === 'auto') respawn(); else endRun(false); }
  } else if (run.xp >= run.xpNeed && !run.rush && !P.trap) {   // 박자·그물 중에는 레벨 업 창을 미룬다
    run.xp -= run.xpNeed; run.level++; run.xpNeed = Math.round(run.xpNeed * 1.38 + 2);
    openCards();
  }
}

function clearField() { foes = []; ebul = []; lasers = []; boss = null; }
function afterBoss() {
  const m = run.mode;
  if (m === 'stage') { endRun(true); return; }
  if (m === 'rush') {
    run.bossIdx++;
    if (run.bossIdx >= 5) { endRun(true); return; }
    clearField(); run.phase = 'warning'; run.warnT = 2; run.theme = run.bossIdx % 4;
    run.banner = { kind: 'boss', title: `BOSS ${run.bossIdx + 1} / 5`, sub: '다음 보스가 온다!', t: 0, life: 1.8 };
    return;
  }
  if (m === 'endless') {
    clearField(); run.phase = 'waves'; run.bossCount++; run.nextBoss = run.t + 90; A.music('stage', run.theme);
    return;
  }
  // 자동 출격: 다음 구역으로
  run.zone0 = run.stage + 1; nextZone(run.stage + 1, `ZONE ${run.stage + 1}`, '다음 구역');
}
function nextZone(z, title, sub) {
  clearField();
  run.stage = z; S.idle.zone = z; S.idle.best = Math.max(S.idle.best, z);
  run.d = diffFor(z); if (run.mode === 'auto') run.d.hp = Math.pow(1.22, z - 1); run.theme = (z - 1) % 4; run.loop = (z - 1) / 5 | 0;
  run.t = 0; run.phase = 'waves'; run.rushDone = run.mode === 'auto'; run.rushAt = rnd(15, 30);
  run.banner = { kind: 'stage', title, sub, t: 0, life: 2.2 };
  A.music('stage', run.theme); save();
}
function respawn() {   // 자동 출격에서 지면: 한 구역 뒤로 물러나 다시 싸운다(잃는 것 없음)
  const z = Math.max(1, run.stage - 1);
  P.hp = P.maxHp; P.inv = 3; P.trap = null; P.x = P.tx = W / 2; P.y = P.ty = H - 190;
  nextZone(z, `ZONE ${z}`, '한 구역 물러나서 다시!');
}
function tickFx(dt) {
  for (const p of fx) {
    p.t += dt;
    if (p.k === 'ring' || p.k === 'muzzle' || p.k === 'beam') continue;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const dr = p.k === 'debris' ? 1.5 : 2;
    p.vx *= 1 - dt * dr; p.vy *= 1 - dt * dr;
    if (p.rot !== undefined) p.rot += p.vr * dt;
  }
  fx = fx.filter(p => p.t < p.life);
  for (const t of texts) t.t += dt;
  texts = texts.filter(t => t.t < t.life);
  shake = Math.max(0, shake - dt * 2.5);
  flash = Math.max(0, flash - dt * 2.5);
}

const fmt = sec => { sec = Math.round(sec); return sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`; };
function endOther(win) {   // 무한 생존·보스 러시·자동 출격의 결과
  keepAwake(false);
  const m = run.mode;
  S.stats.bestCombo = Math.max(S.stats.bestCombo, run.maxCombo);
  let title = '', rec = '', good = win;
  if (m === 'endless') {
    const nb = run.wave > S.records.wave;
    S.records.wave = Math.max(S.records.wave, run.wave); S.records.endlessScore = Math.max(S.records.endlessScore, run.score);
    title = `<small>무한 생존</small>WAVE ${run.wave}`; rec = `버틴 시간 ${fmt(run.t)}${nb ? ' · 최고 기록!' : ` · 최고 WAVE ${S.records.wave}`}`; good = nb;
  } else if (m === 'rush') {
    const beaten = win ? 5 : run.bossIdx;
    S.records.rush = Math.max(S.records.rush, beaten);
    if (win && (!S.records.rushTime || run.t < S.records.rushTime)) S.records.rushTime = run.t;
    title = win ? '<small>보스 러시</small>완주!' : `<small>보스 러시</small>${beaten} / 5`;
    rec = win ? `걸린 시간 ${fmt(run.t)} · 최단 ${fmt(S.records.rushTime)}` : '보스를 더 잡으려면 기체를 강화해 보세요';
  } else {
    S.idle.on = false; good = true;
    title = `<small>표창 공방</small>ZONE ${run.stage}`;
    rec = `켜 둔 시간 ${fmt((Date.now() - run.startedAt) / 1000)} · 번 금화 💰${Forge.fmt(S.forge.earned - run.goldStart)} · 최고 구역 ${S.idle.best} · 최고 표창 Lv ${S.forge.maxLv}`;
  }
  dcount('combo', run.maxCombo, true);
  const pxp = Math.round(run.score / 60 + run.kills * (m === 'auto' ? 0.3 : 1) + (win ? 60 : 0)), up = gainPilotXp(pxp);
  save();
  A.sfx(good ? 'clear' : 'fail'); A.music('hangar', 0);
  $('rTitle').innerHTML = title; $('rTitle').className = good ? 'win' : 'lose';
  $('rStars').innerHTML = '';
  $('rStats').innerHTML = [
    `<div class="big">${run.score.toLocaleString()}<small>점</small></div>`, `<div>${rec}</div>`,
    `<div>처치 <b>${run.kills}</b> · 최고 콤보 <b>${run.maxCombo}</b> · 레벨 <b>${run.level}</b></div>`,
    `<div>얻은 고철 🔩 <b>${run.scrapGot}</b></div>`,
    run.partsGot.length ? `<div class="gold">새 부품: ${run.partsGot.join(', ')}</div>` : '',
    `<div>조종사 경험치 +${pxp} · Lv ${S.pilot.lv} ${rankName(S.pilot.lv)}${up.ups ? ` <b class="gold">승급! 🔩+${up.reward}</b>` : ''}</div>`,
  ].filter(Boolean).join('');
  const btns = $('rBtns'); btns.innerHTML = '';
  const mk = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', () => { A.sfx('click'); fn(); }); btns.append(b); };
  mk(m === 'auto' ? '다시 켜 두기 ▶' : '다시 하기 ▶', 'big', () => startRun(1, m));
  mk('격납고', 'sub', showHangar);
  if (m === 'endless') Rank.after('endless', run.score, `WAVE ${run.wave} · ${fmt(run.t)}`, !run.coop);
  if (m === 'rush') Rank.after('rush', run.score, run.bossIdx >= 5 || win ? `완주 · ${fmt(run.t)}` : `보스 ${run.bossIdx}/5`, !run.coop);
  $('copy').dataset.text = `⚡ 볼트윙 ${MODES.find(x => x.id === m).name} ${title.replace(/<[^>]+>/g, ' ').trim()} · 점수 ${run.score.toLocaleString()}`;
  $('result').classList.remove('hidden');
}
let wakeLock = null;
async function keepAwake(on) {   // 자동 출격 중에는 화면이 꺼지지 않게(되는 기기에서만)
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* 안 되는 기기 */ }
}
function endRun(win) {
  state = 'result';
  Forge.show(false);
  netEndOnce(win);
  $('hud').classList.add('hidden');
  if (run.mode !== 'stage') { endOther(win); return; }
  const before = S.cleared, hpOk = P.hp >= P.maxHp * 0.5;
  S.stats.bestCombo = Math.max(S.stats.bestCombo, run.maxCombo);
  const old = S.stars[run.stage] || [false, false, false];
  const now = [old[0] || win, old[1] || (win && hpOk && !run.assist), old[2] || (run.maxCombo >= 30 && !run.assist)];
  S.fails = S.fails || {};
  S.fails[run.stage] = win ? 0 : (S.fails[run.stage] || 0) + 1;
  const newStars = now.filter((v, i) => v && !old[i]).length;
  if (now.some(Boolean)) S.stars[run.stage] = now;
  S.scrap += newStars * STAR_REWARD;
  if (win) { S.cleared = Math.max(S.cleared, run.stage); S.maxStage = Math.max(S.maxStage, run.stage + 1); S.next = run.stage + 1; }
  const newBest = run.score > S.best;
  S.best = Math.max(S.best, run.score);
  dcount('combo', run.maxCombo, true);
  const pxp = Math.round(run.score / 60 + run.kills + (win ? 40 : 0)), up = gainPilotXp(pxp);
  save();
  hangarStage = win ? run.stage + 1 : run.stage;
  A.sfx(win ? 'clear' : 'fail');
  A.music('hangar', 0);
  const opened = [...D.FRAMES, ...D.WEAPONS].filter(o => o.unlock && o.unlock > before && o.unlock <= S.cleared).map(o => o.name);
  $('rTitle').innerHTML = win ? `<small>STAGE ${run.stage}</small>클리어!` : `<small>STAGE ${run.stage}</small>격추당했다`;
  $('rTitle').className = win ? 'win' : 'lose';
  $('rStars').innerHTML = now.map((v, i) => `<span class="${v ? 'on' : ''} ${v && !old[i] ? 'new' : ''}" title="${STAR_RULES[i]}">★</span>`).join('');
  $('rStats').innerHTML = [
    `<div class="big">${run.score.toLocaleString()}<small>점${newBest ? ' · 최고 기록!' : ''}</small></div>`,
    run.bossRank ? `<div>보스 랭크 <b class="gold">${run.bossRank}</b> · ${run.bossTime.toFixed(1)}초 · 맞은 횟수 ${run.hits - run.hitsAtBoss}${S.ranks && S.ranks[run.stage] ? ` · 최고 ${S.ranks[run.stage]}` : ''}</div>` : '',
    run.assist ? '<div>🛟 지원 출격으로 깼습니다(별 2·3과 S·A 랭크는 지원 없이 도전)</div>' : '',
    `<div>처치 <b>${run.kills}</b> · 최고 콤보 <b>${run.maxCombo}</b> · 레벨 <b>${run.level}</b></div>`,
    `<div>얻은 고철 🔩 <b>${run.scrapGot}</b>${newStars ? ` + 새 별 보상 🔩 <b>${newStars * STAR_REWARD}</b>` : ''}</div>`,
    run.partsGot.length ? `<div class="gold">새 부품: ${run.partsGot.join(', ')}</div>` : '',
    opened.length ? `<div class="gold">🔓 새로 열림: ${opened.join(', ')}</div>` : '',
    `<div>조종사 경험치 +${pxp} · Lv ${S.pilot.lv} ${rankName(S.pilot.lv)}${up.ups ? ` <b class="gold">승급! 🔩+${up.reward}</b>` : ''}</div>`,
    `<div class="rules">${STAR_RULES.map((r, i) => `${now[i] ? '★' : '☆'} ${r}`).join('<br>')}</div>`,
    win ? `<div>다음: 스테이지 ${run.stage + 1} · ${D.BOSSES[run.stage % 5].name}</div>` : '<div>격납고에서 부품과 무기를 강화하고 다시 도전해 보세요.</div>',
  ].filter(Boolean).join('');
  const btns = $('rBtns');
  btns.innerHTML = '';
  const mk = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', () => { A.sfx('click'); fn(); }); btns.append(b); };
  const stg = run.stage;
  if (win) mk('다음 스테이지 ▶', 'big', () => startRun(stg + 1));
  else mk('다시 도전', 'big', () => startRun(stg));
  mk('격납고', 'sub', showHangar);
  Rank.after('stage', run.score, `STAGE ${run.stage}${win ? ' 클리어' : ''} · ${st.F.name}`, !run.coop && !run.assist);
  $('copy').dataset.text = `⚡ 볼트윙 스테이지 ${run.stage} ${win ? '클리어' : '도전'} ${now.map(v => (v ? '★' : '☆')).join('')} 점수 ${run.score.toLocaleString()} · 콤보 ${run.maxCombo} · ${st.F.name}+${st.Wp.name}`;
  $('result').classList.remove('hidden');
}

// ---------- 그리기: 배경(먼 층은 눕힌 캔버스에, 가까운 층은 위 캔버스에) ----------
function drawBg(theme) {
  const TH = Art.TH, f = Art.far(theme), n = Art.near(theme);
  const y1 = (bgY % TH + TH) % TH, y2 = (nearY % TH + TH) % TH;
  if (skyTheme !== theme) { skyTheme = theme; $('stage').style.background = SKIES[theme]; }   // 땅 끝 너머로 보이는 하늘
  const cx0 = (BGW - W) / 2;
  for (const yy of [y1 - TH, y1]) {
    bctx.drawImage(f, cx0, yy);
    // 양옆은 거울처럼 뒤집어 이어 붙인다(이음매가 보이지 않게)
    bctx.save(); bctx.translate(cx0, 0); bctx.scale(-1, 1); bctx.drawImage(f, 0, yy); bctx.restore();
    bctx.save(); bctx.translate(cx0 + W * 2, 0); bctx.scale(-1, 1); bctx.drawImage(f, 0, yy); bctx.restore();
  }
  // 멀수록 옅은 안개(공기 원근)
  const fog = bctx.createLinearGradient(0, 0, 0, BGH * 0.5);
  fog.addColorStop(0, ['rgba(170,215,255,.55)', 'rgba(255,170,130,.5)', 'rgba(20,40,80,.6)', 'rgba(30,10,60,.5)'][theme]); fog.addColorStop(1, 'rgba(0,0,0,0)');
  bctx.fillStyle = fog; bctx.fillRect(0, 0, BGW, BGH);
  ctx.drawImage(n, 0, y2 - TH); ctx.drawImage(n, 0, y2);
  const g = ctx.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, 'rgba(3,6,14,.5)'); g.addColorStop(1, 'rgba(3,6,14,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 150);
}
const hasGround = () => run && run.theme !== 3;   // 우주에는 그림자가 없다

function drawShipAt(g, id, x, y, s, bank, t, withShadow) {
  const F = frameOf(id), im = IMG['ship-' + id], spr = im || Art.ship(id, F.color), size = Art.SHIP / Art.SS;
  const sx = 1 - Math.abs(bank) * 0.22;
  if (withShadow) {
    g.save(); g.translate(x + 26, y + 40); g.scale(s * sx * 0.85, s * 0.85); g.rotate(bank * 0.08);
    g.globalAlpha = 0.9; g.drawImage(im ? im : Art.shipShadow(id, F.color), -size / 2, -size / 2, size, size); g.restore();
  }
  g.save(); g.translate(x, y); g.scale(s, s);
  g.globalCompositeOperation = 'lighter';
  const fl = 1 + Math.sin(t * 40) * 0.15;
  for (const ex of (id === 'turtle' ? [-27, 27] : id === 'hornet' ? [0] : [-6, 6])) {
    g.drawImage(Art.glow(F.color, 24), ex - 8, 18, 16, 34 * fl);
    g.drawImage(Art.glow('#fff6c0', 10), ex - 5, 20, 10, 16 * fl);
  }
  g.globalCompositeOperation = 'source-over';
  g.save(); g.scale(sx, 1); g.rotate(bank * 0.08);
  g.drawImage(spr, -size / 2, -size / 2, size, size);
  // 기울어진 쪽 날개에 빛이 비친다(입체감)
  if (Math.abs(bank) > 0.05) {
    g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(-size / 2, 0, size / 2, 0);
    lg.addColorStop(bank > 0 ? 0 : 1, `rgba(255,255,255,${Math.abs(bank) * 0.25})`); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(bank > 0 ? 1 : 0, `rgba(0,0,0,${Math.abs(bank) * 0.3})`);
    g.fillStyle = lg; g.fillRect(-size / 2, -size / 2, size, size);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  const tips = { falcon: 31, turtle: 30, phoenix: 34 }[id];
  if (tips && Math.floor(t * 2.5) % 2 === 0) {
    g.globalCompositeOperation = 'lighter';
    g.drawImage(Art.glow('#ff4d4d', 8), -tips * sx - 8, 6, 16, 16);
    g.drawImage(Art.glow('#4dff88', 8), tips * sx - 8, 6, 16, 16);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

function drawFoe(e) {
  const size = Art.EN / Art.ES, rot = e.type === 'weaver' ? e.t * 3 : e.type === 'netter' ? e.t * 0.8 : e.type === 'diver' && e.mode === 'go' ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : 0;
  if (hasGround()) { ctx.save(); ctx.translate(e.x + 16, e.y + 26); ctx.scale(0.85, 0.85); ctx.rotate(rot); ctx.drawImage(Art.enemyShadow(e.type), -size / 2, -size / 2, size, size); ctx.restore(); }
  if (e.mod) {   // 정예 표시
    const c = { shield: '#7fd8ff', swift: '#ffe066', volatile: '#ff9a3c' }[e.mod];
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow(c, 40), e.x - e.r * 1.8, e.y - e.r * 1.8, e.r * 3.6, e.r * 3.6); ctx.globalCompositeOperation = 'source-over';
    if (e.sh > 0) { ctx.strokeStyle = 'rgba(127,216,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, TAU * e.sh / (e.maxHp * 0.7)); ctx.stroke(); }
  }
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(rot);
  if (e.type === 'treasure') ctx.scale(1.6, 1.6);
  ctx.drawImage(Art.enemy(e.type, e.flash > 0), -size / 2, -size / 2, size, size);
  ctx.restore();
  if (e.type === 'turret') {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(angTo(e) - Math.PI / 2);
    ctx.fillStyle = Art.metal(ctx, -5, 0, 5, 0, [[0, '#9aa6b4'], [1, '#2b3440']]); ctx.fillRect(-5, 4, 10, 24); ctx.strokeStyle = '#11161c'; ctx.lineWidth = 1.5; ctx.strokeRect(-5, 4, 10, 24);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ffb347', 12), -12, -12, 24, 24); ctx.restore();
  }
  if (e.type === 'diver' && e.mode === 'wait') { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ff5050', 22), e.x - 22, e.y - 22, 44, 44); ctx.globalCompositeOperation = 'source-over'; }
  if (e.elite && e.hp < e.maxHp) { const w = 46; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5); ctx.fillStyle = '#ff8a5e'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * e.hp / e.maxHp, 5); }
}

function drawBoss() {
  if (!boss) return;
  const b = boss, id = b.def.id, im = IMG['boss-' + id];
  const glowAt = (x, y, c, r) => { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow(c, r), x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over'; };
  for (const p of b.parts) {
    if (p.dead) continue;
    if (hasGround()) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(p.x + 34, p.y + 60, p.r * 1.1, p.r * 0.8, 0, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.translate(p.x, p.y);
    if (im) { const w = p.r * 2.8; ctx.drawImage(im, -w / 2, -w / 2, w, w); if (p.flash > 0) glowAt(0, 0, '#ffffff', p.r); ctx.restore(); continue; }
    ctx.lineWidth = 3; ctx.strokeStyle = '#0b0f18'; ctx.lineJoin = 'round';
    const grad = (a, c) => { const g = ctx.createRadialGradient(-p.r * 0.3, -p.r * 0.4, 4, 0, 0, p.r * 1.1); g.addColorStop(0, a); g.addColorStop(0.55, c); g.addColorStop(1, '#0a0d14'); return g; };
    if (id === 'spider') {
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1, k = i % 4, wig = Math.sin(b.t * 6 + i) * 0.15;
        const kx = side * (60 + k * 8), ky = -30 + k * 25, fx2 = kx + side * 30, fy = ky + 40 + wig * 30;
        for (const [lw, c] of [[9, '#0b0f18'], [6, '#59606c'], [2, '#a8b0bd']]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(kx, ky - 30 + wig * 40); ctx.lineTo(fx2, fy); ctx.stroke(); }
        ctx.fillStyle = '#ff5d5d'; ctx.beginPath(); ctx.arc(fx2, fy, 3, 0, TAU); ctx.fill();
      }
      ctx.lineWidth = 3; ctx.strokeStyle = '#0b0f18';
      ctx.beginPath(); ctx.arc(0, 0, 56, 0, TAU); ctx.fillStyle = grad('#d3dae5', '#4a5260'); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(10,14,20,.5)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(0, 0, 56, i * TAU / 6, i * TAU / 6 + 0.6); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, TAU); ctx.stroke();
      for (const [ex, ey, er] of [[-16, 10, 8], [16, 10, 8], [-6, 26, 5], [6, 26, 5]]) glowAt(ex, ey, b.p2 ? '#ff2020' : '#ff6060', er * 2.4);
    } else if (id === 'whale') {
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 82, -12, 42, 17, sx * 0.4, 0, TAU); ctx.fillStyle = grad('#9fd2ff', '#2d6aa6'); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-30, -90); ctx.quadraticCurveTo(0, -130, 30, -90); ctx.fillStyle = '#2d6aa6'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 70, 95, 0, 0, TAU); ctx.fillStyle = grad('#c8ecff', '#2a5f94'); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e4f5ff'; ctx.beginPath(); ctx.ellipse(0, 42, 46, 42, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(60,110,160,.45)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-38 + i * 15, 14); ctx.lineTo(-30 + i * 12, 78); ctx.stroke(); }
      for (const sx of [-1, 1]) { ctx.fillStyle = '#0b1424'; ctx.beginPath(); ctx.arc(sx * 32, 10, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * 32 - 2, 7, 2.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = b.inhale > 0 ? '#050b14' : '#1b3550';
      ctx.beginPath(); ctx.ellipse(0, 72, b.inhale > 0 ? 36 : 22, b.inhale > 0 ? 20 : 6, 0, 0, TAU); ctx.fill();
      if (b.inhale > 0) glowAt(0, 72, '#9fe0ff', 40);
    } else if (id === 'twins') {
      const red = p.dx < 0, enr = b.enraged;
      ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fillStyle = grad(red ? '#ffc7c0' : '#e3ccff', red ? '#a02a36' : '#5c2b9a'); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + b.t; ctx.fillStyle = '#d6dde6'; ctx.beginPath(); ctx.arc(Math.cos(a) * 47, Math.sin(a) * 47, 2.5, 0, TAU); ctx.fill(); }
      ctx.save(); ctx.rotate(angTo(p) - Math.PI / 2); ctx.fillStyle = Art.metal(ctx, -9, 0, 9, 0, [[0, '#8a949f'], [1, '#1b2028']]); ctx.fillRect(-9, 18, 18, 48); ctx.strokeStyle = '#0b0f18'; ctx.strokeRect(-9, 18, 18, 48); ctx.restore();
      glowAt(0, 0, enr ? '#ffef5a' : (red ? '#ff8080' : '#c58bff'), enr ? 34 : 24);
    } else if (id === 'knight') {
      ctx.save(); ctx.rotate(0.25 + Math.sin(b.t * 3) * 0.1);
      ctx.fillStyle = Art.metal(ctx, 48, 0, 58, 0, [[0, '#ffffff'], [1, '#8fa3bd']]); ctx.fillRect(48, -66, 10, 116); ctx.strokeRect(48, -66, 10, 116);
      ctx.fillStyle = '#c9a04a'; ctx.fillRect(38, 44, 30, 8); ctx.strokeRect(38, 44, 30, 8);
      ctx.restore();
      ctx.fillStyle = grad('#f2f6fb', '#56647a');
      ctx.beginPath(); ctx.moveTo(-60, -10); ctx.lineTo(-32, -38); ctx.lineTo(32, -38); ctx.lineTo(60, -10); ctx.lineTo(38, 42); ctx.lineTo(-38, 42); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(20,28,40,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, 42); ctx.moveTo(-50, -6); ctx.lineTo(50, -6); ctx.stroke();
      ctx.strokeStyle = '#c9a04a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-60, -10); ctx.lineTo(-32, -38); ctx.lineTo(32, -38); ctx.lineTo(60, -10); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#0b0f18';
      ctx.beginPath(); ctx.arc(0, -18, 22, Math.PI, 0); ctx.lineTo(22, 6); ctx.lineTo(-22, 6); ctx.closePath(); ctx.fillStyle = grad('#c7d3e3', '#5c6c84'); ctx.fill(); ctx.stroke();
      glowAt(0, -10, '#00e5ff', 20); ctx.fillStyle = '#bff8ff'; ctx.fillRect(-14, -12, 28, 4);
      if (b.mirror > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(120,200,255,${0.6 + Math.sin(T * 20) * 0.3})`; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(0, 0, 78, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.fillStyle = 'rgba(120,200,255,.16)'; ctx.beginPath(); ctx.arc(0, 0, 78, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      for (let k = 0; k < 4; k++) {
        ctx.save(); ctx.rotate(b.spin + k * TAU / 4);
        ctx.fillStyle = Art.metal(ctx, 0, -12, 0, 12, [[0, '#7d8ea6'], [1, '#1c2633']]); ctx.fillRect(40, -13, 52, 26); ctx.strokeRect(40, -13, 52, 26);
        ctx.fillStyle = '#0e141c'; ctx.fillRect(84, -7, 10, 14);
        glowAt(90, 0, '#7cf0c0', 12);
        ctx.restore();
      }
      for (const [rr, a, c] of [[74, '#55677f', '#1d2633'], [54, '#8ea0b8', '#2b3747'], [34, '#1c2633', '#0b0f18']]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fillStyle = grad(a, c); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(124,240,192,.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -T * 40; ctx.beginPath(); ctx.arc(0, 0, 64, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      glowAt(0, 0, b.p2 ? '#ff6b6b' : '#7cf0c0', 34 + Math.sin(T * 6) * 6);
    }
    if (p.flash > 0) glowAt(0, 0, '#ffffff', p.r);
    ctx.restore();
  }
  if (b.def.id === 'twins' && b.parts.every(p => !p.dead)) {
    ctx.strokeStyle = 'rgba(200,200,220,.5)'; ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -T * 30;
    ctx.beginPath(); ctx.moveTo(b.parts[0].x, b.parts[0].y); ctx.lineTo(b.parts[1].x, b.parts[1].y); ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawShots() {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const s of shots) {
    if (s.star) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.t * 16); ctx.drawImage(Forge.sprite(s.star), -15, -15, 30, 30); ctx.restore(); continue; }
    const len = s.long ? 30 : s.homing ? 10 : 16, sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
    ctx.strokeStyle = s.color; ctx.lineWidth = s.r * 1.8;
    ctx.beginPath(); ctx.moveTo(s.x - ux * len, s.y - uy * len); ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s.r * 0.6;
    ctx.beginPath(); ctx.moveTo(s.x - ux * len * 0.6, s.y - uy * len * 0.6); ctx.lineTo(s.x, s.y); ctx.stroke();
    if (!Q.low) ctx.drawImage(Art.glow(s.color, 12), s.x - 9, s.y - 9, 18, 18);
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawNet(x, y, r, spin, alpha) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#7ff0dc'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
  for (const k of [0.35, 0.65, 1]) { ctx.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU; ctx.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } ctx.stroke(); }
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#7ff0dc', 30), -r, -r, r * 2, r * 2);
  ctx.restore();
}
function drawEbul() {
  ctx.globalCompositeOperation = 'lighter';
  for (const b of ebul) {
    if (b.mine !== undefined || b.net) continue;
    const r = b.r * 2.6;
    ctx.drawImage(Art.glow(b.color, 24), b.x - r, b.y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const b of ebul) {
    if (b.net) { drawNet(b.x, b.y, b.r * 1.4, b.spin || 0, 0.9); continue; }
    if (b.mine !== undefined) {
      const k = 0.5 + 0.5 * Math.sin(T * (b.mine < 0.6 ? 30 : 10));
      ctx.fillStyle = '#3a0a0a'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ff3030', 20), b.x - 14 * k - 4, b.y - 14 * k - 4, 28 * k + 8, 28 * k + 8); ctx.globalCompositeOperation = 'source-over';
      continue;
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
  }
}
function drawLasers() {
  for (const l of lasers) {
    const ex = l.x + Math.cos(l.a) * 1400, ey = l.y + Math.sin(l.a) * 1400;
    if (l.warn > 0) {
      ctx.strokeStyle = `rgba(255,70,70,${0.4 + Math.sin(T * 30) * 0.3})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      for (const [w, c] of [[l.w * 2.4, 'rgba(255,60,60,.25)'], [l.w * 1.3, 'rgba(255,90,90,.6)'], [l.w * 0.4, '#fff']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
function drawDrops() {
  for (const d of drops) {
    if (d.kind === 'xp') {
      const r = 5 + Math.min(5, d.v);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#4dff9e', 16), d.x - r * 1.6, d.y - r * 1.6, r * 3.2, r * 3.2); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#b9ffd8'; ctx.beginPath(); ctx.moveTo(d.x, d.y - r); ctx.lineTo(d.x + r * 0.65, d.y); ctx.lineTo(d.x, d.y + r); ctx.lineTo(d.x - r * 0.65, d.y); ctx.fill();
    } else if (d.kind === 'scrap') {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(T * 4 + d.x);
      const s = d.small ? 3 : 4 + Math.min(4, d.v);
      ctx.fillStyle = Art.metal(ctx, -s, 0, s, 0, [[0, '#fff1b8'], [0.5, '#ffd166'], [1, '#8a6a1c']]);
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a4210'; ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, TAU); ctx.fill(); ctx.restore();
    } else if (d.kind === 'heart') { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💗', d.x, d.y + 8); }
    else {
      const k = 1 + Math.sin(T * 6) * 0.08;
      ctx.save(); ctx.translate(d.x, d.y); ctx.scale(k, k);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#ffd166', 40), -40, -40, 80, 80); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = Art.metal(ctx, 0, -12, 0, 12, [[0, '#e3a75a'], [1, '#7a4a18']]); ctx.fillRect(-15, -13, 30, 26);
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.strokeRect(-15, -13, 30, 26); ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.stroke();
      ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚙️', 0, 6); ctx.restore();
    }
  }
}
function drawPlayer() {
  drawAllies();
  if (run.phase === 'dead' || P.down > 0) return;
  const blink = P.inv > 0 && P.ultKind !== 'bulwark' && !P.trap && Math.floor(T * 20) % 2;
  for (const g of guardSpots()) {
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#9ff3ff', 16), g.x - 16, g.y - 16, 32, 32); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#d8fbff'; ctx.beginPath(); ctx.arc(g.x, g.y, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a6b80'; ctx.lineWidth = 2; ctx.stroke();
  }
  for (const d of droneSpots()) {
    ctx.fillStyle = Art.metal(ctx, d.x - 8, 0, d.x + 8, 0, [[0, '#f0fdff'], [1, d.part ? '#3a8fb0' : '#7a5ab8']]); ctx.strokeStyle = '#0b1424'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(d.x, d.y - 11); ctx.lineTo(d.x + 9, d.y + 6); ctx.lineTo(d.x, d.y + 2); ctx.lineTo(d.x - 9, d.y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Art.glow('#9ff3ff', 8), d.x - 6, d.y + 2, 12, 14); ctx.globalCompositeOperation = 'source-over';
  }
  if (P.ultKind === 'laser') {
    ctx.globalCompositeOperation = 'lighter';
    const w = 74 + Math.sin(T * 50) * 6, g = ctx.createLinearGradient(P.x - w / 2, 0, P.x + w / 2, 0);
    g.addColorStop(0, 'rgba(76,201,255,0)'); g.addColorStop(0.3, 'rgba(76,201,255,.7)'); g.addColorStop(0.5, '#fff'); g.addColorStop(0.7, 'rgba(76,201,255,.7)'); g.addColorStop(1, 'rgba(76,201,255,0)');
    ctx.fillStyle = g; ctx.fillRect(P.x - w / 2, 0, w, P.y - 20);
    ctx.drawImage(Art.glow('#4cc9ff', 60), P.x - 60, P.y - 90, 120, 120);
    ctx.globalCompositeOperation = 'source-over';
  }
  const shakeX = P.trap ? Math.sin(T * 60) * 2 : 0;   // 그물 안에서 버둥거림
  if (!blink) drawShipAt(ctx, st.F.id, P.x + shakeX, P.y, 1, P.trap ? Math.sin(T * 25) * 0.4 : P.bank, T, hasGround());
  if (run.mode === 'auto') {   // 장착한 표창이 둘레를 돈다
    const eq = Forge.equipped();
    eq.forEach((lv, i) => { const a = P.ga + i * TAU / eq.length; ctx.save(); ctx.translate(P.x + Math.cos(a) * 50, P.y + Math.sin(a) * 50); ctx.rotate(T * 8); ctx.drawImage(Forge.sprite(lv), -11, -11, 22, 22); ctx.restore(); });
  }
  if (P.trap) drawNet(P.x, P.y, 46 - P.trap.g * 16, T * 0.5, 0.95 - P.trap.g * 0.4);
  if (P.ultKind === 'bulwark') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(123,220,107,${0.6 + Math.sin(T * 12) * 0.3})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(P.x, P.y, 62, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(123,220,107,.12)'; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (P.ultKind === 'nova') { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,140,60,.8)'; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(P.x, P.y, P.novaR, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
  if (run.m.barrier && P.barrierReady) { ctx.strokeStyle = 'rgba(127,216,255,.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -T * 20; ctx.beginPath(); ctx.arc(P.x, P.y, 36, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P.x, P.y, st.hit * 0.8, 0, TAU); ctx.fill();   // 맞는 자리(가운데 흰 점)
  ctx.strokeStyle = 'rgba(255,80,80,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
}
function drawFx() {
  const fr = Art.fire(), sm = Art.smoke();
  for (const p of fx) {
    const k = 1 - p.t / p.life;
    if (p.k === 'smoke') { const s = p.size * (1.6 - k * 0.6); ctx.globalAlpha = k * 0.8; ctx.drawImage(sm, p.x - s, p.y - s, s * 2, s * 2); }
    else if (p.k === 'debris') { ctx.globalAlpha = k; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#2a2f38'; ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (const p of fx) {
    const k = 1 - p.t / p.life;
    if (p.k === 'fire') { const s = p.size * (0.6 + (1 - k) * 0.7); ctx.globalAlpha = k; ctx.drawImage(fr, p.x - s, p.y - s, s * 2, s * 2); }
    else if (p.k === 'ring') { ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.lineWidth = 5 * k; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - k), 0, TAU); ctx.stroke(); }
    else if (p.k === 'muzzle') { ctx.globalAlpha = k; ctx.drawImage(Art.glow(p.color, 20), p.x - 14, p.y - 14, 28, 28); }
    else if (p.k === 'streak') { ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 22); }
    else if (p.k === 'spark') { ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    else if (p.k === 'beam') {   // 박자 빔
      ctx.globalAlpha = k;
      const g = ctx.createLinearGradient(p.x - p.w / 2, 0, p.x + p.w / 2, 0);
      g.addColorStop(0, 'rgba(255,120,240,0)'); g.addColorStop(0.5, 'rgba(255,230,255,.95)'); g.addColorStop(1, 'rgba(255,120,240,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - p.w / 2, 0, p.w, p.y - 20);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  for (const t of texts) {
    const k = t.t / t.life;
    ctx.globalAlpha = Math.min(1, (1 - k) * 3);
    ctx.font = `900 ${t.size}px sans-serif`; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(5,8,16,.85)'; ctx.lineJoin = 'round';
    const y = t.y - Math.min(t.t, 0.5) * 30;
    ctx.strokeText(t.text, t.x, y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, y);
  }
  ctx.globalAlpha = 1;
}

// ---------- 화면 장식(HUD) ----------
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function panel(x, y, w, h, r = 10) {
  rrect(x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(22,32,52,.88)'); g.addColorStop(1, 'rgba(8,12,22,.88)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
}
function segBar(x, y, w, h, k, c1, c2, segs) {
  rrect(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
  if (k > 0) {
    ctx.save(); rrect(x, y, w, h, h / 2); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(x, y, w * clamp(k, 0, 1), h);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, w * clamp(k, 0, 1), h * 0.4);
    ctx.restore();
  }
  if (segs) { ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5; for (let i = 1; i < segs; i++) { const sx = x + w * i / segs; ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, y + h); ctx.stroke(); } }
  rrect(x, y, w, h, h / 2); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
}
function txt(s, x, y, size, color, align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px sans-serif`; ctx.textAlign = align; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(3,6,14,.8)';
  ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function drawRush() {   // 비트 러시: 아래쪽 박자 줄
  const r = run.rush, now = A.clock().t, y = H - 112;
  panel(14, y - 30, W - 170, 60, 30);
  // 박자마다 맥박
  const ph = ((now - r.notes[0].t) / r.beat % 1 + 1) % 1, pulse = 1 - ph;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(Art.glow('#ff7ad9', 40), LANE_X - 30 - pulse * 8, y - 30 - pulse * 8, 60 + pulse * 16, 60 + pulse * 16);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#ffe6ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(LANE_X, y, 21, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LANE_X + 24, y); ctx.lineTo(W - 172, y); ctx.stroke();
  for (const n of r.notes) {
    const x = LANE_X + (n.t - now) * NOTE_SPEED;
    if (x > W - 166 || x < 30) continue;
    if (n.j === 'p' || n.j === 'g') continue;
    const miss = n.j === 'm', rr = n.half ? 11 : 15;
    ctx.globalAlpha = miss ? 0.3 : 1;
    ctx.globalCompositeOperation = 'lighter';
    if (!miss) ctx.drawImage(Art.glow(n.half ? '#7fd8ff' : '#ff7ad9', 26), x - 26, y - 26, 52, 52);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = miss ? '#555' : '#fff'; ctx.beginPath(); ctx.arc(x, y, rr * 0.55, 0, TAU); ctx.fill();
    ctx.strokeStyle = miss ? '#777' : (n.half ? '#7fd8ff' : '#ff7ad9'); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (r.judge && r.judgeT > 0) txt(r.judge, LANE_X, y - 38, 20, r.judge === 'PERFECT' ? '#ffe066' : r.judge === 'GOOD' ? '#9fe0ff' : '#ff8a8a', 'center', 900);
  txt(`${r.perfect + r.good} / ${r.notes.length}`, W - 164, y - 38, 13, '#ffe6ff', 'right', 800);
  if (r.chain >= 3) txt(`${r.chain} 연속!`, W / 2, y - 38, 16, '#ffd166', 'center', 900);
}
function drawTrap() {   // 그물: 가운데 연타 안내와 게이지
  const g = P.trap.g, y = H * 0.66;
  panel(W / 2 - 150, y - 46, 300, 92, 18);
  txt('연타! 연타!', W / 2, y - 12, 30, Math.floor(T * 8) % 2 ? '#7ff0dc' : '#ffffff', 'center', 900);
  segBar(W / 2 - 120, y + 6, 240, 16, g, '#2fb3a8', '#bffff0', 10);
  txt(`${Math.max(0, 7 - P.trap.t).toFixed(1)}초 뒤 저절로 풀리지만 다친다`, W / 2, y + 40, 11, '#b9c8dc', 'center', 600);
  for (let i = 0; i < 3; i++) {   // 손가락 표시
    const a = T * 10 + i * 2.1, s = 1 + Math.sin(a) * 0.2;
    ctx.globalAlpha = 0.5 + Math.sin(a) * 0.3; txt('👆', W / 2 + (i - 1) * 70, y + 90, 28 * s, '#fff', 'center', 400); ctx.globalAlpha = 1;
  }
}
function drawHud() {
  segBar(0, 0, W, 6, run.xp / run.xpNeed, '#2be38a', '#9dffcf');
  panel(10, 14, 118, 52, 12);
  const badge = { stage: ['STAGE', String(run.stage)], endless: ['WAVE', String(run.wave)], rush: ['BOSS', `${run.bossIdx + 1}/5`], auto: ['ZONE', String(run.stage)] }[run.mode] || ['LEVEL', String(run.stage)];
  txt(badge[0], 22, 32, 11, '#ffd166', 'left', 800);
  txt(badge[1], 22, 58, 26, '#ffffff', 'left', 900);
  if (run.mode === 'auto') {
    rrect(10, 72, 118, 22, 11); ctx.fillStyle = Math.floor(T * 2) % 2 ? 'rgba(43,227,138,.85)' : 'rgba(30,160,100,.85)'; ctx.fill();
    txt('⭐ 표창 공방', 69, 88, 12, '#04120a', 'center', 900);
  }
  txt(`Lv ${run.level}`, 118, 32, 12, '#9dffcf', 'right', 800);
  txt(D.THEMES[run.theme].name, 118, 56, 11, '#b9c8dc', 'right', 600);
  panel(W - 150, 14, 140, 52, 12);
  txt('SCORE', W - 138, 32, 11, '#ffd166', 'left', 800);
  txt(run.score.toLocaleString(), W - 20, 58, 20, '#ffffff', 'right', 900);
  txt(`🔩${run.scrapGot}`, W - 20, 32, 12, '#ffe7a3', 'right', 700);
  const cx = 140, cw = W - 300;
  if (run.phase === 'waves') {
    const prog = run.mode === 'endless' ? 1 - (run.nextBoss - run.t) / 90 : run.t / run.waveDur;
    segBar(cx, 26, cw, 9, prog, '#3f7dd6', '#9fd0ff', 10);
    if (isFinite(run.waveDur)) {   // 이번 판에 올 일: ⑂ 갈림길, ♪ 리듬 결투, ★ 황금 수송선
      const mark = (t0, s, c) => { if (t0) txt(s, cx + cw * Math.min(1, t0 / run.waveDur), 22, 13, c, 'center', 900); };
      if (!run.rushDone) mark(run.rushAt, '♪', '#ff7ad9');
      mark(run.gateAt, '⑂', '#9dffcf'); mark(run.treasureAt, '★', '#ffd166');
    }
    txt('보스까지', W / 2, 54, 12, '#cfe0f5', 'center', 700);
  } else if (run.phase === 'warning') txt('⚠ WARNING ⚠', W / 2, 46, 24, Math.floor(T * 6) % 2 ? '#ff4d4d' : '#ffd166', 'center', 900);
  else if (boss) {
    const hp = boss.parts.reduce((s, p) => s + Math.max(0, p.hp), 0), mx = boss.parts.reduce((s, p) => s + p.maxHp, 0);
    segBar(cx - 4, 24, cw + 8, 12, hp / mx, '#ff3d5a', '#ff9a6b', 10);
    txt(boss.def.name, W / 2, 56, 13, '#ffd0d0', 'center', 800);
  }
  if (run.combo >= 2) {
    const k = clamp(run.comboT / 2.5, 0, 1), y = 168;
    ctx.globalAlpha = 0.4 + k * 0.6;
    txt(`${run.combo}`, W - 22, y, 34, '#ffd166', 'right', 900);
    txt('COMBO', W - 22, y + 18, 12, '#ffe7a3', 'right', 800);
    txt(`×${comboMul().toFixed(2)}`, W - 22, y + 34, 12, '#b9c8dc', 'right', 700);
    segBar(W - 92, y + 42, 70, 4, k, '#ffd166', '#fff3c4');
    ctx.globalAlpha = 1;
  }
  if (run.dangerT > 0) txt(`⚠ 위험 항로 ${Math.ceil(run.dangerT)}초 · 보상 ×2`, W / 2, 84, 14, '#ff8a8a', 'center', 900);
  if (run.beatBuff > 1) txt(`♪ 피해 +${Math.round((run.beatBuff - 1) * 100)}%`, 20, 120, 12, '#ffb3f5', 'left', 800);
  const low = P.hp < P.maxHp * 0.3;
  ctx.save(); if (S.lefty) ctx.translate(W - 230, 0);   // 왼손 모드: 체력 줄을 오른쪽으로
  if (run.mode === 'auto') ctx.translate(0, -(H * 0.36));   // 표창 공방: 아래 칸 위로
  panel(10, H - 58, 210, 44, 12);
  txt('❤', 22, H - 30, 18, low ? '#ff5d5d' : '#ff8a8a', 'left', 900);
  segBar(46, H - 44, 162, 12, P.hp / P.maxHp, low ? '#ff3d3d' : '#3fd97a', low ? '#ff8a6b' : '#b8ffb0', Math.max(1, Math.round(P.maxHp / 20)));
  txt(`${Math.ceil(P.hp)} / ${P.maxHp}`, 208, H - 20, 11, '#dfe8f2', 'right', 700);
  ctx.restore();
  if (run.rush) drawRush();
  if (P.trap) drawTrap();
  if (run.rushSum) {
    const k = Math.min(1, (2.4 - run.rushSum.t) * 3);
    ctx.globalAlpha = k; panel(W / 2 - 170, H * 0.62 - 34, 340, 64, 16);
    txt(run.rushSum.text, W / 2, H * 0.62 - 6, 16, '#ffe6ff', 'center', 900); txt(run.rushSum.sub, W / 2, H * 0.62 + 18, 13, '#ffe7a3', 'center', 700); ctx.globalAlpha = 1;
  }
  const v = Math.max(run.hurtT / 0.6, low ? 0.35 + Math.sin(T * 6) * 0.15 : 0);
  if (v > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(220,20,40,${0.55 * v})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const b = run.banner;
  if (b) {
    const inK = clamp(b.t / 0.3, 0, 1), outK = clamp((b.life - b.t) / 0.4, 0, 1), k = Math.min(inK, outK);
    const y = b.kind === 'ult' ? H * 0.6 : b.kind === 'trap' ? H * 0.46 : H * 0.36, h = b.kind === 'boss' ? 130 : 96;
    ctx.save(); ctx.globalAlpha = k;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    const c = { boss: '120,10,20', ult: '90,60,0', rush: '90,10,90', trap: '10,70,70' }[b.kind] || '10,30,70';
    g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.2, `rgba(${c},.85)`); g.addColorStop(0.8, `rgba(${c},.85)`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, y - h / 2, W, h);
    if (b.kind === 'boss') {   // 경고 줄무늬
      ctx.save(); ctx.beginPath(); ctx.rect(0, y - h / 2, W, 12); ctx.rect(0, y + h / 2 - 12, W, 12); ctx.clip();
      ctx.fillStyle = '#ffd166'; ctx.fillRect(0, y - h / 2, W, h);
      ctx.fillStyle = '#1a1a1a'; for (let x = -40 + (T * 80) % 40; x < W + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + 20, y - h / 2); ctx.lineTo(x + 20 - 130, y + h / 2); ctx.lineTo(x - 130, y + h / 2); ctx.fill(); }
      ctx.restore();
    }
    const slide = (1 - inK) * 120;
    const col = { ult: '#ffe066', rush: '#ffb3f5', trap: '#7ff0dc' }[b.kind] || '#ffffff';
    txt(b.title, W / 2 + slide, y + (b.sub ? 4 : 14), b.kind === 'stage' || b.kind === 'rush' ? 44 : 34, col, 'center', 900);
    if (b.sub) txt(b.sub, W / 2 - slide, y + 32, 15, '#e8eef7', 'center', 600);
    ctx.restore();
  }
}
function updateUltBtn() {
  const b = $('ultBtn'), p = Math.floor(P.ult);
  b.style.setProperty('--p', p);
  b.classList.toggle('ready', p >= 100);
  const html = p >= 100 ? `<b>${st.F.ult.name}</b><small>누르기!</small>` : `<b>${p}%</b><small>궁극기</small>`;
  if (b.dataset.h !== html) { b.dataset.h = html; b.innerHTML = html; }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-8, 8) * shake, rnd(-8, 8) * shake);
  if (state === 'hangar' || !run) {
    drawBg((hangarStage - 1) % 4);
    ctx.fillStyle = 'rgba(4,8,18,.25)'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return;
  }
  drawBg(run.theme);
  drawDrops();
  drawGates();
  for (const e of foes) if (e.type !== 'boss') drawFoe(e);
  drawBoss();
  drawShots();
  drawPlayer();
  drawEbul();
  drawLasers();
  drawFx();
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgba(255,250,235,${flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  drawHud();
  updateUltBtn();
  if (state === 'duel') Duel.draw(ctx, T);
  if (net && net.mode === 'guest' && run.cardWait) { panel(W / 2 - 170, H * 0.45 - 30, 340, 60, 16); txt(run.cardWait === 2 ? '방장이 잠깐 멈췄어요' : '방장이 카드를 고르는 중…', W / 2, H * 0.45 + 8, 18, '#ffe7a3', 'center', 800); }
}

// ---------- 격납고 ----------
let openSlot = null;
function shipCanvas(id, w = 200, h = 130, s = 1.6) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  drawShipAt(c.getContext('2d'), id, w / 2, h / 2 - 6, s, 0, 0, false); return c;
}
function showHangar() {
  netEndOnce(false);
  state = 'hangar';
  Forge.show(false); $('ultBtn').classList.remove('hidden');
  for (const id of ['cards', 'pause', 'result', 'hud']) $(id).classList.add('hidden');
  $('hangar').classList.remove('hidden');
  run = null;
  A.music('hangar', 0);
  renderHangar();
}
const statBar = (label, k, val) => `<div class="stat"><span>${label}</span><i><b style="width:${Math.round(clamp(k, 0.04, 1) * 100)}%"></b></i><em>${val}</em></div>`;
function renderHangar() {
  $('scrap').textContent = `🔩 ${S.scrap}`;
  $('bestTxt').textContent = `최고 ${S.best.toLocaleString()} · ★${starCount()}`;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  { const on = document.querySelector('.tabs button.on'), nav = document.querySelector('.tabs'); if (on) nav.scrollLeft = on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2; }
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + tab));
  if (tab === 'rank') Rank.render($('tab-rank'));
  const claimable = GOALS.filter(g => !S.claimed[g.id] && g.val() >= g.need).length;
  $('goalBadge').textContent = claimable || '';
  $('goalBadge').classList.toggle('hidden', !claimable);
  const mb = $('modes'); mb.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button'); b.className = m.id === selMode ? 'on' : '';
    b.innerHTML = `<span>${m.icon}</span>${m.name}`;
    b.addEventListener('click', () => { selMode = m.id; A.sfx('click'); renderHangar(); });
    mb.append(b);
  }
  const M = MODES.find(m => m.id === selMode);
  const rec = { stage: `최고 스테이지 ${S.cleared} · 별 ★${starCount()}`, endless: `최고 WAVE ${S.records.wave} · 최고 점수 ${S.records.endlessScore.toLocaleString()}`,
    rush: `최고 ${S.records.rush} / 5${S.records.rushTime ? ` · 최단 ${fmt(S.records.rushTime)}` : ''}`, auto: `구역 ${S.idle.zone} · 최고 ${S.idle.best} · 💰${Forge.fmt(S.forge.gold)} · 최고 표창 Lv ${S.forge.maxLv} · ✨ 별조각 ${S.forge.shards}` }[selMode];
  $('modeInfo').innerHTML = `<b>${M.icon} ${M.name}</b><br>${M.desc}<br><small>📊 ${rec || `열린 단계 ${S.dojo.open} / 8`}</small>`;
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
  shipBox.append(shipCanvas(S.frame, 260, 170, 2.2));
  pv.append(shipBox);
  const eqIcons = Object.keys(D.SLOTS).map(k => { const p = D.PARTS.find(x => x.id === S.equip[k]); return p ? `<span title="${p.name}">${p.icon}<sup>${S.parts[p.id]}</sup></span>` : '<span class="empty">＋</span>'; }).join('');
  pv.insertAdjacentHTML('beforeend', `<div class="pvInfo"><b>${s2.F.name}</b><span>${s2.Wp.name} Lv ${S.weapons[s2.Wp.id] || 1}</span><div class="eq">${eqIcons}</div>
    ${statBar('체력', s2.maxHp / 230, s2.maxHp)}${statBar('속도', s2.speed / 1.8, Math.round(s2.speed * 100) + '%')}${statBar('화력', s2.dmg * s2.rate / 110, Math.round(s2.dmg * s2.rate))}
    <div class="ultLine">🌟 ${s2.F.ult.name}</div></div>`);
  const map = $('stageMap'); map.innerHTML = '';
  for (let s = 1; s <= S.maxStage + 2; s++) {
    const open = s <= S.maxStage, bd = D.BOSSES[(s - 1) % 5], stars = S.stars[s] || [], loop = (s - 1) / 5 | 0;
    const n = document.createElement('button');
    n.className = 'node' + (s === hangarStage ? ' on' : '') + (open ? '' : ' locked') + (S.cleared >= s ? ' done' : '');
    const rk = (S.ranks || {})[s];
    n.innerHTML = `<span class="num">${s}</span><span class="nm"><b>${bd.name}${loop ? ` <i>${loop + 1}회차</i>` : ''}</b><small>${D.THEMES[(s - 1) % 4].name}</small></span>${rk ? `<span class="rank r${rk}">${rk}</span>` : ''}<span class="st">${[0, 1, 2].map(i => `<em class="${stars[i] ? 'on' : ''}">★</em>`).join('')}</span>${open ? '' : '<span class="lock">🔒</span>'}`;
    if (open) n.addEventListener('click', () => { hangarStage = s; A.sfx('click'); renderHangar(); });
    map.append(n);
  }
  const bd = D.BOSSES[(hangarStage - 1) % 5];
  $('stTip').innerHTML = `<b>스테이지 ${hangarStage}</b> · 보스 <b>${bd.name}</b><br><small>${bd.tip}</small><br><small class="rules">${STAR_RULES.map((r, i) => `${(S.stars[hangarStage] || [])[i] ? '★' : '☆'} ${r}`).join(' · ')}</small>`;
  if (tab === 'sortie') requestAnimationFrame(() => { const on = map.querySelector('.node.on'); if (on) map.scrollTop = on.offsetTop - map.clientHeight / 2; });
  const fr = $('frames'); fr.innerHTML = '';
  for (const f of D.FRAMES) {
    const open = unlocked(f), d = document.createElement('button');
    d.className = 'card' + (S.frame === f.id ? ' on' : '') + (open ? '' : ' locked');
    d.append(shipCanvas(f.id));
    d.insertAdjacentHTML('beforeend', `<b>${f.name}</b><small>${f.desc}</small>${statBar('체력', f.hp / 160, f.hp)}${statBar('속도', f.speed / 1.4, Math.round(f.speed * 100) + '%')}<small class="ult">🌟 ${f.ult.name}<br>${f.ult.desc}</small>` + (open ? '' : `<small class="lockTxt">🔒 스테이지 ${f.unlock} 클리어 시 열림</small>`));
    d.addEventListener('click', () => { if (!open) return; S.frame = f.id; save(); A.sfx('click'); renderHangar(); });
    fr.append(d);
  }
  const wp = $('weapons'); wp.innerHTML = '';
  for (const w of D.WEAPONS) {
    const open = unlocked(w), lv = S.weapons[w.id] || 1, d = document.createElement('div');
    d.className = 'card' + (S.weapon === w.id ? ' on' : '') + (open ? '' : ' locked');
    d.innerHTML = `<b><span class="wIcon" style="background:${w.color};color:${w.color}"></span>${w.name} <small>Lv ${lv}</small></b><small>${w.desc}</small>${statBar('피해', w.dmg * (w.pellets || 1) / 30, Math.round(w.dmg * (1 + 0.1 * (lv - 1))))}${statBar('연사', w.rate / 10, w.rate + '/초')}<div class="lvDots">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</div>` + (open ? '' : `<small class="lockTxt">🔒 스테이지 ${w.unlock} 클리어 시 열림</small>`);
    if (open && lv < D.MAX_LV) {
      const cost = D.WEAPON_COST(lv), u = document.createElement('button');
      u.className = 'up'; u.textContent = `강화 🔩${cost}`; u.disabled = S.scrap < cost;
      u.addEventListener('click', ev => { ev.stopPropagation(); if (S.scrap < cost) return; S.scrap -= cost; S.weapons[w.id] = lv + 1; save(); A.sfx('buy'); renderHangar(); });
      d.append(u);
    }
    d.addEventListener('click', () => { if (!open) return; S.weapon = w.id; if (!S.weapons[w.id]) S.weapons[w.id] = 1; save(); A.sfx('click'); renderHangar(); });
    wp.append(d);
  }
  const sl = $('slots'); sl.innerHTML = '';
  for (const [slot, label] of Object.entries(D.SLOTS)) {
    const id = S.equip[slot], p = D.PARTS.find(x => x.id === id), d = document.createElement('button');
    d.className = 'slot' + (p ? ' filled' : '') + (openSlot === slot ? ' open' : '');
    d.innerHTML = p ? `<span class="ic">${p.icon}</span><b>${p.name}</b> Lv ${S.parts[id]}<i>${label} · ${p.desc(S.parts[id])}</i>` : `<span class="ic">＋</span><b>${label}</b><i>비어 있음 · 눌러서 고르기</i>`;
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
      row.innerHTML = `<span class="ic">${p.icon}</span><span class="tx"><b>${p.name}</b> <span class="lvDots">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span><small>${p.desc(lv)}${lv < D.MAX_LV ? ` → ${p.desc(lv + 1)}` : ' (최고 단계)'}</small></span>`;
      const eq = document.createElement('button');
      eq.className = on ? 'eq' : ''; eq.textContent = on ? '빼기' : '끼우기';
      eq.addEventListener('click', () => { S.equip[openSlot] = on ? null : p.id; save(); A.sfx('click'); renderHangar(); });
      row.append(eq);
      if (lv < D.MAX_LV) {
        const cost = D.PART_COST(lv), u = document.createElement('button');
        u.textContent = `강화 🔩${cost}`; u.disabled = S.scrap < cost;
        u.addEventListener('click', () => { if (S.scrap < cost) return; S.scrap -= cost; S.parts[p.id] = lv + 1; save(); A.sfx('buy'); renderHangar(); });
        row.append(u);
      }
      pl.append(row);
    }
  } else pl.innerHTML = `<p class="note">칸을 누르면 가진 부품이 나옵니다. 모은 부품 ${Object.keys(S.parts).length} / ${D.PARTS.length}종</p>`;
  $('pilot').innerHTML = `<span class="lv">Lv ${S.pilot.lv} ${rankName(S.pilot.lv)}</span><i><b style="width:${S.pilot.xp / pilotNeed(S.pilot.lv) * 100}%"></b></i><em>${Math.floor(S.pilot.xp)} / ${pilotNeed(S.pilot.lv)}</em>`;
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
  $('verTxt').textContent = `볼트윙 BOLTWING v${VERSION} · by motive · 음악과 효과음은 코드로 만든 소리입니다 · 지금까지 ${S.plays}번 출격`;
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

// ---------- 손가락·키보드 ----------
function toWorld(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
cv.addEventListener('pointerdown', e => {
  if (state === 'duel') { duelPtr[e.pointerId] = Duel.pressX(toWorld(e).x); return; }   // 리듬 결투: 누른 자리의 줄(손을 떼면 놓기)
  if (state !== 'play') return;
  onTap();
  if (P.trap) return;
  const p = toWorld(e);
  drag = { px: p.x, py: p.y, ox: P.tx, oy: P.ty };
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (state === 'play' && e.pointerType === 'mouse' && S.mouse && !P.trap) {   // PC: 마우스 따라가기
    const m = toWorld(e); P.tx = clamp(m.x, 22, W - 22); P.ty = clamp(m.y, 90, H - 70); return;
  }
  if (!drag || state !== 'play' || P.trap) return;
  const p = toWorld(e);
  P.tx = clamp(drag.ox + (p.x - drag.px) * 1.3, 22, W - 22);
  P.ty = clamp(drag.oy + (p.y - drag.py) * 1.3, 90, H - 70);
});
const duelPtr = {};
const endDrag = e => { drag = null; if (e && duelPtr[e.pointerId] !== undefined) { if (state === 'duel') Duel.release(duelPtr[e.pointerId]); delete duelPtr[e.pointerId]; } };
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
  if (e.key === 'p' || e.key === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); }
  if (state === 'cards' && ['1', '2', '3'].includes(e.key)) { const ids = $('cards').dataset.ids.split(','); if (ids[+e.key - 1]) takeCard(ids[+e.key - 1]); }
  if (state === 'hangar' && e.key === 'Enter' && document.activeElement.tagName !== 'INPUT') startRun(hangarStage, selMode);
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

$('ultBtn').addEventListener('pointerdown', e => { e.stopPropagation(); if (P && P.trap) tapTrap(); else if (run && run.rush) rushTap(); else useUlt(); });
$('pauseBtn').addEventListener('click', pauseGame);
$('resume').addEventListener('click', resumeGame);
$('quit').addEventListener('click', () => { save(); $('pause').classList.add('hidden'); if (net && net.mode === 'guest') { leaveRoom(); showHangar(); return; } if (run && run.mode !== 'stage') endRun(false); else showHangar(); });
$('assistBtn').addEventListener('click', () => { assistOn = !assistOn; A.sfx('click'); renderHangar(); });
$('go').addEventListener('click', () => {
  A.init(); A.sfx('click');
  const go = () => startRun(hangarStage, selMode);
  if (!S.seenHelp) { afterHelp = go; $('howto').classList.remove('hidden'); } else go();
});
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
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; openSlot = null; A.sfx('click'); renderHangar(); }));
$('musicBtn').addEventListener('click', () => { S.music = !S.music; A.setMusic(S.music); save(); renderHangar(); });
$('sfxBtn').addEventListener('click', () => { S.sfx = !S.sfx; A.setSfx(S.sfx); save(); renderHangar(); });
$('vibBtn').addEventListener('click', () => { S.vib = !S.vib; save(); buzz(40); renderHangar(); });
$('fsBtn').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else goFullscreen(); });
$('copy').addEventListener('click', async () => {
  const t = `${$('copy').dataset.text || ''}\n${location.origin}${location.pathname}`;   // 친구가 바로 들어올 수 있게 주소도 붙인다
  try { await navigator.clipboard.writeText(t); $('copy').textContent = '복사했어요! 카톡에 붙여 넣으세요 ✔'; } catch (e) { $('copy').textContent = t; }
  setTimeout(() => { $('copy').textContent = '📋 결과 복사해서 자랑하기'; }, 2500);
});

// ---------- 친구와 함께(협동, 2~3명) ----------
// 방장의 기기가 판 전체를 계산하고, 친구는 자기 위치·궁극기만 보낸다. 방장은 1초에 20번 화면 상태를 보내 준다.
let net = null, coopMsg = '', coopMd = 'stage', foeSeq = 0, joinCode = '';
const netEv = [], allies = [];
const COOP_MAX = 3, PEER_PFX = 'skybot-v1-', ALLY_COL = ['#7fd8ff', '#ff9ad5'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanName = s => String(s || '').replace(/[<>&"'\n\r\t]/g, '').trim().slice(0, 8) || '조종사';
const myNick = () => { if (!S.nick) { S.nick = '조종사' + ((Math.random() * 900 + 100) | 0); save(); } return S.nick; };
// 소리·음악도 친구 화면에서 같이 나게(무기 발사음처럼 너무 잦은 소리는 빼고)
const rawSfx = A.sfx, rawMusic = A.music, QUIET = new Set(['vulcan', 'spread', 'laser', 'missile', 'drone', 'xp', 'scrap', 'click', 'hit']);
A.sfx = (n, ...r) => { if (net && net.mode === 'host' && !QUIET.has(n)) netEv.push(['a', n]); return rawSfx(n, ...r); };
A.music = (mood, th) => { if (net && net.mode === 'host' && state !== 'hangar') netEv.push(['m', mood, th]); return rawMusic(mood, th); };

function nearestShip(x, y) {
  let best = P, bd = P && !(P.down > 0) ? Math.hypot(P.x - x, P.y - y) : 1e9;
  if (net && net.mode === 'host') for (const a of allies) if (!(a.down > 0)) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } }
  return best || { x: W / 2, y: H };
}
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res; s.onerror = () => rej(new Error('연결 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    document.head.append(s);
  });
}
function netBroadcast(m) { if (net && net.mode === 'host') for (const a of allies) { try { if (a.conn.open) a.conn.send(m); } catch (e) { /* 끊긴 친구 */ } } }
function netEndOnce(win) {
  if (!(net && net.mode === 'host' && run && run.coop) || run.netEnded) return;
  run.netEnded = true;
  netBroadcast({ t: 'end', win, stage: run.stage, mode: run.mode, score: run.score, scrap: run.scrapGot, kills: run.kills, wave: run.wave, parts: allies.map(a => [a.id, a.parts || 0]) });
}
const roster = () => [{ name: myNick(), host: true }, ...allies.map(a => ({ name: a.name }))];
function netFail(msg) { coopMsg = msg; const wasGuest = net && net.mode === 'guest'; leaveRoom(); if (wasGuest && state !== 'hangar') showHangar(); else if (state === 'hangar') renderHangar(); }
function leaveRoom() {
  if (!net) return;
  const n = net; net = null;
  try { if (n.mode === 'guest' && n.conn && n.conn.open) n.conn.send({ t: 'bye' }); if (n.mode === 'host') for (const a of allies) if (a.conn.open) a.conn.send({ t: 'closed' }); } catch (e) { /* 무시 */ }
  setTimeout(() => { try { n.peer.destroy(); } catch (e) { /* 무시 */ } }, 300);
  allies.length = 0;
}

// --- 방장 ---
async function hostRoom() {
  leaveRoom(); coopMsg = '';
  try { await loadPeer(); } catch (e) { coopMsg = e.message; renderHangar(); return; }
  const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random() * 32) | 0]).join('');
  const peer = new window.Peer(PEER_PFX + code);
  net = { mode: 'host', peer, code, status: '방을 여는 중…', snapT: 0 };
  renderHangar();
  peer.on('open', () => { if (net && net.peer === peer) { net.status = '친구를 기다리는 중'; renderHangar(); } });
  peer.on('error', e => { if (net && net.peer === peer) netFail(e.type === 'unavailable-id' ? '방 코드가 겹쳤어요. 다시 만들어 주세요.' : `연결 오류(${e.type}). 잠시 뒤 다시 해 보세요.`); });
  peer.on('connection', c => {
    c.on('data', m => hostData(c, m));
    c.on('close', () => dropAlly(c));
    c.on('error', () => dropAlly(c));
  });
}
function hostData(c, m) {
  if (!net || net.mode !== 'host' || !m || typeof m !== 'object') return;
  let a = allies.find(x => x.conn === c);
  if (m.t === 'hi') {
    if (a) return;
    const playing = run && (state === 'play' || state === 'cards' || state === 'pause' || state === 'duel');
    if (allies.length >= COOP_MAX - 1 || playing) { c.send({ t: 'full', why: playing ? '방장이 지금 게임 중이에요. 판이 끝나면 다시 들어와 주세요.' : '방이 꽉 찼어요(최대 3명).' }); setTimeout(() => c.close(), 600); return; }
    const k = m.card || {}, num = (v, a0, b0, d) => (typeof v === 'number' && isFinite(v) ? clamp(v, a0, b0) : d);
    const F = frameOf(k.frame) || D.FRAMES[0], Wp = weaponOf(k.weapon) || D.WEAPONS[0];
    const used = allies.map(x => x.color);
    a = { id: c.peer, conn: c, name: cleanName(m.name), frame: F.id, wp: Wp, dmg: num(k.dmg, 1, Wp.dmg * 4, Wp.dmg), rate: num(k.rate, 1, Wp.rate * 2, Wp.rate),
      speed: num(k.speed, 0.6, 2, 1), hit: num(k.hit, 4, 16, 8), maxHp: Math.round(num(k.maxHp, 50, 400, 100)), color: ALLY_COL.find(x => !used.includes(x)) || ALLY_COL[0],
      x: W / 2, y: H - 190, tx: W / 2, ty: H - 190, lx: W / 2, bank: 0, hp: 100, inv: 0, ult: 0, fireT: 0, down: 0, parts: 0, swarm: 0, swT: 0 };
    a.hp = a.maxHp;
    allies.push(a);
    c.send({ t: 'welcome', id: c.peer, roster: roster() });
    netBroadcast({ t: 'roster', roster: roster() });
    A.sfx('part'); coopMsg = `${a.name} 님이 들어왔어요!`;
    if (state === 'hangar') renderHangar();
    return;
  }
  if (!a) return;
  if (m.t === 'in' && typeof m.x === 'number' && typeof m.y === 'number') { a.tx = clamp(m.x, 22, W - 22); a.ty = clamp(m.y, 90, H - 70); }
  else if (m.t === 'ult') allyUlt(a);
  else if (m.t === 'bye') dropAlly(c);
}
function dropAlly(c) {
  const i = allies.findIndex(a => a.conn === c);
  if (i < 0) return;
  const a = allies.splice(i, 1)[0];
  try { c.close(); } catch (e) { /* 무시 */ }
  coopMsg = `${a.name} 님이 나갔어요`;
  if (run && state !== 'hangar') say(coopMsg, W / 2, H * 0.3, '#ffb3b3', 18, 1.6);
  netBroadcast({ t: 'roster', roster: roster() });
  if (state === 'hangar') renderHangar();
}
function coopBegin() {
  run.coop = true; run.rushDone = true;   // 협동에서는 리듬 결투를 쉰다(한 사람만 하게 되므로)
  allies.forEach((a, i) => Object.assign(a, { x: W / 2 + (i ? 120 : -120), y: H - 170, tx: W / 2 + (i ? 120 : -120), ty: H - 170, lx: W / 2, hp: a.maxHp, down: 0, inv: 2, ult: 0, fireT: 0.3, parts: 0, swarm: 0, bank: 0 }));
  net.lastBn = null; net.snapT = 0; netEv.length = 0;
  netBroadcast({ t: 'start', stage: run.stage, mode: run.mode, roster: roster() });
}
function allyHurt(a, dmg) {
  if (SKY.god || a.inv > 0 || a.down > 0 || run.phase === 'dead' || run.phase === 'clear') return;
  a.hp -= dmg * (run.dmgTaken || 1); a.inv = 1.1;
  spark(a.x, a.y, 14, '#ff6b6b', 240, 0.45, 3);
  if (a.hp <= 0) {
    a.hp = 0; a.down = 6;
    explode(a.x, a.y, 60, a.color); say(`${a.name} 격추! 6초 뒤 복귀`, a.x, a.y - 50, '#ff9a9a', 18, 1.6);
  }
}
function allyUlt(a) {
  if (a.ult < 100 || a.down > 0 || state !== 'play' || run.phase === 'dead' || run.phase === 'clear') return;
  a.ult = 0; a.swarm = 18;
  ebul = ebul.filter(b => Math.hypot(b.x - a.x, b.y - a.y) > 150);
  ringFx(a.x, a.y, 150, a.color); say(`${a.name}의 궁극기!`, a.x, a.y - 60, a.color, 20, 1.2); A.sfx('charge'); flash = Math.max(flash, 0.25);
}
function updateAllies(dt) {
  const fighting = run.phase !== 'dead' && run.phase !== 'clear';
  for (const a of allies) {
    if (a.down > 0) {
      if ((a.down -= dt) <= 0) { a.down = 0; a.hp = Math.round(a.maxHp * 0.5); a.inv = 2.5; a.x = a.tx; a.y = a.ty; ringFx(a.x, a.y, 70, a.color); say(`${a.name} 복귀!`, a.x, a.y - 50, a.color, 18, 1.2); }
      continue;
    }
    const mv = 900 * a.speed * run.m.speed * dt, dx = a.tx - a.x, dy = a.ty - a.y, dl = Math.hypot(dx, dy);
    if (dl > mv) { a.x += dx / dl * mv; a.y += dy / dl * mv; } else { a.x = a.tx; a.y = a.ty; }
    a.bank += (clamp((a.x - a.lx) / Math.max(dt, 0.001) / 600, -1, 1) - a.bank) * Math.min(1, dt * 10); a.lx = a.x;
    if (a.inv > 0) a.inv -= dt;
    a.ult = Math.min(100, a.ult + 0.5 * dt);
    if (fighting) {
      a.fireT -= dt;
      while (a.fireT <= 0) { fire(a, a.wp, a.dmg); a.fireT += 1 / (a.rate * run.m.rate * (run.evo && a.wp.id === 'vulcan' ? 2 : 1)); }
      if (a.swarm > 0 && (a.swT -= dt) <= 0) { a.swT = 0.04; a.swarm--; addShot(a.x + rnd(-20, 20), a.y, rnd(-320, 320), rnd(-260, -120), 22 * ultPow() * a.dmg / st.dmg, { homing: true, r: 6, color: '#ffe066', own: a }); }
    }
    for (const b of ebul) if (!b.dead && Math.hypot(a.x - b.x, a.y - b.y) < a.hit + b.r) { b.dead = true; allyHurt(a, run.d.dmg * (b.net ? 0.5 : 1)); }
    for (const l of lasers) {
      if (l.warn > 0) continue;
      const lx = a.x - l.x, ly = a.y - l.y, along = lx * Math.cos(l.a) + ly * Math.sin(l.a), perp = Math.abs(-lx * Math.sin(l.a) + ly * Math.cos(l.a));
      l.hitA = l.hitA || [];
      if (!l.hitA.includes(a.id) && along > 0 && perp < l.w / 2 + a.hit) { l.hitA.push(a.id); allyHurt(a, run.d.dmg * 1.6); }
    }
    for (const e of foes) if (!e.dead && !e.inv && Math.hypot(e.x - a.x, e.y - a.y) < e.r * 0.8 + a.hit) { allyHurt(a, run.d.dmg + 8); if (!e.isBoss) hitFoe(e, 30, a); }
    for (const d of drops) {
      if (d.dead || Math.hypot(a.x - d.x, a.y - d.y) > 34) continue;
      d.dead = true;
      if (d.kind === 'xp') { run.xp += d.v; A.sfx('xp'); }
      else if (d.kind === 'scrap') { gainScrap(d.v); A.sfx('scrap'); }
      else if (d.kind === 'heart') { a.hp = Math.min(a.maxHp, a.hp + d.v); say('+' + d.v, a.x, a.y - 40, '#6ee37a', 18); A.sfx('heal'); }
      else if (d.kind === 'part') { a.parts++; say(`${a.name} 부품 획득!`, a.x, a.y - 50, '#ffd166', 18, 1.4); A.sfx('part'); }
    }
  }
  ebul = ebul.filter(b => !b.dead);
  if (P.down > 0 && (P.down -= dt) <= 0) { P.down = 0; P.hp = Math.round(P.maxHp * 0.5); P.inv = 2.5; ringFx(P.x, P.y, 70, '#ffd166'); say('복귀!', P.x, P.y - 50, '#ffd166', 20, 1.2); }
  if (P.down > 0 && run.phase !== 'dead' && allies.every(a => a.down > 0)) {   // 모두 격추되면 끝
    run.phase = 'dead'; run.endT = 2; A.sfx('boomL'); shake = 1.2; flash = 0.6;
  }
}
const r1 = v => Math.round(v), r2 = v => Math.round(v * 100) / 100;
function netTick(dt) {
  if (net.mode === 'guest') return;
  if (!run || !allies.length || !(state === 'play' || state === 'cards' || state === 'pause' || state === 'duel')) { netEv.length = 0; return; }
  if ((net.snapT -= dt) > 0) return;
  net.snapT = 0.05;
  const R = run, bn = R.banner && R.banner !== net.lastBn ? { kind: R.banner.kind, title: R.banner.title, sub: R.banner.sub, life: R.banner.life - R.banner.t } : null;
  net.lastBn = R.banner;
  const m = {
    t: 's', cw: state === 'cards' ? 1 : state === 'pause' ? 2 : 0, fl: r2(flash), sk: r2(shake), bn,
    r: { stage: R.stage, phase: R.phase, theme: R.theme, mode: R.mode, level: R.level, xp: r2(R.xp), xpNeed: R.xpNeed, score: R.score, scrapGot: R.scrapGot, combo: R.combo, comboT: r2(R.comboT),
      t: r2(R.t), waveDur: isFinite(R.waveDur) ? R.waveDur : -1, nextBoss: R.nextBoss, wave: R.wave, bossIdx: R.bossIdx, dangerT: r2(R.dangerT || 0), beatBuff: R.beatBuff || 1, gateAt: R.gateAt || 0, treasureAt: R.treasureAt || 0, msp: R.m.speed },
    p: [['host', r1(P.x), r1(P.y), r2(P.bank), r1(P.hp), P.maxHp, r2(P.down || 0), P.inv > 0 && P.inv < 50 ? 1 : 0, r1(P.ult), st.F.id, myNick(), '#ffd166'],
      ...allies.map(a => [a.id, r1(a.x), r1(a.y), r2(a.bank), r1(a.hp), a.maxHp, r2(a.down), a.inv > 0 ? 1 : 0, r1(a.ult), a.frame, a.name, a.color])],
    f: foes.filter(e => !e.isBoss).slice(0, 120).map(e => [e.nid, e.type, r1(e.x), r1(e.y), r1(e.hp), r1(e.maxHp), e.flash > 0 ? 1 : 0, e.mod || 0, r1(e.sh || 0), r2(e.t), e.mode || 0, r1(e.vx || 0), r1(e.vy || 0), e.elite ? 1 : 0, e.r]),
    b: boss ? { id: boss.def.id, t: r2(boss.t), p2: boss.p2 ? 1 : 0, inhale: r2(boss.inhale || 0), enraged: boss.enraged ? 1 : 0, mirror: r2(boss.mirror || 0), spin: r2(boss.spin || 0),
      parts: boss.parts.map(p => [r1(p.x), r1(p.y), p.r, r1(p.hp), r1(p.maxHp), p.dead ? 1 : 0, p.flash > 0 ? 1 : 0, p.dx || 0]) } : null,
    e: ebul.slice(0, 260).map(b => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.r, b.color, b.net ? 1 : 0, b.mine !== undefined ? r2(b.mine) : -1]),
    s: shots.slice(-220).map(s => [r1(s.x), r1(s.y), r1(s.vx), r1(s.vy), s.r, s.color, s.long ? 1 : 0, s.homing ? 1 : 0, s.star || 0]),
    d: drops.slice(0, 120).map(d => [d.kind, r1(d.x), r1(d.y), d.v, d.small ? 1 : 0, r1(d.vy || 0)]),
    l: lasers.map(l => [r1(l.x), r1(l.y), Math.round(l.a * 1000) / 1000, l.w, l.warn > 0 ? 1 : 0]),
    g: R.gates ? R.gates.map(g => [r1(g.x), r1(g.y), g.kind]) : null,
    ev: netEv.splice(0, 80),
  };
  netEv.length = 0;
  netBroadcast(m);
}

// --- 친구(참가자) ---
async function joinRoom(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { coopMsg = '방 코드는 5글자예요.'; renderHangar(); return; }
  leaveRoom(); coopMsg = '';
  try { await loadPeer(); } catch (e) { coopMsg = e.message; renderHangar(); return; }
  const peer = new window.Peer();
  net = { mode: 'guest', peer, code, status: '방을 찾는 중…', inT: 0, roster: [] };
  renderHangar();
  peer.on('open', id => {
    if (!net || net.peer !== peer) return;
    net.myId = id;
    const c = peer.connect(PEER_PFX + code, { reliable: true });
    net.conn = c;
    c.on('open', () => { const s = buildStats(); c.send({ t: 'hi', name: myNick(), card: { frame: S.frame, weapon: S.weapon, dmg: s.dmg, rate: s.rate, speed: s.speed, hit: s.hit, maxHp: s.maxHp } }); });
    c.on('data', guestData);
    c.on('close', () => { if (net && net.conn === c) netFail('방장과 연결이 끊겼어요.'); });
  });
  peer.on('error', e => { if (net && net.peer === peer) netFail(e.type === 'peer-unavailable' ? '그 코드의 방이 없어요. 코드를 다시 확인해 주세요.' : `연결 오류(${e.type}). 잠시 뒤 다시 해 보세요.`); });
}
function guestData(m) {
  if (!net || net.mode !== 'guest' || !m) return;
  if (m.t === 'welcome') { net.status = '방장이 출격을 누르면 함께 시작해요'; net.roster = m.roster || []; A.sfx('part'); if (state === 'hangar') renderHangar(); }
  else if (m.t === 'roster') { net.roster = m.roster || []; if (state === 'hangar') renderHangar(); }
  else if (m.t === 'full') netFail(m.why);
  else if (m.t === 'closed') netFail('방장이 방을 닫았어요.');
  else if (m.t === 'start') guestStart(m);
  else if (m.t === 's') applySnap(m);
  else if (m.t === 'end') guestEnd(m);
}
function guestStart(m) {
  for (const id of ['away', 'howto']) $(id).classList.add('hidden');
  startRun(m.stage, m.mode === 'endless' ? 'endless' : 'stage');
  run.coop = true; run.rushDone = true; run.gateAt = 0; run.treasureAt = 0; run.spawnT = 1e9;
  allies.length = 0;
  net.roster = m.roster || net.roster;
}
function applySnap(m) {
  if (!run || !net || net.mode !== 'guest' || state === 'result' || state === 'hangar') return;
  const themeWas = run.theme;
  Object.assign(run, m.r);
  if (run.waveDur < 0) run.waveDur = Infinity;
  run.m.speed = m.r.msp || 1;
  if (run.theme !== themeWas) skyTheme = -1;
  if (m.bn) run.banner = Object.assign({ t: 0 }, m.bn);
  run.cardWait = m.cw;
  flash = Math.max(flash, m.fl || 0); shake = Math.max(shake, m.sk || 0);
  const old = new Map(allies.map(a => [a.id, a]));
  allies.length = 0;
  for (const s of m.p) {
    if (s[0] === net.myId) {
      if (s[4] < P.hp - 0.5) { run.hurtT = 0.6; A.sfx('hurt'); buzz(70); shake = Math.max(shake, 0.4); spark(P.x, P.y, 14, '#ff6b6b', 240, 0.45, 3); }
      if (s[6] > 0 && !(P.down > 0)) { explode(P.x, P.y, 60, st.F.color); A.sfx('boomL'); buzz([100, 50, 200]); }
      P.hp = s[4]; P.maxHp = s[5]; P.down = s[6]; P.inv = s[7] ? 0.2 : 0; P.ult = s[8];
      continue;
    }
    const o = old.get(s[0]);
    allies.push({ id: s[0], x: o ? o.x : s[1], y: o ? o.y : s[2], nx: s[1], ny: s[2], bank: s[3], hp: s[4], maxHp: s[5], down: s[6], inv: s[7], ult: s[8], frame: s[9], name: s[10], color: s[11] });
  }
  const fo = new Map(foes.map(e => [e.nid, e]));
  foes = m.f.map(f => { const o = fo.get(f[0]); return { nid: f[0], type: f[1], x: o ? o.x : f[2], y: o ? o.y : f[3], nx: f[2], ny: f[3], hp: f[4], maxHp: f[5], flash: f[6] ? 0.05 : 0, mod: f[7] || undefined, sh: f[8], t: f[9], mode: f[10] || undefined, vx: f[11], vy: f[12], elite: !!f[13], r: f[14] }; });
  if (m.b) {
    const def = D.BOSSES.find(b => b.id === m.b.id) || D.BOSSES[0], op = boss && boss.def === def ? boss.parts : [];
    boss = { def, t: m.b.t, p2: !!m.b.p2, inhale: m.b.inhale, enraged: !!m.b.enraged, mirror: m.b.mirror, spin: m.b.spin,
      parts: m.b.parts.map((p, i) => ({ x: op[i] ? op[i].x : p[0], y: op[i] ? op[i].y : p[1], nx: p[0], ny: p[1], r: p[2], hp: p[3], maxHp: p[4], dead: !!p[5], flash: p[6] ? 0.05 : 0, dx: p[7] })) };
  } else boss = null;
  ebul = m.e.map(b => { const o = { x: b[0], y: b[1], vx: b[2], vy: b[3], r: b[4], color: b[5] }; if (b[6]) { o.net = true; o.spin = T * 4; } if (b[7] >= 0) o.mine = b[7]; return o; });
  shots = m.s.map(s => ({ x: s[0], y: s[1], vx: s[2], vy: s[3], r: s[4], color: s[5], long: !!s[6], homing: !!s[7], star: s[8] || 0, t: 0 }));
  drops = m.d.map(d => ({ kind: d[0], x: d[1], y: d[2], v: d[3], small: !!d[4], vy: d[5] }));
  lasers = m.l.map(l => ({ x: l[0], y: l[1], a: l[2], w: l[3], warn: l[4] ? 1 : 0, dur: 1 }));
  run.gates = m.g ? m.g.map(g => ({ x: g[0], y: g[1], kind: g[2] })) : null;
  for (const ev of m.ev || []) {
    if (ev[0] === 'x') explode(ev[1], ev[2], ev[3], ev[4]);
    else if (ev[0] === 'r') ringFx(ev[1], ev[2], ev[3], ev[4]);
    else if (ev[0] === 's') say(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6]);
    else if (ev[0] === 'a') rawSfx(ev[1]);
    else if (ev[0] === 'm') rawMusic(ev[1], ev[2]);
  }
}
function guestTick(dt) {
  bgY += dt * 45; nearY += dt * 120;
  if (run.banner) { run.banner.t += dt; if (run.banner.t > run.banner.life) run.banner = null; }
  if (run.hurtT > 0) run.hurtT -= dt;
  if (!(P.down > 0)) {
    const ks = 420 * st.speed * run.m.speed;
    if (keys.ArrowLeft || keys.a) P.tx -= ks * dt;
    if (keys.ArrowRight || keys.d) P.tx += ks * dt;
    if (keys.ArrowUp || keys.w) P.ty -= ks * dt;
    if (keys.ArrowDown || keys.s) P.ty += ks * dt;
    P.tx = clamp(P.tx, 22, W - 22); P.ty = clamp(P.ty, 90, H - 70);
    const mv = 900 * st.speed * run.m.speed * dt, dx = P.tx - P.x, dy = P.ty - P.y, dl = Math.hypot(dx, dy);
    if (dl > mv) { P.x += dx / dl * mv; P.y += dy / dl * mv; } else { P.x = P.tx; P.y = P.ty; }
  }
  P.bank += (clamp((P.x - P.lx) / Math.max(dt, 0.001) / 600, -1, 1) - P.bank) * Math.min(1, dt * 10); P.lx = P.x;
  P.ga += dt * 3;
  const k = Math.min(1, dt * 14);
  for (const a of allies) { a.x += (a.nx - a.x) * k; a.y += (a.ny - a.y) * k; }
  for (const e of foes) { e.x += (e.nx - e.x) * k; e.y += (e.ny - e.y) * k; e.t += dt; if (e.flash > 0) e.flash -= dt; }
  if (boss) { boss.t += dt; for (const p of boss.parts) { p.x += (p.nx - p.x) * k; p.y += (p.ny - p.y) * k; if (p.flash > 0) p.flash -= dt; } }
  for (const s of shots) { s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt; }
  for (const b of ebul) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.net) b.spin += dt * 4; }
  for (const d of drops) d.y += d.vy * dt;
  if (run.gates) for (const g of run.gates) g.y += 85 * dt;
  tickFx(dt);
  if ((net.inT -= dt) <= 0 && net.conn && net.conn.open) { net.inT = 0.05; net.conn.send({ t: 'in', x: r1(P.x), y: r1(P.y) }); }
}
function guestEnd(m) {
  if (!run || state === 'result') return;
  state = 'result'; $('hud').classList.add('hidden'); $('pause').classList.add('hidden');
  const mine = (m.parts.find(p => p[0] === net.myId) || [0, 0])[1];
  for (let i = 0; i < mine; i++) grantPart();
  S.scrap += m.scrap; S.coop = (S.coop || 0) + 1;
  const pxp = Math.round(m.score / 60 + m.kills + (m.win ? 40 : 0)), up = gainPilotXp(pxp);
  save(); rawSfx(m.win ? 'clear' : 'fail'); rawMusic('hangar', 0);
  $('rTitle').innerHTML = m.mode === 'endless' ? `<small>함께 · 무한 생존</small>WAVE ${m.wave}` : `<small>함께 · STAGE ${m.stage}</small>${m.win ? '클리어!' : '모두 격추'}`;
  $('rTitle').className = m.win ? 'win' : 'lose';
  $('rStars').innerHTML = '';
  $('rStats').innerHTML = [`<div class="big">${m.score.toLocaleString()}<small>점(팀)</small></div>`, `<div>팀 처치 <b>${m.kills}</b></div>`,
    `<div>받은 고철 🔩 <b>${m.scrap}</b> (팀이 모은 만큼 모두 받아요)</div>`, run.partsGot.length ? `<div class="gold">새 부품: ${run.partsGot.join(', ')}</div>` : '',
    `<div>조종사 경험치 +${pxp} · Lv ${S.pilot.lv} ${rankName(S.pilot.lv)}${up.ups ? ` <b class="gold">승급! 🔩+${up.reward}</b>` : ''}</div>`,
    '<div class="rules">스테이지 별과 랭크는 혼자 할 때 기록됩니다. 방장이 다시 출격하면 자동으로 함께 시작해요.</div>'].filter(Boolean).join('');
  const btns = $('rBtns'); btns.innerHTML = '';
  const b = document.createElement('button'); b.className = 'btn big'; b.textContent = '방에서 기다리기';
  b.addEventListener('click', () => { A.sfx('click'); selMode = 'coop'; showHangar(); }); btns.append(b);
  const b2 = document.createElement('button'); b2.className = 'btn sub'; b2.textContent = '방 나가기';
  b2.addEventListener('click', () => { A.sfx('click'); leaveRoom(); showHangar(); }); btns.append(b2);
  $('copy').dataset.text = `⚡ 볼트윙 친구와 함께 ${m.mode === 'endless' ? 'WAVE ' + m.wave : 'STAGE ' + m.stage + (m.win ? ' 클리어' : '')} · 팀 점수 ${m.score.toLocaleString()}`;
  $('result').classList.remove('hidden');
}

// --- 그리기: 친구 기체 ---
function drawAllies() {
  for (const a of allies) {
    if (a.down > 0) { txt(`${a.name} 복귀 ${Math.ceil(a.down)}초`, clamp(a.x, 80, W - 80), H - 110, 13, '#ff9a9a', 'center', 800); continue; }
    if (a.inv > 0 && Math.floor(T * 20) % 2) continue;
    drawShipAt(ctx, a.frame, a.x, a.y, 0.9, a.bank || 0, T, hasGround());
    ctx.globalAlpha = 0.55; ctx.strokeStyle = a.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y, 32, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    txt(a.name, a.x, a.y + 48, 12, a.color, 'center', 800);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(a.x - 22, a.y + 54, 44, 4);
    ctx.fillStyle = a.hp < a.maxHp * 0.3 ? '#ff5d5d' : '#3fd97a'; ctx.fillRect(a.x - 22, a.y + 54, 44 * clamp(a.hp / a.maxHp, 0, 1), 4);
  }
  if (P && P.down > 0 && run.phase !== 'dead') {
    panel(W / 2 - 150, H * 0.55 - 28, 300, 56, 14);
    txt(`격추! ${Math.ceil(P.down)}초 뒤 복귀`, W / 2, H * 0.55 + 8, 20, '#ff9a9a', 'center', 900);
  }
}

// --- 격납고: 친구와 함께 칸 ---
function coopPanel() {
  const box = document.createElement('div'); box.className = 'coopBox';
  const add = (html, tag = 'div', cls = '') => { const el = document.createElement(tag); if (cls) el.className = cls; el.innerHTML = html; box.append(el); return el; };
  const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'cbtn ' + cls; b.textContent = label; b.addEventListener('click', () => { A.init(); A.sfx('click'); fn(); }); return b; };
  const nameRow = add('<span>내 이름</span>', 'label', 'cRow');
  const ni = document.createElement('input'); ni.maxLength = 8; ni.value = myNick(); ni.disabled = !!net;
  ni.addEventListener('change', () => { S.nick = cleanName(ni.value); ni.value = S.nick; save(); });
  nameRow.append(ni);
  if (!net) {
    const r1b = add('', 'div', 'cRow'); r1b.append(btn('🏠 방 만들기', hostRoom, 'main'));
    const r2b = add('', 'div', 'cRow');
    const ci = document.createElement('input'); ci.placeholder = '방 코드 5글자'; ci.maxLength = 5; ci.value = joinCode; ci.className = 'code';
    ci.addEventListener('input', () => { joinCode = ci.value.toUpperCase(); });
    r2b.append(ci, btn('들어가기', () => joinRoom(ci.value)));
    add('같은 와이파이가 아니어도 됩니다. 방장이 만든 <b>코드</b>를 넣거나, 방장이 보낸 <b>초대 링크</b>를 누르세요. 최대 3명.', 'div', 'cNote');
  } else if (net.mode === 'host') {
    add(`<small>방 코드</small><b>${net.code}</b>`, 'div', 'cCode');
    const r = add('', 'div', 'cRow');
    r.append(btn('🔗 초대 링크 복사', async () => {
      const link = `${location.origin}${location.pathname}?room=${net.code}`;
      try { await navigator.clipboard.writeText(link); coopMsg = '초대 링크를 복사했어요. 카톡에 붙여 넣으세요!'; } catch (e) { window.prompt('이 링크를 친구에게 보내세요', link); }
      renderHangar();
    }), btn('방 닫기', () => { leaveRoom(); coopMsg = ''; renderHangar(); }, 'off'));
    const mr = add('', 'div', 'cRow');
    mr.append(btn(coopMd === 'stage' ? '✅ 스테이지' : '스테이지', () => { coopMd = 'stage'; renderHangar(); }), btn(coopMd === 'endless' ? '✅ 무한 생존' : '무한 생존', () => { coopMd = 'endless'; renderHangar(); }));
    add(`👥 ${roster().map(p => esc(p.name) + (p.host ? '(방장)' : '')).join(' · ')}`, 'div', 'cList');
    add(`${esc(net.status)}${allies.length ? ` — 준비되면 <b>함께 출격</b>을 누르세요. ${coopMd === 'stage' ? `스테이지 ${hangarStage}로 갑니다(아래 지도에서 바꾸기).` : ''}` : ''}`, 'div', 'cNote');
  } else {
    add(`<small>들어간 방</small><b>${net.code}</b>`, 'div', 'cCode');
    add(`👥 ${(net.roster || []).map(p => esc(p.name) + (p.host ? '(방장)' : '')).join(' · ') || '…'}`, 'div', 'cList');
    add(esc(net.status), 'div', 'cNote');
    const r = add('', 'div', 'cRow'); r.append(btn('방 나가기', () => { leaveRoom(); coopMsg = ''; renderHangar(); }, 'off'));
  }
  if (coopMsg) add(esc(coopMsg), 'div', 'cMsg');
  add('함께 하면: 레벨 업 카드는 방장이 고르고 모두에게 적용 · 격추되면 6초 뒤 복귀(모두 격추되면 끝) · 고철은 팀이 모은 만큼 모두 받음 · 리듬 결투는 쉼', 'div', 'cNote');
  return box;
}

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
Rank.init({ S, save, sfx: n => A.sfx(n), ver: VERSION });
renderHangar();
if (joinCode && selMode === 'coop') joinRoom(joinCode);
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
  if (state === 'duel') { Duel.update(dt); tickFx(dt); }
  else if (state === 'play') {
    if (net && net.mode === 'guest') guestTick(dt); else update(dt);
    Q.acc += dt; Q.n++;
    if (Q.n >= 120) { if (!Q.low && Q.acc / Q.n > 0.024) Q.low = true; Q.acc = 0; Q.n = 0; }   // 평균 40프레임 아래면 효과를 줄인다
  } else if (state === 'hangar') { bgY += dt * 30; nearY += dt * 70; tickFx(dt); }
  if (net) netTick(dt); else netEv.length = 0;
  draw();
  requestAnimationFrame(loop);
}
SKY.start = startRun; SKY.ult = () => { P.ult = 100; useUlt(); }; SKY.tap = onTap; SKY.trap = () => catchInNet();
requestAnimationFrame(loop);
})();
