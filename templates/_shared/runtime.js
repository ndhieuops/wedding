/*!
 * Wedding invitation runtime — shared by every template.
 * Vanilla JS, no dependencies, progressive enhancement: the page is fully readable without it.
 *
 * Features: intro overlay (8 styles), background music, particle effects (effects.js),
 * opening bursts & tap effects, animated names, scroll reveal / stagger / parallax / line
 * drawing, countdown, gallery lightbox, RSVP & wishes forms, copy-to-clipboard, lazy Google
 * Map, and a postMessage bridge used by the live preview in the editor.
 */
(function (global) {
  'use strict';

  var html = document.documentElement;
  var cfgEl = document.getElementById('wedding-config');
  var cfg = {};
  try {
    cfg = JSON.parse((cfgEl && cfgEl.textContent) || '{}');
  } catch (e) {
    cfg = {};
  }
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isPreview = cfg.mode === 'preview';
  var canSubmit = cfg.mode === 'live' && !!cfg.endpoints;
  var fxApi = null;

  /* ------------------------------------------------------------------ utils */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var toastTimer;
  function toast(message) {
    var el = $('.toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 2800);
  }

  function throttle(fn, wait) {
    var lastCall = 0, timer;
    return function () {
      var now = Date.now();
      var remaining = wait - (now - lastCall);
      clearTimeout(timer);
      if (remaining <= 0) { lastCall = now; fn(); }
      else timer = setTimeout(function () { lastCall = Date.now(); fn(); }, remaining);
    };
  }

  /* ------------------------------------------------------------------ reveal */
  function initReveal(instant) {
    var items = $$('[data-reveal]');
    if (instant || reducedMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (e) { return e.isIntersecting; });
      visible.forEach(function (entry, i) {
        entry.target.style.setProperty('--reveal-delay', Math.min(i, 6) * 90 + 'ms');
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------ music */
  function initMusic() {
    var btn = $('[data-music]');
    if (!cfg.music || !cfg.music.src || !btn) return { play: function () {} };
    var audio = new Audio();
    audio.src = cfg.music.src;
    audio.loop = true;
    audio.preload = 'none';
    var wantPlaying = false;
    btn.hidden = false;

    function setState(playing) {
      btn.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    }
    function play() {
      wantPlaying = true;
      var p = audio.play();
      if (p && p.then) {
        p.then(function () { setState(true); btn.classList.remove('is-hint'); })
          .catch(function () { setState(false); btn.classList.add('is-hint'); });
      } else setState(true);
    }
    function pause() { wantPlaying = false; audio.pause(); setState(false); }

    btn.addEventListener('click', function () { if (audio.paused) play(); else pause(); });
    audio.addEventListener('error', function () { btn.hidden = true; });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) audio.pause();
      else if (wantPlaying) audio.play().catch(function () {});
    });
    return { play: play };
  }

  /* ------------------------------------------------------------------ effects (see effects.js) */
  function initEffects() {
    var canvas = $('.fx-canvas');
    var noop = { start: function () {}, burst: function () {}, tap: function () {} };
    if (!canvas || reducedMotion || !global.WeddingFX || !canvas.getContext) return noop;
    var fx = null;
    function engine() {
      if (!fx) fx = global.WeddingFX.create(canvas, { colors: cfg.colors || {} });
      return fx;
    }
    var layers = cfg.effects || (cfg.effect && cfg.effect !== 'none' ? [{ type: cfg.effect, intensity: cfg.effectIntensity }] : []);
    var lastTap = 0;
    return {
      start: function () {
        if (!layers.length) return;
        var e = engine();
        layers.forEach(function (l) { e.ambient(l.type, l.intensity); });
      },
      burst: function (type, small) {
        if (type && type !== 'none') engine().burst(type, small);
      },
      tap: function (x, y) {
        if (!cfg.tap || cfg.tap === 'none') return;
        var now = Date.now();
        if (now - lastTap < 120) return;
        lastTap = now;
        engine().tap(cfg.tap, x, y);
      },
    };
  }

  /* ------------------------------------------------------------------ name animations */
  function graphemes(text) {
    if (global.Intl && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text), function (s) { return s.segment; });
    }
    return Array.from(text);
  }

  /** Prepare [data-names] before the intro closes so nothing flashes. */
  function prepareNames(type) {
    var el = $('[data-names]');
    if (!el || !type || type === 'fade' || reducedMotion) return function () {};
    el.removeAttribute('data-reveal');
    el.classList.add('names--' + type);
    // Gradient text (background-clip: text) on the wrapper does not paint animated children —
    // let every child (and letter) carry its own copy of the gradient instead.
    var cs = global.getComputedStyle(el);
    if ((cs.backgroundClip || cs.webkitBackgroundClip) === 'text' || cs.webkitBackgroundClip === 'text') el.classList.add('names--clip');
    var parts = $$(':scope > *', el);
    parts.forEach(function (part, i) { part.style.setProperty('--i', i); });
    if (type === 'letters') {
      var n = 0;
      parts.forEach(function (part) {
        var text = part.textContent;
        part.setAttribute('aria-label', text);
        part.textContent = '';
        graphemes(text).forEach(function (ch) {
          var span = document.createElement('span');
          span.className = 'ch';
          span.setAttribute('aria-hidden', 'true');
          span.style.setProperty('--c', n++);
          span.textContent = ch;
          part.appendChild(span);
        });
      });
    }
    return function play() { el.classList.add('is-playing'); };
  }

  /* ------------------------------------------------------------------ scroll extras */
  function initScrollExtras(instant) {
    // Stagger children: <div data-stagger> children with data-reveal get increasing delays.
    $$('[data-stagger]').forEach(function (group) {
      $$('[data-reveal]', group).forEach(function (el, i) { el.style.setProperty('--reveal-delay', Math.min(i, 10) * 110 + 'ms'); });
    });
    // Line drawings: <svg data-draw> paths are stroked progressively when visible.
    var draws = $$('svg[data-draw]');
    draws.forEach(function (svg) {
      $$('path, line, polyline, circle, ellipse, rect', svg).forEach(function (el) { el.setAttribute('pathLength', '1'); });
      if (instant || reducedMotion) svg.classList.add('is-drawn');
    });
    if (!instant && !reducedMotion && 'IntersectionObserver' in window && draws.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-drawn'); io.unobserve(e.target); }
        });
      }, { threshold: 0.3 });
      draws.forEach(function (svg) { io.observe(svg); });
    }
    // Parallax: data-parallax="0.2" moves the element at a fraction of the scroll speed.
    var items = $$('[data-parallax]');
    if (!items.length || reducedMotion) return;
    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight;
      items.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        var factor = parseFloat(el.getAttribute('data-parallax')) || 0.2;
        var offset = (rect.top + rect.height / 2 - vh / 2) * -factor;
        el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
      });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------ countdown */
  function initCountdown() {
    var root = $('[data-countdown]');
    if (!root) return;
    var target = Date.parse(root.getAttribute('data-countdown'));
    if (isNaN(target)) { root.closest('section').hidden = true; return; }
    var units = {};
    $$('[data-unit]', root).forEach(function (el) { units[el.getAttribute('data-unit')] = el; });
    var done = $('.countdown__done');
    var timer;
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) {
        root.hidden = true;
        if (done) done.hidden = false;
        clearInterval(timer);
        return;
      }
      var s = Math.floor(diff / 1000);
      units.days.textContent = Math.floor(s / 86400);
      units.hours.textContent = pad(Math.floor((s % 86400) / 3600));
      units.minutes.textContent = pad(Math.floor((s % 3600) / 60));
      units.seconds.textContent = pad(s % 60);
    }
    tick();
    timer = setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------------ lightbox */
  function initLightbox() {
    var links = $$('[data-lightbox]');
    if (!links.length) return;
    var box, img, caption, counter, index = 0, lastFocus = null, startX = null;

    function build() {
      box = document.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Xem ảnh');
      box.innerHTML =
        '<div class="lightbox__stage"><img class="lightbox__img" alt="">' +
        '<span class="lightbox__counter"></span>' +
        '<button type="button" class="lightbox__btn lightbox__close" aria-label="Đóng">✕</button>' +
        '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Ảnh trước">‹</button>' +
        '<button type="button" class="lightbox__btn lightbox__next" aria-label="Ảnh sau">›</button></div>' +
        '<p class="lightbox__caption"></p>';
      img = $('.lightbox__img', box);
      caption = $('.lightbox__caption', box);
      counter = $('.lightbox__counter', box);
      $('.lightbox__close', box).addEventListener('click', close);
      $('.lightbox__prev', box).addEventListener('click', function () { show(index - 1); });
      $('.lightbox__next', box).addEventListener('click', function () { show(index + 1); });
      box.addEventListener('click', function (e) { if (e.target === box || e.target.classList.contains('lightbox__stage')) close(); });
      box.addEventListener('pointerdown', function (e) { startX = e.clientX; });
      box.addEventListener('pointerup', function (e) {
        if (startX === null) return;
        var dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      });
      if (links.length < 2) { $('.lightbox__prev', box).hidden = true; $('.lightbox__next', box).hidden = true; }
    }

    function preload(i) {
      var l = links[(i + links.length) % links.length];
      if (l) { var im = new Image(); im.src = l.href; }
    }

    function show(i) {
      index = (i + links.length) % links.length;
      var link = links[index];
      img.style.opacity = '0';
      img.onload = function () { img.style.opacity = '1'; };
      img.src = link.href;
      img.alt = link.getAttribute('data-caption') || ($('img', link) || {}).alt || '';
      caption.textContent = link.getAttribute('data-caption') || '';
      counter.textContent = links.length > 1 ? (index + 1) + ' / ' + links.length : '';
      preload(index + 1);
      preload(index - 1);
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(index + 1);
      else if (e.key === 'ArrowLeft') show(index - 1);
    }

    function open(i) {
      if (!box) build();
      lastFocus = document.activeElement;
      document.body.appendChild(box);
      html.classList.add('intro-lock');
      show(i);
      requestAnimationFrame(function () { box.classList.add('is-open'); });
      document.addEventListener('keydown', onKey);
      $('.lightbox__close', box).focus({ preventScroll: true });
    }

    function close() {
      box.classList.remove('is-open');
      document.removeEventListener('keydown', onKey);
      html.classList.remove('intro-lock');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 300);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    links.forEach(function (link, i) {
      link.addEventListener('click', function (e) { e.preventDefault(); open(i); });
    });
  }

  /* ------------------------------------------------------------------ forms */
  var RSVP_DONE = {
    yes: 'Cảm ơn bạn! Hẹn gặp bạn trong ngày vui nhé ♥',
    maybe: 'Cảm ơn bạn! Mong rằng bạn sẽ sắp xếp được để đến chung vui.',
    no: 'Cảm ơn bạn đã báo! Tiếc quá, hẹn bạn dịp khác nhé.',
  };

  function initForms() {
    $$('form[data-form]').forEach(function (form) {
      var kind = form.getAttribute('data-form');
      var status = $('.form__status', form);
      var button = $('button[type="submit"]', form);

      function setStatus(text, type) {
        status.textContent = text || '';
        status.className = 'form__status' + (type ? ' is-' + type : '');
      }

      if (kind === 'rsvp') {
        var guestsRow = $('[data-when-attending]', form);
        $$('input[name="attending"]', form).forEach(function (radio) {
          radio.addEventListener('change', function () {
            if (guestsRow) guestsRow.hidden = form.attending.value === 'no';
          });
        });
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!canSubmit) {
          toast('Đây là bản xem trước — biểu mẫu chưa được gửi đi.');
          return;
        }
        var invalid = $$('[required]', form).filter(function (el) {
          var bad = !String(el.value || '').trim();
          el.setAttribute('aria-invalid', bad ? 'true' : 'false');
          return bad;
        });
        if (invalid.length) {
          setStatus('Vui lòng điền đầy đủ các mục có dấu *', 'error');
          invalid[0].focus();
          return;
        }
        var payload = {};
        new FormData(form).forEach(function (value, key) { payload[key] = value; });
        if (payload.guests) payload.guests = Number(payload.guests);
        button.disabled = true;
        setStatus('Đang gửi…');

        fetch(cfg.endpoints[kind], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (body) {
              if (!res.ok) throw new Error(body.message || 'Gửi không thành công, vui lòng thử lại.');
              return body;
            });
          })
          .then(function (body) {
            if (kind === 'rsvp') {
              form.classList.add('is-done');
              setStatus(RSVP_DONE[payload.attending] || 'Cảm ơn bạn!', 'success');
              if (payload.attending === 'yes' && fxApi) fxApi.burst('confetti', true);
            } else {
              setStatus('Cảm ơn lời chúc của bạn ♥', 'success');
              form.message.value = '';
              addWish(body.wish || { name: payload.name, message: payload.message });
            }
          })
          .catch(function (err) {
            setStatus(err.message === 'Failed to fetch' ? 'Không có kết nối mạng, vui lòng thử lại.' : err.message, 'error');
          })
          .then(function () { button.disabled = false; });
      });
    });
  }

  function addWish(wish) {
    var list = $('[data-wishes-list]');
    if (!list) return;
    var li = document.createElement('li');
    li.className = 'wish';
    var avatar = document.createElement('span');
    avatar.className = 'wish__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = (wish.name || '♥').trim().split(/\s+/).pop().charAt(0).toUpperCase();
    var body = document.createElement('div');
    body.className = 'wish__body';
    var name = document.createElement('p');
    name.className = 'wish__name';
    name.textContent = wish.name;
    var msg = document.createElement('p');
    msg.className = 'wish__message';
    msg.textContent = wish.message;
    body.appendChild(name);
    body.appendChild(msg);
    li.appendChild(avatar);
    li.appendChild(body);
    list.insertBefore(li, list.firstChild);
  }

  /* ------------------------------------------------------------------ small widgets */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  function initWidgets() {
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyText(btn.getAttribute('data-copy'))
          .then(function () { toast('Đã sao chép số tài khoản'); })
          .catch(function () { toast('Không sao chép được, vui lòng chép thủ công.'); });
      });
    });
    $$('[data-map-load]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wrap = btn.parentNode;
        var iframe = document.createElement('iframe');
        iframe.src = wrap.getAttribute('data-map-src');
        iframe.title = 'Bản đồ';
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer-when-downgrade';
        wrap.replaceChild(iframe, btn);
      });
    });
  }

  /* ------------------------------------------------------------------ preview bridge */
  function initPreviewBridge() {
    if (!isPreview || window.parent === window) return;
    var post = function (msg) { try { window.parent.postMessage(msg, '*'); } catch (e) { /* ignore */ } };
    window.addEventListener('scroll', throttle(function () { post({ type: 'wedding:scroll', y: window.scrollY }); }, 150), { passive: true });
    window.addEventListener('message', function (e) {
      if (e.source !== window.parent || !e.data || e.data.type !== 'wedding:scrollTo') return;
      var target = document.getElementById(e.data.section);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    post({ type: 'wedding:ready' });
  }

  /* ------------------------------------------------------------------ intro + boot */
  var INTRO_MS = { envelope: 1700, curtain: 1500, doors: 1600, card: 1700, scroll: 1100, circle: 1050, fade: 800 };

  function initIntro(onOpen, music) {
    var intro = $('[data-intro]');
    if (!intro) { onOpen(false); return; }
    html.classList.add('intro-lock');
    var opened = false;
    function open() {
      if (opened) return;
      opened = true;
      intro.classList.add('is-opening');
      music.play();
      setTimeout(function () {
        intro.classList.add('is-closed');
        html.classList.remove('intro-lock');
        window.scrollTo({ top: 0, behavior: 'instant' });
        onOpen(true);
        setTimeout(function () { if (intro.parentNode) intro.parentNode.removeChild(intro); }, 900);
      }, reducedMotion ? 0 : INTRO_MS[cfg.intro] || 900);
    }
    $$('[data-intro-open], .envelope, .intro__card, .doors, .gcard, .scrollpaper', intro).forEach(function (el) { el.addEventListener('click', open); });
    intro.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  }

  function boot() {
    var music = initMusic();
    var effects = initEffects();
    fxApi = effects;
    var restoring = isPreview && cfg.preview && cfg.preview.skipIntro;
    if (restoring && cfg.preview.scrollY) window.scrollTo({ top: cfg.preview.scrollY, behavior: 'instant' });
    var playNames = restoring ? function () {} : prepareNames(cfg.nameAnimation);
    if (restoring) { var names = $('[data-names]'); if (names) names.removeAttribute('data-reveal'); }
    initIntro(function (fromIntro) {
      initReveal(restoring);
      initScrollExtras(restoring);
      playNames();
      effects.start();
      if (!restoring) setTimeout(function () { effects.burst(cfg.burst); }, fromIntro ? 150 : 600);
      if (cfg.tap && cfg.tap !== 'none') {
        document.addEventListener('pointerdown', function (e) {
          if (e.target.closest('input, textarea, select, button, a, label, .lightbox')) return;
          effects.tap(e.clientX, e.clientY);
        }, { passive: true });
      }
    }, music);
    initCountdown();
    initLightbox();
    initForms();
    initWidgets();
    initPreviewBridge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
