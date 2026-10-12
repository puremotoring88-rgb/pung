// 로봇 포격전 — 친구와 함께(온라인)
// 방을 만든 사람(방장)의 기기가 게임을 계산하고, 참가자는 조작만 보내고 화면을 받아 그린다.
// 연결은 PeerJS(가입 없이 쓰는 공개 연결 서비스)로 맺고, 그 뒤로는 기기끼리 직접 주고받는다.
(() => {
'use strict';

const G = window.Game;
const $ = id => document.getElementById(id);
const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'robot-pogyeok-v1-';   // 다른 사람의 PeerJS 방과 겹치지 않게 붙이는 머리말
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let peer = null, isHost = false, myId = null, room = '';
let conns = new Map();     // 방장: 참가자 번호표 → 연결
let hostConn = null;       // 참가자: 방장과의 연결
let lobby = { n: 2, map: 'random', players: [] };   // players: { id, name, team, pick }

const nick = () => ($('nick').value.trim() || '플레이어').slice(0, 8);
const say = text => { $('lobbyMsg').textContent = text; };

function loadPeerLib() {
  return new Promise((ok, fail) => {
    if (window.Peer) return ok();
    const s = document.createElement('script');
    s.src = PEER_SRC; s.onload = ok; s.onerror = () => fail(new Error('lib'));
    document.head.append(s);
  });
}

// ---------- 게임 본체에 건네는 통로 ----------
const api = {
  send(m) { if (hostConn && hostConn.open) hostConn.send({ t: 'in', m }); },
  broadcast(o) { for (const c of conns.values()) if (c.open) c.send(o); },
  matchStarted() { api.broadcast({ t: 'start', info: G.matchInfo() }); },
  leave() { closeAll(); },
};

function closeAll() {
  if (peer) { try { peer.destroy(); } catch (e) { /* 이미 닫힘 */ } }
  peer = null; hostConn = null; conns = new Map(); isHost = false; myId = null;
  $('toLobby').classList.add('hidden');
  try { if (location.search) history.replaceState(null, '', location.pathname); } catch (e) { /* 주소를 못 바꾸는 환경 */ }
}

// ---------- 대기실 화면 ----------
function showLobby() {
  for (const id of ['menu', 'pick', 'over']) $(id).classList.add('hidden');
  $('lobby').classList.remove('hidden');
}

function renderLobby() {
  $('roomCode').textContent = room ? `방 ${room}` : '';
  $('link').value = room ? `${location.origin}${location.pathname}?room=${room}` : '';
  $('inviteRow').classList.toggle('hidden', !room);
  $('selSize').value = lobby.n; $('selMap').value = lobby.map;
  $('selSize').disabled = $('selMap').disabled = !isHost;
  $('startGame').classList.toggle('hidden', !isHost);
  const mine = lobby.players.find(p => p.id === myId);
  if (mine) $('selRobot').value = mine.pick;
  const box = $('teams');
  box.innerHTML = '';
  G.TEAMS.forEach((tm, t) => {
    const col = document.createElement('div');
    col.className = 'team'; col.style.borderColor = tm.color;
    const list = lobby.players.filter(p => p.team === t);
    col.innerHTML = `<b style="color:${tm.light}">${tm.name}</b>`;
    for (let i = 0; i < lobby.n; i++) {
      const p = list[i], d = document.createElement('div');
      if (p) {
        const model = G.MODELS.find(m => m.id === p.pick);
        d.textContent = `${p.id === 'host' ? '👑 ' : ''}${p.name}${p.id === myId ? ' (나)' : ''} · ${model ? model.name : '랜덤'}`;
      } else { d.className = 'bot'; d.textContent = '컴퓨터 로봇'; }
      col.append(d);
    }
    if (mine && mine.team !== t && list.length < lobby.n) {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = '이 팀으로 옮기기';
      b.addEventListener('click', () => change({ team: t }));
      col.append(b);
    }
    box.append(col);
  });
  if (isHost) say(lobby.players.length > 1 ? `${lobby.players.length}명이 모였습니다. 준비되면 시작을 누르세요.` : '초대 링크를 친구에게 보내세요. 혼자 시작하면 나머지는 컴퓨터 로봇입니다.');
  else if (mine) say('방장이 시작하기를 기다리는 중입니다.');
}

// 내 설정을 바꾼다(방장은 바로, 참가자는 방장에게 부탁)
function change(patch) {
  if (isHost) { setPlayer('host', patch); pushLobby(); }
  else if (hostConn && hostConn.open) hostConn.send({ t: 'set', patch });
}

// ---------- 방장 쪽 ----------
function setPlayer(id, patch) {
  const p = lobby.players.find(o => o.id === id);
  if (!p) return;
  if (typeof patch.name === 'string') p.name = patch.name.slice(0, 8) || '플레이어';
  if (patch.pick === 'random' || G.MODELS.some(m => m.id === patch.pick && !m.special)) p.pick = patch.pick;
  if ((patch.team === 0 || patch.team === 1) && lobby.players.filter(o => o.team === patch.team).length < lobby.n) p.team = patch.team;
}

function pushLobby(back) {
  api.broadcast({ t: 'lobby', lobby, room, back: !!back });
  renderLobby();
}

function hostMessage(id, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'hello') {
    if (lobby.players.length >= 6) { const c = conns.get(id); if (c) c.send({ t: 'full' }); return; }
    const count = t => lobby.players.filter(p => p.team === t).length;
    if (lobby.players.length >= lobby.n * 2) lobby.n = Math.min(3, lobby.n + 1);   // 자리가 모자라면 인원을 늘린다
    lobby.players.push({ id, name: String(msg.name || '플레이어').slice(0, 8), team: count(0) <= count(1) ? 0 : 1, pick: 'random' });
    pushLobby();
  } else if (msg.t === 'set' && msg.patch) { setPlayer(id, msg.patch); pushLobby(); }
  else if (msg.t === 'in' && msg.m) G.applyInput(id, msg.m);
}

function startHost(fixed) {
  room = fixed || Array.from({ length: 5 }, () => LETTERS[(Math.random() * LETTERS.length) | 0]).join('');
  peer = new window.Peer(PREFIX + room);
  peer.on('open', () => {
    isHost = true; myId = 'host';
    lobby = { n: 2, map: 'random', players: [{ id: 'host', name: nick(), team: 0, pick: 'random' }] };
    renderLobby();
  });
  peer.on('connection', c => {
    const id = c.peer;
    conns.set(id, c);
    c.on('data', msg => hostMessage(id, msg));
    c.on('close', () => {
      conns.delete(id);
      lobby.players = lobby.players.filter(p => p.id !== id);
      G.dropPlayer(id);
      pushLobby();
    });
  });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') { peer.destroy(); startHost(); }   // 방 번호가 겹치면 다시 뽑는다
    else say('연결에 문제가 생겼습니다(' + e.type + '). 잠시 뒤 다시 해 보세요.');
  });
}

