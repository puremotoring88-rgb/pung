// 볼트윙(by motive) — 표창 공방(방치형). 시간이 지나면 표창이 생기고, 같은 단계 둘을 끌어다 합치면 한 단계 위가 된다.
// 가장 좋은 표창 다섯 개가 로봇 둘레를 돌며 적에게 날아간다. 돈은 슈팅 쪽 고철과 따로 '금화'를 쓴다.
window.Forge = (() => {
'use strict';
const TAU = Math.PI * 2;
const TIER = ['#9aa6b4', '#c87533', '#e3e8ef', '#ffd166', '#6ee3a8', '#4cc9ff', '#ff5d8f', '#b98bff', '#ff8a3c', '#ffffff'];
const TIER_NAME = ['쇠', '구리', '은', '금', '비취', '청옥', '홍옥', '자수정', '태양', '별빛'];
const UPS = [
  { id: 'spd', icon: '⏱', name: '제작 속도', max: 10, cost: l => Math.round(40 * Math.pow(2, l)), desc: l => `표창이 생기는 간격 ${(6 / (1 + 0.18 * l)).toFixed(1)}초` },
  { id: 'gen', icon: '🔨', name: '제작 단계', max: 8, cost: l => Math.round(180 * Math.pow(3, l)), desc: l => `새 표창이 Lv ${1 + l}로 나옴` },
  { id: 'gold', icon: '💰', name: '금화 수집', max: 15, cost: l => Math.round(70 * Math.pow(1.8, l)), desc: l => `얻는 금화 +${20 * l}%` },
  { id: 'slots', icon: '🧰', name: '보관 칸', max: 4, cost: l => Math.round(300 * Math.pow(4, l)), desc: l => `칸 ${8 + l}개` },
];
let S, cb, el, dragFrom = null, ghost = null, genT = 0, fever = 0, feverT = 0, made = 0;
const F = () => S.forge;
const slots = () => 8 + F().up.slots;
const tierOf = lv => TIER[Math.floor((lv - 1) / 3) % TIER.length];
const nameOf = lv => `${TIER_NAME[Math.floor((lv - 1) / 3) % TIER_NAME.length]} 표창`;
const starDmg = lv => 4 * Math.pow(1.62, lv - 1) * (1 + 0.15 * F().shards);
const goldMult = () => (1 + 0.2 * F().up.gold) * (1 + 0.15 * F().shards);
const buyCost = () => Math.round(10 * Math.pow(1.15, F().bought));
const fmt = n => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(Math.floor(n)));

// 표창 그림(단계마다 색이 바뀌고, 10단계마다 날이 늘어난다)
const cache = {};
function sprite(lv, size = 64) {
  const k = lv + ':' + size;
  if (cache[k]) return cache[k];
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = size * 0.44, col = tierOf(lv), blades = [4, 5, 6, 8][Math.min(3, Math.floor((lv - 1) / 10))];
  g.translate(size / 2, size / 2);
  if (lv >= 7) { const gl = g.createRadialGradient(0, 0, 2, 0, 0, r * 1.15); gl.addColorStop(0, col); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.45; g.fillStyle = gl; g.fillRect(-size / 2, -size / 2, size, size); g.globalAlpha = 1; }
  g.beginPath();
  for (let i = 0; i < blades * 2; i++) { const a = i / (blades * 2) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.32 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath();
  const m = g.createLinearGradient(-r, -r, r, r); m.addColorStop(0, '#ffffff'); m.addColorStop(0.35, col); m.addColorStop(1, '#1a1f2b');
  g.fillStyle = m; g.fill(); g.lineWidth = Math.max(1.5, size / 32); g.strokeStyle = '#0b0f18'; g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.2, 0, TAU); g.fillStyle = '#0b0f18'; g.fill(); g.strokeStyle = col; g.lineWidth = Math.max(1, size / 40); g.stroke();
  return (cache[k] = c);
}

function init(o) {
  S = o.S; cb = o;
  S.forge = Object.assign({ gold: 0, grid: [], up: { spd: 0, gen: 0, gold: 0, slots: 0 }, shards: 0, bought: 0, maxLv: 1, earned: 0, rebirths: 0 }, S.forge || {});
  S.forge.up = Object.assign({ spd: 0, gen: 0, gold: 0, slots: 0 }, S.forge.up);
  while (F().grid.length < 12) F().grid.push(0);
  if (!F().grid.some(Boolean)) F().grid[0] = 1;
  el = document.getElementById('forge');
  el.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  el.querySelector('#fBuy').addEventListener('click', buy);
  el.querySelector('#fUpBtn').addEventListener('click', () => { el.querySelector('#fUps').classList.toggle('hidden'); renderUps(); cb.sfx('click'); });
  el.querySelector('#fReborn').addEventListener('click', reborn);
}

function place(lv) {   // 빈 칸에 표창 넣기
  const g = F().grid;
  for (let i = 0; i < slots(); i++) if (!g[i]) { g[i] = lv; noteMax(lv); render(); return true; }
  return false;
}
function noteMax(lv) {
  if (lv > F().maxLv) {
    F().maxLv = lv;
    const sc = 5 * lv;
    S.scrap += sc;   // 슈팅 쪽과 느슨한 연결: 새 최고 단계마다 고철
    cb.toast(`새 표창! ${nameOf(lv)} Lv ${lv} · 고철 +${sc}`);
    cb.sfx('part');
  }
}
function buy() {
  const c = buyCost();
  if (F().gold < c) { cb.sfx('click'); return; }
  if (!place(1 + F().up.gen)) { cb.toast('칸이 가득 찼어요. 합쳐서 비우세요'); return; }
  F().gold -= c; F().bought++; cb.sfx('buy'); render();
}
function rebornGain() { return Math.floor(Math.max(0, S.idle.best - 9) * 1.5); }
function reborn() {
  const gain = rebornGain();
  if (gain < 1) { cb.toast('구역 10을 넘기면 환생할 수 있어요'); return; }
  if (!window.confirm(`환생하면 금화·표창·공방 강화와 구역이 처음으로 돌아가고, 별조각 ${gain}개를 받습니다.\n별조각 하나마다 표창 피해와 금화가 영원히 15%씩 늘어납니다. 환생할까요?`)) return;
  const f = F();
  f.shards += gain; f.rebirths++; f.gold = 0; f.grid = Array(12).fill(0); f.grid[0] = 1; f.up = { spd: 0, gen: 0, gold: 0, slots: 0 }; f.bought = 0;
  S.idle.zone = 1; S.idle.best = 1;
  cb.sfx('part'); cb.reborn();
  render();
}

// 끌어서 합치기
function cellAt(x, y) { const c = document.elementFromPoint(x, y); return c && c.closest ? c.closest('.fCell') : null; }
function down(e) {
  const c = e.target.closest('.fCell');
  if (!c) return;
  const i = +c.dataset.i;
  if (!F().grid[i]) return;
  e.preventDefault();
  dragFrom = i;
  ghost = document.createElement('canvas'); ghost.width = ghost.height = 64; ghost.className = 'fGhost';
  ghost.getContext('2d').drawImage(sprite(F().grid[i]), 0, 0);
  document.getElementById('stage').append(ghost);
  move(e);
}
function move(e) {
  if (!ghost) return;
  const r = document.getElementById('stage').getBoundingClientRect();
  ghost.style.left = (e.clientX - r.left - ghost.offsetWidth / 2) + 'px'; ghost.style.top = (e.clientY - r.top - ghost.offsetHeight / 2) + 'px';
}
function up(e) {
  if (!ghost) return;
  ghost.remove(); ghost = null;
  const c = cellAt(e.clientX, e.clientY), g = F().grid, a = dragFrom;
  dragFrom = null;
  if (!c) return;
  const b = +c.dataset.i;
  if (b === a || b >= slots()) return;
  if (g[b] === g[a]) { g[b]++; g[a] = 0; noteMax(g[b]); cb.sfx('levelup'); cb.merged(g[b]); fillPending(); }
  else { const t = g[b]; g[b] = g[a]; g[a] = t; cb.sfx('click'); }
  render();
}

function tick(dt, running) {
  const iv = 6 / (1 + 0.18 * F().up.spd);
  if (running) {
    genT += dt;
    if (genT >= iv) { genT = 0; made++; if (place(1 + F().up.gen)) cb.sfx('xp'); else F().pend = Math.min(30, (F().pend || 0) + 1); }   // 칸이 차면 대기 바구니로
  }
  if (feverT > 0) feverT -= dt; else fever = Math.max(0, fever - dt * 0.08);
  const bar = el.querySelector('#fGen');
  if (bar) bar.style.width = Math.min(100, genT / iv * 100) + '%';
  const fb = el.querySelector('#fFever');
  if (fb) { fb.style.width = (feverT > 0 ? 100 : fever * 100) + '%'; fb.parentElement.classList.toggle('on', feverT > 0); }
  el.querySelector('#fGold').textContent = fmt(F().gold);
  el.querySelector('#fBuy').innerHTML = `⭐ 사기 <small>💰${fmt(buyCost())}</small>`;
  el.querySelector('#fBuy').disabled = F().gold < buyCost();
}
// 화면을 톡톡 두드리면 열기가 차고, 다 차면 5초 동안 표창 폭풍(던지기 3배)
function tap(v = 0.05) { if (feverT > 0) return; fever += v; if (fever >= 1) { fever = 0; feverT = 5; cb.sfx('rush'); cb.toast('표창 폭풍! 5초 동안 3배로 던진다'); } }
function addGold(n) { const v = n * goldMult(); F().gold += v; F().earned += v; return v; }
function equipped() { return F().grid.slice(0, slots()).filter(Boolean).sort((a, b) => b - a).slice(0, 5); }

function render() {
  if (!el) return;
  const g = el.querySelector('#fGrid'); g.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const d = document.createElement('div'); d.className = 'fCell' + (i >= slots() ? ' locked' : ''); d.dataset.i = i;
    const lv = F().grid[i];
    if (i < slots() && lv) { const cv = sprite(lv); const im = document.createElement('canvas'); im.width = im.height = 64; im.getContext('2d').drawImage(cv, 0, 0); d.append(im); d.insertAdjacentHTML('beforeend', `<b style="color:${tierOf(lv)}">${lv}</b>`); }
    if (i >= slots()) d.textContent = '🔒';
    g.append(d);
  }
  const eq = equipped();
  el.querySelector('#fInfo').innerHTML = `${F().pend ? `📦 대기 ${F().pend} · ` : ''}장착 ${eq.map(l => `<b style="color:${tierOf(l)}">${l}</b>`).join(' ')} · 최고 Lv ${F().maxLv} · ✨ 별조각 ${F().shards}`;
  const gain = rebornGain();
  el.querySelector('#fReborn').innerHTML = `✨ 환생 <small>${gain >= 1 ? `+${gain}` : '구역 10↑'}</small>`;
  renderUps();
}
function renderUps() {
  const box = el.querySelector('#fUps');
  if (box.classList.contains('hidden')) return;
  box.innerHTML = '';
  for (const u of UPS) {
    const l = F().up[u.id], row = document.createElement('div'); row.className = 'fUp';
    row.innerHTML = `<span>${u.icon} <b>${u.name}</b> ${l}/${u.max}<small>${u.desc(l)}${l < u.max ? ` → ${u.desc(l + 1)}` : ''}</small></span>`;
    if (l < u.max) {
      const b = document.createElement('button'), c = u.cost(l); b.textContent = `💰${fmt(c)}`; b.disabled = F().gold < c;
      b.addEventListener('click', () => { if (F().gold < c) return; F().gold -= c; F().up[u.id]++; cb.sfx('buy'); render(); });
      row.append(b);
    }
    box.append(row);
  }
}
// 싸우는 동안 칸이 차서 못 넣은 표창은 대기 바구니에 있다가, 합쳐서 칸이 비면 들어온다
function fillPending() { while ((F().pend || 0) > 0 && place(1 + F().up.gen)) F().pend--; }
function takeMade() { const m = made; made = 0; return m; }
function show(on) { el.classList.toggle('hidden', !on); if (on) { fillPending(); render(); } }

return { init, tick, tap, addGold, fillPending, takeMade, equipped, starDmg, sprite, tierOf, render, show, fmt, get fever() { return feverT > 0; }, get gold() { return F().gold; } };
})();
