// 배경음악 손질 스크립트 (일회성, 배포 산출물과 무관) — 받은 mp3 를 청첩장용 assets/audio/bgm.mp3 로.
// 현재 음원: Pixabay 「Christmas piano ~カノン~」 (pianocafe_Kumi, track 271110)
//   https://pixabay.com/music/christmas-christmas-piano%E3%82%AB%E3%83%8E%E3%83%B3-271110/
//   Pixabay Content License — 무료, 출처 표기 불필요. 원본 파일(6.4MB)은 저장소에 넣지 않음.
//
// 하는 일: 앞뒤 무음 잘라내기(반복 재생 때 공백 최소화) → 끝 0.5초 페이드아웃(이음매 '틱' 소리 방지)
//         → 128kbps 스테레오로 다시 압축(약 3MB, 폰 데이터 고려).
// 실행: npm install && node scripts/prepare-bgm.mjs <받은 파일.mp3>   (그 뒤 npm run bump)
import { readFile, writeFile } from 'node:fs/promises';
import { MPEGDecoder } from 'mpg123-decoder';
import { Mp3Encoder } from '@breezystack/lamejs';

const input = process.argv[2];
if (!input) throw new Error('사용법: node scripts/prepare-bgm.mjs <받은 파일.mp3>');

const dec = new MPEGDecoder();
await dec.ready;
const { channelData: ch, samplesDecoded: n, sampleRate: sr } = dec.decode(new Uint8Array(await readFile(input)));
dec.free();

// 100ms 구간 RMS(dB)로 소리 시작·끝 찾기
const WIN = Math.round(sr * 0.1);
const rmsDb = s => {
  let q = 0;
  for (const c of ch) for (let i = s; i < Math.min(n, s + WIN); i++) q += c[i] * c[i];
  return 10 * Math.log10(q / (WIN * ch.length) + 1e-12);
};
let start = 0;
while (start < n && rmsDb(start) < -50) start += WIN;
let end = n - WIN;
while (end > start && rmsDb(end) < -45) end -= WIN;
start = Math.max(0, start - Math.round(sr * 0.05));     // 첫 음 직전 50ms 여유
end = Math.min(n, end + WIN + Math.round(sr * 0.5));    // 마지막 울림 + 0.5초(페이드아웃 구간)
const len = end - start, fade = Math.round(sr * 0.5);

const GAIN = 0.92;                                      // 다시 압축할 때 깨짐 방지 여유(-0.7dB)
const pcm = ch.map(c => {
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const f = i > len - fade ? (len - i) / fade : 1;
    out[i] = Math.max(-32767, Math.min(32767, Math.round(c[start + i] * GAIN * f * 32767)));
  }
  return out;
});

const enc = new Mp3Encoder(2, sr, 128);
const chunks = [];
for (let i = 0; i < len; i += 1152) {
  const b = enc.encodeBuffer(pcm[0].subarray(i, i + 1152), pcm[ch.length > 1 ? 1 : 0].subarray(i, i + 1152));
  if (b.length) chunks.push(Buffer.from(b));
}
chunks.push(Buffer.from(enc.flush()));
const mp3 = Buffer.concat(chunks);
await writeFile('assets/audio/bgm.mp3', mp3);
console.log(`assets/audio/bgm.mp3 — ${(len / sr).toFixed(1)}초 (원본 ${(n / sr).toFixed(1)}초에서 앞 ${(start / sr).toFixed(2)}초·뒤 ${((n - end) / sr).toFixed(2)}초 잘라냄), ${(mp3.length / 1024 / 1024).toFixed(2)}MB`);
