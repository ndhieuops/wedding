#!/usr/bin/env node
/**
 * Generates the illustrated demo pictures used by template demos
 * (templates/_shared/demo/*.webp). They are drawn procedurally, so there is
 * no copyright concern. Run once: `node scripts/generate-demo-assets.js`.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve(import.meta.dirname, '..', 'templates', '_shared', 'demo');
fs.mkdirSync(OUT, { recursive: true });

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bokeh(w, h, colors, seed, count = 26) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const c = colors[Math.floor(r() * colors.length)];
    out += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="${(20 + r() * 90).toFixed(0)}" fill="${c}" opacity="${(0.12 + r() * 0.3).toFixed(2)}"/>`;
  }
  return `<g filter="url(#blur)">${out}</g>`;
}

function frame(w, h, [c1, c2], body, seed, bokehColors = ['#ffffff', '#ffe9c7', '#ffd1dc']) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="2"/></filter>
    <radialGradient id="vignette" cx="50%" cy="45%" r="75%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${bokeh(w, h, bokehColors, seed)}
  ${body}
  <rect width="${w}" height="${h}" fill="url(#vignette)"/>
</svg>`;
}

const rose = (x, y, s, c) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <circle r="22" fill="${c}"/>
    <path d="M-14 -4c6-12 22-12 26 2M-10 8c10 6 20 2 22-8M-4 -12c8-2 14 4 12 12" stroke="#000" stroke-opacity=".18" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle r="6" fill="#000" opacity=".12"/>
  </g>`;
const leaf = (x, y, rot, c = '#6f8f63') => `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 0c14-18 40-18 52 0-14 16-38 16-52 0Z" fill="${c}"/>`;

const groomFigure = (x, y, s = 1, suit = '#2b2b33') => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="-150" r="34" fill="#3a2f2a"/>
    <path d="M-62 40c0-90 20-140 62-140s62 50 62 140Z" fill="${suit}"/>
    <path d="M-14 -100 0 -60 14 -100Z" fill="#f4f1ec"/>
    <path d="M-10 -96 0 -88 10 -96 0 -92Z" fill="#111"/>
    <rect x="-62" y="40" width="54" height="170" fill="${suit}"/><rect x="8" y="40" width="54" height="170" fill="${suit}"/>
  </g>`;
const brideFigure = (x, y, s = 1, dress = '#fbfaf7') => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-20 -170c-40 30-60 150-70 330h180c-10-180-30-300-70-330Z" fill="#ffffff" opacity=".45"/>
    <circle cx="0" cy="-150" r="31" fill="#3a2f2a"/>
    <path d="M-30 -96h60l10 70c50 60 80 150 90 236H-110c10-86 40-176 90-236Z" fill="${dress}"/>
    <path d="M-30 -96h60l10 70h-80Z" fill="#000" opacity=".05"/>
    <circle cx="-22" cy="-176" r="7" fill="#f2c4cf"/><circle cx="-10" cy="-182" r="6" fill="#fff"/>
  </g>`;

const scenes = {
  'couple-sunset': [900, 1200, ['#f6c7a8', '#c76d7e'], `
    <circle cx="450" cy="760" r="210" fill="#ffe2b8" opacity=".85"/>
    <path d="M0 900c180-60 320-40 450-10s300 40 450-20V1200H0Z" fill="#7d3b4b" opacity=".55"/>
    ${groomFigure(380, 900, 1.35, '#2a2430')}${brideFigure(530, 900, 1.35, '#fffaf5')}
    <path d="M0 1000c200-40 400-30 900 10V1200H0Z" fill="#5b2a37" opacity=".75"/>
    ${rose(120, 1080, 1.4, '#f3a6b8')}${rose(180, 1110, 1.1, '#fff')}${leaf(60, 1100, -30)}${rose(790, 1090, 1.5, '#f7c6d0')}${leaf(820, 1060, 200)}`, ['#fff3d6', '#ffd0d0', '#ffffff']],
  rings: [900, 900, ['#fbf3ea', '#e9d3c2'], `
    <g fill="none" stroke-width="22">
      <circle cx="390" cy="470" r="150" stroke="#d6ac5e"/><circle cx="390" cy="470" r="150" stroke="#fff" stroke-width="5" opacity=".6" transform="translate(-6 -6)"/>
      <circle cx="530" cy="430" r="140" stroke="#c9c9cf"/><circle cx="530" cy="430" r="140" stroke="#fff" stroke-width="5" opacity=".7" transform="translate(-5 -5)"/>
    </g>
    <path d="M530 270l18 -40 18 40-18 22Z" fill="#e8f4ff" stroke="#9fb7cf" stroke-width="3"/>
    <path d="M700 230l8 24 24 8-24 8-8 24-8-24-24-8 24-8Z" fill="#fff"/>`, ['#ffffff', '#f6dcc0', '#f1c4b4']],
  bouquet: [900, 1100, ['#f7ece6', '#e8c8c8'], `
    ${leaf(330, 520, -120)}${leaf(560, 520, -60)}${leaf(300, 620, -150)}${leaf(600, 640, -20)}${leaf(450, 440, -90)}
    ${rose(380, 560, 2.4, '#f2b6c2')}${rose(520, 560, 2.2, '#fff6f3')}${rose(450, 470, 2.3, '#e98fa5')}${rose(450, 640, 2.0, '#fbd9de')}${rose(340, 660, 1.6, '#fff')}${rose(570, 670, 1.7, '#f4a9bb')}
    <path d="M410 700 450 1000 490 700Z" fill="#7a9a6c"/>
    <path d="M400 760c40 30 60 30 100 0l-10 40c-30 20-50 20-80 0Z" fill="#fffaf5"/>`, ['#ffffff', '#ffe0e6', '#fff1d6']],
  toast: [900, 1100, ['#2e2638', '#6a4b5f'], `
    <g transform="translate(450 560) rotate(-14) translate(-110 0)">
      <path d="M-60 -220h120c0 120-20 170-60 180-40-10-60-60-60-180Z" fill="#f7e2a8" opacity=".9"/>
      <path d="M-60 -220h120" stroke="#fff" stroke-width="4"/><rect x="-4" y="-40" width="8" height="220" fill="#f3f0ea" opacity=".85"/><ellipse cx="0" cy="182" rx="56" ry="12" fill="#f3f0ea" opacity=".85"/>
    </g>
    <g transform="translate(450 560) rotate(14) translate(110 0)">
      <path d="M-60 -220h120c0 120-20 170-60 180-40-10-60-60-60-180Z" fill="#f7e2a8" opacity=".9"/>
      <path d="M-60 -220h120" stroke="#fff" stroke-width="4"/><rect x="-4" y="-40" width="8" height="220" fill="#f3f0ea" opacity=".85"/><ellipse cx="0" cy="182" rx="56" ry="12" fill="#f3f0ea" opacity=".85"/>
    </g>
    <g fill="#fff6d8"><circle cx="450" cy="300" r="6"/><circle cx="420" cy="260" r="4"/><circle cx="490" cy="250" r="5"/><circle cx="460" cy="210" r="3"/></g>`, ['#ffd27a', '#ff9fb2', '#ffffff']],
  cake: [900, 1100, ['#f5efe9', '#dccbbd'], `
    <ellipse cx="450" cy="900" rx="300" ry="34" fill="#c9b19b"/>
    <rect x="220" y="680" width="460" height="220" rx="14" fill="#fffdf9"/><rect x="290" y="500" width="320" height="180" rx="12" fill="#fffaf4"/><rect x="350" y="360" width="200" height="140" rx="10" fill="#fffdf9"/>
    <path d="M220 700c40 30 80 30 115 0s80-30 115 0 80 30 115 0 80-30 115 0" stroke="#e8c7cf" stroke-width="10" fill="none"/>
    <path d="M290 520c35 25 70 25 107 0s70-25 107 0 70 25 106 0" stroke="#e8c7cf" stroke-width="8" fill="none"/>
    ${rose(430, 350, 1.2, '#f2a7b8')}${rose(470, 345, 1.0, '#fff')}${leaf(500, 340, -20)}${rose(260, 690, 0.9, '#f2a7b8')}${rose(640, 690, 0.9, '#f2a7b8')}`, ['#ffffff', '#f3d5d9', '#efe0c8']],
  'couple-arch': [900, 1200, ['#e7efe6', '#b9cdb5'], `
    <path d="M190 1200V560a260 260 0 0 1 520 0v640" fill="none" stroke="#fffaf2" stroke-width="26"/>
    ${[...Array(9)].map((_, i) => { const a = Math.PI - (i * Math.PI) / 8; return rose(450 + Math.cos(a) * 260, 560 - Math.sin(a) * 260, 1.3, i % 2 ? '#fff' : '#f1b7c4'); }).join('')}
    ${groomFigure(390, 980, 1.25, '#3b4a3c')}${brideFigure(520, 980, 1.25, '#fffdf8')}
    <path d="M0 1120h900v80H0Z" fill="#8fae86"/>`, ['#ffffff', '#f5ffe8', '#ffe8ee']],
  groom: [800, 1000, ['#e9e4dd', '#b9a99a'], `${groomFigure(400, 770, 2.1, '#2d2a32')}`, ['#ffffff', '#f1e6d6']],
  bride: [800, 1000, ['#f6e7ea', '#d7b2ba'], `${brideFigure(400, 790, 2.0, '#fffdfa')}`, ['#ffffff', '#ffe5ea']],
};

for (const [name, [w, h, bg, body, bokehColors]] of Object.entries(scenes)) {
  const svg = frame(w, h, bg, body, name.length * 97, bokehColors);
  const file = path.join(OUT, `${name}.webp`);
  const thumb = path.join(OUT, `${name}-thumb.webp`);
  await sharp(Buffer.from(svg)).webp({ quality: 84 }).toFile(file);
  await sharp(Buffer.from(svg)).resize({ width: 600 }).webp({ quality: 76 }).toFile(thumb);
  const meta = await sharp(file).metadata();
  console.log(`✓ ${name}.webp ${meta.width}x${meta.height} ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
}
