// 로봇 포격전 (가칭) — 게임 본체
// 혼자 하기(solo), 방장(host), 참가자(client) 세 가지로 돈다.
// 방장만 실제로 계산하고, 참가자는 방장이 보내 주는 상태를 그리기만 한다(js/net.js가 주고받는다).
(() => {
'use strict';

const W = 960, H = 540;            // 화면 크기
const WW = 2400;                   // 맵 너비(화면의 2.5배. 밀어서 둘러본다)
const VOID = 5000;                 // 땅이 없는 자리(구름 사이)
const GRAVITY = 520;
const WIND_K = 14;                 // 바람 1당 가로 가속도
const MAX_POWER = 860, MAX_DRAG = 140;
const AIM_TIME = 25;               // 팀 동시 조준 시간(초)
const WALK_SPEED = 55;
const MAX_CLIMB = 2.2;             // 1픽셀 가는 동안 오를 수 있는 높이
const ENERGY_MAX = 100;
const CRATE_MAX = 5, CRATE_FALL = 110;
const GRAB_R = 120;                // 내 로봇에서 이 거리 안을 눌러야 조준이 된다(그 밖은 화면 밀기)
const HIT_PAUSE = 1.8;             // 포탄이 터진 뒤 결과를 보여 주며 멈춰 있는 시간(초)
const NEXT_PAUSE = 0.6;            // 다음에 쏠 로봇을 비춰 주는 시간(초)
const FLOAT_LIFE = 2.2;            // 피해 숫자가 떠 있는 시간(초)
const KNOCK = 150;                 // 폭발에 밀려나는 세기
const SPECIAL_CHANCE = 0.05;       // 랜덤으로 골랐을 때 특수 로봇이 나올 확률

const SHELLS = {
  basic:  { name: '포탄', icon: '💥', tip: '세게 한 방', dmg: 35, blast: 42, crater: 34, color: '#ffd166' },
  triple: { name: '세 갈래탄', icon: '🔱', tip: '세 발이 퍼짐', dmg: 16, blast: 30, crater: 20, color: '#ffb86b', multi: 3 },
  water:  { name: '물탄', icon: '💧', tip: '적시고 밀어냄', dmg: 12, blast: 58, crater: 12, color: '#5bc0ff', wet: true, push: 1.7 },
  heal:   { name: '수리탄', icon: '💚', tip: '우리 편 회복', dmg: 0, blast: 60, crater: 0, color: '#6ee37a', heal: 25 },
  volt:   { name: '전기탄', icon: '⚡', tip: '젖은 적 2배', dmg: 22, blast: 36, crater: 18, color: '#f5f55a', volt: true },
  split:  { name: '분열탄', icon: '✳️', tip: '꼭대기에서 셋으로', dmg: 19, blast: 32, crater: 22, color: '#ffe98a', split: true },
  shard:  { name: '분열 조각', dmg: 19, blast: 32, crater: 22, color: '#ffe98a' },
  drill:  { name: '굴착탄', icon: '⛏️', tip: '땅을 크게 팜', dmg: 24, blast: 48, crater: 60, color: '#d9a066', push: 0.5 },
  mound:  { name: '흙탄', icon: '⛰️', tip: '언덕을 쌓음', dmg: 8, blast: 30, crater: 0, color: '#b08a5a', mound: 46, push: 0.3 },
  homing: { name: '유도 미사일', icon: '🚀', tip: '적을 쫓아감', dmg: 32, blast: 40, crater: 28, color: '#ff7ad9', homing: true },
  heavy:  { name: '중포탄', icon: '☄️', tip: '크고 강함', dmg: 48, blast: 52, crater: 42, color: '#ff8a5e', push: 1.5 },
  warp:   { name: '자리 이동탄', dmg: 0, blast: 26, crater: 0, color: '#7fe0c0' },
  ult:    { name: '유성 신호탄', dmg: 8, blast: 24, crater: 10, color: '#c58bff' },   // 떨어진 자리에 유성 5발을 부른다
  meteor: { name: '유성', dmg: 24, blast: 40, crater: 26, color: '#ff9a5e' },
};
const ULTS = {
  meteor:  { name: '유성 폭격', tip: '겨눈 곳에 유성 5발' },
  rain:    { name: '폭우', tip: '적 모두를 적심' },
  thunder: { name: '낙뢰', tip: '적 모두에게 번개' },
  quake:   { name: '지진', tip: '적 발밑을 무너뜨림' },
  swarm:   { name: '미사일 떼', tip: '유도 미사일 5발' },
};
// 로봇 종류. p = 1차 공격, s = 2차 공격. 나중에 "조립"이 들어오면 이 표가 부품 조합으로 바뀐다.
// art: w = 게임 속 너비, mx·my = 그림에서 포신 받침의 자리(0~1), bs = 포신 크기, front = 포신을 몸 앞에 그림,
//      hit = 맞는 범위(원 여러 개: 가로 치우침, 발에서 높이, 반지름), mid = 몸 가운데 높이, rad = 고리 크기, tall = 키
const MODELS = [
  { id: 'cannon', name: '캐논', desc: '고루 갖춘 포격형', p: 'basic', s: 'triple', ult: 'meteor', hp: 100, fuel: 60, mass: 1,
    art: { w: 68, mx: 0.458, my: 0.09, bs: 1.6, hit: [[0, 22, 22], [-19, 15, 14], [19, 15, 14]], mid: 22, rad: 40, tall: 48 } },
  { id: 'shower', name: '소나기', desc: '적시고 고치는 지원형', p: 'water', s: 'heal', ult: 'rain', hp: 100, fuel: 70, mass: 1,
    art: { w: 48, mx: 0.5, my: 0.07, bs: 1.3, hit: [[0, 34, 23], [0, 10, 12]], mid: 32, rad: 38, tall: 62 } },
  { id: 'spark', name: '스파크', desc: '젖은 적에게 강한 전기형', p: 'volt', s: 'split', ult: 'thunder', hp: 90, fuel: 80, mass: 1.3,
    art: { w: 22, mx: 0.62, my: 0.427, bs: 1.0, front: true, hit: [[0, 13, 12], [1, 38, 9], [2, 58, 11]], mid: 38, rad: 42, tall: 76 } },
  { id: 'mole', name: '두더지', desc: '땅을 파고 쌓는 중장갑', p: 'drill', s: 'mound', ult: 'quake', hp: 125, fuel: 40, mass: 0.5,
    art: { w: 96, mx: 0.371, my: 0.127, bs: 1.5, hit: [[-32, 13, 13], [-8, 15, 15], [16, 15, 15], [36, 13, 12]], mid: 16, rad: 52, tall: 34 } },
  { id: 'hunter', name: '추적자', desc: '★ 특수 로봇', p: 'homing', s: 'heavy', ult: 'swarm', hp: 130, fuel: 60, mass: 1, special: true, hover: true,
    art: { w: 74, mx: 0.47, my: 0.12, bs: 1.4, hit: [[0, 33, 17], [-22, 31, 12], [20, 31, 12]], mid: 32, rad: 44, tall: 56 } },
];
const ITEMS = {
  double: { name: '더블탄', icon: '✌️' },   // 같은 공격을 두 번(한 번당 75%)
  power:  { name: '강화탄', icon: '🔺' },   // 피해 1.6배, 폭발 1.3배
  shield: { name: '쉴드', icon: '🛡️' },     // 다음 내 차례까지 피해 40 막기
  repair: { name: '수리', icon: '🔧' },     // 체력 30 회복
  warp:   { name: '이동탄', icon: '🌀' },   // 이번 턴 공격이 자리 이동탄이 된다
};
// 맵. gravity = 중력 배수, windMax = 바람 최대, windStep = 턴마다 바뀌는 폭, knock = 밀려나는 배수, void = 땅이 뚫리고 떨어지면 끝
const MAPS = [
  { id: 'factory', name: '공장 지대', icon: '🏭', desc: '기본 전장', gravity: 1, windMax: 8, windStep: 4, knock: 1, bg: 'bg', tex: 'ground',
    land: { a: '#7d8f93', b: '#4b5a63', edge: '#1d2a2e', line: '#6fd6a8', shine: 'rgba(200,255,225,.55)' } },
  { id: 'cloud', name: '구름 위', icon: '☁️', desc: '떨어지면 끝! 구름이 뚫려요', gravity: 1, windMax: 10, windStep: 5, knock: 2.2, void: true, bg: 'bg-cloud', tex: 'ground-cloud',
    land: { a: '#ffffff', b: '#b7cde6', edge: '#7f9cc0', line: '#ffffff', shine: 'rgba(255,255,255,.9)' } },
  { id: 'moon', name: '달 기지', icon: '🌙', desc: '중력이 약하고 바람이 없어요', gravity: 0.55, windMax: 0, windStep: 0, knock: 1.5, bg: 'bg-moon', tex: 'ground-moon',
    land: { a: '#b9bcc6', b: '#62656f', edge: '#2a2c33', line: '#e6e8ee', shine: 'rgba(255,255,255,.5)' } },
  { id: 'desert', name: '모래 폭풍', icon: '🏜️', desc: '바람이 세고 자주 바뀌어요', gravity: 1, windMax: 14, windStep: 9, knock: 1, bg: 'bg-desert', tex: 'ground-desert',
    land: { a: '#e6b56a', b: '#9c6a36', edge: '#5a3516', line: '#ffe2a0', shine: 'rgba(255,240,200,.6)' } },
];
const TEAMS = [
  { name: '푸른 팀', color: '#4aa3ff', light: '#9fd0ff', dark: '#1f5fae' },
  { name: '붉은 팀', color: '#ff6b5e', light: '#ffb0a6', dark: '#a8322a' },
];
const BOT_NAMES = [['볼트', '너트', '태엽'], ['기어', '렌치', '피스톤']];
const CHEERS = ['간다!', '받아라!', '조준 완료!', '이번엔 맞는다!'];

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
const groundAt = x => ground[clamp(Math.round(x), 0, WW)];
const rot = (a, ang) => ({ vx: a.vx * Math.cos(ang) - a.vy * Math.sin(ang), vy: a.vx * Math.sin(ang) + a.vy * Math.cos(ang) });
const dirOf = r => (r.team === 0 ? 1 : -1);
const midY = r => r.y - r.model.art.mid;

let MAP = MAPS[0];
let ground, bot, robots = [], queue = [], projs = [], crates = [], fx = [], floats = [], parts = [];
let wind = 0, phase = 'menu', turnTeam = 0, turnNo = 0, timer = 0, thinkT = 0, pauseT = 0, T = 0, shake = 0;
let drag = null, winner = null, teamSize = 1, moveDir = 0, lastCfg = null, pickMap = 'random', nextId = 1;
let cam = { x: 0, z: 1, tx: 0, manual: false }, overview = false;
let rockPattern = null, patternFor = '';
let pending = null, holdX = null;   // 곧 쏠 로봇, 방금 터진 자리(카메라가 머문다)

// 온라인: mode = solo | host | client, myId = 내 번호표, net = js/net.js가 넣어 주는 통로
let mode = 'solo', myId = 'me', net = null, events = [], frameNo = 0, readyTn = -1, aimSentAt = 0;
const emit = e => { if (mode === 'host') events.push(e); };

const me = () => robots.find(r => r.ctrl === myId);
const iCanAct = () => { const m = me(); return phase === 'aim' && !!m && m.alive && m.team === turnTeam && !m.ready; };

// ---------- 그림 파일(있으면 쓰고, 없으면 코드로 그린 그림) ----------
const IMG = {};
function loadImg(key) {
  const exts = ['png', 'webp', 'jpg'];
  const tryNext = i => {
    if (i >= exts.length) return;
    const im = new Image();
    im.onload = () => {
      IMG[key] = im;
      rockPattern = null;
      if (!$('pick').classList.contains('hidden')) buildPick();   // 고르기 화면이 떠 있으면 그림으로 다시 그린다
    };
    im.onerror = () => tryNext(i + 1);
    im.src = `assets/${key}.${exts[i]}`;
  };
  tryNext(0);
}
['crate', ...MAPS.flatMap(m => [m.bg, m.tex]), ...MODELS.map(m => 'robot-' + m.id)].forEach(loadImg);

// ---------- 맵 만들기 ----------
function makeTerrain() {
  ground = new Float32Array(WW + 1);
  bot = new Float32Array(WW + 1).fill(9999);
  const ph = [0, 1, 2, 3].map(() => rnd(0, 6.28));
  const wave = (x, a, b, c, d) => a * Math.sin(x * 0.0045 + ph[0]) + b * Math.sin(x * 0.011 + ph[1]) + c * Math.sin(x * 0.027 + ph[2]) + d * Math.sin(x * 0.06 + ph[3]);
  if (MAP.id === 'cloud') {
    // 구름 섬 여러 개. 섬 사이는 뚫려 있고, 섬은 가장자리로 갈수록 얇다.
    ground.fill(VOID); bot.fill(VOID);
    for (let x = 40; x < WW - 200;) {
      const w = Math.min(rnd(300, 470), WW - 40 - x), base = rnd(250, 390);
      for (let i = 0; i <= w; i++) {
        const u = i / w, xx = Math.round(x + i);
        ground[xx] = base + wave(xx, 0, 16, 8, 3) + 18 * Math.pow(Math.abs(u - 0.5) * 2, 3);
        bot[xx] = ground[xx] + 34 + 80 * Math.pow(Math.sin(Math.PI * u), 0.6);
      }
      x += w + rnd(60, 100);
    }
  } else if (MAP.id === 'moon') {
    for (let x = 0; x <= WW; x++) ground[x] = 320 + wave(x, 35, 14, 5, 3);
    for (let i = 0; i < 9; i++) {   // 운석 구덩이
      const c = rnd(100, WW - 100), R = rnd(55, 130), depth = R * rnd(0.3, 0.5);
      for (let x = Math.max(0, Math.ceil(c - R * 1.25)); x <= Math.min(WW, c + R * 1.25); x++) {
        const d = Math.abs(x - c) / R;
        ground[x] += d < 1 ? depth * (1 - d * d) - 8 : -8 * (1 - (d - 1) / 0.25);
      }
    }
    for (let x = 0; x <= WW; x++) ground[x] = clamp(ground[x], 170, 430);
  } else if (MAP.id === 'desert') {
    const mesas = [rnd(500, 900), rnd(1500, 1900)];
    for (let x = 0; x <= WW; x++) {
      let y = 335 + wave(x, 55, 28, 0, 0) + 4 * Math.sin(x * 0.09);
      for (const m of mesas) { const d = Math.abs(x - m); if (d < 150) y -= 75 * clamp((150 - d) / 40, 0, 1); }   // 평평한 바위 언덕
      ground[x] = clamp(y, 170, 430);
    }
  } else {
    for (let x = 0; x <= WW; x++) ground[x] = clamp(315 + wave(x, 60, 45, 22, 8), 170, 430);
  }
}

function solidSpot(x) {
  const ok = c => { for (let d = -30; d <= 30; d += 6) if (groundAt(c + d) >= VOID) return false; return true; };
  for (let d = 0; d < 700; d += 4) { if (ok(x + d)) return x + d; if (ok(x - d)) return x - d; }
  return x;
}

function rollModel() {
  if (Math.random() < SPECIAL_CHANCE) return MODELS.find(m => m.special);
  const normal = MODELS.filter(m => !m.special);
  return normal[(Math.random() * normal.length) | 0];
}

function makeRobot(team, i, model, name, ctrl) {
  const dir = team === 0 ? 1 : -1;
  return { team, i, x: 0, y: 0, tx: 0, ty: 0, vx: 0, fall: 0, model, hp: model.hp, maxHp: model.hp, wet: 0, alive: true,
    ctrl: ctrl || null, name, ready: false, skip: false, moveDir: 0,
    slot: 'p', aim: { vx: dir * 320, vy: -320 }, item: null,
    items: { double: 0, power: 0, shield: 0, repair: 0, warp: 1 },   // 나머지는 보급 상자에서 얻는다
    energy: 0, shield: 0, fuel: 0, goal: null, say: '', sayT: 0 };
}

function resetMatchState() {
  queue = []; projs = []; crates = []; fx = []; floats = []; parts = []; events = [];
  winner = null; moveDir = 0; shake = 0; pending = null; holdX = null; drag = null; readyTn = -1;
  for (const id of ['menu', 'pick', 'over', 'lobby']) if ($(id)) $(id).classList.add('hidden');
  $('zoom').classList.remove('hidden'); $('home').classList.remove('hidden');
}

// cfg = { n, mapId, slots: [{ team, i, ctrl, name, pick }] }. 빈자리는 컴퓨터 로봇이 채운다.
function startMatch(cfg) {
  lastCfg = cfg; teamSize = cfg.n;
  MAP = cfg.mapId && cfg.mapId !== 'random' ? MAPS.find(m => m.id === cfg.mapId) : MAPS[(Math.random() * MAPS.length) | 0];
  makeTerrain();
  resetMatchState();
  robots = [];
  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < cfg.n; i++) {
      const s = cfg.slots.find(o => o.team === team && o.i === i);
      const model = s && s.pick && s.pick !== 'random' ? MODELS.find(m => m.id === s.pick) : rollModel();
      const r = makeRobot(team, i, model, s ? s.name : BOT_NAMES[team][i], s ? s.ctrl : null);
      r.x = solidSpot(Math.round(team === 0 ? 480 + i * 150 + rnd(-20, 20) : WW - 480 - i * 150 + rnd(-20, 20)));
      r.y = groundAt(r.x);
      robots.push(r);
    }
  }
  dropCrates(3);
  wind = r1(rnd(-0.6, 0.6) * MAP.windMax);
  turnNo = 0;
  startAim(0);
  const m = me() || robots[0];
  cam.x = cam.tx = clamp(m.x - W / 2, 0, WW - W);
  for (const r of robots) if (r.model.special) say(r, `★ 특수 로봇 ${r.model.name}!`);
  if (mode === 'host' && net) net.matchStarted();
}

