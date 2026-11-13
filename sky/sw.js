// 볼트윙 — 인터넷이 없어도 열리게: 한 번 열었던 게임 파일을 기기에 넣어 둔다.
// 인터넷이 되면 늘 새 파일을 먼저 받고(업데이트가 바로 보이게), 안 되면 넣어 둔 파일을 쓴다.
const CACHE = 'boltwing-v34';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'js/data.js', 'js/audio.js', 'js/art.js', 'js/duel.js', 'js/forge.js', 'js/rank.js', 'js/cloud.js', 'js/notice.js', 'js/lobby.js', 'js/escape.js', 'js/game.js', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/bg-0.jpg', 'assets/bg-1.jpg', 'assets/bg-2.jpg', 'assets/bg-3.jpg', 'assets/bg-4.jpg', 'assets/bg-5.jpg', 'assets/bg-6.jpg', 'assets/bg-7.jpg', 'assets/bg-8.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;   // 서버(랭킹·계정)·다른 사이트는 건드리지 않는다
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
