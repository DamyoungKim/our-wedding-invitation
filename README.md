# 모바일 청첩장 — 김담영 ♥ 박승혜 (2026. 12. 12. 더채플 앳 청담)

빌드 도구 없는 순수 HTML/CSS/vanilla JS 단일 페이지 청첩장입니다.
GitHub Pages(project page)에 `git push`만으로 배포/롤백됩니다.

- **배포 주소**: https://damyoungkim.github.io/our-wedding-invitation/
  (종이 청첩장 표지의 QR 코드 → 네이버 단축 URL → 이 주소로 연결)
- **문구/디자인 기준**: 종이 청첩장(`청첩장.pdf`) — 인사말·혼주 표기·교통 안내·버건디 포인트 색·
  스크립트 영문 제목(Invitation / Location / Date)·12일 하트 마커·약도를 그대로 옮겼습니다.

## 파일 구조

```
index.html              # 단일 페이지 (OG 메타는 여기서 직접 수정)
css/style.css           # 스타일 (모바일 우선, 라이트 고정) + 스크립트 폰트 @font-face
css/fonts.css           # Noto Serif KR + Pretendard 셀프호스팅 (scripts/fetch-fonts.mjs 가 생성)
js/config.js            # ★ 본문 값 전부 여기서 수정 (이름/연락처/계좌/인사말/교통 등)
js/main.js              # 인터랙션 (수정 불필요)
assets/img/             # cover.jpg(커버 — 웨딩 촬영본 전 임시 종이 커버) — 아래 "사진 바꾸기" 참고
assets/fonts/           # Noto Serif KR·Pretendard 슬라이스 + Yellowtail(영문 스크립트) 라틴 서브셋
assets/audio/           # BGM 음원 (bgm.mp3)
scripts/optimize-images.mjs  # 일회성 이미지 최적화 스크립트 (배포와 무관)
scripts/fetch-fonts.mjs      # 일회성 본문 폰트(Noto Serif KR·Pretendard) 다운로드 스크립트 (배포와 무관)
scripts/make-handwriting.mjs # 커버 손글씨 문구 SVG 생성 스크립트 (배포와 무관)
scripts/make-cover-art.mjs   # 임시 종이 커버(아이보리 + 올리브 가지) 생성 (배포와 무관)
scripts/make-bgm.mjs         # 배경음악(캐논 오르골 편곡) 생성 (배포와 무관)
scripts/bump-assets.mjs      # index.html 의 CSS·JS·커버 사진 주소에 ?v=해시 갱신 (커밋 전 실행)
image/                  # 원본 사진 (git 제외)
.claude/rules/design.md # 디자인·구현 규칙 (폰트/색/스크롤 — Claude Code 가 자동으로 읽음)
```

## 내용 수정 방법

### 1) 본문 값 — `js/config.js`
신랑/신부/혼주 성함, 영문 성함, 관계(장남/장녀), 연락처, 인사말, 예식 시간, 계좌번호,
예식장 정보·교통 안내, BGM 파일 경로, 카카오맵 키를 이 파일에서 수정합니다. 주석에 형식 예시가 있습니다.

- **예식 시간**: `wedding.time`이 `'12:30'`이면 커버(`12:30 PM`)/캘린더(`오후 12시 30분`)에 표시되고
  "구글 캘린더에 저장"·".ics 저장" 버튼이 활성화됩니다. 비워두면 "시간 추후 안내"로 표시됩니다.
- **연락처/계좌**: 값을 비우면(`''`) 해당 버튼/줄이 자동으로 숨겨집니다. 계좌는 현재 전부 비어 있어
  "계좌 정보는 추후 안내드립니다." 문구가 보입니다 — `bank`/`number`만 채우면 됩니다.
- **고인(故) 표시**: 혼주 객체에 `deceased: true`를 주면 성함 앞에 국화 아이콘이 붙습니다.
  종이 청첩장에 표시가 있어 `bride.father`에 켜져 있습니다. 잘못됐다면 그 줄을 지우세요.
- **교통 안내**: `venue.transport` 배열 — `label`(왼쪽 라벨), `lines`(지하철 노선 배지, 색상은
  `style.css`의 `.line-badge[data-line=…]`), `text`, `note`(작은 부가 문구).