function hostStart() {
  if (!isHost) return;
  const per = [0, 1].map(t => lobby.players.filter(p => p.team === t));
  const n = Math.max(lobby.n, per[0].length, per[1].length);
  const slots = [];
  per.forEach((list, t) => list.forEach((p, i) => slots.push({ team: t, i, ctrl: p.id, name: p.name, pick: p.pick })));
  $('toLobby').classList.remove('hidden');
  G.setMode('host', 'host', api);
  G.startMatch({ n, mapId: lobby.map, slots });
}

// ---------- 참가자 쪽 ----------
function clientMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'lobby') {
    lobby = msg.lobby; room = msg.room;
    if (msg.back && G.phase !== 'menu') G.toMenu();
    if (G.phase === 'menu') showLobby();
    renderLobby();
  } else if (msg.t === 'start') {
    G.setMode('client', myId, api);
    G.loadMatch(msg.info);
  } else if (msg.t === 'snap') { if (G.mode === 'client') G.applySnapshot(msg.s); }
  else if (msg.t === 'full') say('방이 가득 찼습니다(최대 6명).');
}

function startClient(code) {
  room = code;
  peer = new window.Peer();
  peer.on('open', id => {
    myId = id;
    hostConn = peer.connect(PREFIX + code, { reliable: true });   // 기본 방식(큰 소식은 알아서 나눠 보냄). json 방식은 16KB를 넘으면 버려진다
    hostConn.on('open', () => { say('방에 들어왔습니다.'); hostConn.send({ t: 'hello', name: nick() }); });
    hostConn.on('data', clientMessage);
    hostConn.on('close', () => {
      const was = G.phase;
      closeAll(); G.toMenu(); showLobby(); renderLobby();
      say(was === 'menu' ? '방과의 연결이 끊겼습니다.' : '방장이 나가서 게임이 끝났습니다.');
      $('teams').innerHTML = '';
    });
  });
  peer.on('error', e => say(e.type === 'peer-unavailable' ? '방을 찾지 못했습니다. 방장이 방을 열어 두었는지, 링크가 맞는지 확인해 주세요.' : '연결에 문제가 생겼습니다(' + e.type + ').'));
}