function startAim(team) {
  turnTeam = team;
  phase = 'aim';
  turnNo++;
  timer = AIM_TIME;
  thinkT = 1.7;
  cam.manual = false;
  for (const r of robots) {
    r.ready = false; r.skip = false; r.moveDir = 0;
    if (!r.alive || r.team !== team) continue;
    r.shield = 0;                       // 쉴드는 내 다음 차례가 오면 사라진다
    r.fuel = r.model.fuel;
    r.energy = Math.min(ENERGY_MAX, r.energy + 8);
    r.item = null;
    if (r.slot === 'ult' && r.energy < ENERGY_MAX) r.slot = 'p';
    // 컴퓨터 로봇: 걸어서 닿는 상자가 있으면 주우러 가고, 아니면 가끔 자리를 조금 옮긴다
    const near = crates.find(c => Math.abs(c.x - r.x) < r.fuel + 16);
    r.goal = r.ctrl ? null : near ? near.x : Math.random() < 0.6 ? r.x + (Math.random() < 0.5 ? -1 : 1) * rnd(15, 40) : null;
  }
  emit(['t', Array.from(ground, Math.round), MAP.void ? Array.from(bot, Math.round) : null]);   // 턴마다 땅 모양을 다시 맞춘다
  updateBar();
}

function updateBar() {
  const on = iCanAct();
  $('bar').classList.toggle('hidden', !on);
  $('items').classList.toggle('hidden', !on);
  const m = me();
  if (!m) return;
  document.querySelectorAll('#bar .shell').forEach(b => {
    const slot = b.dataset.slot;
    b.classList.toggle('on', slot === m.slot);
    if (slot === 'ult') {
      const full = m.energy >= ENERGY_MAX;
      b.disabled = !full;
      b.innerHTML = `🌠 ${ULTS[m.model.ult].name}<small>${full ? ULTS[m.model.ult].tip : '에너지 ' + Math.floor(m.energy) + '%'}</small>`;
    } else {
      const sh = SHELLS[m.model[slot]];
      b.innerHTML = `${sh.icon} ${sh.name}<small>${slot === 'p' ? '1차' : '2차'} · ${sh.tip}</small>`;
    }
  });
  document.querySelectorAll('#items button').forEach(b => {
    const k = b.dataset.item;
    b.classList.toggle('on', m.item === k);
    b.disabled = m.items[k] <= 0;
    b.querySelector('i').textContent = '×' + m.items[k];
  });
}

// ---------- 걷기 ----------
function walk(r, dir, dist) {
  dist = Math.min(dist, r.fuel);
  if (dist <= 0) return false;
  const nx = r.x + dir * dist;
  if (nx < 14 || nx > WW - 14) return false;
  if (groundAt(nx) >= VOID || groundAt(nx + dir * 6) >= VOID) return false;   // 낭떠러지로는 걸어가지 않는다
  const rise = groundAt(r.x) - groundAt(nx);
  if (rise > MAX_CLIMB * Math.max(1, Math.abs(Math.round(nx) - Math.round(r.x)))) return false;
  for (const o of robots) {
    const gap = (r.model.art.w + o.model.art.w) * 0.42;
    if (o !== r && o.alive && Math.abs(o.x - nx) < gap && Math.abs(o.x - nx) < Math.abs(o.x - r.x)) return false;
  }
  r.x = nx; r.fuel -= dist;
  if (Math.random() < 0.25) spark(r.x - dir * 12, r.y - 2, 1, '#9aa6ae', 'smoke');
  return true;
}

// ---------- 보급 상자 ----------
// 턴이 끝날 때마다 하늘에서 떨어진다. 걸어가서 닿거나 포탄으로 맞히면 얻는다. 내용물은 상자에 보인다.
function dropCrates(n) {
  const kinds = Object.keys(ITEMS);
  for (let i = 0; i < n && crates.length < CRATE_MAX; i++) {
    crates.push({ id: nextId++, x: solidSpot(Math.round(rnd(200, WW - 200))), y: -30 - i * 60, item: kinds[(Math.random() * kinds.length) | 0], landed: false });
  }
}

function takeCrate(c, r) {
  crates = crates.filter(o => o !== c);
  if (!r || !r.alive) return;
  r.items[c.item]++;
  addFloat(r.x, r.y - r.model.art.tall - 22, '+ ' + ITEMS[c.item].icon + ' ' + ITEMS[c.item].name, '#ffe98a');
  if (r.ctrl === myId) updateBar();
}

