// 볼트윙(by motive) — 게임에 나오는 것들의 표. 숫자를 바꾸면 게임이 바로 바뀐다.
window.DATA = (() => {
'use strict';

// 기체: 체력·속도·맞는 범위(hit)와 궁극기가 다르다. unlock = 이 스테이지를 깨면 열림
const FRAMES = [
  { id: 'falcon', name: '매', desc: '빠르고 균형 잡힌 기체', hp: 100, speed: 1.1, hit: 6, color: '#4cc9ff',
    ult: { id: 'laser', name: '천공 레이저', desc: '3초 동안 앞을 꿰뚫는 굵은 광선, 닿는 탄도 지움' } },
  { id: 'turtle', name: '거북', desc: '튼튼하고 묵직한 기체', hp: 150, speed: 0.85, hit: 9, color: '#7bdc6b',
    ult: { id: 'bulwark', name: '철벽 방패', desc: '5초 무적, 닿는 탄을 고철로 바꾸고 부딪힌 적을 부숨' } },
  { id: 'hornet', name: '말벌', desc: '작고 날쌘 기체(맞는 범위가 작음)', hp: 80, speed: 1.3, hit: 4, color: '#ffc93c',
    ult: { id: 'swarm', name: '벌떼 미사일', desc: '적을 쫓아가는 미사일 30발' } },
  { id: 'phoenix', name: '불사조', desc: '불꽃 날개의 기체', hp: 95, speed: 1.05, hit: 6, color: '#ff6b5e', unlock: 5,
    ult: { id: 'nova', name: '불꽃 폭발', desc: '화면 전체를 태우고 체력 35% 회복' } },
];

// 주무기: 쏘는 방식과 소리가 다르다
const WEAPONS = [
  { id: 'vulcan', name: '발칸', desc: '빠르게 연사', rate: 10, dmg: 6, speed: 950, color: '#9ff3ff' },
  { id: 'spread', name: '확산포', desc: '부채꼴로 퍼짐', rate: 3.4, dmg: 5.5, pellets: 5, arc: 0.6, speed: 820, color: '#ffd166' },
  { id: 'laser', name: '레이저', desc: '적을 꿰뚫고 지나감', rate: 6, dmg: 9, pierce: 2, speed: 1300, color: '#ff7ad9', unlock: 2 },
  { id: 'missile', name: '유도탄', desc: '알아서 적을 쫓아감', rate: 2.8, dmg: 15, homing: true, speed: 540, color: '#ffb86b', unlock: 4 },
];

// 부품: 보스를 잡거나 큰 적을 부수면 나오고, 격납고에서 고철로 강화한다(최대 5단계)
const SLOTS = { engine: '엔진', armor: '장갑', chip: '칩', drone: '드론' };
const PARTS = [
  { id: 'turbo', slot: 'engine', name: '터보 엔진', icon: '🔥', desc: l => `이동 속도 +${8 * l}%` },
  { id: 'blink', slot: 'engine', name: '회피 엔진', icon: '💨', desc: l => `맞은 뒤 무적 시간 +${(0.25 * l).toFixed(2)}초` },
  { id: 'plate', slot: 'armor', name: '강화 장갑', icon: '🛡️', desc: l => `최대 체력 +${15 * l}` },
  { id: 'regen', slot: 'armor', name: '재생 장갑', icon: '💚', desc: l => `1초마다 체력 ${(0.4 * l).toFixed(1)} 회복` },
  { id: 'power', slot: 'chip', name: '화력 칩', icon: '💥', desc: l => `피해 +${7 * l}%` },
  { id: 'rapid', slot: 'chip', name: '연사 칩', icon: '⚡', desc: l => `연사 +${7 * l}%` },
  { id: 'ultchip', slot: 'chip', name: '궁극 칩', icon: '🌟', desc: l => `궁극기 충전 +${12 * l}%` },
  { id: 'magnet', slot: 'chip', name: '자석 칩', icon: '🧲', desc: l => `줍는 범위 +${25 * l}%` },
  { id: 'gun', slot: 'drone', name: '사격 드론', icon: '🛸', desc: l => `옆에서 함께 쏘는 드론(피해 ${3 + 2 * l})` },
  { id: 'guard', slot: 'drone', name: '방어 드론', icon: '🔰', desc: l => `둘레를 돌며 탄을 막는 드론 ${l >= 3 ? 2 : 1}대` },
  { id: 'seeker', slot: 'drone', name: '미사일 드론', icon: '🚀', desc: l => `${(3.2 - 0.3 * l).toFixed(1)}초마다 유도탄 2발` },
];
const PART_COST = l => 30 * l;      // 부품 강화 값(지금 단계 × 30 고철)
const WEAPON_COST = l => 40 * l;    // 무기 강화 값
const MAX_LV = 5;

// 판 안에서 레벨이 오르면 고르는 카드(이번 판에만 적용)
const CARDS = [
  { id: 'dmg', name: '화력 강화', icon: '💥', desc: '피해 +20%' },
  { id: 'rate', name: '연사 강화', icon: '⚡', desc: '연사 +18%' },
  { id: 'multi', name: '탄 갈래 +1', icon: '🔱', desc: '한 번에 쏘는 줄이 늘어남', max: 3 },
  { id: 'pierce', name: '관통 +1', icon: '🗡️', desc: '탄이 적 하나를 더 뚫음', max: 3 },
  { id: 'drone', name: '임시 드론', icon: '🛸', desc: '이번 판 동안 함께 쏘는 드론', max: 2 },
  { id: 'magnet', name: '자석', icon: '🧲', desc: '줍는 범위 +40%' },
  { id: 'heal', name: '수리', icon: '🔧', desc: '체력 40% 회복' },
  { id: 'maxhp', name: '장갑 보강', icon: '🛡️', desc: '최대 체력 +20' },
  { id: 'ult', name: '궁극 회로', icon: '🌟', desc: '궁극기 충전 +30%' },
  { id: 'speed', name: '추진기', icon: '💨', desc: '이동 속도 +12%' },
  { id: 'barrier', name: '보호막', icon: '🔵', desc: '16초마다 탄 한 번을 막음', max: 1 },
];

// 적: from = 이 스테이지부터 나옴, xp = 경험치 알
const ENEMIES = {
  scout:    { name: '정찰기', hp: 10, r: 16, xp: 1, score: 50, from: 1 },
  weaver:   { name: '물결기', hp: 14, r: 17, xp: 1, score: 70, from: 1 },
  diver:    { name: '돌격기', hp: 20, r: 17, xp: 2, score: 100, from: 2 },
  turret:   { name: '포대선', hp: 48, r: 23, xp: 3, score: 160, from: 2 },
  splitter: { name: '분열기', hp: 32, r: 20, xp: 2, score: 120, from: 3 },
  tank:     { name: '장갑기', hp: 140, r: 30, xp: 6, score: 400, from: 4, elite: true },
  netter:   { name: '그물기', hp: 36, r: 21, xp: 3, score: 180, from: 2 },   // 그물을 쏜다. 걸리면 연타해서 빠져나온다
  treasure: { name: '황금 수송선', hp: 160, r: 34, xp: 5, score: 1500, from: 1 },   // 가끔 지나간다. 놓치기 전에 부수면 고철이 쏟아진다
};

// 보스: 다섯이 차례로 나오고, 다섯 번째 다음부터는 더 세져서 다시 나온다
const BOSSES = [
  // 보스는 3단계로 싸운다(체력 2/3, 1/3에서 새 공격이 더해짐). 체력은 첫 보스가 35~45초 걸리도록 맞춤
  { id: 'spider', name: '강철 거미', hp: 3600, par: 40, tip: '둥글게 퍼지는 탄 → 지뢰와 거미줄 → 두 겹 소용돌이' },
  { id: 'whale', name: '폭풍 고래', hp: 4600, par: 45, tip: '숨을 들이쉬면 끌려간다 → 부채 탄이 두 배 → 틈이 하나뿐인 물방울 벽' },
  { id: 'twins', name: '쌍둥이 포대선', hp: 2400, par: 50, tip: '하나를 부수면 남은 쪽이 화를 내며 광선을 쏜다' },
  { id: 'knight', name: '거울 기사', hp: 5000, par: 55, tip: '거울 방패가 뜨면 내 탄이 되돌아온다 → 두 번 베기 → X자 베기' },
  { id: 'core', name: '코어 요새', hp: 6600, par: 60, tip: '네 갈래 소용돌이 → 조준 광선 → 여섯 갈래가 거꾸로 돈다' },
];

// 스테이지 배경(맵) 9가지. 스테이지마다 나오는 순서는 game.js의 THEME_ORDER
const THEMES = [
  { name: '푸른 바다 섬', sky: ['#1b5fbf', '#4a9ae8', '#a8d8ff'], cloud: 'rgba(255,255,255,', stars: false },
  { name: '노을 사막', sky: ['#2a1650', '#8a3a6a', '#ff8a5c'], cloud: 'rgba(255,200,190,', stars: false },
  { name: '밤바다 도시', sky: ['#040c1f', '#0b2a4a', '#13506e'], cloud: 'rgba(160,200,255,', stars: true, sea: true },
  { name: '우주', sky: ['#02030a', '#0a0b24', '#1a0f33'], cloud: 'rgba(150,120,255,', stars: true, space: true },
  { name: '녹슨 공장', sky: ['#1a1d22', '#4a4a48', '#8a8070'], cloud: 'rgba(120,120,120,', stars: false },
  { name: '얼음 설원', sky: ['#6f8fb0', '#c8dcea', '#eef6fb'], cloud: 'rgba(240,248,255,', stars: false },
  { name: '용암 화산', sky: ['#120806', '#3a1a10', '#7a3018'], cloud: 'rgba(90,60,50,', stars: false },
  { name: '밀림 유적', sky: ['#24402a', '#6f9a6a', '#c9e0b8'], cloud: 'rgba(220,240,220,', stars: false },
  { name: '구름 위 성', sky: ['#f2b8a0', '#f6d8d0', '#e8e0f4'], cloud: 'rgba(255,240,245,', stars: false },
];

return { FRAMES, WEAPONS, SLOTS, PARTS, PART_COST, WEAPON_COST, MAX_LV, CARDS, ENEMIES, BOSSES, THEMES };
})();
