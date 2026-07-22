// 일회성 이미지 최적화 스크립트 (배포 산출물과 무관)
// 원본: image/*.jpg (git 제외) → 산출물: assets/img/*.jpg
// 매핑 규칙(계획 M8): 정렬순 첫 사진 = cover + og, 나머지 5장 = gallery-01..05
// 실행: npm run optimize
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
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

// 커버: 첫 사진(사용자 미지정 시 임시), 가로 최대 1200px, q80, 목표 <300KB
const coverSrc = files[0];
await sharp(src(coverSrc))
  .rotate() // EXIF 방향 반영
  .resize({ width: 1200, withoutEnlargement: true })
  .jpeg({ quality: 80, mozjpeg: true })
  .toFile(out('cover.jpg'));

// OG: 1200x630, attention 크롭(피사체 중심), q80, 목표 <300KB
await sharp(src(coverSrc))
  .rotate()
  .resize(1200, 630, { fit: 'cover', position: sharp.strategy.attention })
  .jpeg({ quality: 80, mozjpeg: true })
  .toFile(out('og-image.jpg'));

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
console.log(`매핑: cover/og ← ${coverSrc} | gallery-01..${String(galleryFiles.length).padStart(2, '0')} ← 나머지 정렬순`);