function updateCrates(dt) {
  for (const c of crates.slice()) {
    const gy = groundAt(c.x);
    if (c.y < gy) { c.y = Math.min(gy, c.y + CRATE_FALL * dt); c.landed = c.y >= gy; } else { c.y = gy; c.landed = true; }
    if (c.y > H + 100) { crates = crates.filter(o => o !== c); continue; }   // 구름 사이로 빠진 상자
    const r = robots.find(o => o.alive && Math.abs(o.x - c.x) < o.model.art.w / 2 + 8 && Math.abs(o.y - c.y) < o.model.art.tall);
    if (r) takeCrate(c, r);
  }
}

// ---------- 로봇 모양에서 나오는 값 ----------
// 포신이 달린 자리(로봇이 선 점 기준)
function pivotOf(model, team) {
  const im = IMG['robot-' + model.id], a = model.art;
  if (!im) return { x: 0, y: -17, len: 26 };
  const h = a.w * im.height / im.width;
  return { x: (team === 0 ? 1 : -1) * (a.mx - 0.5) * a.w, y: -h + a.my * h - (model.hover ? 2 : 0), len: 26 * a.bs };
}
// 점 (x, y)에서 로봇 몸까지의 거리. 0보다 작으면 몸 안이다.
function gapTo(r, x, y) {
  let m = Infinity; const d = dirOf(r);
  for (const c of r.model.art.hit) m = Math.min(m, Math.hypot(x - (r.x + d * c[0]), y - (r.y - c[1])) - c[2]);
  return m;
}

// ---------- 포탄 ----------
function makeProj(r, vx, vy, shell, opt) {
  const len = Math.hypot(vx, vy) || 1, pv = pivotOf(r.model, r.team);
  return Object.assign({ id: nextId++, x: r.x + pv.x + vx / len * pv.len, y: r.y + pv.y + vy / len * pv.len, vx, vy, shell, owner: r, t: 0, trail: [], delay: 0, dm: 1, sm: 1 }, opt);
}