// ---------- 들어가기 ----------
async function enter(code, hostCode) {
  showLobby();
  $('teams').innerHTML = ''; room = ''; renderLobby();
  say('연결하는 중…');
  try { await loadPeerLib(); } catch (e) { say('연결 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); return; }
  if (code) startClient(code); else startHost(hostCode);
}

// 화면 요소 채우기와 버튼
for (const m of [{ id: 'random', name: '아무 맵' }, ...G.MAPS]) $('selMap').add(new Option(m.name, m.id));
for (const m of [{ id: 'random', name: '랜덤' }, ...G.MODELS.filter(m => !m.special)]) $('selRobot').add(new Option(m.name, m.id));
try { $('nick').value = localStorage.getItem('rp-nick') || ''; } catch (e) { /* 저장소를 못 쓰는 환경 */ }

$('nick').addEventListener('change', () => {
  try { localStorage.setItem('rp-nick', nick()); } catch (e) { /* 무시 */ }
  change({ name: nick() });
});
$('selRobot').addEventListener('change', () => change({ pick: $('selRobot').value }));
$('selSize').addEventListener('change', () => {
  if (!isHost) return;
  const need = Math.max(...[0, 1].map(t => lobby.players.filter(p => p.team === t).length));
  lobby.n = Math.max(+$('selSize').value, need, 1);
  pushLobby();
});
$('selMap').addEventListener('change', () => { if (isHost) { lobby.map = $('selMap').value; pushLobby(); } });
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('link').value); $('copy').textContent = '복사했습니다 ✔'; }
  catch (e) { $('link').select(); $('copy').textContent = '링크를 길게 눌러 복사하세요'; }
  setTimeout(() => { $('copy').textContent = '초대 링크 복사'; }, 2500);
});
$('online').addEventListener('click', () => enter(null));
$('startGame').addEventListener('click', hostStart);
$('leave').addEventListener('click', () => { closeAll(); G.toMenu(); });
$('toLobby').addEventListener('click', () => { if (isHost) { G.toMenu(); showLobby(); pushLobby(true); } });
$('pickBack').addEventListener('click', () => G.toMenu());

// 초대 링크(?room=방번호)로 들어온 경우 바로 대기실로
const invited = new URLSearchParams(location.search).get('room');
const forced = new URLSearchParams(location.search).get('host');   // 점검용: 방 번호를 정해서 방 만들기
if (invited && /^[A-Z0-9]{5}$/.test(invited.toUpperCase())) enter(invited.toUpperCase());
else if (forced && /^[A-Z0-9]{5}$/.test(forced)) enter(null, forced);
})();
