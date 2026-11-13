// 작은 QR 코드 만들기(바이트 방식, 오류 고침 L, 버전 1~6 = 글자 약 130바이트까지). 사진 카드에 게임 주소를 넣는 데 쓴다.
// 바깥 라이브러리 없이 QR 표준(ISO 18004)의 계산만 옮겼다.
'use strict';
window.QR = (() => {
const VER = [null, [26, 7, 1], [44, 10, 1], [70, 15, 1], [100, 20, 1], [134, 26, 1], [172, 18, 2]];   // [전체 칸, 블록마다 고침 칸, 블록 수]
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; };
function divisor(n) {
  const r = new Array(n).fill(0); r[n - 1] = 1; let root = 1;
  for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) { r[j] = mul(r[j], root); if (j + 1 < n) r[j] ^= r[j + 1]; } root = mul(root, 2); }
  return r;
}
function remainder(data, dv) {
  const r = dv.map(() => 0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); dv.forEach((c, i) => { r[i] ^= mul(c, f); }); }
  return r;
}
function make(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let v = 1;
  for (; v <= 6; v++) { const [tot, ec, nb] = VER[v]; if (bytes.length + 2 <= tot - ec * nb) break; }
  if (v > 6) throw new Error('QR: 너무 길어요');
  const [tot, ec, nb] = VER[v], dataLen = tot - ec * nb, size = v * 4 + 17;
  // 비트 줄: 방식 0100, 길이 8비트, 바이트들, 끝 표시, 채움
  const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, 8); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, dataLen * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let p = 0; data.length < dataLen; p ^= 1) data.push(p ? 0x11 : 0xEC);
  // 블록마다 고침 칸 붙이고 번갈아 섞기
  const per = dataLen / nb, dv = divisor(ec), blocks = [], eccs = [];
  for (let b = 0; b < nb; b++) { const d = data.slice(b * per, (b + 1) * per); blocks.push(d); eccs.push(remainder(d, dv)); }
  const all = [];
  for (let i = 0; i < per; i++) blocks.forEach(d => all.push(d[i]));
  for (let i = 0; i < ec; i++) eccs.forEach(e => all.push(e[i]));
  // 판 그리기
  const M = Array.from({ length: size }, () => new Array(size).fill(false)), F = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
  for (let i = 0; i < size; i++) { fn(6, i, i % 2 === 0); fn(i, 6, i % 2 === 0); }   // 시간 줄
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < size && y >= 0 && y < size) fn(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[v];
  for (const ay of al) for (const ax of al) {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ax === al[al.length - 1] && ay === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const fmt = mask => {   // 형식 정보(오류 고침 L = 01)
    const d = (1 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) fn(8, i, g(i));
    fn(8, 7, g(6)); fn(8, 8, g(7)); fn(7, 8, g(8));
    for (let i = 9; i < 15; i++) fn(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) fn(size - 1 - i, 8, g(i));
    for (let i = 8; i < 15; i++) fn(8, size - 15 + i, g(i));
    fn(8, size - 8, true);
  };
  fmt(0);   // 자리를 먼저 잡아 둔다
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!F[y][x] && k < all.length * 8) { M[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
    }
  }
  // 무늬 덮기: 0번((x+y) 짝수) 하나만 쓴다(표준에서 어느 무늬든 읽힌다)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && (x + y) % 2 === 0) M[y][x] = !M[y][x];
  fmt(0);
  return M;
}
// g에 (x, y)부터 w 크기로 그린다(둘레 흰 여백 포함)
function draw(g, text, x, y, w, dark = '#000', light = '#fff') {
  const M = make(text), n = M.length + 8, s = w / n;
  g.fillStyle = light; g.fillRect(x, y, w, w); g.fillStyle = dark;
  for (let r = 0; r < M.length; r++) for (let c = 0; c < M.length; c++) if (M[r][c]) g.fillRect(Math.floor(x + (c + 4) * s), Math.floor(y + (r + 4) * s), Math.ceil(s), Math.ceil(s));
}
return { make, draw };
})();