function nearestFoe(p) {
  let best = null, bd = Infinity;
  for (const r of robots) {
    if (!r.alive || r.team === p.owner.team) continue;
    const d = Math.hypot(r.x - p.x, midY(r) - p.y);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

function stepProj(p, dt) {
  const sh = SHELLS[p.shell];
  const tg = sh.homing && p.t > 0.3 && p.t < 4.5 ? nearestFoe(p) : null;
  if (tg) {
    // 유도: 속도를 지키면서 적 쪽으로 조금씩 방향을 튼다. 언덕 뒤는 못 넘는다.
    const sp = clamp(Math.hypot(p.vx, p.vy), 340, 520);
    const cur = Math.atan2(p.vy, p.vx);
    let d = Math.atan2(midY(tg) - p.y, tg.x - p.x) - cur;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const a = cur + clamp(d, -2.4 * dt, 2.4 * dt);
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
  } else {
    p.vx += wind * WIND_K * dt;
    p.vy += GRAVITY * MAP.gravity * dt;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.t += dt;
  if (p.x < -80 || p.x > WW + 80 || p.y > H + 50) return 'out';
  if (p.x >= 0 && p.x <= WW) { const xi = p.x | 0; if (p.y >= ground[xi] && p.y <= bot[xi] + 6) return 'hit'; }
  for (const r of robots) {
    if (!r.alive || (r === p.owner && p.t < 0.3)) continue;
    if (gapTo(r, p.x, p.y) < 0) return 'hit';
  }
  for (const c of crates) if (Math.hypot(p.x - c.x, p.y - (c.y - 12)) < 14) return 'hit';
  return null;
}

function simulate(r, vx, vy) {
  const p = makeProj(r, vx, vy, 'basic');
  for (let i = 0; i < 1500; i++) {
    const res = stepProj(p, 1 / 60);
    if (res) return { x: p.x, y: p.y, res };
  }
  return { x: p.x, y: p.y, res: 'out' };
}

function addFloat(x, y, text, color) { floats.push({ x, y, text, color, t: 0 }); emit(['f', Math.round(x), Math.round(y), text, color]); }
function addBolt(x1, y1, x2, y2) { fx.push({ type: 'bolt', x1, y1, x2, y2, t: 0 }); emit(['z', x1 | 0, y1 | 0, x2 | 0, y2 | 0]); }

function hurt(r, amount, color, by) {
  let d = Math.max(1, Math.round(amount));
  const fy = r.y - r.model.art.tall - 8;
  if (r.shield > 0) {
    const a = Math.min(r.shield, d);
    r.shield -= a; d -= a;
    if (d <= 0) { addFloat(r.x, fy, '🛡 막음', '#8fe3ff'); return; }
  }
  r.hp -= d;
  addFloat(r.x + rnd(-8, 8), fy, '-' + d, color || '#fff');
  // 에너지: 적을 맞히면 많이, 맞으면 조금 찬다
  if (by && by.team !== r.team) {
    by.energy = Math.min(ENERGY_MAX, by.energy + d * 0.9);
    r.energy = Math.min(ENERGY_MAX, r.energy + d * 0.4);
  }
  if (r.hp <= 0) {
    r.hp = 0; r.alive = false;
    boom(r.x, midY(r), 50, '#ff9a5e');
  }
}

function dig(cx, cy, rad) {
  emit(['d', r1(cx), r1(cy), rad]);
  for (let x = Math.max(0, Math.ceil(cx - rad)); x <= Math.min(WW, cx + rad); x++) {
    if (ground[x] >= VOID) continue;
    const bottom = cy + Math.sqrt(rad * rad - (x - cx) * (x - cx));
    if (ground[x] >= bottom) continue;
    if (MAP.void) ground[x] = bottom >= bot[x] - 8 ? VOID : bottom;   // 구름은 끝까지 파이면 구멍이 난다
    else ground[x] = Math.min(bottom, H - 90);                        // 아래 버튼 줄에 가리지 않는 깊이까지만 파인다
  }
}

function pile(cx, cy, rad) {
  emit(['p', r1(cx), r1(cy), rad]);
  for (let x = Math.max(0, Math.ceil(cx - rad)); x <= Math.min(WW, cx + rad); x++) {
    const top = Math.max(cy - Math.sqrt(rad * rad - (x - cx) * (x - cx)) * 0.85, 140);
    if (ground[x] >= VOID) { ground[x] = top; bot[x] = cy + 30; }   // 빈 곳을 메우면 새 구름 조각이 된다
    else if (ground[x] > top) ground[x] = top;
  }
}

function explode(p) {
  const sh = SHELLS[p.shell];
  const crater = sh.crater * p.sm, blast = sh.blast * p.sm;
  holdX = p.x;
  if (p.shell === 'warp') {
    boom(p.owner.x, midY(p.owner), blast, sh.color);
    boom(p.x, p.y, blast, sh.color);
    if (p.owner.alive) { p.owner.x = clamp(p.x, 14, WW - 14); p.owner.y = Math.min(groundAt(p.owner.x), p.y); p.owner.vx = 0; }
    return;
  }
  boom(p.x, p.y, blast, sh.color);
  for (const c of crates.slice()) if (Math.hypot(p.x - c.x, p.y - (c.y - 12)) < blast + 12) takeCrate(c, p.owner);

  if (sh.heal) {
    for (const r of robots) {
      if (!r.alive || r.team !== p.owner.team || gapTo(r, p.x, p.y) >= blast) continue;
      const heal = Math.min(Math.round(sh.heal * p.dm), r.maxHp - r.hp);
      r.hp += heal;
      addFloat(r.x, r.y - r.model.art.tall - 8, '+' + heal, '#6ee37a');
    }
    return;
  }
  if (crater > 0) dig(p.x, p.y, crater);
  if (sh.mound) pile(p.x, p.y, sh.mound * p.sm);

  const shocked = [];
  for (const r of robots) {
    if (!r.alive) continue;
    const d = Math.max(0, gapTo(r, p.x, p.y));
    if (d >= blast) continue;
    const near = 1 - d / blast;
    let dmg = sh.dmg * p.dm * (0.35 + 0.65 * near);
    const combo = sh.volt && r.wet > 0;
    if (combo) { dmg *= 2; shocked.push(r); }
    hurt(r, dmg, combo ? '#f5f55a' : '#fff', p.owner);
    if (sh.wet) r.wet = 3;
    // 폭발에 밀려난다(구름 위에서는 더 멀리)
    r.vx += (Math.sign(r.x - p.x) || (Math.random() < 0.5 ? -1 : 1)) * KNOCK * MAP.knock * r.model.mass * (sh.push || 1) * (0.4 + 0.6 * near);
  }
  // 전기는 가까이 있는 젖은 로봇에게 번진다
  for (const s of shocked) {
    for (const r of robots) {
      if (!r.alive || r.wet <= 0 || shocked.includes(r)) continue;
      if (Math.hypot(r.x - s.x, r.y - s.y) < 170) {
        addBolt(s.x, midY(s), r.x, midY(r));
        hurt(r, 12, '#f5f55a', p.owner);
        shocked.push(r);
      }
    }
  }
  // 유성 폭격: 신호탄이 떨어진 자리 위로 유성 5발
  if (p.shell === 'ult') {
    for (let i = 0; i < 5; i++) {
      projs.push({ id: nextId++, x: p.x + (i - 2) * 34 + rnd(-10, 10), y: -20, vx: 0, vy: 380, shell: 'meteor', owner: p.owner,
        t: 1, trail: [], delay: 0.25 + i * 0.18, dm: 1, sm: 1 });
    }
  }
}

function fireShell(r, key, opt) {
  const n = SHELLS[key].multi || 1;
  for (let i = 0; i < n; i++) {
    const a = rot(r.aim, (i - (n - 1) / 2) * 0.075);
    projs.push(makeProj(r, a.vx, a.vy, key, opt));
  }
}

function castUlt(r) {
  const U = r.model.ult;
  const foes = robots.filter(o => o.alive && o.team !== r.team);
  say(r, `🌠 ${ULTS[U].name}!`);
  boom(r.x, midY(r), 40, '#c58bff');
  if (U === 'meteor') { projs.push(makeProj(r, r.aim.vx, r.aim.vy, 'ult')); return; }
  if (U === 'swarm') {
    for (let i = 0; i < 5; i++) {
      const a = rot(r.aim, (i - 2) * 0.07);
      projs.push(makeProj(r, a.vx, a.vy, 'homing', { delay: i * 0.28, dm: 0.6 }));
    }
    return;
  }
  for (const f of foes) {
    if (U === 'rain') {
      emit(['r', f.x | 0, f.y | 0]); rainFx(f.x, f.y);
      f.wet = 3; hurt(f, 12, '#5bc0ff', r);
    } else if (U === 'thunder') {
      addBolt(f.x + rnd(-60, 60), f.y - 460, f.x, midY(f));
      boom(f.x, midY(f), 30, '#f5f55a');
      hurt(f, f.wet > 0 ? 34 : 17, '#f5f55a', r);
    } else if (U === 'quake') {
      dig(f.x, f.y, 30);
      boom(f.x, f.y, 34, '#d9a066');
      hurt(f, 18, '#d9a066', r);
    }
  }
  shake = Math.max(shake, 1.4);
  if (foes.length) holdX = foes.reduce((a, f) => a + f.x, 0) / foes.length;
  pauseT = HIT_PAUSE;
}

function launch(r) {
  if (r.skip) { r.skip = false; r.item = null; say(r, '이번 턴은 쉴게'); pauseT = 0.8; return; }
  if (r.item === 'warp') { projs.push(makeProj(r, r.aim.vx, r.aim.vy, 'warp')); r.item = null; return; }
  if (r.slot === 'ult') {
    r.slot = 'p';
    if (r.energy >= ENERGY_MAX) { r.energy = 0; r.item = null; castUlt(r); return; }
  }
  const key = r.model[r.slot];
  if (r.item === 'double') { fireShell(r, key, { dm: 0.75 }); fireShell(r, key, { dm: 0.75, delay: 0.4 }); }
  else if (r.item === 'power') fireShell(r, key, { dm: 1.6, sm: 1.3 });
  else fireShell(r, key);
  r.item = null;
}

// ---------- 컴퓨터 로봇 ----------
function solveAim(r, target, err) {
  const dir = target.x >= r.x ? 1 : -1;
  let best = null, bestD = Infinity;
  for (let a = 20; a <= 84; a += 4) {
    const rad = a * Math.PI / 180;
    for (let pw = 220; pw <= MAX_POWER; pw += 20) {
      const hit = simulate(r, Math.cos(rad) * pw * dir, -Math.sin(rad) * pw);
      let d = Math.hypot(hit.x - target.x, hit.y - midY(target));
      if (hit.res === 'out') d += 500;
      if (d < bestD) { bestD = d; best = { a, pw }; }
    }
  }
  const rad = (best.a + rnd(-3.5, 3.5) * err) * Math.PI / 180;
  const pw = clamp(best.pw * (1 + rnd(-0.05, 0.05) * err), 150, MAX_POWER);
  return { vx: Math.cos(rad) * pw * dir, vy: -Math.sin(rad) * pw, miss: bestD };
}

function say(r, text) { r.say = text; r.sayT = 2.4; }

// 팀이 함께 쏠 계획을 세운다: 누가 적시면 전기를 가진 로봇이 그 적을 노린다.
function planTeam(team) {
  const mates = robots.filter(r => r.alive && r.team === team);
  const foes = robots.filter(r => r.alive && r.team !== team);
  if (!foes.length) return;
  const willBeWet = new Set(foes.filter(f => f.wet > 0));
  const slotWith = (r, flag) => ['p', 's'].find(s => SHELLS[r.model[s]][flag]);
  mates.forEach(r => {
    if (r.ctrl) {   // 사람이 조종하는 로봇: 물을 쏘는지만 미리 본다
      if (!r.skip && r.slot !== 'ult' && r.item !== 'warp' && SHELLS[r.model[r.slot]].wet) {
        const hit = simulate(r, r.aim.vx, r.aim.vy);
        foes.forEach(f => { if (gapTo(f, hit.x, hit.y) < SHELLS.water.blast) willBeWet.add(f); });
      }
      return;
    }
    const wetFoes = foes.filter(f => willBeWet.has(f));
    const weakest = foes.reduce((a, b) => (b.hp < a.hp ? b : a));
    const hurtMate = mates.filter(a => a !== r && a.hp <= a.maxHp - 30).sort((a, b) => a.hp - b.hp)[0];
    const voltSlot = slotWith(r, 'volt'), healSlot = slotWith(r, 'heal'), wetSlot = slotWith(r, 'wet');
    let target = Math.random() < 0.5 ? weakest : foes[(Math.random() * foes.length) | 0];
    if (r.energy >= ENERGY_MAX) { r.slot = 'ult'; target = weakest; }
    else if (voltSlot && wetFoes.length) { r.slot = voltSlot; target = wetFoes[(Math.random() * wetFoes.length) | 0]; say(r, '⚡ 전기 간다!'); }
    else if (healSlot && hurtMate && Math.random() < 0.7) { r.slot = healSlot; target = hurtMate; say(r, '💚 고쳐 줄게!'); }
    else if (wetSlot && mates.some(a => a !== r && slotWith(a, 'volt')) && Math.random() < 0.75) { r.slot = wetSlot; say(r, '💧 내가 적실게!'); }
    else {
      const attack = ['p', 's'].filter(s => !SHELLS[r.model[s]].heal && !SHELLS[r.model[s]].mound);
      r.slot = attack.length > 1 && Math.random() < 0.35 ? attack[1] : attack[0];
      if (Math.random() < 0.4) say(r, CHEERS[(Math.random() * CHEERS.length) | 0]);
    }
    const foeTarget = target.team !== r.team;
    if (r.slot !== 'ult' && foeTarget && SHELLS[r.model[r.slot]].wet) willBeWet.add(target);
    // 아이템은 한 턴에 하나
    r.item = null;
    if (r.items.repair && r.hp <= r.maxHp * 0.5) r.item = 'repair';
    else if (r.items.shield && r.hp <= r.maxHp * 0.7 && Math.random() < 0.5) r.item = 'shield';
    else if (r.slot !== 'ult' && foeTarget) {
      if (r.items.power && (r.slot === voltSlot || Math.random() < 0.3)) r.item = 'power';
      else if (r.items.double && Math.random() < 0.3) r.item = 'double';
    }
    r.aim = solveAim(r, target, team === 0 ? 0.8 : 1.6);
    // 어디서 쏴도 닿지 않으면 자리 이동탄으로 가까이 간다(땅이 있는 곳에 떨어질 때만)
    if (r.aim.miss > 140 && r.items.warp && foeTarget) {
      const dir = target.x >= r.x ? 1 : -1;
      const land = simulate(r, dir * 420, -420);
      if (land.res === 'hit' && groundAt(land.x) < VOID) { r.item = 'warp'; say(r, '자리 옮긴다!'); r.aim = { vx: dir * 420, vy: -420 }; }
    }
  });
}

// ---------- 조종 입력 ----------
// 사람의 조작은 모두 이 한 곳을 지난다. 방장은 참가자가 보낸 것도 여기로 넣는다.
function applyInput(id, m) {
  const r = robots.find(o => o.ctrl === id);
  if (!r || !r.alive || phase !== 'aim' || r.team !== turnTeam || r.ready) return;
  if (m.t === 'aim') {
    const len = Math.hypot(+m.vx, +m.vy);
    if (len > 1 && isFinite(len)) { const k = Math.min(1, MAX_POWER / len); r.aim = { vx: m.vx * k, vy: m.vy * k }; }
  } else if (m.t === 'slot') { if (['p', 's', 'ult'].includes(m.v)) r.slot = m.v; }
  else if (m.t === 'item') r.item = ITEMS[m.v] && r.items[m.v] > 0 ? m.v : null;
  else if (m.t === 'move') r.moveDir = Math.sign(+m.v) || 0;
  else if (m.t === 'ready') { r.ready = true; r.skip = !!m.skip; r.moveDir = 0; }
  if (id === myId && m.t !== 'aim' && m.t !== 'move') updateBar();
}

function input(m) {
  if (mode === 'client') {
    if (m.t === 'ready') readyTn = turnNo;
    if (m.t !== 'aim' || performance.now() - aimSentAt > 70 || m.last) { net.send(m); if (m.t === 'aim') aimSentAt = performance.now(); }
  }
  applyInput(myId, m);
}

// ---------- 턴 진행 ----------
function confirmAim() {
  if (phase !== 'aim') return;
  planTeam(turnTeam);
  queue = robots.filter(r => r.alive && r.team === turnTeam);
  for (const r of queue) {
    r.goal = null; r.ready = true; r.moveDir = 0;
    // 궁극기에는 더블탄·강화탄이 붙지 않으니 쓰지 않고 남겨 둔다
    if (r.slot === 'ult' && (r.item === 'double' || r.item === 'power')) r.item = null;
    // 턴을 넘기면 쏘는 아이템은 쓰지 않는다(쉴드·수리는 쓸 수 있다)
    if (r.skip && ['double', 'power', 'warp'].includes(r.item)) r.item = null;
    if (!r.item || r.items[r.item] <= 0) { r.item = null; continue; }
    r.items[r.item]--;
    const fy = r.y - r.model.art.tall - 8;
    if (r.item === 'shield') { r.shield = 40; addFloat(r.x, fy, '🛡 쉴드', '#8fe3ff'); r.item = null; }
    else if (r.item === 'repair') {
      const heal = Math.min(30, r.maxHp - r.hp);
      r.hp += heal; addFloat(r.x, fy, '+' + heal, '#6ee37a'); r.item = null;
    }
  }
  phase = 'fire';
  pauseT = 0.7;
  drag = null; moveDir = 0; cam.manual = false; pending = null; holdX = null;
  updateBar();
}

function showOver() {
  const m = me(), mine = m ? m.team : 0;
  $('overTitle').textContent = winner === -1 ? '무승부' : winner === mine ? '🏆 승리!' : '패배…';
  $('overText').textContent = (winner === -1 ? '두 팀이 함께 쓰러졌습니다.' : `${TEAMS[winner].name}이 이겼습니다.`)
    + (mode === 'client' ? ' 방장이 다시 시작하기를 기다립니다.' : '');
  $('again').classList.toggle('hidden', mode === 'client');
  setTimeout(() => { if (phase === 'over') $('over').classList.remove('hidden'); }, 900);
  updateBar();
}

function checkWinner() {
  const alive = [0, 1].map(t => robots.filter(r => r.alive && r.team === t).length);
  if (alive[0] && alive[1]) return false;
  winner = alive[0] ? 0 : alive[1] ? 1 : -1;
  phase = 'over';
  showOver();
  return true;
}

function endTurn() {
  robots.forEach(r => { if (r.wet > 0) r.wet--; });
  wind = r1(clamp(wind + rnd(-1, 1) * MAP.windStep, -MAP.windMax, MAP.windMax));
  dropCrates(teamSize >= 3 ? 2 : 1);
  startAim(1 - turnTeam);
}

// ---------- 효과 ----------
function spark(x, y, n, color, type) {
  for (let i = 0; i < n && parts.length < 400; i++) {
    const a = rnd(0, 6.28), sp = type === 'smoke' ? rnd(5, 25) : rnd(60, 260);
    parts.push({ x, y, vx: type === 'drop' ? 0 : Math.cos(a) * sp, vy: type === 'drop' ? 420 : Math.sin(a) * sp - (type === 'smoke' ? 20 : 60),
      t: 0, life: type === 'smoke' ? rnd(0.6, 1.2) : type === 'drop' ? 0.6 : rnd(0.3, 0.7), size: type === 'smoke' ? rnd(5, 11) : rnd(1.5, 3.5), color, type: type || 'spark' });
  }
}
function rainFx(x, y) { for (let i = 0; i < 14; i++) spark(x + rnd(-40, 40), y - rnd(60, 260), 1, '#5bc0ff', 'drop'); }

function boom(x, y, r, color) {
  emit(['b', x | 0, y | 0, r | 0, color]);
  fx.push({ type: 'boom', x, y, r, color, t: 0 });
  spark(x, y, Math.round(r / 3), color);
  spark(x, y, Math.round(r / 9), '#6b7480', 'smoke');
  shake = Math.max(shake, r / 55);
}

function tickEffects(dt) {
  fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < (f.type === 'bolt' ? 0.35 : 0.5));
  floats.forEach(f => f.t += dt); floats = floats.filter(f => f.t < FLOAT_LIFE);
  for (const p of parts) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.type === 'spark') p.vy += 420 * dt;
    else if (p.type === 'smoke') { p.vy -= 30 * dt; p.size += 8 * dt; }
  }
  parts = parts.filter(p => p.t < p.life);
  shake = Math.max(0, shake - dt * 3);
}