- **예식장 전화/좌표**: 공식 홈페이지(thechapel.co.kr) 기준으로 확인된 값이 들어 있습니다
  (02-421-1121 / 37.52218, 127.03901). 지도 앱 검색용 등록명은 `venue.searchName`입니다.

### 2) SNS 공유 미리보기(OG) — `index.html <head>`
카카오톡 등 크롤러는 JS를 실행하지 않으므로 **config.js가 아닌 index.html에서 직접** 수정합니다.
`og:title` / `og:description` / `og:url`이 배포 주소 기준 **절대 URL**로 채워져 있습니다.
`og:image`는 현재 주석 처리돼 있습니다 — 켜는 방법은 아래 "사진 바꾸기" 참고.

### 3) 배경음악(BGM)
1. **⚠ 저작권 필수**: public 저장소이므로 **로열티프리/자작/정식 라이선스 음원만** 사용하세요.
2. MP3 파일(1~2MB 권장)을 `assets/audio/bgm.mp3`로 저장하고 `js/config.js`의 `bgm.src`를 지정
→ 우상단에 ♪ 플로팅 토글이 나타납니다. 브라우저 정책상 소리 있는 자동재생은 보장되지
않으며(첫 터치 후 재생 시도), 토글 버튼이 항상 동작하는 보장 경로입니다.
현재 음원은 **직접 만든 파헬벨 「캐논」 오르골 편곡**입니다(작곡은 퍼블릭 도메인, 편곡·소리 합성은
`scripts/make-bgm.mjs` 가 직접 생성 → 저작권·출처 표기 걱정 없음). 다시 만들려면 `node scripts/make-bgm.mjs`.

