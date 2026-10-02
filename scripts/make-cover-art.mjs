// 커버 그림 생성 스크립트 (일회성, 배포 산출물과 무관) — 웨딩 촬영 사진 전까지 쓰는 임시 커버.
// 종이 청첩장처럼 미니멀한 아이보리 종이 결 + 위쪽 가운데 올리브 가지 장식. 글자는 넣지 않음
// (손글씨·성함은 페이지가 그림 위/아래에 따로 그림). 이중 테두리는 화면 비율마다 잘리지 않게
// 그림이 아니라 CSS(.cover--paper)로 보이는 화면에 맞춰 그림.
// 실행: npm install && node scripts/make-cover-art.mjs   (그 뒤 node scripts/bump-assets.mjs)
//
// 크기 1080×2160(1:2) — 폰은 위아래가 그대로 보이고, PC(480×800)는 위아래가 약 180px씩 잘림
// → 장식은 y≈330(PC 에서도 화면 안), 손글씨 자리(화면 높이의 65~85%)는 비움.
import sharp from 'sharp';

const W = 1080, H = 2160, CX = W / 2;
const INK = '#701018';      // 버건디 (--accent)
const PAPER = '#faf5ee';    // 아이보리 (--cover-bg)

// 2차 베지어 위 점·기울기
function quad(p, t) {
  const u = 1 - t;
  return {
    x: u * u * p[0] + 2 * u * t * p[2] + t * t * p[4],
    y: u * u * p[1] + 2 * u * t * p[3] + t * t * p[5],
    a: Math.atan2(2 * u * (p[3] - p[1]) + 2 * t * (p[5] - p[3]), 2 * u * (p[2] - p[0]) + 2 * t * (p[4] - p[2])) * 180 / Math.PI
  };
}
const leaf = (x, y, deg, len, wid) =>
  `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})" ` +
  `d="M0 0 C ${len * 0.3} ${-wid} ${len * 0.75} ${-wid * 0.8} ${len} 0 C ${len * 0.75} ${wid * 0.8} ${len * 0.3} ${wid} 0 0 Z"/>`;

// 가운데에서 바깥으로 뻗는 올리브 가지 하나 (dir = -1 왼쪽, 1 오른쪽)
function branch(dir) {
  const p = [CX + dir * 14, 340, CX + dir * 150, 360, CX + dir * 270, 300];
  let s = `<path d="M${p[0]} ${p[1]} Q ${p[2]} ${p[3]} ${p[4]} ${p[5]}" fill="none" stroke-width="2"/>`;
  const N = 7;
  for (let i = 1; i <= N; i++) {
    const t = i / (N + 0.6), q = quad(p, t);
    const size = 1 - t * 0.45;
    const fwd = dir > 0 ? q.a : q.a + 180;            // 가지 끝 방향
    s += leaf(q.x, q.y, fwd - dir * 38, 46 * size, 10 * size);   // 위쪽 잎
    s += leaf(q.x, q.y, fwd + dir * 38, 42 * size, 9 * size);    // 아래쪽 잎
  }
  const tip = quad(p, 1);
  s += leaf(tip.x, tip.y, dir > 0 ? tip.a : tip.a + 180, 30, 7);
  // 작은 열매 두 개
  [0.35, 0.62].forEach((t, k) => {
    const q = quad(p, t);
    s += `<circle cx="${(q.x + dir * 4).toFixed(1)}" cy="${(q.y + (k ? -16 : 15)).toFixed(1)}" r="4.2" fill="${INK}" fill-opacity=".55" stroke="none"/>`;
  });
  return s;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <filter id="paper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".018 .45" numOctaves="2" seed="9"/>
    <feColorMatrix values="0 0 0 0 .55  0 0 0 0 .45  0 0 0 0 .40  0 0 0 .05 0"/>
  </filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5"/>
    <feColorMatrix values="0 0 0 0 .4  0 0 0 0 .3  0 0 0 0 .3  0 0 0 .05 0"/>
  </filter>
  <radialGradient id="light" cx="${CX}" cy="700" r="1300" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#e9dfd2" stop-opacity=".35"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="${PAPER}"/>
<rect width="${W}" height="${H}" fill="url(#light)"/>
<rect width="${W}" height="${H}" filter="url(#paper)"/>
<g fill="${INK}" fill-opacity=".1" stroke="${INK}" stroke-opacity=".62" stroke-width="1.6" stroke-linejoin="round">
  ${branch(-1)}${branch(1)}
  <path d="M${CX} 326 l 9 14 l -9 14 l -9 -14 Z" fill-opacity=".5"/>
</g>
<rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toFile('assets/img/cover.jpg');
const meta = await sharp('assets/img/cover.jpg').metadata();
console.log(`assets/img/cover.jpg ${meta.width}x${meta.height}`);
