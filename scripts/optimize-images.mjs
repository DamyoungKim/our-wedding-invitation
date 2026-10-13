// 일회성 이미지 최적화 스크립트 (배포 산출물과 무관)
// 원본: image/*.jpg (git 제외) → 산출물: assets/img/*.jpg
// 매핑 규칙(계획 M8): 정렬순 첫 사진 = cover + og, 나머지 5장 = gallery-01..05
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
await sharp(src(coverSrc))
  .rotate() // EXIF 방향 반영
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
const tiny = await sharp(src(coverSrc)).rotate().resize({ width: 24 }).jpeg({ quality: 55 }).toBuffer();
const CSS = 'css/style.css';
const css = await readFile(CSS, 'utf8');
const LQIP = /(\.cover-photo \{[^}]*url\("data:image\/jpeg;base64,)[^"]*(")/;
if (!LQIP.test(css)) throw new Error(`${CSS} 의 .cover-photo 배경에 data:image/jpeg;base64 자리가 없습니다`);
await writeFile(CSS, css.replace(LQIP, `$1${tiny.toString('base64')}$2`));

// OG(카카오톡 등 링크 미리보기): 1200x630, q80, 목표 <300KB
// 세로 사진은 자동(attention) 크롭이 두 사람 대신 계단 같은 배경을 고를 때가 있어서, 자를 영역을
// 사진 비율(0~1, 왼쪽·위·폭 — 높이는 1200:630 비율로 정해짐)로 직접 지정. 커버 사진을 바꾸면 다시 맞추거나 null(자동).
const OG_CROP = { left: 0.245, top: 0.43, width: 0.75 }; // 01-cover.jpg: 두 사람 얼굴이 가운데 — 카톡이 정사각형 등으로 가운데를 잘라도 얼굴이 남게
const og = sharp(src(coverSrc)).rotate();
if (OG_CROP) {
  const { width, height, orientation } = await sharp(src(coverSrc)).metadata();
  const w = orientation >= 5 ? height : width;
  const h = orientation >= 5 ? width : height;
  const cw = Math.round(w * OG_CROP.width);
  og.extract({ left: Math.round(w * OG_CROP.left), top: Math.round(h * OG_CROP.top), width: cw, height: Math.round(cw * 630 / 1200) })
    .resize(1200, 630);
} else {
  og.resize(1200, 630, { fit: 'cover', position: sharp.strategy.attention });
}
await og.jpeg({ quality: 80, mozjpeg: true }).toFile(out('og-image.jpg'));

// 갤러리: 나머지 사진들(최대 5장), 긴 변 1080px, q78, 각 <250KB
const galleryFiles = files.slice(1, 6);
for (let i = 0; i < galleryFiles.length; i++) {
  const name = `gallery-${String(i + 1).padStart(2, '0')}.jpg`;
  const img = sharp(src(galleryFiles[i])).rotate();
  const meta = await img.metadata();
  const resize =
    (meta.width ?? 0) >= (meta.height ?? 0)
      ? { width: 1080, withoutEnlargement: true }
      : { height: 1080, withoutEnlargement: true };
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
