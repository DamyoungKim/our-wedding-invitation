// 커버 그림 생성 스크립트 (일회성, 배포 산출물과 무관) — 웨딩 촬영 사진 전까지 쓰는 일러스트.
// 버건디 배경 + 채플 아치 창(장미창·창살) + 양옆 꽃 넝쿨 + 반짝임. 손글씨(We're getting married)가
// 올라가는 아래쪽은 어둡게 비워 둠. SVG 로 그려 sharp 로 assets/img/cover.jpg 를 만듦.
// 실행: npm install && node scripts/make-cover-art.mjs   (그 뒤 node scripts/bump-assets.mjs)
//
// 크기 1080×2160(1:2) — 폰(약 1:2.2)·PC(480×800) 어디서 잘려도 아치가 가운데 오도록 배치.
// 손글씨는 보이는 화면 높이의 약 65~85% 구간 → 아치는 위쪽(창턱 y≈1050)에 두고 아래는 빛길만 남김
// (카카오톡처럼 보이는 높이가 짧은 화면에서도 글씨가 아치·꽃과 겹치지 않게).
import sharp from 'sharp';

const W = 1080, H = 2160, CX = W / 2;
const LINE = '#f3dfc6';      // 크림 골드 선
const ROSE = '#e7b3b3';      // 더스티 로즈 꽃

// 결정적 난수 (매번 같은 그림)
let seed = 20261212;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// 3차 베지어 위 점·기울기
function bez(p, t) {
  const u = 1 - t;
  const x = u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6];
  const y = u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7];
  const dx = 3 * u * u * (p[2] - p[0]) + 6 * u * t * (p[4] - p[2]) + 3 * t * t * (p[6] - p[4]);
  const dy = 3 * u * u * (p[3] - p[1]) + 6 * u * t * (p[5] - p[3]) + 3 * t * t * (p[7] - p[5]);
  return { x, y, a: Math.atan2(dy, dx) * 180 / Math.PI };
}
const leaf = (x, y, deg, len) =>
  `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})" ` +
  `d="M0 0 C ${len * 0.35} ${-len * 0.32} ${len * 0.75} ${-len * 0.28} ${len} 0 C ${len * 0.75} ${len * 0.28} ${len * 0.35} ${len * 0.32} 0 0 Z M0 0 L ${len * 0.85} 0"/>`;
const flower = (x, y, r) => {
  let s = `<g transform="translate(${x} ${y})">`;
  for (let k = 0; k < 5; k++) s += `<ellipse cx="0" cy="${-r * 0.62}" rx="${r * 0.42}" ry="${r * 0.62}" transform="rotate(${k * 72})"/>`;
  return s + `<circle r="${r * 0.22}" fill="${LINE}" fill-opacity=".8"/></g>`;
};

// 넝쿨 하나 (왼쪽 기준, mirror=true 면 좌우 반전)
function vine(mirror) {
  const m = x => (mirror ? W - x : x);
  const stem = [300, 1330, 215, 1180, 225, 1010, 305, 880];
  const p = stem.map((v, i) => (i % 2 ? v : m(v)));
  let leaves = '';
  for (let i = 1; i <= 9; i++) {
    const t = i / 10, q = bez(p, t);
    const side = i % 2 ? 1 : -1;
    const len = 52 - i * 2.4;
    leaves += leaf(q.x, q.y, q.a + side * (mirror ? -48 : 48) + (mirror ? 180 : 0), len);
  }
  const tip = bez(p, 1);
  return `<path d="M${p[0]} ${p[1]} C ${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}" fill="none"/>` +
    leaves + leaf(tip.x, tip.y, tip.a + (mirror ? 180 : 0), 34);
}

let sparkles = '';
for (let i = 0; i < 70; i++) {
  const x = 50 + rand() * (W - 100), y = 100 + rand() * 950, r = 1.2 + rand() * 2.8;
  sparkles += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill-opacity="${(0.15 + rand() * 0.5).toFixed(2)}"/>`;
}

let petals = '';
for (let k = 0; k < 8; k++) petals += `<ellipse cx="${CX}" cy="${740 - 54}" rx="20" ry="44" transform="rotate(${k * 45} ${CX} 740)"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4f0e17"/><stop offset=".45" stop-color="#3c0a12"/><stop offset="1" stop-color="#1c0408"/>
  </linearGradient>
  <radialGradient id="glow" cx="${CX}" cy="560" r="760" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#ffd9c2" stop-opacity=".26"/><stop offset="1" stop-color="#ffd9c2" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="win" cx="${CX}" cy="700" r="560" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#ffe6d2" stop-opacity=".30"/><stop offset="1" stop-color="#ffe6d2" stop-opacity=".04"/>
  </radialGradient>
  <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe2cc" stop-opacity=".13"/><stop offset="1" stop-color="#ffe2cc" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="vig" cx="${CX}" cy="900" r="1350" gradientUnits="userSpaceOnUse">
    <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/>
  </radialGradient>
  <filter id="soft" x="-30%" y="-10%" width="160%" height="130%"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/>
    <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/>
  </filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<polygon points="340,1050 740,1050 950,2050 130,2050" fill="url(#ray)" filter="url(#soft)"/>

<!-- 아치 창 + 꽃 넝쿨 — 창턱(540,1300) 기준으로 0.92배 줄이고 250 위로 -->
<g transform="translate(0 -250) translate(540 1300) scale(.92) translate(-540 -1300)">
<path d="M318 1300 V760 A222 222 0 0 1 762 760 V1300 Z" fill="url(#win)"/>
<g fill="none" stroke="${LINE}" stroke-linecap="round">
  <path d="M300 1300 V760 A240 240 0 0 1 780 760 V1300" stroke-width="3.2" stroke-opacity=".85"/>
  <path d="M318 1300 V760 A222 222 0 0 1 762 760 V1300" stroke-width="1.4" stroke-opacity=".5"/>
  <path d="M340 1300 V985 A95 95 0 0 1 530 985 V1300 M550 1300 V985 A95 95 0 0 1 740 985 V1300" stroke-width="2" stroke-opacity=".65"/>
  <circle cx="${CX}" cy="740" r="110" stroke-width="2.4" stroke-opacity=".75"/>
  <circle cx="${CX}" cy="740" r="98" stroke-width="1.2" stroke-opacity=".45"/>
  <g stroke-width="1.6" stroke-opacity=".7">${petals}</g>
  <circle cx="${CX}" cy="740" r="24" stroke-width="1.8" stroke-opacity=".8"/>
  <path d="M250 1300 H830" stroke-width="3" stroke-opacity=".8"/>
  <path d="M225 1322 H855" stroke-width="1.2" stroke-opacity=".4"/>
</g>

<!-- 꽃 넝쿨 -->
<g fill="${LINE}" fill-opacity=".12" stroke="${LINE}" stroke-opacity=".65" stroke-width="1.8" stroke-linejoin="round">
  ${vine(false)}${vine(true)}
</g>
<g fill="${ROSE}" fill-opacity=".55" stroke="${ROSE}" stroke-opacity=".7" stroke-width="1.2">
  ${flower(282, 1290, 30)}${flower(236, 1215, 22)}${flower(330, 1262, 16)}
  ${flower(W - 282, 1290, 30)}${flower(W - 236, 1215, 22)}${flower(W - 330, 1262, 16)}
</g>

</g>

<g fill="${LINE}">${sparkles}</g>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
<rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 84, mozjpeg: true }).toFile('assets/img/cover.jpg');
const meta = await sharp('assets/img/cover.jpg').metadata();
console.log(`assets/img/cover.jpg ${meta.width}x${meta.height}`);