function moveBodies(dt) {
  for (const r of robots) {
    if (Math.abs(r.vx) > 3) { r.x = clamp(r.x + r.vx * dt, 14, WW - 14); r.vx *= Math.max(0, 1 - 5 * dt); } else r.vx = 0;
    const gy = groundAt(r.x);
    if (gy >= VOID || r.y < gy - 40) {   // 발밑에 땅이 없으면 떨어진다
      r.fall += 900 * dt; r.y += r.fall * dt;
      if (gy < VOID && r.y >= gy) { r.y = gy; r.fall = 0; }
      if (r.y > H + 140 && r.alive) { r.alive = false; r.hp = 0; r.ready = true; addFloat(r.x, H - 120, `${r.name} 추락!`, '#ffb0a6'); }
    } else { r.fall = 0; r.y += (gy - r.y) * Math.min(1, dt * 10); }
    if (r.sayT > 0) r.sayT -= dt;
  }
}

function update(dt) {
  moveBodies(dt);
  tickEffects(dt);
  updateCrates(dt);

  if (phase === 'aim') {
    for (const r of robots) {
      if (r.goal === null || !r.alive) continue;
      const gap = r.goal - r.x;
      if (Math.abs(gap) < 1 || !walk(r, Math.sign(gap), Math.min(Math.abs(gap), WALK_SPEED * dt))) r.goal = null;
    }
    const humans = robots.filter(r => r.alive && r.team === turnTeam && r.ctrl);
    for (const h of humans) if (!h.ready && h.moveDir) walk(h, h.moveDir, WALK_SPEED * dt);
    if (humans.length) { timer -= dt; if (timer <= 0 || humans.every(h => h.ready)) confirmAim(); }
    else { thinkT -= dt; if (thinkT <= 0) confirmAim(); }
  } else if (phase === 'fire') {
    if (projs.length) {
      for (const p of projs.slice()) {
        if (p.delay > 0) { p.delay -= dt; continue; }
        for (let i = 0; i < 4; i++) {
          const res = stepProj(p, dt / 4);
          if (res) { if (res === 'hit') explode(p); p.dead = true; break; }
        }
        if (p.dead) continue;
        if (SHELLS[p.shell].split && p.vy > 0) {   // 꼭대기를 넘으면 셋으로 갈라진다
          p.dead = true;
          boom(p.x, p.y, 14, '#ffe98a');
          for (const k of [-1, 0, 1]) projs.push({ ...p, id: nextId++, shell: 'shard', vx: p.vx + k * 70, trail: [], dead: false });
          continue;
        }
        p.trail.push([p.x, p.y]); if (p.trail.length > 26) p.trail.shift();
        if (SHELLS[p.shell].homing && Math.random() < 0.5) spark(p.x, p.y, 1, '#8a8f99', 'smoke');
      }
      projs = projs.filter(p => !p.dead);
      if (!projs.length) pauseT = Math.max(pauseT, HIT_PAUSE);   // 결과를 볼 시간
    } else {
      pauseT -= dt;
      if (pauseT <= 0) {
        if (pending) { const r = pending; pending = null; if (r.alive) launch(r); return; }
        if (checkWinner()) return;
        const r = queue.shift();
        if (!r) endTurn();
        else if (r.alive) { pending = r; holdX = null; pauseT = NEXT_PAUSE; }   // 쏠 로봇을 먼저 비춘다
      }
    }
  }
}

// ---------- 온라인: 상태 주고받기 ----------
// 방장 → 참가자: 판을 시작할 때 한 번 보내는 정보
function matchInfo() {
  return { n: teamSize, map: MAP.id, R: robots.map(r => ({ team: r.team, i: r.i, model: r.model.id, name: r.name, ctrl: r.ctrl })),
    g: Array.from(ground, Math.round), b: MAP.void ? Array.from(bot, Math.round) : null };
}
// 방장 → 참가자: 자주 보내는 지금 상태
function snapshot() {
  const ev = events; events = [];
  return { ph: phase, tt: turnTeam, tn: turnNo, tm: r1(timer), w: wind, hx: holdX === null ? null : Math.round(holdX), win: winner,
    pd: pending ? robots.indexOf(pending) : -1,
    R: robots.map(r => [r1(r.x), r1(r.y), r.hp, Math.round(r.energy), r.wet, r.shield, r.alive ? 1 : 0, Math.round(r.aim.vx), Math.round(r.aim.vy),
      r.slot, r.item, Math.round(r.fuel), r.ready ? 1 : 0, r.say, r1(Math.max(0, r.sayT)), r.items, r.ctrl]),
    P: projs.filter(p => p.delay <= 0).map(p => [p.id, r1(p.x), r1(p.y), Math.round(p.vx), Math.round(p.vy), p.shell, p.sm]),
    C: crates.map(c => [c.id, c.x, Math.round(c.y), c.item, c.landed ? 1 : 0]), E: ev };
}

function loadMatch(info) {
  teamSize = info.n;
  MAP = MAPS.find(m => m.id === info.map) || MAPS[0];
  ground = Float32Array.from(info.g);
  bot = info.b ? Float32Array.from(info.b) : new Float32Array(WW + 1).fill(9999);
  resetMatchState();
  robots = info.R.map(o => {
    const r = makeRobot(o.team, o.i, MODELS.find(m => m.id === o.model), o.name, o.ctrl);
    r.fresh = true;
    return r;
  });
  phase = 'aim'; turnTeam = 0; turnNo = 0; timer = AIM_TIME; rockPattern = null;
  updateBar();
}

function applySnapshot(s) {
  const prev = phase, newTurn = s.tn !== turnNo;
  phase = s.ph; turnTeam = s.tt; turnNo = s.tn; timer = s.tm; wind = s.w; holdX = s.hx; winner = s.win;
  pending = s.pd >= 0 ? robots[s.pd] : null;
  s.R.forEach((a, i) => {
    const r = robots[i];
    if (!r) return;
    r.tx = a[0]; r.ty = a[1];
    if (r.fresh || Math.abs(r.tx - r.x) > 120) { r.x = r.tx; r.y = r.ty; r.fresh = false; }
    r.hp = a[2]; r.energy = a[3]; r.wet = a[4]; r.shield = a[5]; r.alive = !!a[6];
    r.fuel = a[11]; r.say = a[13]; r.sayT = a[14]; r.items = a[15]; r.ctrl = a[16];
    // 내가 조준하는 동안에는 내 손이 먼저다(늦게 온 소식이 조준을 되돌리지 않게)
    const steering = r.ctrl === myId && phase === 'aim' && r.team === turnTeam && !newTurn && readyTn !== turnNo;
    if (!steering) { r.aim = { vx: a[7], vy: a[8] }; r.slot = a[9]; r.item = a[10]; }
    r.ready = !!a[12] || (r.ctrl === myId && readyTn === turnNo);
  });
  const old = new Map(projs.map(p => [p.id, p]));
  projs = s.P.map(a => Object.assign(old.get(a[0]) || { trail: [] }, { id: a[0], x: a[1], y: a[2], vx: a[3], vy: a[4], shell: a[5], sm: a[6], delay: 0, dm: 1 }));
  crates = s.C.map(a => ({ id: a[0], x: a[1], y: a[2], item: a[3], landed: !!a[4] }));
  for (const e of s.E) {
    if (e[0] === 'b') boom(e[1], e[2], e[3], e[4]);
    else if (e[0] === 'f') floats.push({ x: e[1], y: e[2], text: e[3], color: e[4], t: 0 });
    else if (e[0] === 'z') fx.push({ type: 'bolt', x1: e[1], y1: e[2], x2: e[3], y2: e[4], t: 0 });
    else if (e[0] === 'd') dig(e[1], e[2], e[3]);
    else if (e[0] === 'p') pile(e[1], e[2], e[3]);
    else if (e[0] === 'r') rainFx(e[1], e[2]);
    else if (e[0] === 't') { ground = Float32Array.from(e[1]); if (e[2]) bot = Float32Array.from(e[2]); }
  }
  if (phase !== prev || newTurn) { if (phase === 'aim') cam.manual = false; updateBar(); }
  if (phase === 'over' && prev !== 'over') showOver();
}

// 참가자 쪽: 소식과 소식 사이를 부드럽게 이어 그린다
function clientTick(dt) {
  for (const r of robots) {
    r.x += (r.tx - r.x) * Math.min(1, dt * 14); r.y += (r.ty - r.y) * Math.min(1, dt * 14);
    if (r.sayT > 0) r.sayT -= dt;
  }
  for (const p of projs) {
    if (!SHELLS[p.shell].homing) { p.vx += wind * WIND_K * dt; p.vy += GRAVITY * MAP.gravity * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.trail.push([p.x, p.y]); if (p.trail.length > 26) p.trail.shift();
  }
  if (phase === 'aim') timer = Math.max(0, timer - dt);
  tickEffects(dt);
}

// ---------- 카메라 ----------
function updateCam(dt) {
  let tz = overview ? W / WW : 1, focus = null;
  const flying = projs.find(p => p.delay <= 0);
  if (!cam.manual) {
    if (flying) {
      focus = flying.x;
      if (flying.y < 80) tz = Math.min(tz, clamp(H / (H - flying.y + 80), W / WW, 1));   // 높이 뜬 포탄이 보이게 물러난다
    } else if (phase === 'aim') {
      const team = robots.filter(r => r.alive && r.team === turnTeam), m = me();
      if (m && m.alive && m.team === turnTeam) focus = m.x;
      else if (team.length) focus = team.reduce((s, r) => s + r.x, 0) / team.length;
    } else if (phase === 'fire') {
      if (pending) focus = pending.x;
      else if (holdX !== null) focus = clamp(holdX, 0, WW);
      else if (queue.length) focus = queue[0].x;
    }
  }
  const k = Math.min(1, dt * 5);
  cam.z += (tz - cam.z) * k;
  const viewW = W / cam.z, maxX = Math.max(0, WW - viewW);
  if (focus !== null) cam.tx = focus - viewW / 2;
  cam.tx = clamp(cam.tx, 0, maxX);
  cam.x = clamp(cam.x + (cam.tx - cam.x) * (cam.manual ? 1 : k), 0, maxX);
}
const toScreenPos = (wx, wy) => ({ x: (wx - cam.x) * cam.z, y: H - (H - wy) * cam.z });

// ---------- 그리기: 배경 ----------
const stars = [], layers = [];
for (let i = 0; i < 110; i++) stars.push({ x: rnd(0, W), y: rnd(0, 330), s: rnd(0.8, 2.2), tw: rnd(0.6, 2.4), ph: rnd(0, 6.28) });
[{ par: 0.06, base: 300, hmin: 50, hmax: 150 }, { par: 0.14, base: 340, hmin: 40, hmax: 130 }, { par: 0.26, base: 390, hmin: 30, hmax: 110 }].forEach((L, li) => {
  L.span = 1500; L.b = [];
  for (let x = 0; x < L.span;) {
    const w = rnd(38, 90), h = rnd(L.hmin, L.hmax), win = [];
    if (li > 0) for (let i = 0; i < 6; i++) if (Math.random() < 0.55) win.push([rnd(5, w - 9), rnd(8, h - 6)]);
    L.b.push({ x, w, h, win, stack: Math.random() < 0.35, dome: Math.random() < 0.2 });
    x += w + rnd(4, 30);
  }
  layers.push(L);
});
const clouds = [0, 1, 2, 3, 4, 5, 6].map(() => ({ x: rnd(0, 1400), y: rnd(40, 260), w: rnd(120, 260), sp: rnd(3, 9) }));

function skyFill(stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function drawStars() {
  for (const s of stars) {
    ctx.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(T * s.tw + s.ph))) * (1 - s.y / 380);
    ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
}
function drawOrb(x, y, r, color, glow) {
  const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.4);
  g.addColorStop(0, glow); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
}
function drawClouds(alpha, par) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  for (const c of clouds) {
    const x = ((c.x + T * c.sp - cam.x * par) % 1400 + 1400) % 1400 - 220;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + i * c.w / 4, c.y + (i % 2) * 8, c.w / 3, 16 + c.w / 16, 0, 0, 6.3); ctx.fill(); }
  }
}
function drawSkyline(colors, lit) {
  layers.forEach((L, li) => {
    const off = -((cam.x * L.par) % L.span);
    for (const base of [off, off + L.span]) {
      for (const b of L.b) {
        const x = base + b.x;
        if (x > W || x + b.w < 0) continue;
        ctx.fillStyle = colors[li];
        if (lit) {
          ctx.fillRect(x, L.base - b.h, b.w, b.h + 260);
          if (b.stack) ctx.fillRect(x + b.w * 0.3, L.base - b.h - 24, 7, 24);
          if (b.dome) { ctx.beginPath(); ctx.arc(x + b.w / 2, L.base - b.h, b.w * 0.35, Math.PI, 0); ctx.fill(); }
          ctx.fillStyle = li === 2 ? 'rgba(255,214,120,.75)' : 'rgba(255,214,120,.4)';
          for (const w of b.win) ctx.fillRect(x + w[0], L.base - b.h + w[1], 4, 5);
        } else {   // 바위산: 비스듬한 옆면
          ctx.beginPath(); ctx.moveTo(x - 14, L.base + 260); ctx.lineTo(x + 6, L.base - b.h); ctx.lineTo(x + b.w - 6, L.base - b.h); ctx.lineTo(x + b.w + 14, L.base + 260); ctx.fill();
        }
      }
    }
  });
}

