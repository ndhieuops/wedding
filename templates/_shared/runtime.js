/*!
 * Wedding invitation runtime — shared by every template.
 * Vanilla JS, no dependencies, progressive enhancement: the page is fully readable without it.
 *
 * Features: intro overlay, background music, particle effects (canvas), scroll reveal,
 * countdown, gallery lightbox, RSVP & wishes forms, copy-to-clipboard, lazy Google Map,
 * and a postMessage bridge used by the live preview in the editor.
 */
(function () {
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

  /* ------------------------------------------------------------------ utils */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

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

  /* ------------------------------------------------------------------ effects */
  function makeSprite(type, color) {
    var size = 64;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    if (type === 'petals') {
      var grad = g.createLinearGradient(-20, -20, 20, 20);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, color);
      grad.addColorStop(1, color);
      g.fillStyle = grad;
      g.globalAlpha = 0.9;
      g.beginPath();
      g.moveTo(0, -26);
      g.bezierCurveTo(22, -18, 18, 14, 0, 26);
      g.bezierCurveTo(-18, 14, -22, -18, 0, -26);
      g.fill();
    } else if (type === 'hearts') {
      g.fillStyle = color;
      g.globalAlpha = 0.85;
      g.beginPath();
      g.moveTo(0, 20);
      g.bezierCurveTo(-30, 0, -18, -26, 0, -10);
      g.bezierCurveTo(18, -26, 30, 0, 0, 20);
      g.fill();
    } else if (type === 'sparkles') {
      var glow = g.createRadialGradient(0, 0, 0, 0, 0, 28);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.25, color);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.moveTo(0, -30); g.quadraticCurveTo(3, -3, 30, 0); g.quadraticCurveTo(3, 3, 0, 30);
      g.quadraticCurveTo(-3, 3, -30, 0); g.quadraticCurveTo(-3, -3, 0, -30);
      g.fill();
    } else if (type === 'snow') {
      var flake = g.createRadialGradient(0, 0, 0, 0, 0, 24);
      flake.addColorStop(0, 'rgba(255,255,255,1)');
      flake.addColorStop(0.5, 'rgba(255,255,255,.8)');
      flake.addColorStop(1, 'rgba(255,255,255,0)');
      g.shadowColor = color;
      g.shadowBlur = 8;
      g.fillStyle = flake;
      g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
    } else if (type === 'confetti') {
      g.fillStyle = color;
      g.fillRect(-10, -18, 20, 36);
    }
    return c;
  }

  function initEffects() {
    var type = cfg.effect;
    var canvas = $('.fx-canvas');
    if (!canvas || !type || type === 'none' || reducedMotion || !canvas.getContext) return { start: function () {} };
    var ctx = canvas.getContext('2d');
    var colors = cfg.colors || {};
    var palette = [colors.primary, colors.secondary, colors.accent].filter(Boolean);
    if (!palette.length) palette = ['#e8a0b4'];
    var sprites = palette.map(function (c) { return makeSprite(type, c); });
    var base = { low: 12, medium: 22, high: 36 }[cfg.effectIntensity] || 22;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, particles = [], raf = 0, running = false, last = 0;

    function spawn(initial) {
      var p = {
        sprite: sprites[(Math.random() * sprites.length) | 0],
        x: rand(0, W),
        y: 0, size: 0, vx: rand(-0.3, 0.3), vy: 0,
        rot: rand(0, Math.PI * 2), vr: rand(-0.02, 0.02),
        phase: rand(0, Math.PI * 2), alpha: 1, life: 0, ttl: 0,
      };
      if (type === 'petals') { p.size = rand(12, 22); p.vy = rand(0.5, 1.2); p.y = initial ? rand(-H, H) : -30; }
      else if (type === 'hearts') { p.size = rand(10, 20); p.vy = -rand(0.35, 0.9); p.y = initial ? rand(0, H * 1.5) : H + 30; p.vr = 0; p.rot = rand(-0.3, 0.3); }
      else if (type === 'sparkles') { p.size = rand(8, 20); p.vy = rand(-0.12, 0.12); p.y = rand(0, H); p.ttl = rand(120, 280); p.life = initial ? rand(0, p.ttl) : 0; p.vr = 0.004; }
      else if (type === 'snow') { p.size = rand(5, 12); p.vy = rand(0.4, 1); p.y = initial ? rand(-H, H) : -20; p.vr = 0; }
      else if (type === 'confetti') { p.size = rand(6, 11); p.vy = rand(1, 2.1); p.y = initial ? rand(-H, H) : -20; p.vr = rand(-0.08, 0.08); }
      return p;
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var target = Math.round(base * clamp((W * H) / (390 * 844), 0.7, 1.8));
      while (particles.length < target) particles.push(spawn(true));
      if (particles.length > target) particles.length = target;
    }

    function frame(t) {
      if (!running) return;
      var dt = last ? Math.min(3, (t - last) / 16.67) : 1;
      last = t;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.phase += 0.02 * dt;
        p.x += (p.vx + Math.sin(p.phase) * (type === 'snow' ? 0.3 : 0.6)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        var alpha = 1, scaleY = 1;
        if (type === 'sparkles') {
          p.life += dt;
          alpha = Math.sin((p.life / p.ttl) * Math.PI);
          if (p.life >= p.ttl) { particles[i] = spawn(false); continue; }
        } else if (type === 'hearts') {
          alpha = clamp(p.y / (H * 0.5), 0, 1);
          if (p.y < -30) { particles[i] = spawn(false); continue; }
        } else {
          if (p.y > H + 30) { particles[i] = spawn(false); continue; }
          if (type === 'confetti' || type === 'petals') scaleY = Math.cos(p.phase * 1.5);
        }
        if (p.x < -40) p.x = W + 30; else if (p.x > W + 40) p.x = -30;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, scaleY || 0.05);
        ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    var resizeTimer;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });
    var started = false;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (started) start();
    });
    return { start: function () { started = true; start(); } };
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
  function initIntro(onOpen, music) {
    var intro = $('[data-intro]');
    if (!intro) { onOpen(); return; }
    html.classList.add('intro-lock');
    var opened = false;
    var durations = { envelope: 1700, curtain: 1500, fade: 800 };
    function open() {
      if (opened) return;
      opened = true;
      intro.classList.add('is-opening');
      music.play();
      setTimeout(function () {
        intro.classList.add('is-closed');
        html.classList.remove('intro-lock');
        window.scrollTo({ top: 0, behavior: 'instant' });
        onOpen();
        setTimeout(function () { if (intro.parentNode) intro.parentNode.removeChild(intro); }, 900);
      }, reducedMotion ? 0 : durations[cfg.intro] || 900);
    }
    $$('[data-intro-open], .envelope, .intro__card', intro).forEach(function (el) { el.addEventListener('click', open); });
    intro.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  }

  function boot() {
    var music = initMusic();
    var effects = initEffects();
    var restoring = isPreview && cfg.preview && cfg.preview.skipIntro;
    if (restoring && cfg.preview.scrollY) window.scrollTo({ top: cfg.preview.scrollY, behavior: 'instant' });
    initIntro(function () {
      initReveal(restoring);
      effects.start();
    }, music);
    initCountdown();
    initLightbox();
    initForms();
    initWidgets();
    initPreviewBridge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
