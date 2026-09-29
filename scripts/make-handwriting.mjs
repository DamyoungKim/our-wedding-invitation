// 손글씨 커버 문구 생성 스크립트 (일회성, 배포 산출물과 무관)
// Google Fonts 의 필기체 TTF 를 받아 글자별 윤곽을 SVG 로 뽑고, index.html 의
// <!-- HANDWRITING:START --> ~ <!-- HANDWRITING:END --> 사이를 교체합니다.
// 폰트 파일은 저장소에 넣지 않고, 사이트도 폰트를 내려받지 않습니다(윤곽만 인라인).
//
// 실행: npm install
//       node scripts/make-handwriting.mjs                                  (기본: We're getting|married, Pinyon Script)
//       node scripts/make-handwriting.mjs "Just|married" "Great Vibes"      ('|' 로 줄바꿈)
//
// 애니메이션 원리(js/main.js initHandwriting): 글자 윤곽을 틀(clipPath)로 두고, 같은 윤곽을
// 굵은 선으로 따라 그리며(stroke-dashoffset) 한 글자씩 써지게 한 뒤, 마지막에 채움을 켭니다.
import { readFile, writeFile } from 'node:fs/promises';
import opentype from 'opentype.js';

const TEXT = process.argv[2] || "We're getting|married";
const FAMILY = process.argv[3] || 'Pinyon Script';
const SIZE = 100;          // 폰트 단위(viewBox 좌표)
const LINE_GAP = 0.95;     // 줄 간격(× SIZE)
const INDENT = 0.35;       // 둘째 줄부터 오른쪽으로 들여쓰기(× SIZE) — 필기체 청첩장 레이아웃
const STROKE = 18;         // 따라 그리는 선 굵기(글자 획보다 충분히 굵게)
const HTML = 'index.html';

const cssUrl = 'https://fonts.googleapis.com/css2?family=' + FAMILY.trim().replace(/ /g, '+');
const css = await (await fetch(cssUrl)).text();
const ttfUrl = (css.match(/url\((https:[^)]+\.ttf)\)/) || [])[1];
if (!ttfUrl) throw new Error(`TTF 주소를 찾지 못했습니다: ${FAMILY}`);
const font = opentype.parse(await (await fetch(ttfUrl)).arrayBuffer());

const lines = TEXT.split('|');
const widths = lines.map(t => font.getAdvanceWidth(t, SIZE, { kerning: true }));
const maxW = Math.max(...widths);
const glyphs = [];
lines.forEach((t, i) => {
  const x0 = (maxW - widths[i]) / 2 + (i > 0 ? SIZE * INDENT : 0);
  font.forEachGlyph(t, x0, SIZE + i * SIZE * LINE_GAP, SIZE, { kerning: true }, (glyph, gx, gy) => {
    const p = glyph.getPath(gx, gy, SIZE);
    const d = p.toPathData(1);
    if (d) glyphs.push({ d, bb: p.getBoundingBox() }); // 공백은 윤곽 없음
  });
});

const pad = STROKE / 2;
const x1 = Math.min(...glyphs.map(g => g.bb.x1)) - pad, y1 = Math.min(...glyphs.map(g => g.bb.y1)) - pad;
const x2 = Math.max(...glyphs.map(g => g.bb.x2)) + pad, y2 = Math.max(...glyphs.map(g => g.bb.y2)) + pad;
const viewBox = [x1, y1, x2 - x1, y2 - y1].map(v => Math.round(v * 10) / 10).join(' ');

const fills = glyphs.map((g, i) => `<path id="hw-g${i}" d="${g.d}"/>`).join('');
const clips = glyphs.map((g, i) => `<clipPath id="hw-c${i}"><use href="#hw-g${i}"/></clipPath>`).join('');
const strokes = glyphs.map((g, i) => `<path class="hw-stroke" d="${g.d}" clip-path="url(#hw-c${i})"/>`).join('');
const svg =
  `<svg class="hw" viewBox="${viewBox}" aria-hidden="true" focusable="false">` +
  `<defs>${clips}</defs>` +
  `<g class="hw-strokes" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${strokes}</g>` +
  `<g class="hw-fill" fill="currentColor">${fills}</g></svg>`;

const START = '<!-- HANDWRITING:START', END = '<!-- HANDWRITING:END -->';
const html = await readFile(HTML, 'utf8');
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < 0) throw new Error(`${HTML} 에 ${START} … ${END} 표시가 없습니다`);
const note = `${START} "${lines.join(' / ')}" · ${FAMILY} (OFL) — scripts/make-handwriting.mjs 로 생성, 직접 수정 금지 -->`;
await writeFile(HTML, html.slice(0, a) + note + '\n        ' + svg + '\n        ' + html.slice(b));
console.log(`${FAMILY} · "${lines.join(' / ')}" · 글자 ${glyphs.length}개 · SVG ${(svg.length / 1024).toFixed(1)}KB → ${HTML}`);
