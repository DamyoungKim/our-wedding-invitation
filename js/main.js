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
   * 0. 인트로 해제 — 5s 하드 타임아웃을 "가장 먼저" 무장 (노트 10)
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
  var introHardTimer = setTimeout(endIntro, 5000); // 독립 무장 (노트 10)
  // head의 __introFailsafe는 "main.js 로드 실패" 대비용 — 제어권을 잡은 즉시 해제.
  // (head failsafe는 intro-active/is-locked만 제거하고 #page의 aria-hidden/inert는
  //  못 풀므로, 둘 다 살아 있으면 failsafe가 먼저 발화해 오버레이는 사라졌는데
  //  본문은 inert인 "보이는데 죽은 페이지" 구간이 생긴다. 여기부터는 위의
  //  introHardTimer(endIntro 완전 정리)가 5s 상한을 대체한다.)
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
   *    해제 = max(애니메이션 타이머 ~2.2s, 커버 settle) / 5s 상한(위에서 무장)
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
    setTimeout(function () { animDone = true; maybeEnd(); }, 2200);

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

  /* ============================================================
   * 4. config 텍스트 주입 (placeholder 안전 — HTML 정적 텍스트가 기본값)
   * ============================================================ */
  (function bindConfig() {
    var timeDisplay = formatTimeDisplay(get(CFG, ['wedding', 'time'], ''));
    var bindings = {
      groomName: get(CFG, ['groom', 'name'], null),
      brideName: get(CFG, ['bride', 'name'], null),
      groomFather: get(CFG, ['groom', 'father', 'name'], null),
      groomMother: get(CFG, ['groom', 'mother', 'name'], null),
      brideFather: get(CFG, ['bride', 'father', 'name'], null),
      brideMother: get(CFG, ['bride', 'mother', 'name'], null),
      greeting: get(CFG, ['greeting'], null),
      venueName: get(CFG, ['venue', 'name'], null),
      venueHall: get(CFG, ['venue', 'hall'], null),
      venueAddress: get(CFG, ['venue', 'address'], null),
      timeDisplay: timeDisplay || get(CFG, ['wedding', 'timePlaceholder'], null)
    };
    $$('[data-cfg]').forEach(function (el) {
      var key = el.getAttribute('data-cfg');
      if (bindings[key] != null) el.textContent = bindings[key];
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
    var name = get(CFG, ['venue', 'name'], '더채플앳청담');
    var addr = get(CFG, ['venue', 'address'], '');
    var lat = get(CFG, ['venue', 'lat'], 37.5223);
    var lng = get(CFG, ['venue', 'lng'], 127.0405);
    var enc = encodeURIComponent(name); // 노트 3

    var kakaoBtn = doc.getElementById('btn-kakaomap');
    var naverBtn = doc.getElementById('btn-navermap');
    var tmapBtn = doc.getElementById('btn-tmap');
    if (kakaoBtn) kakaoBtn.href = 'https://map.kakao.com/link/map/' + enc + ',' + lat + ',' + lng;
    if (naverBtn) naverBtn.href = 'https://map.naver.com/p/search/' + enc;
    if (tmapBtn) {
      // 티맵은 웹 지도가 없어 공식 앱 스킴 사용(best-effort). 인앱 WebView에서
      // 스킴 전환이 무시될 수 있으므로 실패 시 안내 토스트 (노트 2)
      // cancel 리스너는 1쌍만 상시 등록, 클릭마다 타이머 id만 갱신
      // ({once:true}를 클릭마다 새로 걸면 앱 전환이 없을 때 스테일 리스너가 누적됨)
      tmapBtn.href = 'tmap://search?name=' + enc;
      var tmapTimer = null;
      var tmapCancel = function () {
        if (tmapTimer) { clearTimeout(tmapTimer); tmapTimer = null; }
      };
      doc.addEventListener('visibilitychange', tmapCancel);
      window.addEventListener('pagehide', tmapCancel);
      tmapBtn.addEventListener('click', function () {
        tmapCancel();
        tmapTimer = setTimeout(function () {
          tmapTimer = null;
          toast('티맵 앱이 설치된 기기에서 열 수 있습니다.');
        }, 1500);
      });
    }

    var copyBtn = doc.getElementById('btn-copy-address');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      copyText(addr || name, '주소가 복사되었습니다.');
    });

    // 카카오맵 JS 임베드 — 키 없으면 fallback 블록 유지, SDK 실패 시에도 fallback 유지
    var key = get(CFG, ['map', 'kakaoJsKey'], '');
    if (!key) return;
    var sc = doc.createElement('script');
    sc.async = true;
    sc.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&autoload=false';
    sc.onload = function () {
      try {
        window.kakao.maps.load(function () {
          try {
            var canvas = doc.getElementById('map-canvas');
            var fb = doc.getElementById('map-fallback');
            var embed = doc.getElementById('map-embed');
            if (!canvas) return;
            embed.classList.add('has-map');
            canvas.removeAttribute('aria-hidden');
            var pos = new window.kakao.maps.LatLng(lat, lng);
            var map = new window.kakao.maps.Map(canvas, { center: pos, level: 4 });
            new window.kakao.maps.Marker({ map: map, position: pos });
            if (fb) fb.hidden = true;
          } catch (e) { /* fallback 유지 */ }
        });
      } catch (e) { /* fallback 유지 */ }
    };
    sc.onerror = function () { /* fallback 유지 — 콘솔 에러 없이 안내 블록 표시 */ };
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
   * 11. 공유 — navigator.share → 링크 복사 fallback (M11-②)
   *     구글 캘린더 버튼: 예식 시간 확정 전 숨김 (rev.3-A)
   * ============================================================ */
  (function initShare() {
    var url = window.location.href.split('#')[0];
    var title = get(CFG, ['share', 'title'], doc.title);
    var text = get(CFG, ['share', 'text'], '');

    var shareBtn = doc.getElementById('btn-share');
    var copyBtn = doc.getElementById('btn-copy-link');
    function copyLink() { copyText(url, '청첩장 링크가 복사되었습니다.'); }

    if (shareBtn) shareBtn.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: title, text: text, url: url })
          .catch(function () { /* 사용자 취소(AbortError) 등 — 조용히 */ });
      } else {
        copyLink(); // 인스타 인앱 등 미지원 환경 fallback
      }
    });
    if (copyBtn) copyBtn.addEventListener('click', copyLink);

    // 구글 캘린더 (인앱 다운로드 제약 회피 — 인앱 기본 동선은 URL 1순위, 노트 8)
    var gcal = doc.getElementById('btn-gcal');
    var icsBtn = doc.getElementById('btn-ics');
    var icsNote = doc.getElementById('ics-note');
    var time = get(CFG, ['wedding', 'time'], '');
    var m = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!m) return; // 시간 미확정 → 캘린더 버튼(구글/.ics) 숨김 유지
    var y = get(CFG, ['wedding', 'year'], 2026);
    var mo = get(CFG, ['wedding', 'month'], 12);
    var d = get(CFG, ['wedding', 'day'], 12);
    var dur = get(CFG, ['wedding', 'durationMinutes'], 90);
    var startUtc = Date.UTC(y, mo - 1, d, parseInt(m[1], 10), parseInt(m[2], 10)) - 9 * 3600e3; // KST→UTC
    function fmt(ms) {
      var dt = new Date(ms);
      function p(n) { return (n < 10 ? '0' : '') + n; }
      return dt.getUTCFullYear() + p(dt.getUTCMonth() + 1) + p(dt.getUTCDate()) +
        'T' + p(dt.getUTCHours()) + p(dt.getUTCMinutes()) + '00Z';
    }
    var loc = get(CFG, ['venue', 'name'], '') + ' ' + get(CFG, ['venue', 'hall'], '') +
      ' (' + get(CFG, ['venue', 'address'], '') + ')';
    if (gcal) {
      gcal.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        '&text=' + encodeURIComponent(title) +
        '&dates=' + fmt(startUtc) + '/' + fmt(startUtc + dur * 60000) +
        '&location=' + encodeURIComponent(loc) +
        '&ctz=Asia/Seoul';
      gcal.classList.remove('is-hidden');
    }

    // .ics 보조 링크 (노트 8 / rev.3-A — 2순위. 인앱 WebView에선 다운로드가
    // 실패할 수 있어 "정식 브라우저에서 이용" 안내 문구를 병기해 노출)
    if (icsBtn) {
      var icsEsc = function (s) {
        return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;')
          .replace(/,/g, '\\,').replace(/\n/g, '\\n');
      };
      var ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//mobile-wedding-invitation//KO',
        'BEGIN:VEVENT',
        'UID:wedding-' + fmt(startUtc) + '@invitation',
        'DTSTAMP:' + fmt(Date.now()),
        'DTSTART:' + fmt(startUtc),
        'DTEND:' + fmt(startUtc + dur * 60000),
        'SUMMARY:' + icsEsc(title),
        'LOCATION:' + icsEsc(loc),
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
      icsBtn.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      icsBtn.classList.remove('is-hidden');
      if (icsNote) icsNote.classList.remove('is-hidden');
    }
  })();

  /* ============================================================
   * 12. 스크롤 리빌 (M11-①) — IO 지원 시에만 숨김 클래스 부여
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
