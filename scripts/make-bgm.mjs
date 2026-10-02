// 배경음악 생성 스크립트 (일회성, 배포 산출물과 무관) — 파헬벨 「캐논 D장조」 오르골 편곡.
// 작곡(1680년경, 파헬벨 1706년 사망)은 퍼블릭 도메인이고, 편곡·연주(소리 합성)는 이 스크립트가
// 직접 만들므로 다른 사람의 녹음·음원이 들어가지 않음 → 저작권·출처 표기 걱정 없음.
// 실행: npm install && node scripts/make-bgm.mjs   → assets/audio/bgm.mp3 (그 뒤 npm run bump)
//
// 구성 (2마디 = 화음 4개, 한 구간 = 화음 8개 = 4마디):
//   반주 → 주선율 → 두 번째 선율 → 4분음표 변주 → 8분음표 변주 → 두 선율 겹침 → (처음으로 반복)
// 끝과 처음이 자연스럽게 이어지도록 두 바퀴를 그린 뒤 두 번째 바퀴만 잘라 씀(울림이 처음으로 넘어감).
import { writeFile } from 'node:fs/promises';
import { Mp3Encoder } from '@breezystack/lamejs';

const SR = 44100;
const BPM = 62;
const BEAT = 60 / BPM;            // 4분음표 길이(초)
const CHORD = 2 * BEAT;           // 화음 하나 = 2박

// 저음 진행 D A Bm F#m G D G A — [저음 MIDI, 장(1)/단(0)]
const GROUND = [[50, 1], [45, 1], [47, 0], [42, 0], [43, 1], [50, 1], [43, 1], [45, 1]];

// 선율 (MIDI, 한 화음 안에서 균등 분할)
const S1 = [[78], [76], [74], [73], [71], [69], [71], [73]];                      // 주선율(2분음표)
const S2 = [[74], [73], [71], [69], [67], [66], [67], [64]];                      // 두 번째 선율
const S3 = [[74, 78], [81, 79], [78, 74], [78, 76], [74, 71], [74, 81], [79, 83], [81, 79]];  // 4분음표
const S4 = [[74, 73, 74, 62], [61, 69, 64, 66], [62, 74, 73, 71], [73, 78, 81, 83],          // 8분음표
            [79, 78, 76, 79], [78, 76, 74, 73], [71, 69, 67, 66], [64, 67, 66, 64]];
const SECTIONS = [[], [S1], [S2], [S3], [S4], [S1, S2]];

let seed = 1212;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

const notes = [];   // { t(초), m(MIDI), v(세기) }
const add = (t, m, v) => notes.push({ t: t + (rand() - 0.5) * 0.016, m, v: v * (0.9 + rand() * 0.2) });

const LOOP = SECTIONS.length * 8 * CHORD;
for (let cycle = 0; cycle < 2; cycle++) {
  SECTIONS.forEach((voices, s) => {
    for (let c = 0; c < 8; c++) {
      const t0 = cycle * LOOP + (s * 8 + c) * CHORD;
      const [bass, major] = GROUND[c];
      // 반주: 저음 → 5도 → 10도(3음) → 5도 (8분음표)
      [bass, bass + 7, bass + (major ? 16 : 15), bass + 7].forEach((m, i) => add(t0 + i * BEAT / 2, m, i ? 0.32 : 0.5));
      voices.forEach(line => {
        const seg = line[c];
        seg.forEach((m, i) => add(t0 + i * CHORD / seg.length, m, 0.8));
      });
    }
  });
}

// 오르골 소리: 빗살(쇠막대)을 튕긴 소리 — 기음 + 살짝 어긋난 기음(반짝임) + 2배음 + 짧은 "팅" 부분음
const out = new Float32Array(Math.ceil(2 * LOOP * SR) + SR * 6);
for (const n of notes) {
  const f = hz(n.m);
  const tau = Math.min(2.4, Math.max(0.45, 1.7 * Math.sqrt(261.6 / f)));
  const len = Math.min(6, tau * 6.5);
  const start = Math.round(n.t * SR), N = Math.round(len * SR);
  const w = 2 * Math.PI * f / SR;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const env = Math.exp(-t / tau) * (1 - Math.exp(-t / 0.0015));
    const s = Math.sin(w * i) + 0.35 * Math.sin(w * 1.0025 * i)
      + 0.22 * Math.sin(w * 2 * i) * Math.exp(-t / (tau * 0.35))
      + 0.07 * Math.sin(w * 5.4 * i) * Math.exp(-t / 0.05);
    out[start + i] += n.v * env * s * 0.16;
  }
}

// 잔향 (Schroeder: 빗살 필터 4 + 전역통과 2)
function reverb(x) {
  const y = new Float32Array(x.length);
  const combs = [1557, 1617, 1491, 1422].map(d => ({ b: new Float32Array(d), i: 0, lp: 0 }));
  const aps = [556, 225].map(d => ({ b: new Float32Array(d), i: 0 }));
  for (let n = 0; n < x.length; n++) {
    let acc = 0;
    for (const c of combs) {
      const o = c.b[c.i];
      c.lp = o * 0.7 + c.lp * 0.3;                 // 고음 감쇠
      c.b[c.i] = x[n] + c.lp * 0.82;
      c.i = (c.i + 1) % c.b.length;
      acc += o;
    }
    let s = acc * 0.25;
    for (const a of aps) {
      const o = a.b[a.i];
      a.b[a.i] = s + o * 0.5;
      a.i = (a.i + 1) % a.b.length;
      s = o - s * 0.5;
    }
    y[n] = x[n] * 0.85 + s * 0.3;
  }
  return y;
}
const wet = reverb(out);

// 두 번째 바퀴만 잘라 한 바퀴(LOOP)로 — 끝→처음 이음매가 자연스러움
const L = Math.round(LOOP * SR), from = L;
const loop = wet.subarray(from, from + L);
let peak = 0;
for (const v of loop) peak = Math.max(peak, Math.abs(v));
const gain = 0.79 / peak;                          // -2 dBFS — 배경음악이라 살짝 작게
const pcm = new Int16Array(L);
for (let i = 0; i < L; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(loop[i] * gain * 32767)));

const enc = new Mp3Encoder(1, SR, 96);
const chunks = [];
for (let i = 0; i < pcm.length; i += 1152) {
  const b = enc.encodeBuffer(pcm.subarray(i, i + 1152));
  if (b.length) chunks.push(Buffer.from(b));
}
chunks.push(Buffer.from(enc.flush()));
const mp3 = Buffer.concat(chunks);
await writeFile('assets/audio/bgm.mp3', mp3);
console.log(`assets/audio/bgm.mp3 — ${LOOP.toFixed(1)}초, 음표 ${notes.length / 2}개, ${(mp3.length / 1024).toFixed(0)}KB`);