function drawBackdrop() {
  const im = IMG[MAP.bg];
  if (im) {
    const sc = Math.max(W * 1.3 / im.width, H / im.height), iw = im.width * sc, ih = im.height * sc;
    const k = cam.x / Math.max(1, WW - W);
    ctx.drawImage(im, -(iw - W) * clamp(k, 0, 1), 0, iw, ih);   // 하늘이 잘리지 않게 위에 맞춘다(아래는 땅에 가려진다)
    ctx.fillStyle = 'rgba(8,12,24,.12)'; ctx.fillRect(0, 0, W, H);
    return;
  }
  if (MAP.id === 'cloud') {
    skyFill(['#2f7fd8', '#6db4f2', '#bfe3ff', '#f2f9ff']);
    drawOrb(W * 0.2 - cam.x * 0.02, 90, 38, '#fffbe0', 'rgba(255,250,210,.55)');
    drawClouds(0.5, 0.05);
    ctx.fillStyle = 'rgba(255,255,255,.55)';   // 발아래 구름 바다
    for (let i = 0; i < 14; i++) { const x = ((i * 90 - cam.x * 0.2) % 1260 + 1260) % 1260 - 130; ctx.beginPath(); ctx.ellipse(x, H - 6 + (i % 3) * 8, 120, 46, 0, 0, 6.3); ctx.fill(); }
  } else if (MAP.id === 'moon') {
    skyFill(['#02030a', '#0a0d1f', '#1a1d33']);
    drawStars();
    const ex = W * 0.72 - cam.x * 0.02;
    drawOrb(ex, 110, 50, '#3f8fe0', 'rgba(120,180,255,.35)');
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    for (const [dx, dy, rx, ry] of [[-12, -14, 22, 7], [14, 6, 20, 6], [-8, 24, 16, 5]]) { ctx.beginPath(); ctx.ellipse(ex + dx, 110 + dy, rx, ry, 0.3, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = 'rgba(70,170,110,.8)'; ctx.beginPath(); ctx.ellipse(ex + 6, 100, 14, 9, 0.6, 0, 6.3); ctx.fill();
    drawSkyline(['#23242e', '#191a22', '#101117'], false);
  } else if (MAP.id === 'desert') {
    skyFill(['#3d2350', '#a0465a', '#e8824a', '#f7c873']);
    drawOrb(W * 0.3 - cam.x * 0.02, 250, 46, '#fff0c2', 'rgba(255,220,150,.55)');
    drawSkyline(['#b0603f', '#8a4630', '#623021'], false);
    ctx.strokeStyle = 'rgba(255,225,170,.28)'; ctx.lineWidth = 2;   // 바람에 날리는 모래
    for (let i = 0; i < 26; i++) {
      const x = ((i * 97 + T * (40 + wind * 16) + i * i * 13) % (W + 200) + W + 200) % (W + 200) - 100, y = 120 + (i * 53) % 330;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26 + Math.abs(wind) * 4, y + 2); ctx.stroke();
    }
  } else {
    skyFill(['#0a1030', '#27255a', '#6b3a6e', '#d9785a', '#f0a868']);
    drawStars();
    drawOrb(W * 0.78 - cam.x * 0.02, 105, 44, '#fff3d6', 'rgba(255,240,210,.4)');
    drawClouds(0.07, 0.04);
    drawSkyline(['#34306a', '#231f4d', '#161535'], true);
  }
}

// ---------- 그리기: 땅 ----------
function getRockPattern() {
  if (rockPattern && patternFor === MAP.id) return rockPattern;
  patternFor = MAP.id;
  if (IMG[MAP.tex]) return (rockPattern = ctx.createPattern(IMG[MAP.tex], 'repeat'));
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d');
  for (let i = 0; i < 90; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.16)';
    const s = rnd(1, 4); g.fillRect(rnd(0, 96), rnd(0, 96), s * rnd(1, 3), s);
  }
  if (!MAP.void) {
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { g.beginPath(); const x = rnd(0, 96), y = rnd(0, 96); g.moveTo(x, y); g.lineTo(x + rnd(-18, 18), y + rnd(6, 20)); g.lineTo(x + rnd(-24, 24), y + rnd(18, 34)); g.stroke(); }
  }
  return (rockPattern = ctx.createPattern(c, 'repeat'));
}

// 화면에 보이는 땅을 이어진 덩어리로 나눈다(구름 맵은 섬마다 한 덩어리)
function landPieces() {
  const x0 = Math.max(0, (Math.floor(cam.x) - 4) & ~1), x1 = Math.min(WW, Math.ceil(cam.x + W / cam.z) + 4);
  const out = []; let a = -1;
  for (let x = x0; x <= x1; x += 2) {
    const solid = ground[x] < VOID;
    if (solid && a < 0) a = x;
    if (a >= 0 && (!solid || x + 2 > x1)) { const b = solid ? x : x - 2; if (b > a) out.push([a, b]); a = -1; }
  }
  return out;
}
function landFill(a, b, dy) {
  ctx.beginPath(); ctx.moveTo(a, ground[a] + dy);
  for (let x = a + 2; x <= b; x += 2) ctx.lineTo(x, ground[x] + dy);
  if (MAP.void) for (let x = b; x >= a; x -= 2) ctx.lineTo(x, Math.max(bot[x], ground[x] + dy));
  else { ctx.lineTo(b, H + 600); ctx.lineTo(a, H + 600); }
  ctx.closePath();
}
function landTop(a, b, dy) {
  ctx.beginPath(); ctx.moveTo(a, ground[a] + dy);
  for (let x = a + 2; x <= b; x += 2) ctx.lineTo(x, ground[x] + dy);
}

function drawGround() {
  const L = MAP.land, pat = getRockPattern();
  const g = ctx.createLinearGradient(0, 170, 0, H);
  g.addColorStop(0, L.a); g.addColorStop(1, L.b);
  ctx.lineJoin = 'round';
  for (const [a, b] of landPieces()) {
    if (MAP.void) {   // 구름: 아래쪽에 몽글몽글한 덩어리
      ctx.fillStyle = L.b;
      for (let x = a + 8; x < b; x += 26) { ctx.beginPath(); ctx.arc(x, bot[x] - 4, 15 + (x % 7), 0, 6.3); ctx.fill(); }
    }
    landFill(a, b, 0); ctx.fillStyle = g; ctx.fill();
    ctx.globalAlpha = IMG[MAP.tex] ? 0.75 : MAP.void ? 0.35 : 1; ctx.fillStyle = pat; ctx.fill(); ctx.globalAlpha = 1;
    if (!MAP.void) {   // 깊어질수록 어두운 지층
      for (const [dy, al] of [[22, 0.22], [60, 0.28], [118, 0.34], [200, 0.42]]) { landFill(a, b, dy); ctx.fillStyle = `rgba(10,12,20,${al})`; ctx.fill(); }
    } else {
      ctx.fillStyle = '#fff';
      for (let x = a + 6; x < b; x += 22) { ctx.beginPath(); ctx.arc(x, ground[x] + 3, 10 + (x % 5), Math.PI, 0); ctx.fill(); }
    }
    landTop(a, b, 2); ctx.strokeStyle = L.edge; ctx.lineWidth = MAP.void ? 3 : 7; ctx.stroke();
    landTop(a, b, 0); ctx.strokeStyle = L.line; ctx.lineWidth = 3; ctx.stroke();
    landTop(a, b, -1.5); ctx.strokeStyle = L.shine; ctx.lineWidth = 1; ctx.stroke();
  }
}

// ---------- 그리기: 로봇 ----------
function rr(g, x, y, w, h, rad) {
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}
const OUT = '#0d1320';
function plate(g, fill) { g.fillStyle = fill; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke(); }

function drawBarrel(g, id) {
  const steel = g.createLinearGradient(0, -5, 0, 5);
  steel.addColorStop(0, '#eef3f8'); steel.addColorStop(0.5, '#aab6c4'); steel.addColorStop(1, '#5d6978');
  if (id === 'shower') {
    rr(g, 3, -2.6, 16, 5.2, 2); plate(g, steel);
    g.beginPath(); g.moveTo(18, -3); g.lineTo(26, -6); g.lineTo(26, 6); g.lineTo(18, 3); g.closePath(); plate(g, '#5bc0ff');
  } else if (id === 'spark') {
    rr(g, 3, -2, 21, 4, 2); plate(g, steel);
    g.fillStyle = '#f5f55a'; for (const x of [9, 14, 19]) g.fillRect(x, -3, 2, 6);
    g.shadowColor = '#f5f55a'; g.shadowBlur = 8; g.fillStyle = '#fffbc2'; g.beginPath(); g.arc(25.5, 0, 3.2, 0, 6.3); g.fill(); g.shadowBlur = 0;
  } else if (id === 'mole') {
    rr(g, 3, -4.2, 15, 8.4, 2); plate(g, steel);
    g.beginPath(); g.moveTo(18, -6); g.lineTo(30, 0); g.lineTo(18, 6); g.closePath(); plate(g, '#d9a066');
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
    for (const x of [21, 24, 27]) { const h = 6 - (x - 18) * 0.5; g.beginPath(); g.moveTo(x, -h); g.lineTo(x - 2, h); g.stroke(); }
  } else if (id === 'hunter') {
    rr(g, 1, -6.5, 22, 13, 3); plate(g, '#2b303c');
    g.strokeStyle = '#f4c95d'; g.lineWidth = 1; rr(g, 3, -4.5, 18, 9, 2); g.stroke();
    g.fillStyle = '#ff5d5d'; for (const y of [-2.6, 2.6]) { g.beginPath(); g.arc(22.5, y, 1.9, 0, 6.3); g.fill(); }
  } else {
    rr(g, 3, -3.6, 20, 7.2, 2.5); plate(g, steel);
    rr(g, 21, -4.8, 5, 9.6, 2); plate(g, '#4a5563');
  }
}

