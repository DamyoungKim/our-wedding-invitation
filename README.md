# 모바일 청첩장 (2026. 12. 12. 더채플앳청담)

빌드 도구 없는 순수 HTML/CSS/vanilla JS 단일 페이지 청첩장입니다.
GitHub Pages(user page)에 `git push`만으로 배포/롤백됩니다.

## 파일 구조

```
index.html              # 단일 페이지 (OG 메타는 여기서 직접 수정)
css/style.css           # 스타일 (모바일 우선, 라이트 고정)
js/config.js            # ★ 본문 값 전부 여기서 수정 (이름/연락처/계좌/인사말 등)
js/main.js              # 인터랙션 (수정 불필요)
assets/img/             # 최적화된 이미지 (cover, gallery-01~05, og-image)
assets/audio/           # BGM 음원 (직접 추가: bgm.mp3)
scripts/optimize-images.mjs  # 일회성 이미지 최적화 스크립트 (배포와 무관)
image/                  # 원본 사진 (git 제외)
```

## 내용 수정 방법

### 1) 본문 값 — `js/config.js`
신랑/신부/혼주 성함, 연락처, 인사말, 예식 시간, 계좌번호, 예식장 전화/좌표,
BGM 파일 경로, 카카오맵 키를 이 파일에서 수정합니다. 주석에 형식 예시가 있습니다.

- **예식 시간**: `wedding.time`에 `'12:30'`처럼 입력하면 커버/캘린더에 표시되고
  "구글 캘린더에 저장" 버튼이 자동 활성화됩니다. 비워두면 "시간 추후 안내"로 표시됩니다.
- **연락처/계좌**: 값을 비우면(`''`) 해당 버튼/줄이 자동으로 숨겨집니다.
- **⚠ 확인 필요 값**: 예식장 전화번호(출처 상충)와 좌표(±100m 근사)는 config.js 주석
  표기대로 공식 홈페이지(thechapel.co.kr) 또는 네이버지도에서 확인 후 교체하세요.

### 2) SNS 공유 미리보기(OG) — `index.html <head>`
카카오톡 등 크롤러는 JS를 실행하지 않으므로 **config.js가 아닌 index.html에서 직접** 수정합니다.
- `og:title` / `og:description`: 실제 성함으로 교체
- `og:url` / `og:image`: GitHub username 확정 후 **절대 URL**로 교체
  (예: `https://<username>.github.io/assets/img/og-image.jpg`) — `<head>`의 TODO 주석 참조

### 3) 배경음악(BGM)
1. **⚠ 저작권 필수**: public 저장소이므로 **로열티프리/자작/정식 라이선스 음원만** 사용하세요.
   상용 가요/팝 업로드는 저작권 침해입니다.
2. MP3 파일(1~2MB 권장)을 `assets/audio/bgm.mp3`로 저장
3. `js/config.js`의 `bgm.src`를 `'./assets/audio/bgm.mp3'`로 수정
→ 우상단에 ♪ 플로팅 토글이 나타납니다. 브라우저 정책상 소리 있는 자동재생은 보장되지
않으며(첫 터치 후 재생 시도), 토글 버튼이 항상 동작하는 보장 경로입니다.
iOS 하드웨어 무음 스위치가 켜져 있으면 소리가 나지 않을 수 있습니다(브라우저 제어 불가).

### 4) 카카오맵 실시간 지도 (선택)
키가 없어도 길찾기 버튼 3종(카카오맵/네이버지도/티맵)과 주소 복사는 정상 동작하며,
지도 영역에는 장소명/주소 안내 블록이 표시됩니다. 실시간 지도를 켜려면:
1. [Kakao Developers](https://developers.kakao.com) → 애플리케이션 추가 (무료)
2. 앱 설정 > 플랫폼 > Web에 배포 도메인 등록 (예: `https://<username>.github.io`)
3. "JavaScript 키"를 `js/config.js`의 `map.kakaoJsKey`에 입력

## 로컬 미리보기

```
npx serve .
```
`file://`로 직접 열면 일부 기능이 제한됩니다. clipboard/공유/오디오 일부는
https(배포 후)에서 최종 확인하세요.

## 배포 (GitHub Pages user page)

1. GitHub에 `<username>.github.io` **public** 저장소 생성
2. `index.html`의 OG 절대 URL(TODO 주석)을 확정 username으로 교체 후 커밋
3. `git remote add origin https://github.com/<username>/<username>.github.io.git`
   → `git push -u origin main`
4. 저장소 Settings → Pages → Branch: `main` / root → Save
5. 배포 후 [카카오 공유 디버거](https://developers.kakao.com/tool/debugger/sharing)에서
   캐시 초기화 + 미리보기 확인, 카톡 "나에게 보내기"로 육안 확인

롤백: `git revert <commit>` → `git push` (정적 사이트라 즉시 복구)

## 배포 전 체크리스트

- [ ] 신랑/신부/혼주 성함 (config.js + index.html OG/title)
- [ ] 연락처, 인사말, 계좌번호 (config.js)
- [ ] 예식 시간 확정 시 `wedding.time` 입력
- [ ] 예식장 전화번호/좌표 확인 (config.js 주석 참조)
- [ ] GitHub username 확정 → index.html OG 절대 URL 교체
- [ ] (선택) BGM 음원 — 저작권 안전 음원만
- [ ] (선택) 카카오맵 JavaScript 키
- [ ] 배포 후 카카오톡/네이버 앱/인스타그램 인앱 브라우저에서 실기기 확인

## 이미지 재생성 (선택)

원본 사진을 바꾸면 `image/` 폴더에 넣고 아래를 실행해 `assets/img/`를 재생성합니다.

```
npm install
node scripts/optimize-images.mjs
```