### 4) 지도 · 길찾기 버튼
- **카카오지도 임베드**: `js/config.js`의 `map.kakaoJsKey`에 JavaScript 키가 들어 있어 지도 영역에
  실시간 카카오지도(마커 + 장소명 말풍선 + 줌 컨트롤)가 표시됩니다. 키를 비우거나 SDK 로드가
  실패하면(도메인 미등록·네트워크 차단 등) 핀 아이콘 + 장소명 + 주소만 보이는 텍스트 폴백으로
  대체됩니다(사진/이미지 없음).
  - 키 재발급/변경: [Kakao Developers](https://developers.kakao.com) 로그인 → 내 애플리케이션
    → 앱 설정 > **플랫폼 > Web** 에 사이트 도메인 `https://damyoungkim.github.io` 등록
    (로컬 확인용으로 `http://localhost:3456` 도 같이 등록) → 앱 키 중 **JavaScript 키** 복사.
  - 도메인이 등록돼 있지 않으면 SDK가 403으로 실패하고 텍스트 폴백이 그대로 유지됩니다(에러 없음).
- **길찾기 버튼 3종** (키와 무관하게 항상 동작, `venue.lat/lng/searchName` 기준):
  - 티맵: `tmap://route?…` 앱 스킴. Android는 `intent://`로 미설치 시 Play 스토어, iOS는 미설치 시 안내 토스트.
  - 카카오맵: `https://map.kakao.com/link/to/…` 공식 길찾기 URL — 앱이 있으면 앱, 없으면 웹.
  - 네이버지도: `nmap://route/car?…` 앱 스킴(자동차 길찾기), 미설치/차단 시 네이버 플레이스 페이지
    (`venue.naverPlaceId`)로 폴백. Android는 `intent://`.
  - 앱 스킴은 카카오톡 인앱 브라우저에서 막힐 수 있어 1.5초 뒤 자동 폴백합니다.
- 주소 복사 버튼은 `venue.address`를 클립보드에 복사합니다.

### 5) 폰트
기기 기본 글꼴에 맡기면 PC·일부 안드로이드에서 맑은 고딕 등으로 바뀌어 투박해 보이므로, 모든 글꼴을 셀프호스팅합니다(전부 OFL).

| 용도 | 글꼴 | CSS |
|---|---|---|
| 읽는 글 — 섹션 제목·인사말·혼주·커버 일시/장소·예식 일시 문장·예식장명·안내 문구 | Noto Serif KR (명조) | `var(--font-serif)` — `style.css` 상단 그룹 셀렉터 |
| 성함·큰 숫자 (D-day, 달력 큰 날짜) | Noto Serif KR 600 | 각 규칙에서 `var(--font-serif)` |
| 작은 UI 글자 — 버튼·계좌번호·연락처·달력 숫자·교통 안내 | Pretendard | body 기본 `var(--font)` |
| 영문 스크립트 섹션 제목 (Invitation / Location …) | Yellowtail | `var(--font-script)` |
| 커버 손글씨 | Pinyon Script | 폰트 파일 없이 SVG 윤곽 (아래 6번) |

- Noto Serif KR·Pretendard 는 `node scripts/fetch-fonts.mjs` 가 `assets/fonts/` 와 `css/fonts.css` 를 생성합니다(직접 수정 금지).
  글자 범위별 조각이라 브라우저는 페이지에 쓰인 글자가 든 조각만 받습니다.
- Yellowtail 은 라틴 서브셋(18KB) — 바꾸려면 woff2 를 `assets/fonts/`에 넣고 `style.css` 상단 `@font-face`와 `--font-script`를 수정하세요.
- 인사말은 320px 폰에서 가장 긴 줄이 한 줄에 들어가도록 맞춰져 있습니다. 문구를 길게 바꾸면 작은 화면에서 줄이 꺾이는지 확인하세요.

### 6) 커버 손글씨 문구 (We're getting married)
첫 화면 사진 위 문구는 열리면 한 글자씩 써지는 손글씨 애니메이션입니다(`js/main.js` initHandwriting).
글자 모양은 **Pinyon Script**(OFL) — 더채플 로고의 "Chapel"과 같은 영국식 라운드핸드 필기체로 골랐습니다.
폰트 파일을 내려받지 않고 글자 윤곽만 `index.html` 에 SVG로 들어 있어서, 문구나 폰트를 바꾸려면 다시 생성해야 합니다:
```
npm install
node scripts/make-handwriting.mjs "We're getting|married" "Pinyon Script"
```
- 첫 인자: 문구 (`|` 에서 줄바꿈), 둘째 인자: Google Fonts 패밀리명 (예: `"Great Vibes"`)
- `index.html` 의 `<!-- HANDWRITING:START -->` ~ `<!-- HANDWRITING:END -->` 사이가 교체됩니다 (직접 수정 금지).
  화면낭독기용 문구(`.cover-script` 안의 `sr-only`)도 같이 바꿔주세요.
- 모션 줄이기 설정이거나 JS가 없으면 애니메이션 없이 완성된 글씨가 바로 보입니다.

## 사진 바꾸기

**커버는 웨딩 촬영본 도착 전 임시 종이 커버**(아이보리 종이 + 올리브 가지, 버건디 손글씨·이중 테두리)입니다. `node scripts/make-cover-art.mjs` 가
그려서 `assets/img/cover.jpg` 를 만듭니다. 갤러리·OG 공유 이미지는 아직 꺼져 있습니다.

1. 원본 사진을 이 저장소 바로 아래 `image/` 폴더에 넣습니다 (git 제외 폴더, 없으면 새로 만드세요).
   파일명 정렬 순서가 그대로 매핑되니(예: `01.jpg`, `02.jpg`, …) 커버로 쓸 사진을 맨 앞 순번으로 두세요.
2. 아래를 실행해 `assets/img/`에 최적화된 `cover.jpg` / `og-image.jpg` / `gallery-01~05.jpg`를 생성합니다.
   ```
   npm install
   node scripts/optimize-images.mjs
   ```
   (사진이 5장보다 적어도 되고, 6장을 초과하면 앞 5장만 갤러리로 씁니다. 매핑 규칙은
   `scripts/optimize-images.mjs` 상단 주석 참고.) 커버는 `cover.jpg` 만 바뀌면 되고, 커밋 전에 `npm run bump` 를 실행하세요(아래 "배포").
   세로 사진 권장 — 첫 화면에 꽉 차게 잘리고, 손글씨가 사진 아래쪽에 올라갑니다.
   사진으로 바꿀 때는 `index.html` 의 `<section class="cover cover--paper">` 에서 `cover--paper` 를 지우세요
   (버건디 손글씨·테두리 → 사진용 흰 손글씨·아래 그림자로 바뀝니다).
3. 갤러리·OG를 켜려면 `index.html`을 아래와 같이 고칩니다.
   - **갤러리**: "갤러리 섹션 — 웨딩 촬영본 도착 전까지 비활성화" 주석을 아래 블록으로 교체합니다
     (스타일·라이트박스는 이미 준비돼 있어 이 마크업만 넣으면 바로 동작합니다):
     ```html
     <section class="section gallery-section reveal">
       <p class="eyebrow">Gallery</p>
       <h2 class="section-title">우리의 순간들</h2>
       <div class="gallery" id="gallery">
         <button type="button" class="gallery-item"><img src="./assets/img/gallery-01.jpg" alt="웨딩 사진 1" loading="lazy" decoding="async"></button>
         <button type="button" class="gallery-item"><img src="./assets/img/gallery-02.jpg" alt="웨딩 사진 2" loading="lazy" decoding="async"></button>
         <button type="button" class="gallery-item"><img src="./assets/img/gallery-03.jpg" alt="웨딩 사진 3" loading="lazy" decoding="async"></button>
         <button type="button" class="gallery-item"><img src="./assets/img/gallery-04.jpg" alt="웨딩 사진 4" loading="lazy" decoding="async"></button>
         <button type="button" class="gallery-item"><img src="./assets/img/gallery-05.jpg" alt="웨딩 사진 5" loading="lazy" decoding="async"></button>
       </div>
     </section>
     ```
   - **OG 공유 이미지**: `<head>`의 주석 처리된 두 줄을 되돌립니다 —
     `<meta property="og:image" content="https://damyoungkim.github.io/our-wedding-invitation/assets/img/og-image.jpg">`
     주석을 풀고, `<meta name="twitter:card" content="summary">`를
     `<meta name="twitter:card" content="summary_large_image">`로 바꿉니다(바로 위 주석 처리된 줄).
4. 헷갈리면 저에게 사진만 전달해 주셔도 위 과정을 대신 해드릴게요.

## 로컬 미리보기

```
npx serve .
```
`file://`로 직접 열면 일부 기능이 제한됩니다. clipboard/공유/오디오 일부는
https(배포 후)에서 최종 확인하세요.

## 배포 (GitHub Pages project page)

저장소 `DamyoungKim/our-wedding-invitation`의 `master` 브랜치 루트가 Pages로 서빙됩니다.
`git push origin master` 만으로 반영되며, 캐시 때문에 1~2분 뒤 새로고침해서 확인하세요.

**커밋 전에 `npm run bump`** — GitHub Pages 는 파일마다 10분 캐시(`max-age=600`)라, 그냥 두면
새로고침해도 브라우저가 예전 CSS·JS 를 씁니다. 이 스크립트가 `index.html` 의 CSS·JS·커버 사진 주소 뒤
`?v=` 를 파일 내용 해시로 바꿔서, 바뀐 파일만 바로 새로 받게 합니다.

배포 후 [카카오 공유 디버거](https://developers.kakao.com/tool/debugger/sharing)에서
캐시 초기화 + 미리보기 확인, 카톡 "나에게 보내기"로 육안 확인을 권장합니다.

롤백: `git revert <commit>` → `git push` (정적 사이트라 즉시 복구)

## 배포 전 체크리스트

- [x] 신랑/신부/혼주 성함 (config.js + index.html OG/title)
- [x] 인사말, 예식 시간, 예식장 정보·교통 안내 (종이 청첩장 기준)
- [x] 예식장 전화번호/좌표 (공식 홈페이지 기준 확인)
- [x] OG 절대 URL
- [ ] 연락처 (`groom.phone`, `bride.phone`, 혼주 `phone`)
- [ ] 계좌번호 (`accounts.*`의 `bank`/`number`)
- [ ] 신부 아버지 고인(故) 표시가 맞는지 확인 (`bride.father.deceased`)
- [x] 카카오맵 JavaScript 키
- [ ] **웨딩 촬영본 도착 후 사진 교체** (커버 임시 그림 교체 + 갤러리/OG 켜기 — 위 "사진 바꾸기" 참고)
- [ ] 배포 후 카카오톡/네이버 앱/인스타그램 인앱 브라우저에서 실기기 확인