// 땅에 닿는 점이 (0,0)인 로봇 한 대. 화면의 로봇과 고르기 화면의 미리보기가 같이 쓴다.
function drawRobotArt(g, model, team, aim, t) {
  const tm = TEAMS[team], dir = team === 0 ? 1 : -1, a = model.art, im = IMG['robot-' + model.id];
  const pv = pivotOf(model, team), ang = Math.atan2(aim.vy, aim.vx);
  const hover = model.hover ? Math.sin(t * 2.6) * 2 : 0;
  const barrel = () => { g.save(); g.translate(pv.x, pv.y + hover); g.rotate(ang); g.scale(im ? a.bs : 1, im ? a.bs : 1); drawBarrel(g, model.id); g.restore(); };
  // 발밑: 그림자와 팀 색 고리
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 1, a.w * 0.5, 5, 0, 0, 6.3); g.fill();
  g.strokeStyle = tm.color; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 1.5, a.w * 0.5 + 3, 6, 0, 0, 6.3); g.stroke();
  if (!im) {   // 그림이 없을 때의 임시 로봇
    barrel();
    rr(g, -15, -8, 30, 9, 4.5); plate(g, '#1a212b');
    rr(g, -12, -26, 24, 19, 5); plate(g, tm.color);
    g.fillStyle = '#0c1118'; rr(g, dir > 0 ? 0 : -11, -22, 11, 5.5, 2.5); g.fill();
    return;
  }
  const h = a.w * im.height / im.width;
  if (!a.front) barrel();
  g.save(); g.scale(dir, 1); g.shadowColor = tm.color; g.shadowBlur = 6;
  g.drawImage(im, -a.w / 2, -h + 1 + hover, a.w, h);
  g.restore();
  if (a.front) barrel();
}

