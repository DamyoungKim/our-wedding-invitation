// index.html 의 CSS·JS·커버 사진 주소와 config.js 의 배경음악 주소 뒤에 파일 내용 해시(?v=xxxxxxxx)를 붙임 — 커밋 전에 실행.
// GitHub Pages 는 파일마다 Cache-Control: max-age=600(10분)이라, 새로고침해도 브라우저가 10분 동안
// 예전 CSS/JS 를 캐시에서 씀(크롬은 새로고침 때 페이지 HTML만 다시 확인). 내용이 바뀌면 주소가 바뀌어
// 바로 새 파일을 받게 됨. 내용이 그대로인 파일은 해시도 그대로라 캐시를 계속 씀.
// 실행: node scripts/bump-assets.mjs   (npm run bump)
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const hashOf = async path => createHash('sha1').update(await readFile(path)).digest('hex').slice(0, 8);

// config.js 의 배경음악 주소 — index.html 의 config.js 해시보다 먼저 갱신해야 함
const CONFIG = 'js/config.js', BGM = './assets/audio/bgm.mp3';
const bgmV = await hashOf(BGM);
const config = await readFile(CONFIG, 'utf8');
await writeFile(CONFIG, config.replace(/(src: ')\.\/assets\/audio\/bgm\.mp3(?:\?v=[0-9a-f]+)?(')/, `$1${BGM}?v=${bgmV}$2`));

const HTML = 'index.html';
const html = await readFile(HTML, 'utf8');
const ASSET = /((?:href|src)=")(\.\/(?:css\/[\w.-]+\.css|js\/[\w.-]+\.js|assets\/img\/cover\.jpg))(?:\?v=[0-9a-f]+)?(")/g;

const hashes = {};
for (const m of html.matchAll(ASSET)) {
  const path = m[2];
  if (!hashes[path]) hashes[path] = await hashOf(path);
}
const out = html.replace(ASSET, (_, pre, path, post) => `${pre}${path}?v=${hashes[path]}${post}`);
await writeFile(HTML, out);
console.log([...Object.entries(hashes).map(([p, h]) => `${p}?v=${h}`), `${BGM}?v=${bgmV} (config.js)`].join('\n'));
