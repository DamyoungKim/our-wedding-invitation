// 일회성 폰트 다운로드 스크립트 (배포 산출물과 무관)
// 본문 폰트 2종을 받아 셀프호스팅용으로 저장 (둘 다 OFL 라이선스):
//   - Noto Serif KR 400/600 (Google Fonts) — 제목·인사말 등 "읽는 글" 명조
//   - Pretendard Variable (jsDelivr)     — 버튼·계좌·연락처 등 작은 UI 글자
// unicode-range 슬라이스 방식이라 브라우저는 페이지에 실제 쓰인 글자가 포함된
// 조각(woff2)만 내려받음 → 어떤 이름/문구가 와도 자동 대응 + 전송량 ~100-300KB/폰트.
// 실행: node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const FONTS = [
  {
    label: 'Noto Serif KR 400/600',
    css: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&display=swap',
    prefix: 'noto-serif-kr'
  },
  {
    label: 'Pretendard Variable 45–920',
    css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
    prefix: 'pretendard'
  }
];
// 최신 UA 를 보내야 Google Fonts 가 woff2 + unicode-range 버전 CSS를 줌
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const OUT_FONT_DIR = 'assets/fonts';
const OUT_CSS = 'css/fonts.css';

await mkdir(OUT_FONT_DIR, { recursive: true });

const blocks = [];
for (const font of FONTS) {
  let css = await (await fetch(font.css, { headers: { 'User-Agent': UA } })).text();
  // 배포처 주석 제거 + 압축(min) CSS 는 @font-face 하나당 한 줄로
  css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/}\s*@font-face/g, '}\n@font-face').trim();
  // Pretendard CSS 는 상대경로 url 이라 CSS 주소 기준으로 풀어서 받음.
  // Noto Serif KR 은 가변 폰트라 400/600 이 같은 파일을 가리킴 → 중복 제거 후 한 번만 저장
  const urls = [...new Set([...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1]))];
  if (urls.length === 0) throw new Error(`${font.label}: woff2 URL을 찾지 못했습니다 — UA 확인 필요`);

  let i = 0;
  for (const url of urls) {
    const name = `${font.prefix}-${String(i++).padStart(3, '0')}.woff2`;
    const buf = Buffer.from(await (await fetch(new URL(url, font.css))).arrayBuffer());
    await writeFile(`${OUT_FONT_DIR}/${name}`, buf);
    // fonts.css 는 css/ 안에 있으므로 ../assets/fonts/ 상대경로
    css = css.split(`url(${url})`).join(`url(../assets/fonts/${name})`);
  }
  blocks.push(`/* ${font.label} — self-hosted (OFL 라이선스) */\n${css}`);
  console.log(`${font.label}: 슬라이스 ${urls.length}개 저장`);
}

await writeFile(OUT_CSS, '/* scripts/fetch-fonts.mjs 로 생성 — 직접 수정하지 마세요 */\n' + blocks.join('\n\n') + '\n');
console.log(`CSS → ${OUT_CSS}`);
