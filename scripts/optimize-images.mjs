// 일회성 이미지 최적화 스크립트 (배포 산출물과 무관)
// 원본: image/*.jpg (git 제외) → 산출물: assets/img/*.jpg
// 매핑 규칙: 정렬순 첫 사진 = cover + og, 나머지 = gallery-01, 02, …
// 실행: npm run optimize
import sharp from 'sharp';
import { readdir, mkdir, stat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC_DIR = 'image';
const OUT_DIR = 'assets/img';

const files = (await readdir(SRC_DIR))
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .sort();

if (files.length === 0) {
  console.error(`원본 이미지가 없습니다: ${SRC_DIR}/`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const kb = async (p) => Math.round((await stat(p)).size / 1024);
const src = (f) => path.join(SRC_DIR, f);
const out = (f) => path.join(OUT_DIR, f);

// 커버: 첫 사진, 가로 최대 1600px(폰 화면 높이 전체를 채우므로 3배율 폰 기준), q80, 목표 <300KB
const coverSrc = files[0];
// 커버 아래쪽을 사진 높이 비율만큼 잘라냄(1 = 자르지 않음). 01-cover.jpg(대문 앞 인사)는 맨 아래 아스팔트 도로가 넓게 보여서
// 사용자가 보낸 크롭대로 위는 그대로, 아래는 인도 끝까지만 남김(14.5% 자름, 2026-11-06). 좌우는 css .cover-photo(3:5 상자)가 정함.
// 커버 사진을 바꾸면 1 로 되돌리거나 다시 맞춤(css/style.css .cover-photo img 의 object-position 도 같이)
const COVER_KEEP = 0.855;
const coverImg = async () => {
  const img = sharp(src(coverSrc)).rotate();
  if (COVER_KEEP >= 1) return img;
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  return sharp(data).extract({ left: 0, top: 0, width: info.width, height: Math.round(info.height * COVER_KEEP) });
};
await (await coverImg())
  .resize({ width: 1600, withoutEnlargement: true })
  .jpeg({ quality: 80, mozjpeg: true })
  .toFile(out('cover.jpg'));

// 커버 실제 크기 → index.html <img id="cover-img" width height>. 브라우저가 사진을 받기 전부터 이 비율로 자리를
// 잡아 첫 화면 크기가 곧 최종 크기(화면 높이를 재지 않음 — css/style.css .cover-photo 주석)
const { width: cw, height: ch } = await sharp(out('cover.jpg')).metadata();
const HTML = 'index.html';
const html = await readFile(HTML, 'utf8');
const SIZE = /(<img id="cover-img" src="[^"]*" )width="\d+" height="\d+"/;
if (!SIZE.test(html)) throw new Error(`${HTML} 의 <img id="cover-img"> 에 width/height 속성 자리가 없습니다`);
await writeFile(HTML, html.replace(SIZE, `$1width="${cw}" height="${ch}"`));

// 커버 축소본(LQIP): 사진이 받아지기 전 바탕으로 까는 24px 짜리 base64 → css/style.css 의 .cover-photo 배경에 넣음
// (빈 단색 대신 사진 윤곽이 바로 보이게). 커버 사진을 바꾸면 이 스크립트를 다시 실행해야 바탕도 바뀜
const tiny = await (await coverImg()).resize({ width: 24 }).jpeg({ quality: 55 }).toBuffer();
const CSS = 'css/style.css';
const css = await readFile(CSS, 'utf8');
const LQIP = /(\.cover-photo \{[^}]*url\("data:image\/jpeg;base64,)[^"]*(")/;
if (!LQIP.test(css)) throw new Error(`${CSS} 의 .cover-photo 배경에 data:image/jpeg;base64 자리가 없습니다`);
await writeFile(CSS, css.replace(LQIP, `$1${tiny.toString('base64')}$2`));

// OG(카카오톡 등 링크 미리보기): 1200x630, q80, 목표 <300KB
// 2026-11-06 사용자가 "썸네일도 전체적으로" → 비교 시안 A(두 사람 확대 크롭)/B(사진 전체 + 양옆 흐림)/C(나뭇잎 일부만) 중 B.
// 커버와 같은 사진(아래 아스팔트 잘린 coverImg)을 높이 630 에 통째로 가운데 두고, 남는 양옆은 같은 사진을 흐리고 어둡게 깔아 채움
// (갤러리 라이트박스 블러 여백과 같은 방식). 카톡이 가운데를 정사각형으로 잘라도 사진 전체가 남음.
// 예전 크롭 방식으로 되돌리려면 git 기록의 OG_CROP(대문 앞 인사 { left: 0.05, top: 0.5, width: 0.9 }, 나무 계단 { left: 0.245, top: 0.43, width: 0.75 }) 복원
const ogSrc = await (await coverImg()).toBuffer();
const ogBg = await sharp(ogSrc).resize(1200, 630, { fit: 'cover' }).blur(25).modulate({ brightness: 0.75 }).toBuffer();
const ogFg = await sharp(ogSrc).resize({ height: 630 }).toBuffer();
const { width: ogFgW } = await sharp(ogFg).metadata();
const og = sharp(ogBg).composite([{ input: ogFg, left: Math.round((1200 - ogFgW) / 2), top: 0 }]);
await og.jpeg({ quality: 80, mozjpeg: true }).toFile(out('og-image.jpg'));

// 갤러리: 나머지 사진 전부(index.html #gallery 에 같은 개수만큼 마크업), 긴 변 1440px(라이트박스에서 크게 봄), q78, 각 <350KB
const galleryFiles = files.slice(1);
for (let i = 0; i < galleryFiles.length; i++) {
  const name = `gallery-${String(i + 1).padStart(2, '0')}.jpg`;
  const img = sharp(src(galleryFiles[i])).rotate();
  const meta = await img.metadata();
  const resize =
    (meta.width ?? 0) >= (meta.height ?? 0)
      ? { width: 1440, withoutEnlargement: true }
      : { height: 1440, withoutEnlargement: true };
  await img.resize(resize).jpeg({ quality: 78, mozjpeg: true }).toFile(out(name));
}

// 결과 리포트 (예산: cover<300KB, og<300KB, gallery 각<250KB)
const outputs = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.jpg')).sort();
let total = 0;
for (const f of outputs) {
  const size = await kb(out(f));
  total += size;
  console.log(`${f.padEnd(18)} ${String(size).padStart(5)} KB`);
}
console.log(`${'합계'.padEnd(17)} ${String(total).padStart(5)} KB`);
console.log(`index.html 커버 width/height ${cw}×${ch} | style.css 커버 축소본 ${tiny.length} B (base64 ${Math.ceil(tiny.length * 4 / 3)} B)`);
console.log(`매핑: cover/og ← ${coverSrc} | gallery-01..${String(galleryFiles.length).padStart(2, '0')} ← 나머지 정렬순`);
