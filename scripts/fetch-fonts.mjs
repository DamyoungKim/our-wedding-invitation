// 일회성 폰트 다운로드 스크립트 (배포 산출물과 무관)
// Noto Serif KR 400/600을 Google Fonts에서 받아 셀프호스팅용으로 저장.
// unicode-range 슬라이스 방식이라 브라우저는 페이지에 실제 쓰인 글자가 포함된
// 조각(woff2)만 내려받음 → 어떤 이름/문구가 와도 자동 대응 + 전송량 ~100-300KB.
// 실행: node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&display=swap';
// 최신 UA 를 보내야 woff2 + unicode-range 버전 CSS를 받음
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const OUT_FONT_DIR = 'assets/fonts';
const OUT_CSS = 'css/fonts.css';

const css = await (await fetch(CSS_URL, { headers: { 'User-Agent': UA } })).text();
const urls = [...css.matchAll(/url\((https:[^)]+\.woff2)\)/g)].map((m) => m[1]);
if (urls.length === 0) throw new Error('woff2 URL을 찾지 못했습니다 — UA 확인 필요');

await mkdir(OUT_FONT_DIR, { recursive: true });

let rewritten = css;
let i = 0;
for (const url of urls) {
  const name = `noto-serif-kr-${String(i++).padStart(3, '0')}.woff2`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(`${OUT_FONT_DIR}/${name}`, buf);
  // fonts.css 는 css/ 안에 있으므로 ../assets/fonts/ 상대경로
  rewritten = rewritten.replace(url, `../assets/fonts/${name}`);
}

await writeFile(OUT_CSS, '/* Noto Serif KR 400/600 — self-hosted (OFL 라이선스), scripts/fetch-fonts.mjs 로 생성 */\n' + rewritten);
console.log(`슬라이스 ${urls.length}개 저장 → ${OUT_FONT_DIR}/, CSS → ${OUT_CSS}`);
