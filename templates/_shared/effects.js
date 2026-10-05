/*!
 * Wedding invitation effects engine — canvas particles, shared by every template.
 *
 *   var fx = WeddingFX.create(canvas, { colors: {...}, dark: false });
 *   fx.ambient('sakura', 'medium');      // continuous layer (can stack several)
 *   fx.burst('fireworks');               // one-shot celebration
 *   fx.tap('hearts', x, y);              // small effect at a point
 *
 * Performance: sprites are pre-rendered once per colour, devicePixelRatio is capped at 2,
 * particle counts scale with the screen size and everything pauses while the tab is hidden.
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* ------------------------------------------------------------------ colour helpers */
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return { r: 230, g: 160, b: 180 };
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }
  function mix(hexA, hexB, t) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    var r = Math.round(a.r + (b.r - a.r) * t), g = Math.round(a.g + (b.g - a.g) * t), bl = Math.round(a.b + (b.b - a.b) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  function luminance(hex) {
    var c = hexToRgb(hex);
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  }
  function saturation(hex) {
    var c = hexToRgb(hex);
    var max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
    return max ? (max - min) / max : 0;
  }

  /** Natural colours per effect, used when the theme colours would look muddy (near-black, grey, near-white). */
  var FALLBACK = {
    petals: ['#f4b6c2', '#f9d3da', '#eea3b5'],
    hearts: ['#e8798f', '#f4a7b9', '#ff9eb1'],
    sparkles: ['#f6d27a', '#ffffff', '#f4b6c2'],
    bokeh: ['#f6d6de', '#f3e3c4', '#dbe8d4'],
    butterflies: ['#9ad0f5', '#f7a6c1', '#ffd76a', '#b9a3e3'],
    bubbles: ['#9ad0f5', '#c7b8f0', '#f7c6d6'],
    balloons: ['#f7a6c1', '#9ad0f5', '#ffd76a', '#b9e3c6'],
    confetti: ['#f7a6c1', '#ffd76a', '#9ad0f5', '#b9e3c6', '#ffffff'],
    snow: ['#bcd6ee'],
  };

  /** Theme colours that read well as particles, topped up with the effect's natural colours. */
  function particleColors(palette, type) {
    var fallback = FALLBACK[type] || FALLBACK.petals;
    var good = palette.filter(function (c) { var l = luminance(c); return l > 0.28 && l < 0.94 && saturation(c) > 0.14; });
    return good.length >= 2 ? good : good.concat(fallback.slice(0, 3 - good.length));
  }

  /* ------------------------------------------------------------------ sprites */
  var cache = {};
  function sprite(key, size, draw) {
    if (cache[key]) return cache[key];
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    draw(g, size / 2);
    cache[key] = c;
    return c;
  }

  var DRAW = {
    petal: function (g, r, col) {
      var grad = g.createLinearGradient(-r, -r, r, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, col);
      grad.addColorStop(1, mix(col, '#000000', 0.12));
      g.fillStyle = grad;
      g.globalAlpha = 0.92;
      g.beginPath();
      g.moveTo(0, -r * 0.82);
      g.bezierCurveTo(r * 0.7, -r * 0.55, r * 0.55, r * 0.45, 0, r * 0.82);
      g.bezierCurveTo(-r * 0.55, r * 0.45, -r * 0.7, -r * 0.55, 0, -r * 0.82);
      g.fill();
    },
    sakuraPetal: function (g, r, col) {
      var grad = g.createLinearGradient(0, r, 0, -r);
      grad.addColorStop(0, mix(col, '#ffffff', 0.15));
      grad.addColorStop(1, mix(col, '#ffffff', 0.65));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, r * 0.88);
      g.bezierCurveTo(r * 0.9, r * 0.35, r * 0.78, -r * 0.78, r * 0.2, -r * 0.84);
      g.lineTo(0, -r * 0.52);
      g.lineTo(-r * 0.2, -r * 0.84);
      g.bezierCurveTo(-r * 0.78, -r * 0.78, -r * 0.9, r * 0.35, 0, r * 0.88);
      g.fill();
    },
    flower: function (g, r, col, center, notched) {
      for (var i = 0; i < 5; i++) {
        g.save();
        g.rotate((i * TAU) / 5);
        g.translate(0, -r * 0.42);
        g.scale(0.55, 0.55);
        if (notched) DRAW.sakuraPetal(g, r, col);
        else {
          var grad = g.createRadialGradient(0, r * 0.3, r * 0.1, 0, 0, r);
          grad.addColorStop(0, mix(col, '#ffffff', 0.45));
          grad.addColorStop(1, col);
          g.fillStyle = grad;
          g.beginPath();
          g.ellipse(0, 0, r * 0.72, r * 0.82, 0, 0, TAU);
          g.fill();
        }
        g.restore();
      }
      g.fillStyle = center;
      g.beginPath();
      g.arc(0, 0, r * 0.16, 0, TAU);
      g.fill();
      g.strokeStyle = center;
      g.lineWidth = r * 0.04;
      for (var j = 0; j < 8; j++) {
        var a = (j * TAU) / 8;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14);
        g.lineTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
        g.stroke();
        g.beginPath();
        g.arc(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34, r * 0.035, 0, TAU);
        g.fill();
      }
    },
    leaf: function (g, r, col) {
      var grad = g.createLinearGradient(-r * 0.5, -r, r * 0.5, r);
      grad.addColorStop(0, mix(col, '#ffffff', 0.25));
      grad.addColorStop(1, mix(col, '#000000', 0.15));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -r * 0.92);
      g.bezierCurveTo(r * 0.62, -r * 0.5, r * 0.55, r * 0.5, 0, r * 0.92);
      g.bezierCurveTo(-r * 0.55, r * 0.5, -r * 0.62, -r * 0.5, 0, -r * 0.92);
      g.fill();
      g.strokeStyle = mix(col, '#000000', 0.3);
      g.globalAlpha = 0.5;
      g.lineWidth = r * 0.05;
      g.beginPath();
      g.moveTo(0, -r * 0.8);
      g.lineTo(0, r * 0.95);
      for (var i = -2; i <= 2; i++) {
        g.moveTo(0, i * r * 0.28);
        g.lineTo(r * 0.32, i * r * 0.28 - r * 0.2);
        g.moveTo(0, i * r * 0.28);
        g.lineTo(-r * 0.32, i * r * 0.28 - r * 0.2);
      }
      g.stroke();
    },
    heart: function (g, r, col) {
      var grad = g.createLinearGradient(-r, -r, r, r);
      grad.addColorStop(0, mix(col, '#ffffff', 0.35));
      grad.addColorStop(1, col);
      g.fillStyle = grad;
      g.globalAlpha = 0.9;
      g.beginPath();
      g.moveTo(0, r * 0.62);
      g.bezierCurveTo(-r * 0.95, 0, -r * 0.55, -r * 0.82, 0, -r * 0.32);
      g.bezierCurveTo(r * 0.55, -r * 0.82, r * 0.95, 0, 0, r * 0.62);
      g.fill();
    },
    sparkle: function (g, r, col) {
      var glow = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.9);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.22, col);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.moveTo(0, -r); g.quadraticCurveTo(r * 0.1, -r * 0.1, r, 0); g.quadraticCurveTo(r * 0.1, r * 0.1, 0, r);
      g.quadraticCurveTo(-r * 0.1, r * 0.1, -r, 0); g.quadraticCurveTo(-r * 0.1, -r * 0.1, 0, -r);
      g.fill();
    },
    glow: function (g, r, col) {
      var grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.18, rgba(col, 1));
      grad.addColorStop(0.45, rgba(col, 0.35));
      grad.addColorStop(1, rgba(col, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
    },
    bokeh: function (g, r, col) {
      var grad = g.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.95);
      grad.addColorStop(0, rgba(col, 0.35));
      grad.addColorStop(0.75, rgba(col, 0.22));
      grad.addColorStop(0.9, rgba(mix(col, '#ffffff', 0.5), 0.35));
      grad.addColorStop(1, rgba(col, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r * 0.95, 0, TAU);
      g.fill();
    },
    butterfly: function (g, r, col) {
      var light = mix(col, '#ffffff', 0.45);
      function wing(sign) {
        var up = g.createLinearGradient(0, 0, sign * r, -r);
        up.addColorStop(0, col);
        up.addColorStop(1, light);
        g.fillStyle = up;
        g.beginPath();
        g.ellipse(sign * r * 0.42, -r * 0.24, r * 0.46, r * 0.34, sign * -0.55, 0, TAU);
        g.fill();
        g.beginPath();
        g.ellipse(sign * r * 0.3, r * 0.3, r * 0.28, r * 0.24, sign * 0.6, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.beginPath();
        g.arc(sign * r * 0.55, -r * 0.32, r * 0.08, 0, TAU);
        g.arc(sign * r * 0.32, r * 0.34, r * 0.05, 0, TAU);
        g.fill();
      }
      wing(1);
      wing(-1);
      g.fillStyle = mix(col, '#000000', 0.55);
      g.beginPath();
      g.ellipse(0, 0, r * 0.07, r * 0.42, 0, 0, TAU);
      g.fill();
      g.strokeStyle = g.fillStyle;
      g.lineWidth = r * 0.03;
      g.beginPath();
      g.moveTo(0, -r * 0.36); g.quadraticCurveTo(r * 0.12, -r * 0.62, r * 0.22, -r * 0.7);
      g.moveTo(0, -r * 0.36); g.quadraticCurveTo(-r * 0.12, -r * 0.62, -r * 0.22, -r * 0.7);
      g.stroke();
    },
    star: function (g, r, col) {
      var glow = g.createRadialGradient(0, 0, 0, 0, 0, r);
      glow.addColorStop(0, 'rgba(255,255,255,0.9)');
      glow.addColorStop(0.3, rgba(col, 0.5));
      glow.addColorStop(1, rgba(col, 0));
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      for (var i = 0; i < 10; i++) {
        var rad = i % 2 ? r * 0.16 : r * 0.42;
        var a = (i * Math.PI) / 5 - Math.PI / 2;
        g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      g.closePath();
      g.fill();
    },
    lantern: function (g, r) {
      var halo = g.createRadialGradient(0, 0, 0, 0, 0, r);
      halo.addColorStop(0, 'rgba(255,190,90,0.55)');
      halo.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = halo;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      var body = g.createLinearGradient(0, -r * 0.5, 0, r * 0.5);
      body.addColorStop(0, '#ffe7a3');
      body.addColorStop(0.55, '#ffb257');
      body.addColorStop(1, '#ef6a2c');
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(-r * 0.28, -r * 0.5);
      g.lineTo(r * 0.28, -r * 0.5);
      g.quadraticCurveTo(r * 0.42, 0, r * 0.32, r * 0.48);
      g.lineTo(-r * 0.32, r * 0.48);
      g.quadraticCurveTo(-r * 0.42, 0, -r * 0.28, -r * 0.5);
      g.fill();
      g.fillStyle = 'rgba(255,255,220,0.9)';
      g.beginPath();
      g.ellipse(0, r * 0.46, r * 0.22, r * 0.06, 0, 0, TAU);
      g.fill();
    },
    bubble: function (g, r, col) {
      var grad = g.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r * 0.9);
      grad.addColorStop(0, 'rgba(255,255,255,0.08)');
      grad.addColorStop(0.8, rgba(col, 0.12));
      grad.addColorStop(1, rgba(mix(col, '#ffffff', 0.3), 0.45));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r * 0.9, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(col, 0.55);
      g.lineWidth = r * 0.05;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.ellipse(-r * 0.35, -r * 0.38, r * 0.18, r * 0.09, -0.7, 0, TAU);
      g.fill();
    },
    balloon: function (g, r, col) {
      g.strokeStyle = 'rgba(120,120,120,0.6)';
      g.lineWidth = r * 0.03;
      g.beginPath();
      g.moveTo(0, r * 0.42);
      g.quadraticCurveTo(r * 0.12, r * 0.7, 0, r * 0.98);
      g.stroke();
      var grad = g.createRadialGradient(-r * 0.18, -r * 0.42, r * 0.05, 0, -r * 0.2, r * 0.62);
      grad.addColorStop(0, mix(col, '#ffffff', 0.6));
      grad.addColorStop(1, col);
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, -r * 0.2, r * 0.46, r * 0.58, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(-r * 0.06, r * 0.4); g.lineTo(r * 0.06, r * 0.4); g.lineTo(0, r * 0.33);
      g.fill();
    },
    snow: function (g, r, col) {
      var flake = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.75);
      flake.addColorStop(0, 'rgba(255,255,255,1)');
      flake.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      flake.addColorStop(1, 'rgba(255,255,255,0)');
      g.shadowColor = col;
      g.shadowBlur = r * 0.25;
      g.fillStyle = flake;
      g.beginPath();
      g.arc(0, 0, r * 0.7, 0, TAU);
      g.fill();
    },
    confetti: function (g, r, col, shape) {
      g.fillStyle = col;
      if (shape === 1) {
        g.beginPath();
        g.arc(0, 0, r * 0.4, 0, TAU);
        g.fill();
      } else if (shape === 2) {
        g.lineWidth = r * 0.18;
        g.strokeStyle = col;
        g.beginPath();
        g.moveTo(-r * 0.6, -r * 0.3); g.quadraticCurveTo(0, r * 0.4, r * 0.6, -r * 0.3);
        g.stroke();
      } else g.fillRect(-r * 0.3, -r * 0.6, r * 0.6, r * 1.2);
    },
  };

  /* ------------------------------------------------------------------ ambient effects */
  // kind: fall | rise | twinkle | wander. count = particles on a 390×844 phone at "medium".
  var AMBIENT = {
    petals: { kind: 'fall', count: 22, size: [13, 24], speed: [0.5, 1.2], sway: 0.6, spin: 0.02, flip: true,
      sprites: function (p) { return p.map(function (c) { return sprite('petal' + c, 64, function (g, r) { DRAW.petal(g, r, c); }); }); } },
    sakura: { kind: 'fall', count: 26, size: [10, 22], speed: [0.45, 1], sway: 0.85, spin: 0.03, flip: true,
      sprites: function () {
        var pinks = ['#f7b6c8', '#f9c9d6', '#f19cb7', '#fbd5e0'];
        var out = pinks.map(function (c) { return sprite('sakP' + c, 64, function (g, r) { DRAW.sakuraPetal(g, r, c); }); });
        out.push(sprite('sakF', 96, function (g, r) { DRAW.flower(g, r, '#f8bfd0', '#e2799a', true); }));
        return out;
      } },
    plum: { kind: 'fall', count: 18, size: [14, 26], speed: [0.5, 1.1], sway: 0.7, spin: 0.02,
      sprites: function () {
        return [
          sprite('plum1', 96, function (g, r) { DRAW.flower(g, r, '#ffd23f', '#e07a10'); }),
          sprite('plum2', 96, function (g, r) { DRAW.flower(g, r, '#ffc61a', '#d1600b'); }),
          sprite('plumP', 64, function (g, r) { DRAW.petal(g, r, '#ffcf33'); }),
        ];
      } },
    leaves: { kind: 'fall', count: 16, size: [16, 30], speed: [0.6, 1.3], sway: 1.1, spin: 0.03, flip: true,
      sprites: function (p, colors) {
        var greens = ['#7fa36b', '#9cbf7f', '#5f8a55', colors.accent || '#8fa77f'];
        return greens.map(function (c) { return sprite('leaf' + c, 64, function (g, r) { DRAW.leaf(g, r, c); }); });
      } },
    hearts: { kind: 'rise', count: 16, size: [10, 22], speed: [0.35, 0.9], sway: 0.6,
      sprites: function (p) { return p.map(function (c) { return sprite('heart' + c, 64, function (g, r) { DRAW.heart(g, r, c); }); }); } },
    sparkles: { kind: 'twinkle', count: 22, size: [8, 22], ttl: [120, 280],
      sprites: function (p) { return p.map(function (c) { return sprite('spark' + c, 64, function (g, r) { DRAW.sparkle(g, r, c); }); }); } },
    golddust: { kind: 'fall', count: 46, size: [4, 10], speed: [0.15, 0.45], sway: 0.35, pulse: true,
      sprites: function (p, colors) {
        return ['#f6d27a', '#e8b94a', colors.accent || '#d4a646'].map(function (c) { return sprite('gold' + c, 32, function (g, r) { DRAW.glow(g, r, c); }); });
      } },
    fireflies: { kind: 'wander', count: 18, size: [10, 20], speed: [0.25, 0.6], pulse: true,
      sprites: function () { return [sprite('ffly', 32, function (g, r) { DRAW.glow(g, r, '#e7ff8a'); }), sprite('ffly2', 32, function (g, r) { DRAW.glow(g, r, '#ffe58a'); })]; } },
    bokeh: { kind: 'wander', count: 10, size: [44, 120], speed: [0.06, 0.18], alpha: [0.35, 0.8],
      sprites: function (p) { return p.map(function (c) { return sprite('bokeh' + c, 128, function (g, r) { DRAW.bokeh(g, r, c); }); }); } },
    butterflies: { kind: 'wander', count: 7, size: [26, 42], speed: [0.6, 1.1], flap: true,
      sprites: function (p) { return p.map(function (c) { return sprite('bfly' + c, 96, function (g, r) { DRAW.butterfly(g, r, c); }); }); } },
    stars: { kind: 'twinkle', count: 40, size: [4, 11], ttl: [200, 420], shooting: true,
      sprites: function (p, colors) { return ['#ffffff', '#fff3c4', colors.accent || '#ffe08a'].map(function (c) { return sprite('star' + c, 48, function (g, r) { DRAW.star(g, r, c); }); }); } },
    lanterns: { kind: 'rise', count: 8, size: [30, 52], speed: [0.22, 0.5], sway: 0.35, flicker: true,
      sprites: function () { return [sprite('lantern', 96, function (g, r) { DRAW.lantern(g, r); })]; } },
    bubbles: { kind: 'rise', count: 14, size: [12, 36], speed: [0.3, 0.8], sway: 0.75,
      sprites: function (p) { return p.map(function (c) { return sprite('bub' + c, 64, function (g, r) { DRAW.bubble(g, r, c); }); }); } },
    balloons: { kind: 'rise', count: 8, size: [34, 52], speed: [0.4, 0.8], sway: 0.5, tilt: true,
      sprites: function (p) { return p.map(function (c) { return sprite('ball' + c, 96, function (g, r) { DRAW.balloon(g, r, c); }); }); } },
    snow: { kind: 'fall', count: 30, size: [6, 14], speed: [0.4, 1], sway: 0.3,
      sprites: function (p) { return [sprite('snow' + p[0], 48, function (g, r) { DRAW.snow(g, r, p[0]); })]; } },
    confetti: { kind: 'fall', count: 26, size: [7, 13], speed: [1, 2.1], sway: 0.6, spin: 0.08, flip: true,
      sprites: function (p) {
        var out = [];
        p.forEach(function (c, i) { out.push(sprite('conf' + c + (i % 3), 48, function (g, r) { DRAW.confetti(g, r, c, i % 3); })); });
        return out;
      } },
  };

  var INTENSITY = { low: 0.6, medium: 1, high: 1.6 };

  /* ------------------------------------------------------------------ engine */
  function create(canvas, opts) {
    opts = opts || {};
    var colors = opts.colors || {};
    var palette = [colors.primary, colors.secondary, colors.accent].filter(Boolean);
    if (!palette.length) palette = ['#e8a0b4', '#f6d6de', '#c9a36a'];
    var dark = luminance(colors.background || '#ffffff') < 0.35;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var W = 0, H = 0, raf = 0, running = false, last = 0;
    var layers = [];
    var transients = [];

    function areaFactor() { return clamp((W * H) / (390 * 844), 0.7, 1.8); }

    function spawn(layer, initial) {
      var d = layer.def;
      var p = {
        sprite: pick(layer.sprites),
        x: rand(0, W), y: 0, size: rand(d.size[0], d.size[1]),
        vx: rand(-0.3, 0.3), vy: rand(d.speed ? d.speed[0] : 0.5, d.speed ? d.speed[1] : 1),
        rot: rand(0, TAU), vr: d.spin ? rand(-d.spin, d.spin) : 0,
        phase: rand(0, TAU), life: 0, ttl: d.ttl ? rand(d.ttl[0], d.ttl[1]) : 0,
        heading: rand(0, TAU), alpha: d.alpha ? rand(d.alpha[0], d.alpha[1]) : 1,
      };
      if (d.kind === 'fall') p.y = initial ? rand(-H, H) : -p.size * 2;
      else if (d.kind === 'rise') { p.y = initial ? rand(0, H * 1.4) : H + p.size * 2; p.rot = 0; }
      else { p.y = rand(0, H); if (d.kind === 'twinkle') p.life = initial ? rand(0, p.ttl) : 0; p.rot = 0; }
      return p;
    }

    function fit(layer) {
      var target = Math.round(layer.def.count * (INTENSITY[layer.intensity] || 1) * areaFactor());
      while (layer.particles.length < target) layer.particles.push(spawn(layer, true));
      if (layer.particles.length > target) layer.particles.length = target;
    }

    function drawSprite(p, alpha, scaleX, scaleY, composite) {
      ctx.save();
      if (composite) ctx.globalCompositeOperation = composite;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.translate(p.x, p.y);
      if (p.rot) ctx.rotate(p.rot);
      if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY || 0.05);
      ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    function stepLayer(layer, dt, t) {
      var d = layer.def;
      for (var i = 0; i < layer.particles.length; i++) {
        var p = layer.particles[i];
        p.phase += 0.02 * dt;
        var alpha = p.alpha, sx = 1, sy = 1;
        if (d.kind === 'fall') {
          p.x += (p.vx + Math.sin(p.phase) * (d.sway || 0.5)) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (d.flip) sy = Math.cos(p.phase * 1.4);
          if (d.pulse) alpha = 0.45 + 0.55 * Math.abs(Math.sin(p.phase * 1.7));
          if (p.y > H + p.size * 2) { layer.particles[i] = spawn(layer, false); continue; }
        } else if (d.kind === 'rise') {
          p.x += (p.vx * 0.5 + Math.sin(p.phase) * (d.sway || 0.5)) * dt;
          p.y -= p.vy * dt;
          if (d.tilt) p.rot = Math.sin(p.phase * 0.8) * 0.12;
          alpha = clamp(p.y / (H * 0.45), 0, 1) * p.alpha;
          if (d.flicker) alpha *= 0.82 + 0.18 * Math.sin(t * 0.012 + p.phase * 9);
          if (p.y < -p.size * 2) { layer.particles[i] = spawn(layer, false); continue; }
        } else if (d.kind === 'twinkle') {
          p.life += dt;
          p.y += Math.sin(p.phase) * 0.05 * dt;
          alpha = Math.sin((p.life / p.ttl) * Math.PI);
          if (p.life >= p.ttl) { layer.particles[i] = spawn(layer, false); continue; }
        } else if (d.kind === 'wander') {
          p.heading += Math.sin(p.phase * 0.7 + i) * 0.03 * dt;
          var speed = p.vy;
          p.x += Math.cos(p.heading) * speed * dt;
          p.y += Math.sin(p.heading) * speed * dt;
          if (d.pulse) alpha = 0.25 + 0.75 * Math.abs(Math.sin(p.phase * 1.3));
          if (d.flap) { sx = 0.25 + 0.75 * Math.abs(Math.cos(p.phase * 7)); p.rot = p.heading + Math.PI / 2; }
          var m = p.size;
          if (p.x < -m) p.x = W + m; else if (p.x > W + m) p.x = -m;
          if (p.y < -m) p.y = H + m; else if (p.y > H + m) p.y = -m;
        }
        if (p.x < -60) p.x = W + 40; else if (p.x > W + 60) p.x = -40;
        drawSprite(p, alpha, sx, sy);
      }
      if (d.shooting) shootingStar(layer, dt);
    }

    function shootingStar(layer, dt) {
      layer.nextShot = (layer.nextShot == null ? rand(90, 240) : layer.nextShot) - dt;
      if (layer.nextShot <= 0 && !layer.shot) {
        layer.shot = { x: rand(W * 0.2, W), y: rand(0, H * 0.35), vx: -rand(7, 10), vy: rand(3, 5), life: 0 };
        layer.nextShot = rand(240, 480);
      }
      var s = layer.shot;
      if (!s) return;
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      var a = clamp(1 - s.life / 45, 0, 1);
      var grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
      grad.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9);
      ctx.stroke();
      if (a <= 0) layer.shot = null;
    }

    /* ---------- transient particles (bursts & taps) ---------- */
    function particle(o) {
      o.life = 0;
      o.rot = o.rot || 0;
      o.vr = o.vr || 0;
      o.drag = o.drag == null ? 0.985 : o.drag;
      o.gravity = o.gravity || 0;
      return o;
    }

    function stepTransients(dt) {
      for (var i = transients.length - 1; i >= 0; i--) {
        var p = transients[i];
        if (p.delay > 0) { p.delay -= dt; continue; }
        if (p.update) { if (!p.update(p, dt)) transients.splice(i, 1); continue; }
        p.life += dt;
        p.vx *= Math.pow(p.drag, dt);
        p.vy = p.vy * Math.pow(p.drag, dt) + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        var remain = 1 - p.life / p.ttl;
        if (remain <= 0 || p.y > H + 80) { transients.splice(i, 1); continue; }
        if (p.ring) {
          ctx.save();
          ctx.globalAlpha = remain * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2 * remain + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (1 - remain) * p.size, 0, TAU);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        var fade = p.fadeIn ? clamp(p.life / 8, 0, 1) : 1;
        drawSprite(p, Math.min(remain * 1.6, 1) * fade, 1, p.flutter ? Math.cos(p.life * 0.2 + p.phase) : 1, p.glow && dark ? 'lighter' : null);
      }
    }

    var glowSprites = function () {
      return particleColors(palette, 'sparkles').concat(['#ffffff', '#ffd76a']).map(function (c) { return sprite('glow' + c, 32, function (g, r) { DRAW.glow(g, r, c); }); });
    };

    var BURSTS = {
      fireworks: function () {
        var sprites = glowSprites();
        var rockets = Math.round(5 * clamp(W / 390, 1, 1.8));
        for (var r = 0; r < rockets; r++) {
          (function (delay) {
            var x = rand(W * 0.15, W * 0.85);
            var target = rand(H * 0.12, H * 0.42);
            var rocket = { delay: delay, x: x, y: H + 10, vy: -rand(9, 12) * (H / 844 + 0.4) / 1.4, update: function (p, dt) {
              p.y += p.vy * dt;
              p.vy *= Math.pow(0.985, dt);
              ctx.save();
              ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
              ctx.drawImage(sprites[sprites.length - 1], p.x - 5, p.y - 5, 10, 10);
              ctx.restore();
              if (p.y <= target || p.vy > -1) {
                var color = pick(sprites);
                var n = Math.round(rand(48, 70));
                for (var k = 0; k < n; k++) {
                  var a = (k / n) * TAU + rand(-0.05, 0.05);
                  var sp = rand(1.6, 4.4) * (W / 390 + 0.6) / 1.6;
                  transients.push(particle({ sprite: Math.random() < 0.8 ? color : pick(sprites), glow: true, x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gravity: 0.045, drag: 0.975, ttl: rand(60, 95), size: rand(6, 11), phase: 0 }));
                }
                return false;
              }
              return true;
            } };
            transients.push(rocket);
          })(r * rand(18, 32));
        }
      },
      confetti: function (small) {
        var colors = particleColors(palette, 'confetti').concat(['#ffd76a', '#ffffff', '#f7a6c1', '#9ad0f5']);
        var sprites = colors.map(function (c, i) { return sprite('conf' + c + (i % 3), 48, function (g, r) { DRAW.confetti(g, r, c, i % 3); }); });
        var per = small ? 26 : 70;
        [[0, -1.05], [W, -2.1]].forEach(function (cannon) {
          for (var k = 0; k < per; k++) {
            var a = cannon[1] + rand(-0.35, 0.35);
            var sp = rand(9, 16) * clamp(H / 844, 0.8, 1.3);
            transients.push(particle({ sprite: pick(sprites), x: cannon[0], y: H * 0.88, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gravity: 0.24, drag: 0.975, ttl: rand(170, 230), size: rand(9, 14), vr: rand(-0.2, 0.2), rot: rand(0, TAU), flutter: true, phase: rand(0, TAU), delay: rand(0, 12) }));
          }
        });
      },
      hearts: function () {
        var sprites = particleColors(palette, 'hearts').map(function (c) { return sprite('heart' + c, 64, function (g, r) { DRAW.heart(g, r, c); }); });
        for (var k = 0; k < 40; k++) {
          var a = rand(0, TAU), sp = rand(2.5, 7);
          transients.push(particle({ sprite: pick(sprites), x: W / 2, y: H * 0.45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, gravity: -0.03, drag: 0.95, ttl: rand(110, 160), size: rand(12, 28), phase: 0 }));
        }
      },
      petals: function () {
        var sprites = particleColors(palette, 'petals').map(function (c) { return sprite('petal' + c, 64, function (g, r) { DRAW.petal(g, r, c); }); });
        for (var k = 0; k < 70; k++) {
          transients.push(particle({ sprite: pick(sprites), x: rand(0, W), y: rand(-H * 0.4, -20), vx: rand(-0.8, 0.8), vy: rand(2.2, 4.2), gravity: 0.01, drag: 0.995, ttl: 360, size: rand(14, 26), vr: rand(-0.05, 0.05), rot: rand(0, TAU), flutter: true, phase: rand(0, TAU) }));
        }
      },
    };

    var TAPS = {
      hearts: function (x, y) {
        var sprites = particleColors(palette, 'hearts').map(function (c) { return sprite('heart' + c, 64, function (g, r) { DRAW.heart(g, r, c); }); });
        for (var k = 0; k < 6; k++) transients.push(particle({ sprite: pick(sprites), x: x, y: y, vx: rand(-1.2, 1.2), vy: rand(-2.8, -1.2), gravity: -0.02, drag: 0.97, ttl: rand(45, 65), size: rand(10, 18), phase: 0 }));
      },
      sparkles: function (x, y) {
        var sprites = particleColors(palette, 'sparkles').concat(['#ffffff']).map(function (c) { return sprite('spark' + c, 64, function (g, r) { DRAW.sparkle(g, r, c); }); });
        for (var k = 0; k < 9; k++) {
          var a = (k / 9) * TAU;
          transients.push(particle({ sprite: pick(sprites), x: x, y: y, vx: Math.cos(a) * rand(1.4, 3), vy: Math.sin(a) * rand(1.4, 3), drag: 0.92, ttl: rand(30, 45), size: rand(10, 18), phase: 0 }));
        }
      },
      ripple: function (x, y) {
        transients.push(particle({ ring: true, color: palette[0], x: x, y: y, vx: 0, vy: 0, drag: 1, ttl: 40, size: 56 }));
        transients.push(particle({ ring: true, color: palette[palette.length - 1], x: x, y: y, vx: 0, vy: 0, drag: 1, ttl: 40, size: 34, delay: 6 }));
      },
    };

    /* ---------- loop ---------- */
    function frame(t) {
      if (!running) return;
      var dt = last ? Math.min(3, (t - last) / 16.67) : 1;
      last = t;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < layers.length; i++) {
        ctx.globalCompositeOperation = layers[i].glow && dark ? 'lighter' : 'source-over';
        stepLayer(layers[i], dt, t);
      }
      ctx.globalCompositeOperation = 'source-over';
      stepTransients(dt);
      if (!layers.length && !transients.length) {
        running = false;
        ctx.clearRect(0, 0, W, H);
        return;
      }
      raf = global.requestAnimationFrame(frame);
    }

    function start() {
      if (running || document.hidden) return;
      running = true;
      last = 0;
      raf = global.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      global.cancelAnimationFrame(raf);
    }

    function resize() {
      W = global.innerWidth;
      H = global.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layers.forEach(fit);
    }

    resize();
    var resizeTimer;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (layers.length || transients.length) start();
    });

    return {
      ambient: function (type, intensity) {
        var def = AMBIENT[type];
        if (!def) return;
        var layer = { def: def, intensity: intensity || 'medium', particles: [], sprites: def.sprites(particleColors(palette, type), colors), glow: /golddust|fireflies|stars|lanterns|sparkles/.test(type) };
        layers.push(layer);
        fit(layer);
        start();
      },
      burst: function (type, small) {
        if (!BURSTS[type]) return;
        BURSTS[type](small);
        start();
      },
      tap: function (type, x, y) {
        if (!TAPS[type] || transients.length > 400) return;
        TAPS[type](x, y);
        start();
      },
      clear: function () {
        layers = [];
        transients = [];
      },
    };
  }

  global.WeddingFX = { create: create, AMBIENT: Object.keys(AMBIENT) };
})(window);