function label(text, x, y, color, font) {
  ctx.font = font; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(8,12,22,.85)';
  ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function drawRobot(r) {
  const { x, y } = r, a = r.model.art, tm = TEAMS[r.team];
  if (!r.alive) {
    if (y > H + 100) return;
    ctx.fillStyle = '#39414b'; rr(ctx, x - a.w * 0.4, y - 8, a.w * 0.8, 8, 3); ctx.fill();
    ctx.fillStyle = '#4a525c'; ctx.fillRect(x - 7, y - 16, 14, 9);
    if (Math.random() < 0.06) spark(x + rnd(-6, 6), y - 14, 1, '#555c66', 'smoke');
    return;
  }
  ctx.save(); ctx.translate(x, y); drawRobotArt(ctx, r.model, r.team, r.aim, T + x); ctx.restore();
  const my = midY(r);
  if (r.wet > 0) {
    ctx.strokeStyle = 'rgba(91,192,255,.85)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -T * 10;
    ctx.beginPath(); ctx.arc(x, my, a.rad, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
  }
  if (r.shield > 0) {
    const sg = ctx.createRadialGradient(x, my, 8, x, my, a.rad + 5);
    sg.addColorStop(0, 'rgba(143,227,255,0)'); sg.addColorStop(1, 'rgba(143,227,255,.38)');
    ctx.fillStyle = sg; ctx.strokeStyle = 'rgba(190,240,255,.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, my, a.rad + 5, 0, 6.3); ctx.fill(); ctx.stroke();
  }
  // 체력, 에너지, 이름(테두리가 팀 색)
  const top = y - a.tall - 22;
  ctx.fillStyle = 'rgba(8,12,22,.8)'; rr(ctx, x - 21, top, 42, 12, 4); ctx.fill();
  ctx.strokeStyle = tm.color; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = r.hp > r.maxHp * 0.5 ? '#6ee37a' : r.hp > r.maxHp * 0.25 ? '#ffd166' : '#ff6b5e';
  rr(ctx, x - 18, top + 2.5, Math.max(2, 36 * r.hp / r.maxHp), 4, 2); ctx.fill();
  ctx.fillStyle = r.energy >= ENERGY_MAX ? '#e9c8ff' : '#a06bd6';
  ctx.fillRect(x - 18, top + 7.5, 36 * r.energy / ENERGY_MAX, 2.5);
  const mine = r.ctrl === myId;
  label((r.wet > 0 ? '💧' : '') + (r.energy >= ENERGY_MAX ? '🌠' : '') + (r.ready && phase === 'aim' && r.ctrl ? '✔ ' : '') + r.name, x, top - 5, mine ? '#ffe98a' : tm.light, 'bold 12px sans-serif');
  if (r.sayT > 0) {
    ctx.font = '13px sans-serif';
    const w = ctx.measureText(r.say).width + 18;
    const bx = clamp(x - w / 2, 4, WW - w - 4);
    ctx.fillStyle = 'rgba(255,255,255,.96)'; rr(ctx, bx, top - 46, w, 25, 11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 5, top - 22); ctx.lineTo(x, top - 15); ctx.lineTo(x + 5, top - 22); ctx.fill();
    ctx.fillStyle = '#1a2230'; ctx.textAlign = 'center'; ctx.fillText(r.say, bx + w / 2, top - 29);
  }
}

function drawCrate(c) {
  const { x, y } = c;
  if (!c.landed) {   // 낙하산
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 1;
    ctx.beginPath(); for (const dx of [-17, -6, 6, 17]) { ctx.moveTo(x + dx, y - 42); ctx.lineTo(x + Math.sign(dx) * 8, y - 24); } ctx.stroke();
    const pg = ctx.createLinearGradient(0, y - 62, 0, y - 42);
    pg.addColorStop(0, '#ffd08a'); pg.addColorStop(1, '#f08a3c');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(x, y - 42, 19, Math.PI, 0); ctx.closePath(); ctx.fill();
  }
  if (IMG.crate) ctx.drawImage(IMG.crate, x - 16, y - 30, 32, 31);
  else { rr(ctx, x - 11, y - 20, 22, 20, 3); ctx.fillStyle = '#c98b3d'; ctx.fill(); ctx.strokeStyle = '#5c3a12'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.shadowColor = '#ffe98a'; ctx.shadowBlur = 6 + 3 * Math.sin(T * 4);
  ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText(ITEMS[c.item].icon, x + (IMG.crate ? 4 : 0), y - (IMG.crate ? 10 : 5)); ctx.shadowBlur = 0;   // 그림 상자는 둥근 창 안에
}

function drawAimGuide() {
  const m = me();
  if (!m || !iCanAct()) return;
  // 여기를 누르고 당기면 조준된다는 표시
  ctx.strokeStyle = `rgba(255,233,138,${0.35 + 0.25 * Math.sin(T * 4)})`; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
  ctx.beginPath(); ctx.arc(m.x, midY(m), m.model.art.rad + 8, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
  // 날아갈 길 앞부분만 점으로 보여 준다
  const key = m.item === 'warp' ? 'warp' : m.slot === 'ult' ? 'ult' : m.model[m.slot];
  const p = makeProj(m, m.aim.vx, m.aim.vy, key);
  ctx.fillStyle = SHELLS[key].color;
  for (let i = 0; i < 33; i++) {
    p.vx += wind * WIND_K / 60; p.vy += GRAVITY * MAP.gravity / 60; p.x += p.vx / 60; p.y += p.vy / 60;
    if (i % 4 === 0) { ctx.globalAlpha = 1 - i / 40; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.3); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  const pw = Math.hypot(m.aim.vx, m.aim.vy);
  const ang = Math.round(Math.atan2(-m.aim.vy, Math.abs(m.aim.vx)) * 180 / Math.PI);
  label(`각도 ${ang}°  힘 ${Math.round(pw / MAX_POWER * 100)}%`, m.x, m.y + 24, '#ffe98a', 'bold 13px sans-serif');
  // 이번 턴에 더 걸을 수 있는 거리
  ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, m.x - 30, m.y + 30, 60, 6, 3); ctx.fill();
  ctx.fillStyle = '#7fe0c0'; rr(ctx, m.x - 29, m.y + 31, Math.max(2, 58 * m.fuel / m.model.fuel), 4, 2); ctx.fill();
}

function drawProjs() {
  for (const p of projs) {
    if (p.delay > 0) continue;
    const c = SHELLS[p.shell].color, big = (p.shell === 'meteor' || p.shell === 'heavy' ? 7 : 5) * (p.sm > 1 ? 1.5 : 1);
    ctx.globalCompositeOperation = 'lighter';
    p.trail.forEach((t, i) => {
      ctx.globalAlpha = i / p.trail.length * 0.5; ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(t[0], t[1], big * 0.6 * i / p.trail.length + 1, 0, 6.3); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = c; ctx.shadowBlur = 14;
    if (SHELLS[p.shell].homing) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = '#e8eef7'; rr(ctx, -8, -3, 13, 6, 2); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(11, 0); ctx.lineTo(5, 3); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, big, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x - big * 0.25, p.y - big * 0.25, big * 0.4, 0, 6.3); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

function drawEffects() {
  for (const p of parts) {
    const k = p.t / p.life;
    if (p.type === 'smoke') { ctx.globalAlpha = 0.35 * (1 - k); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.3); ctx.fill(); }
    else if (p.type === 'drop') { ctx.globalAlpha = 0.8 * (1 - k); ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 12); ctx.stroke(); }
    else { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalCompositeOperation = 'source-over'; }
  }
  for (const f of fx) {
    if (f.type === 'boom') {
      const k = f.t / 0.5, rad = f.r * (0.35 + 0.65 * k);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
      g.addColorStop(0, '#fff'); g.addColorStop(0.35, f.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, rad, 0, 6.3); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = f.color; ctx.lineWidth = 3 * (1 - k) + 0.01; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + 0.9 * k), 0, 6.3); ctx.stroke();
    } else {
      ctx.globalAlpha = 1 - f.t / 0.35; ctx.shadowColor = '#f5f55a'; ctx.shadowBlur = 12;
      ctx.strokeStyle = '#fffbc2'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1);
      for (let i = 1; i < 6; i++) ctx.lineTo(f.x1 + (f.x2 - f.x1) * i / 6 + rnd(-10, 10), f.y1 + (f.y2 - f.y1) * i / 6 + rnd(-10, 10));
      ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1;
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, (FLOAT_LIFE - f.t) * 2.5);   // 끝날 때만 흐려진다
    label(f.text, f.x, f.y - Math.min(f.t, 1) * 26, f.color, 'bold 22px sans-serif');
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  if (phase === 'menu') return;
  ctx.textAlign = 'center';
  const HX = 722;   // 왼쪽 위 아이템 줄과 겹치지 않는 자리
  // 바람
  ctx.fillStyle = 'rgba(10,18,32,.72)'; rr(ctx, HX - 95, 10, 190, 34, 12); ctx.fill();
  ctx.fillStyle = '#33455f'; ctx.fillRect(HX - 80, 34, 160, 4);
  ctx.fillStyle = '#8fd3ff';
  const ww = MAP.windMax ? wind / MAP.windMax * 80 : 0;
  ctx.fillRect(Math.min(HX, HX + ww), 34, Math.abs(ww), 4);
  ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#e8eef7';
  ctx.fillText(`${MAP.icon} ` + (wind === 0 ? '바람 없음' : `바람 ${wind > 0 ? '→' : '←'} ${Math.abs(wind).toFixed(1)}`), HX, 28);
  // 차례
  const tm = TEAMS[turnTeam], m = me();
  let msg = '';
  if (phase === 'aim') {
    const humans = robots.some(r => r.alive && r.team === turnTeam && r.ctrl);
    if (iCanAct()) msg = `조준하세요 · ${Math.ceil(timer)}초`;
    else if (m && m.alive && m.team === turnTeam) msg = `같은 편을 기다리는 중 · ${Math.ceil(timer)}초`;
    else msg = humans ? `${tm.name} 조준 중 · ${Math.ceil(timer)}초` : `${tm.name} 조준 중…`;
  } else if (phase === 'fire') msg = `${tm.name} 발사!`;
  if (msg) label(msg, HX, 66, tm.light, 'bold 16px sans-serif');
  // 작은 지도: 맵 전체에서 누가 어디 있고, 지금 화면이 어디인지
  const mx = 16, my = 54, mw = 330, mh = 26, sx = mw / WW;
  ctx.fillStyle = 'rgba(10,18,32,.72)'; rr(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
  ctx.fillStyle = '#51616c';
  for (let x = 0; x < WW; x += 24) if (ground[x] < VOID) { const hh = (H - ground[x]) * mh / 420; ctx.fillRect(mx + x * sx, my + mh - hh, 24 * sx + 0.5, MAP.void ? 5 : hh); }
  ctx.fillStyle = '#ffd166';
  for (const c of crates) ctx.fillRect(mx + c.x * sx - 1.5, my + mh - (H - clamp(c.y, 120, H)) * mh / 420 - 4, 3, 3);
  for (const r of robots) {
    if (!r.alive) continue;
    const mine = r.ctrl === myId;
    ctx.fillStyle = mine ? '#ffe98a' : TEAMS[r.team].color;
    ctx.beginPath(); ctx.arc(mx + r.x * sx, my + mh - (H - clamp(r.y, 120, H)) * mh / 420 - 3, mine ? 3.5 : 3, 0, 6.3); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(mx + cam.x * sx, my - 1, Math.min(mw, W / cam.z * sx), mh + 2);
}

function draw() {
  drawBackdrop();
  if (!ground) return;
  ctx.save();
  const sh = shake * 5;
  ctx.translate(-cam.x * cam.z + rnd(-sh, sh), H * (1 - cam.z) + rnd(-sh, sh));   // 땅이 화면 아래에 붙은 채로 줄어든다
  ctx.scale(cam.z, cam.z);
  drawGround();
  crates.forEach(drawCrate);
  robots.forEach(drawRobot);
  drawAimGuide();
  drawProjs();
  drawEffects();
  ctx.restore();
  if (drag && drag.mode === 'aim') {
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(drag.sx, drag.sy); ctx.lineTo(drag.x, drag.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(drag.x, drag.y, 7, 0, 6.3); ctx.fill();
  }
  drawHud();
}

// ---------- 손가락·마우스·키보드 ----------
function toView(e) {
  const rect = cv.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H };
}

// 내 로봇 근처를 누르고 당기면 조준, 그 밖을 밀면 화면 이동
cv.addEventListener('pointerdown', e => {
  if (phase !== 'aim' && phase !== 'fire') return;
  const p = toView(e), m = me();
  cv.setPointerCapture(e.pointerId);
  if (iCanAct()) {
    const s = toScreenPos(m.x, midY(m));
    if (Math.hypot(p.x - s.x, p.y - s.y) < GRAB_R) { drag = { mode: 'aim', sx: p.x, sy: p.y, x: p.x, y: p.y }; return; }
  }
  drag = { mode: 'pan', x: p.x, y: p.y };
  cam.manual = true;
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = toView(e);
  if (drag.mode === 'pan') { cam.tx -= (p.x - drag.x) / cam.z; drag.x = p.x; return; }
  if (!iCanAct()) return;
  drag.x = p.x; drag.y = p.y;
  const dx = drag.sx - p.x, dy = drag.sy - p.y, len = Math.hypot(dx, dy);
  if (len < 8) return;
  const pw = Math.min(len, MAX_DRAG) / MAX_DRAG * MAX_POWER;
  input({ t: 'aim', vx: Math.round(dx / len * pw), vy: Math.round(dy / len * pw) });
});
const endDrag = () => {
  if (drag && drag.mode === 'aim' && iCanAct()) { const m = me(); input({ t: 'aim', vx: Math.round(m.aim.vx), vy: Math.round(m.aim.vy), last: 1 }); }
  drag = null;
};
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);

const setMove = d => { if (moveDir === d) return; moveDir = d; if (d) cam.manual = false; if (iCanAct() || d === 0) input({ t: 'move', v: d }); };
document.querySelectorAll('#bar .shell').forEach(b => b.addEventListener('click', () => { if (iCanAct()) input({ t: 'slot', v: b.dataset.slot }); }));
document.querySelectorAll('#items button').forEach(b => b.addEventListener('click', () => {
  const m = me(), k = b.dataset.item;
  if (iCanAct() && m.items[k] > 0) input({ t: 'item', v: m.item === k ? null : k });
}));
document.querySelectorAll('#bar .move').forEach(b => {
  const dir = +b.dataset.dir;
  b.addEventListener('pointerdown', e => { e.preventDefault(); setMove(dir); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (moveDir === dir) setMove(0); });
});
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft' || e.key === 'a') setMove(-1);
  else if (e.key === 'ArrowRight' || e.key === 'd') setMove(1);
  else if ((e.key === ' ' || e.key === 'Enter') && iCanAct()) { e.preventDefault(); input({ t: 'ready' }); }
});
window.addEventListener('keyup', e => { if (['ArrowLeft', 'a', 'ArrowRight', 'd'].includes(e.key)) setMove(0); });
$('fire').addEventListener('click', () => { if (iCanAct()) input({ t: 'ready' }); });
$('skip').addEventListener('click', () => { if (iCanAct()) input({ t: 'ready', skip: 1 }); });
$('zoom').addEventListener('click', () => { overview = !overview; $('zoom').classList.toggle('on', overview); });
$('home').addEventListener('click', () => { cam.manual = false; overview = false; $('zoom').classList.remove('on'); });

// ---------- 맵·로봇 고르기(혼자 하기) ----------
function robotCard(id, title, desc, lines, model, onPick) {
  const b = document.createElement('button');
  b.className = 'card'; b.dataset.model = id;
  const c = document.createElement('canvas'); c.width = 170; c.height = 150;
  const g = c.getContext('2d');
  if (model) {
    const im = IMG['robot-' + model.id], tall = im ? model.art.w * im.height / im.width : 30;
    const k = Math.min(150 / (model.art.w + 30), 118 / (tall + 22));
    g.translate(80, 142); g.scale(k, k); drawRobotArt(g, model, 0, { vx: 1, vy: -0.8 }, 0);
  } else { g.font = '70px sans-serif'; g.textAlign = 'center'; g.fillText('🎲', 85, 100); }
  b.append(c);
  b.insertAdjacentHTML('beforeend', `<b>${title}</b><span>${desc}</span><small>${lines}</small>`);
  b.addEventListener('click', () => onPick(id));
  return b;
}
function robotCards(row, onPick) {
  row.innerHTML = '';
  for (const m of MODELS.filter(m => !m.special)) {
    const P = SHELLS[m.p], S = SHELLS[m.s];
    row.append(robotCard(m.id, m.name, m.desc, `1차 ${P.icon} ${P.name}<br>2차 ${S.icon} ${S.name}<br>궁 🌠 ${ULTS[m.ult].name}<br>체력 ${m.hp} · 이동 ${m.fuel}`, m, onPick));
  }
  row.append(robotCard('random', '랜덤', '무엇이 나올지 몰라요', `네 로봇 중 하나<br>${Math.round(SPECIAL_CHANCE * 100)}% 확률로<br>★ 특수 로봇!`, null, onPick));
}
function mapButtons(row, current, onPick) {
  row.innerHTML = '';
  for (const m of [{ id: 'random', name: '아무 맵', icon: '🎲', desc: '시작할 때 정해져요' }, ...MAPS]) {
    const b = document.createElement('button');
    b.className = 'chip' + (m.id === current ? ' on' : ''); b.dataset.map = m.id;
    b.innerHTML = `${m.icon} ${m.name}<small>${m.desc}</small>`;
    b.addEventListener('click', () => onPick(m.id));
    row.append(b);
  }
}
function buildPick() {
  mapButtons($('mapRow'), pickMap, id => { pickMap = id; buildPick(); });
  robotCards($('pickRow'), id => { mode = 'solo'; myId = 'me'; startMatch({ n: teamSize, mapId: pickMap, slots: [{ team: 0, i: 0, ctrl: 'me', name: '나', pick: id }] }); });
}

document.querySelectorAll('#menu button[data-n]').forEach(b => b.addEventListener('click', () => {
  teamSize = +b.dataset.n;
  buildPick();
  $('menu').classList.add('hidden'); $('pick').classList.remove('hidden');
}));
$('again').addEventListener('click', () => { if (mode !== 'client') startMatch(lastCfg); });
function toMenu() {
  phase = 'menu'; ground = null; mode = 'solo'; myId = 'me';
  for (const id of ['over', 'pick', 'lobby', 'zoom', 'home']) if ($(id)) $(id).classList.add('hidden');
  $('menu').classList.remove('hidden');
  updateBar();
}
$('toMenu').addEventListener('click', () => { if (net && mode !== 'solo') net.leave(); toMenu(); });

// ---------- js/net.js가 쓰는 문 ----------
window.Game = {
  MODELS, MAPS, TEAMS, startMatch, matchInfo, snapshot, loadMatch, applySnapshot, applyInput, toMenu, robotCards, mapButtons,
  setMode(m, id, n) { mode = m; myId = id; net = n; },
  get mode() { return mode; }, get phase() { return phase; }, get turn() { return turnNo; },
  hps: () => robots.map(r => Math.round(r.hp)).join('/'),
  // 나간 사람의 로봇은 컴퓨터가 이어받는다
  dropPlayer(id) {
    for (const r of robots) if (r.ctrl === id) { r.ctrl = null; r.ready = true; r.name += '(자리 비움)'; }
    if (lastCfg) lastCfg.slots = lastCfg.slots.filter(s => s.ctrl !== id);
  },
};

// ---------- 시작 ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now; T += dt;
  if (mode === 'client') { if (ground && phase !== 'menu') clientTick(dt); }
  else if (phase === 'aim' || phase === 'fire') update(dt);
  else if (phase === 'over') { moveBodies(dt); tickEffects(dt); }
  if (mode === 'host' && net && ground && phase !== 'menu' && ++frameNo % (phase === 'fire' ? 3 : 6) === 0) net.broadcast({ t: 'snap', s: snapshot() });
  if (ground) updateCam(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
