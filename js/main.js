/* ============================================================
 * 모바일 청첩장 인터랙션 (js/main.js)
 * 빌드리스 vanilla JS — config 주입 / 인트로 / D-day / 갤러리 /
 * 지도 / 복사 / 공유 / BGM. 인앱 WebView(카톡·네이버·인스타) 1차 타깃.
 * ============================================================ */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var CFG = window.WEDDING_CONFIG || {};

  /* ---------- 안전 접근 헬퍼 (placeholder/누락 값에도 throw 금지) ---------- */
  function get(obj, path, fallback) {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (cur == null) return fallback;
      cur = cur[path[i]];
    }
    return (cur == null || cur === '') ? fallback : cur;
  }
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  var reducedMotion = false;
  try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ============================================================
   * 0. 인트로 해제 — 7s 하드 타임아웃을 "가장 먼저" 무장 (노트 10)
   *    이후 어떤 코드가 throw 해도 영구 잠금이 될 수 없다.
   * ============================================================ */
  var introDone = false;
  var introEl = doc.getElementById('intro');
  var pageEl = doc.getElementById('page');

  function endIntro() {
    if (introDone) return;
    introDone = true;
    try { if (window.__introFailsafe) clearTimeout(window.__introFailsafe); } catch (e) {}
    root.classList.remove('is-locked');
    if (pageEl) {
      pageEl.removeAttribute('aria-hidden');
      try { pageEl.inert = false; } catch (e) {}
    }
    if (introEl && root.classList.contains('intro-active')) {
      introEl.classList.add('is-leaving');
      setTimeout(function () { root.classList.remove('intro-active'); }, 500);
    } else {
      root.classList.remove('intro-active');
    }
  }
  var introHardTimer = setTimeout(endIntro, 7000); // 독립 무장 (노트 10)
  // head의 __introFailsafe는 "main.js 로드 실패" 대비용 — 제어권을 잡은 즉시 해제.
  // (head failsafe는 intro-active/is-locked만 제거하고 #page의 aria-hidden/inert는
  //  못 풀므로, 둘 다 살아 있으면 failsafe가 먼저 발화해 오버레이는 사라졌는데
  //  본문은 inert인 "보이는데 죽은 페이지" 구간이 생긴다. 여기부터는 위의
  //  introHardTimer(endIntro 완전 정리)가 7s 상한을 대체한다.)
  try {
    if (window.__introFailsafe) { clearTimeout(window.__introFailsafe); window.__introFailsafe = null; }
  } catch (e) {}

  /* ============================================================
   * 1. BGM (rev.3-B / rev.4, 노트 5·6·7)
   *    - 로드 시 자동재생 시도 없음(MJ2), preload="none" 유지
   *    - 재생 트리거: pointerup/touchend/click/keydown {once:true} 만
   *      (scroll·touchstart 금지 — user activation 비보장)
   *    - 재무장(N1): play().catch() 안에서만 리스너 재등록
   *    - localStorage(N2): 읽기/쓰기 try/catch, OFF 저장 시 자동재생 미무장
   * ============================================================ */
  var bgmFirstGesture = function () {}; // 인트로 탭에서 직접 호출할 훅 (노트 12)

  (function initBgm() {
    var btn = doc.getElementById('bgm-toggle');
    var audio = doc.getElementById('bgm');
    var src = get(CFG, ['bgm', 'src'], '');
    if (!btn || !audio) return;
    if (!src) { btn.hidden = true; return; } // 음원 미제공 → 토글 숨김(레이아웃 무영향)

    var source = doc.createElement('source');
    source.src = src;
    source.type = /\.m4a(\?.*)?$/i.test(src) ? 'audio/mp4' : 'audio/mpeg';
    audio.appendChild(source);
    btn.hidden = false;

    var LS_KEY = 'wedding-bgm-pref';
    function prefGet() { try { return window.localStorage.getItem(LS_KEY); } catch (e) { return null; } }
    function prefSet(v) { try { window.localStorage.setItem(LS_KEY, v); } catch (e) {} }

    function setState(playing) {
      btn.setAttribute('aria-pressed', String(playing));
      btn.setAttribute('aria-label', playing ? '배경음악 일시정지' : '배경음악 재생');
      btn.innerHTML = playing ? '&#10074;&#10074;' : '&#9834;';
      if (playing) btn.classList.remove('is-hinting');
    }

    var GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
    var armed = false;
    function onGesture(ev) {
      // 토글 버튼에서 시작된 제스처는 무시 — 버튼 핸들러 전담.
      // (문서 리스너가 pointerup에서 먼저 재생을 시작하면, 같은 탭의 click이
      //  버튼 핸들러에서 "재생 중"으로 보여 즉시 정지+OFF 저장하는 역전 방지)
      if (ev && ev.target && btn.contains(ev.target)) return;
      disarm();
      tryAutoPlay();
    }
    function arm() {
      if (armed) return;
      armed = true;
      GESTURES.forEach(function (ev) { doc.addEventListener(ev, onGesture); });
    }
    function disarm() {
      if (!armed) return;
      armed = false;
      GESTURES.forEach(function (ev) { doc.removeEventListener(ev, onGesture); });
    }
    function tryAutoPlay() {
      if (!audio.paused) return; // 이중 트리거(인트로 탭 + 버블) 무해화
      var p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(function () { setState(true); })
         .catch(function () { arm(); }); // N1: 실패 시에만 재무장, 콘솔 에러 0
      }
    }

    var pref = prefGet(); // 'on' | 'off' | null(첫 방문)
    if (pref == null) { // N2: 저장값이 "없는 첫 방문"일 때만 best-effort 자동재생 무장 + 힌트
      arm();
      btn.classList.add('is-hinting'); // "탭하여 음악" 펄스 힌트
    }

    bgmFirstGesture = function () {
      if (prefGet() != null) return; // N2: 저장값(on/off)이 있으면 best-effort 미발동 — 토글이 경로
      disarm();
      tryAutoPlay();
    };

    btn.addEventListener('click', function () {
      disarm(); // 문서 레벨 once 리스너가 뒤이어 재생을 되살리는 것 방지
      btn.classList.remove('is-hinting');
      if (audio.paused) {
        var p = audio.play();
        if (p && typeof p.then === 'function') {
          p.then(function () { setState(true); prefSet('on'); })
           .catch(function () { toast('음악을 재생할 수 없습니다.'); });
        }
      } else {
        audio.pause();
        setState(false);
        prefSet('off');
      }
    });
    audio.addEventListener('play', function () { setState(true); });
    audio.addEventListener('pause', function () { setState(false); });
  })();

  /* ============================================================
   * 2. 인트로 오프닝 (rev.5, 노트 9~13)
   *    해제 = max(애니메이션 타이머 ~4.4s, 커버 settle) / 7s 상한(위에서 무장)
   *    (rev.6: 처음 들어왔을 때 문구를 다 읽기 전에 넘어간다는 피드백으로
   *     2.2s → 4.4s 로 연장 + 각 줄 등장 타이밍도 style.css 쪽에서 함께 늦춤)
   * ============================================================ */
  (function initIntro() {
    if (!root.classList.contains('intro-active')) {
      // reduced-motion 등으로 미마운트 — 하드 타이머만 정리
      clearTimeout(introHardTimer);
      introDone = true;
      return;
    }
    if (pageEl) {
      pageEl.setAttribute('aria-hidden', 'true'); // 노트 13
      try { pageEl.inert = true; } catch (e) {}
    }

    var animDone = false;
    var coverDone = false;
    function maybeEnd() { if (animDone && coverDone) endIntro(); }

    // 애니메이션 분기: animationend 대신 duration 기반 setTimeout (노트 10)
    // 4.4s = 마지막 줄(스킵 힌트, style.css 기준 3.6s에 등장 완료) 이후 ~0.8s 를
    // 그대로 유지해 다 읽을 시간을 준 뒤 자동으로 넘어감 (탭하면 언제든 즉시 스킵)
    setTimeout(function () { animDone = true; maybeEnd(); }, 4400);

    // 커버 settle: load + error + 동기 complete(캐시) 3경로 (노트 10 — 재방문 역전 방지)
    // HTML 스펙상 broken 이미지도 complete=true → naturalWidth 검사 없이 settled 취급.
    // (main.js 실행 전에 이미 error로 settle된 404 커버가 load/error 재발화 없이
    //  5s 하드캡까지 인트로를 잠그는 구멍 방지 — AC rev.5 ② settle=[load|error|cached])
    var cover = doc.getElementById('cover-img');
    function coverSettled() { coverDone = true; maybeEnd(); }
    if (!cover || cover.complete) {
      coverDone = true;
    } else {
      cover.addEventListener('load', coverSettled);
      cover.addEventListener('error', coverSettled);
    }

    if (introEl) {
      // 탭 = 즉시 스킵 + 같은 신뢰 제스처로 BGM 트리거. stopPropagation 금지 (노트 12)
      introEl.addEventListener('click', function () {
        endIntro();
        bgmFirstGesture();
      });
      // 스크롤 잠금 보강: CSS(touch-action:none) + passive:false touchmove (노트 9)
      introEl.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    }
  })();

  /* ============================================================
   * 3. 토스트
   * ============================================================ */
  var toastTimer = null;
  function toast(msg) {
    var el = doc.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-show'); }, 2400);
  }

  // 국화(故) 아이콘 — index.html 의 정적 마크업과 동일한 SVG (JS 주입용).
  // ⚠ bindConfig() 안에서 즉시 쓰이므로 반드시 그 IIFE보다 앞에 있어야 함
  //   (var 는 선언만 호이스팅되고 대입은 실행 순서를 따르므로, 뒤에 두면
  //    첫 실행 시 여기 값이 아직 undefined 라 innerHTML 이 문자열 "undefined"가 됨).
  var FLOWER_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round">' +
    '<ellipse cx="12" cy="5.4" rx="2.1" ry="4.1"/>' +
    '<ellipse cx="12" cy="5.4" rx="2.1" ry="4.1" transform="rotate(45 12 12)"/>' +
    '<ellipse cx="12" cy="5.4" rx="2.1" ry="4.1" transform="rotate(90 12 12)"/>' +
    '<ellipse cx="12" cy="5.4" rx="2.1" ry="4.1" transform="rotate(135 12 12)"/>' +
    '<ellipse cx="12" cy="5.4" rx="2.1" ry="4.1" transform="rotate(180 12 12)"/>' +
    '<ellipse cx="12" cy="5.4" rx="2.1" ry="4.1" transform="rotate(225 12 12)"/>' +
    '<ellipse cx="12" cy="5.4" rx="2.1" ry="4.1" transform="rotate(270 12 12)"/>' +
    '<ellipse cx="12" cy="5.4" rx="2.1" ry="4.1" transform="rotate(315 12 12)"/>' +
    '</g><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>';

  /* ============================================================
   * 4. config 텍스트 주입 (placeholder 안전 — HTML 정적 텍스트가 기본값)
   * ============================================================ */
  (function bindConfig() {
    var time = get(CFG, ['wedding', 'time'], '');
    var timePlaceholder = get(CFG, ['wedding', 'timePlaceholder'], null);
    var venueName = get(CFG, ['venue', 'name'], null);
    var venueHall = get(CFG, ['venue', 'hall'], null);
    var bindings = {
      groomName: get(CFG, ['groom', 'name'], null),
      brideName: get(CFG, ['bride', 'name'], null),
      groomNameEn: get(CFG, ['groom', 'nameEn'], null),
      brideNameEn: get(CFG, ['bride', 'nameEn'], null),
      groomRelation: get(CFG, ['groom', 'relation'], null),
      brideRelation: get(CFG, ['bride', 'relation'], null),
      groomFather: get(CFG, ['groom', 'father', 'name'], null),
      groomMother: get(CFG, ['groom', 'mother', 'name'], null),
      brideFather: get(CFG, ['bride', 'father', 'name'], null),
      brideMother: get(CFG, ['bride', 'mother', 'name'], null),
      greeting: get(CFG, ['greeting'], null),
      tagline: get(CFG, ['wedding', 'tagline'], null),
      dateText: get(CFG, ['wedding', 'dateText'], null),
      venueName: venueName,
      venueHall: venueHall,
      // 커버 한 줄 표기: "더채플 앳 청담 커티지홀 (3층)"
      venueLine: (venueName || venueHall) ? [venueName, venueHall].filter(Boolean).join(' ') : null,
      venueAddress: get(CFG, ['venue', 'address'], null),
      timeDisplay: formatTimeDisplay(time) || timePlaceholder,
      timeDisplayEn: formatTimeDisplayEn(time) || timePlaceholder
    };
    $$('[data-cfg]').forEach(function (el) {
      var key = el.getAttribute('data-cfg');
      if (bindings[key] != null) el.textContent = bindings[key];
    });

    // 고인(故) 표시 — 혼주 { deceased: true } 이면 성함 앞에 국화 아이콘 + 스크린리더용 "고(故)"
    var deceased = {
      groomFather: get(CFG, ['groom', 'father', 'deceased'], false) === true,
      groomMother: get(CFG, ['groom', 'mother', 'deceased'], false) === true,
      brideFather: get(CFG, ['bride', 'father', 'deceased'], false) === true,
      brideMother: get(CFG, ['bride', 'mother', 'deceased'], false) === true
    };
    $$('[data-deceased]').forEach(function (el) {
      var on = deceased[el.getAttribute('data-deceased')];
      el.hidden = !on;
      if (on && !el.firstChild) el.innerHTML = FLOWER_SVG;
    });
    $$('[data-deceased-sr]').forEach(function (el) {
      el.hidden = !deceased[el.getAttribute('data-deceased-sr')];
    });

    // 예식장 전화 — config 비우면 숨김
    var tel = get(CFG, ['venue', 'tel'], '');
    var telWrap = doc.getElementById('venue-tel-wrap');
    var telA = doc.getElementById('venue-tel');
    if (telWrap && telA) {
      if (tel) {
        telA.textContent = tel;
        telA.href = 'tel:' + tel.replace(/[^+\d]/g, '');
      } else {
        telWrap.hidden = true;
      }
    }
  })();

  function formatTimeDisplay(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    if (!m) return '';
    var h = parseInt(m[1], 10), min = parseInt(m[2], 10);
    var ampm = h < 12 ? '오전' : '오후';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return ampm + ' ' + h12 + '시' + (min ? ' ' + min + '분' : '');
  }
  // 커버용 영문 표기 (종이 청첩장 표지 "12 : 30 PM" 형식) — '12:30' → '12:30 PM'
  function formatTimeDisplayEn(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    if (!m) return '';
    var h = parseInt(m[1], 10);
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + m[2] + ' ' + (h < 12 ? 'AM' : 'PM');
  }

  /* ============================================================
   * 4-1. 교통 안내 표 (config.venue.transport) — 정적 HTML 이 기본값,
   *      config 가 있으면 그대로 다시 그림. 노선 배지 색상은 CSS [data-line] 담당.
   * ============================================================ */
  (function initTransport() {
    var dl = doc.getElementById('transport');
    var rows = get(CFG, ['venue', 'transport'], null);
    if (!dl || !rows || !rows.length) return;
    dl.innerHTML = '';
    rows.forEach(function (r) {
      if (!r || !r.label) return;
      var row = doc.createElement('div');
      row.className = 'transport-row';
      var dt = doc.createElement('dt');
      dt.textContent = r.label;
      var dd = doc.createElement('dd');
      var lines = r.lines || [];
      lines.forEach(function (ln) {
        var b = doc.createElement('span');
        b.className = 'line-badge';
        b.setAttribute('data-line', ln);
        b.textContent = ln;
        dd.appendChild(b);
      });
      if (r.text) dd.appendChild(doc.createTextNode((lines.length ? ' ' : '') + r.text));
      if (r.note) {
        var s = doc.createElement('small');
        s.className = 'transport-note';
        s.textContent = '* ' + r.note;
        dd.appendChild(s);
      }
      row.appendChild(dt);
      row.appendChild(dd);
      dl.appendChild(row);
    });
  })();

  /* ============================================================
   * 5. 연락처 버튼 (전화/문자) — 번호 없으면 미노출
   * ============================================================ */
  (function initContacts() {
    function telHref(p) { return 'tel:' + p.replace(/[^+\d]/g, ''); }
    function smsHref(p) { return 'sms:' + p.replace(/[^+\d]/g, ''); }
    function btnA(href, label, cls) {
      var a = doc.createElement('a');
      a.href = href;
      a.textContent = label;
      a.className = 'btn contact-btn' + (cls ? ' ' + cls : '');
      return a;
    }
    [['groom', CFG.groom], ['bride', CFG.bride]].forEach(function (pair) {
      var holder = $('[data-contact="' + pair[0] + '"]');
      var phone = get(pair[1] || {}, ['phone'], '');
      if (!holder || !phone) return;
      holder.appendChild(btnA(telHref(phone), '전화하기'));
      holder.appendChild(btnA(smsHref(phone), '문자하기'));
    });

    // 혼주 연락처 (details 내부)
    var box = doc.getElementById('parents-contact');
    if (!box) return;
    var rows = [];
    [['신랑측', CFG.groom], ['신부측', CFG.bride]].forEach(function (side) {
      [['아버지', get(side[1] || {}, ['father'], {})], ['어머니', get(side[1] || {}, ['mother'], {})]].forEach(function (p) {
        var name = get(p[1], ['name'], '');
        var phone = get(p[1], ['phone'], '');
        if (!phone) return;
        var row = doc.createElement('div');
        row.className = 'parent-row';
        var label = doc.createElement('p');
        label.className = 'parent-label';
        label.textContent = side[0] + ' ' + p[0] + ' ' + name;
        row.appendChild(label);
        var btns = doc.createElement('div');
        btns.className = 'contact-btns';
        btns.appendChild(btnA(telHref(phone), '전화하기'));
        btns.appendChild(btnA(smsHref(phone), '문자하기'));
        row.appendChild(btns);
        rows.push(row);
      });
    });
    if (rows.length) {
      box.innerHTML = '';
      rows.forEach(function (r) { box.appendChild(r); });
    }
  })();

  /* ============================================================
   * 6. D-day — KST(+09:00) 앵커, floor, 당일 "D-Day" (M6, 노트 4)
   *    한국은 DST 없음 → 고정 +09:00 정확. 브라우저 시간대 무관.
   * ============================================================ */
  (function initDday() {
    var el = doc.getElementById('dday-badge');
    if (!el) return;
    var KST = 9 * 3600e3;
    var y = get(CFG, ['wedding', 'year'], 2026);
    var mo = get(CFG, ['wedding', 'month'], 12);
    var d = get(CFG, ['wedding', 'day'], 12);
    var targetMidUtc = Date.UTC(y, mo - 1, d) - KST;          // 목표일 KST 자정
    var nowK = new Date(Date.now() + KST);                     // KST 달력일 추출용
    var todayMidUtc = Date.UTC(nowK.getUTCFullYear(), nowK.getUTCMonth(), nowK.getUTCDate()) - KST;
    var diff = Math.floor((targetMidUtc - todayMidUtc) / 86400e3);
    if (diff > 0) el.textContent = 'D-' + diff;
    else if (diff === 0) el.textContent = 'D-Day';
    else el.textContent = 'D+' + Math.abs(diff);
  })();

  /* ============================================================
   * 7. 갤러리 라이트박스 — 이전/다음/스와이프/ESC/배경 닫기
   * ============================================================ */
  (function initLightbox() {
    var items = $$('#gallery .gallery-item img');
    var lb = doc.getElementById('lightbox');
    if (!lb || !items.length) return;
    var lbImg = doc.getElementById('lb-img');
    var lbCounter = doc.getElementById('lb-counter');
    var current = 0;
    var lastFocus = null;

    function show(i) {
      current = (i + items.length) % items.length;
      lbImg.src = items[current].src;
      lbImg.alt = items[current].alt || '';
      lbCounter.textContent = (current + 1) + ' / ' + items.length;
    }
    function open(i) {
      lastFocus = doc.activeElement;
      show(i);
      lb.hidden = false;
      root.classList.add('lb-open');
      // aria-modal 선언과 키보드 포커스 동작 정합 — 배경 #page 포커스 유출 차단
      // (인트로에서 쓰는 inert 패턴 재사용, 미지원 브라우저는 graceful degradation)
      if (pageEl) { try { pageEl.inert = true; } catch (e) {} }
      var closeBtn = doc.getElementById('lb-close');
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      lb.hidden = true;
      root.classList.remove('lb-open');
      if (pageEl) { try { pageEl.inert = false; } catch (e) {} }
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }

    items.forEach(function (img, i) {
      var btn = img.closest ? img.closest('.gallery-item') : img.parentNode;
      (btn || img).addEventListener('click', function () { open(i); });
    });
    doc.getElementById('lb-close').addEventListener('click', close);
    doc.getElementById('lb-prev').addEventListener('click', function () { show(current - 1); });
    doc.getElementById('lb-next').addEventListener('click', function () { show(current + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); }); // 배경 닫기
    doc.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(current - 1);
      else if (e.key === 'ArrowRight') show(current + 1);
    });
    // 스와이프 (passive — preventDefault 불필요)
    var touchX = null;
    lb.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length === 1) touchX = e.touches[0].clientX;
    }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX == null) return;
      var dx = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : touchX) - touchX;
      touchX = null;
      if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    }, { passive: true });
  })();

  /* ============================================================
   * 8. 복사 유틸 — clipboard → execCommand → 실패 토스트 (M 계열)
   * ============================================================ */
  function copyText(str, okMsg) {
    function ok() { toast(okMsg || '복사되었습니다.'); }
    function fail() { toast('복사에 실패했습니다. 길게 눌러 직접 복사해주세요.'); }
    function legacy() {
      var ta = null;
      var done = false;
      try {
        ta = doc.createElement('textarea');
        ta.value = str;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        doc.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, str.length);
        done = doc.execCommand('copy');
      } catch (e) { done = false; }
      // 예외 경로 포함 항상 제거 — 계좌번호가 담긴 textarea의 DOM 잔류/누적 방지
      if (ta && ta.parentNode) { try { doc.body.removeChild(ta); } catch (e2) {} }
      done ? ok() : fail();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(ok, legacy);
    } else {
      legacy();
    }
  }

  /* ============================================================
   * 9. 오시는 길 — 딥링크(https 보장 경로) + 카카오맵 임베드 (M2·M3, 노트 2·3)
   * ============================================================ */
  (function initMap() {
    // 딥링크/검색은 지도 앱 등록명(searchName, 띄어쓰기 없음) 우선 — 화면 표기명은 폴백
    var name = get(CFG, ['venue', 'searchName'], get(CFG, ['venue', 'name'], '더채플앳청담'));
    var displayName = get(CFG, ['venue', 'name'], name);
    var addr = get(CFG, ['venue', 'address'], '');
    var lat = get(CFG, ['venue', 'lat'], 37.52218);
    var lng = get(CFG, ['venue', 'lng'], 127.03901);
    var naverPlaceId = get(CFG, ['venue', 'naverPlaceId'], '');
    var enc = encodeURIComponent(name); // 노트 3
    var ua = navigator.userAgent || '';
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPhone|iPad|iPod/i.test(ua);

    /* 앱 스킴 열기 → 앱 전환이 없으면(미설치·인앱 WebView 차단) 1.5s 뒤 폴백.
     * cancel 리스너는 1쌍만 상시 등록, 클릭마다 타이머 id만 갱신
     * ({once:true}를 클릭마다 새로 걸면 앱 전환이 없을 때 스테일 리스너가 누적됨, 노트 2) */
    var navTimer = null;
    function navCancel() { if (navTimer) { clearTimeout(navTimer); navTimer = null; } }
    doc.addEventListener('visibilitychange', navCancel);
    window.addEventListener('pagehide', navCancel);
    function armFallback(fallback) {
      navCancel();
      navTimer = setTimeout(function () {
        navTimer = null;
        if (typeof fallback === 'function') fallback();
        else if (fallback) window.location.href = fallback;
      }, 1500);
    }
    function openApp(schemeUrl, fallback) {
      armFallback(fallback);
      window.location.href = schemeUrl;
    }
    // Android 는 intent:// 권장 — 앱이 없으면 Play 스토어(package)로 자동 이동
    function intentUrl(scheme, path, pkg) {
      return 'intent://' + path + '#Intent;scheme=' + scheme +
        ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=' + pkg + ';end';
    }

    // 카카오맵 길찾기 — 공식 URL(https)이라 어디서나 열리고, 앱이 있으면 앱으로 연결됨
    var kakaoBtn = doc.getElementById('btn-kakaomap');
    if (kakaoBtn) kakaoBtn.href = 'https://map.kakao.com/link/to/' + enc + ',' + lat + ',' + lng;

    // 네이버지도 자동차 길찾기 — 앱 스킴(nmap://) 우선, 실패 시 네이버지도 웹(플레이스 페이지) 폴백
    var naverBtn = doc.getElementById('btn-navermap');
    if (naverBtn) {
      var naverWeb = naverPlaceId
        ? 'https://map.naver.com/p/entry/place/' + encodeURIComponent(naverPlaceId)
        : 'https://map.naver.com/p/search/' + enc;
      var naverPath = 'route/car?dlat=' + lat + '&dlng=' + lng + '&dname=' + enc +
        '&appname=' + encodeURIComponent(window.location.hostname || 'wedding-invitation');
      naverBtn.href = naverWeb; // no-JS / 데스크톱 폴백
      naverBtn.addEventListener('click', function (e) {
        if (isAndroid) {
          e.preventDefault();
          openApp(intentUrl('nmap', naverPath, 'com.nhn.android.nmap'), naverWeb);
        } else if (isIOS) {
          e.preventDefault();
          openApp('nmap://' + naverPath, naverWeb);
        }
        // 데스크톱: href(웹) 그대로 이동
      });
    }

    // 티맵 길안내 — 웹 지도가 없어 앱 스킴만. 미설치 시 Android 는 스토어, iOS 는 안내 토스트
    var tmapBtn = doc.getElementById('btn-tmap');
    if (tmapBtn) {
      var tmapPath = 'route?goalname=' + enc + '&goalx=' + lng + '&goaly=' + lat;
      var tmapNoApp = function () { toast('티맵 앱이 설치된 기기에서 열 수 있습니다.'); };
      tmapBtn.href = 'tmap://' + tmapPath;
      tmapBtn.addEventListener('click', function (e) {
        if (isAndroid) {
          e.preventDefault();
          openApp(intentUrl('tmap', tmapPath, 'com.skt.tmap.ku'), tmapNoApp);
        } else {
          armFallback(tmapNoApp); // href 스킴으로 이동, 앱 전환이 없으면 토스트
        }
      });
    }

    var copyBtn = doc.getElementById('btn-copy-address');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      copyText(addr || name, '주소가 복사되었습니다.');
    });

    // 카카오맵 JS 임베드 — 키 없으면 약도(fallback) 유지, SDK 실패 시에도 약도 유지
    var key = get(CFG, ['map', 'kakaoJsKey'], '');
    if (!key) return;
    var sc = doc.createElement('script');
    sc.async = true;
    sc.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&autoload=false';
    sc.onload = function () {
      try {
        window.kakao.maps.load(function () {
          try {
            var K = window.kakao.maps;
            var canvas = doc.getElementById('map-canvas');
            var fb = doc.getElementById('map-fallback');
            var embed = doc.getElementById('map-embed');
            if (!canvas) return;
            embed.classList.add('has-map');
            canvas.removeAttribute('aria-hidden');
            var pos = new K.LatLng(lat, lng);
            var map = new K.Map(canvas, { center: pos, level: 3 });
            map.addControl(new K.ZoomControl(), K.ControlPosition.RIGHT);
            new K.Marker({ map: map, position: pos });
            // 장소명 말풍선 (textContent 로 만들어 HTML 이스케이프 불필요)
            var label = doc.createElement('div');
            label.className = 'map-label';
            label.textContent = displayName;
            new K.CustomOverlay({ map: map, position: pos, content: label, yAnchor: 2.4 });
            if (fb) fb.hidden = true;
          } catch (e) { /* fallback 유지 */ }
        });
      } catch (e) { /* fallback 유지 */ }
    };
    sc.onerror = function () { /* fallback 유지 — 콘솔 에러 없이 약도 표시 */ };
    doc.head.appendChild(sc);
  })();

  /* ============================================================
   * 10. 마음 전하실 곳 — 아코디언(details) + 계좌 복사
   * ============================================================ */
  (function initAccounts() {
    [['groom', get(CFG, ['accounts', 'groom'], [])], ['bride', get(CFG, ['accounts', 'bride'], [])]].forEach(function (pair) {
      var list = $('[data-accounts="' + pair[0] + '"]');
      var arr = pair[1];
      if (!list || !arr || !arr.length) return;
      var rows = arr.filter(function (a) { return a && a.number; });
      if (!rows.length) return;
      list.innerHTML = '';
      rows.forEach(function (a) {
        var li = doc.createElement('li');
        li.className = 'account-item';

        var info = doc.createElement('div');
        info.className = 'account-info';
        var line1 = doc.createElement('p');
        line1.className = 'account-line';
        line1.textContent = (a.bank || '') + ' ' + a.number;
        var line2 = doc.createElement('p');
        line2.className = 'account-holder';
        line2.textContent = (a.label ? a.label + ' · ' : '') + (a.holder || '');
        info.appendChild(line1);
        info.appendChild(line2);

        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'btn copy-btn';
        btn.textContent = '복사';
        btn.setAttribute('aria-label', (a.holder || '') + ' 계좌번호 복사');
        btn.addEventListener('click', function () {
          copyText((a.bank ? a.bank + ' ' : '') + a.number, '계좌번호가 복사되었습니다.');
        });

        li.appendChild(info);
        li.appendChild(btn);
        list.appendChild(li);
      });
    });
  })();

  /* ============================================================
   * 11. 스크롤 리빌 (M11-①) — IO 지원 시에만 숨김 클래스 부여
   *     (IO 미지원/JS off/reduced-motion → 콘텐츠 항상 표시)
   * ============================================================ */
  (function initReveal() {
    var els = $$('.reveal');
    if (!els.length) return;
    if (reducedMotion || !('IntersectionObserver' in window)) return; // 전부 표시 유지
    root.classList.add('reveal-ready'); // 이 클래스 하위에서만 초기 숨김 CSS 적용
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  })();

})();
