#!/usr/bin/env node
/**
 * Visual QA for a template: screenshots + automatic checks, written to .shots/<id>/.
 *
 *   npm run template:shot -- classic-gold
 *   npm run template:shot -- classic-gold --query "effect=butterflies&intro=doors"
 *
 * Produces:
 *   intro.png          the opening overlay (mobile 390×844)
 *   opening.png        mid-animation while the invitation opens
 *   hero.png           first screen after opening, effects running
 *   desktop.png        first screen on a 1366×860 desktop
 *   sheet-N.png        the whole page (mobile, reduced motion) cut into side-by-side columns
 * and prints a JSON report: console errors, failed requests, horizontal overflow at 320/390px.
 * Requires Chromium (set CHROMIUM_PATH if it is not auto-detected).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { ADMIN_COOKIE, createSignedToken } from '../server/lib/security.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { query: { type: 'string', default: '' }, out: { type: 'string' } } });
const id = positionals[0];
if (!id) {
  console.error('Cách dùng: npm run template:shot -- <template-id> [--query "effect=...&intro=..."]');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('Cần cài playwright-core: npm i -D playwright-core');
  process.exit(1);
}

function findChromium() {
  const list = [process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root && fs.existsSync(root)) for (const d of fs.readdirSync(root)) if (d.startsWith('chromium-')) list.push(path.join(root, d, 'chrome-linux', 'chrome'));
  return list.filter(Boolean).find((p) => fs.existsSync(p));
}

const ROOT = path.resolve(import.meta.dirname, '..');
const outDir = path.resolve(values.out || path.join(ROOT, '.shots', id));
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-shot-'));
const config = loadConfig({ ...process.env, NODE_ENV: 'development', DATA_DIR: tmp, TEMPLATE_HOT_RELOAD: 'true', ADMIN_PASSWORD: 'shot-admin-password', SESSION_SECRET: 'x'.repeat(48) });
const app = await buildApp(config);
await app.listen({ host: '127.0.0.1', port: 0 });
const base = `http://127.0.0.1:${app.server.address().port}`;
const template = app.registry.get(id);
if (!template) {
  console.error(`Không tìm thấy template "${id}". Lỗi nạp template: ${JSON.stringify(app.registry.errors)}`);
  await app.close();
  process.exit(1);
}
const query = values.query ? `&${values.query.replace(/^[?&]/, '')}` : '';
const url = `${base}/templates/${id}?to=Anh%20Tu%E1%BA%A5n%20%26%20gia%20%C4%91%C3%ACnh${query}`;
const INTRO_MS = { envelope: 1700, curtain: 1500, doors: 1600, card: 1700, scroll: 1100, circle: 1050, fade: 800, none: 0 };

const exe = findChromium();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const report = { template: id, url: url.replace(base, ''), errors: [], failedRequests: [], overflow: {}, files: [] };

async function context(viewport, reducedMotion = 'no-preference') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width > 800 ? 1 : 2, reducedMotion });
  await ctx.addCookies([{ name: ADMIN_COOKIE, value: createSignedToken({ role: 'admin' }, config.sessionSecret, 900), url: base }]);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    try {
      const res = await fetch(route.request().url(), { headers: { 'user-agent': route.request().headers()['user-agent'] } });
      const headers = Object.fromEntries(res.headers);
      delete headers['content-encoding'];
      delete headers['content-length'];
      headers['access-control-allow-origin'] = '*';
      await route.fulfill({ status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) });
    } catch {
      await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && report.errors.push(`console: ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && report.failedRequests.push(`${r.status()} ${r.url().replace(base, '')}`));
  return { ctx, page };
}

async function shot(page, name, opts = {}) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, ...opts });
  report.files.push(path.relative(ROOT, file));
}

async function openIntro(page) {
  const btn = await page.$('[data-intro-open]');
  if (btn) await btn.click();
  return Boolean(btn);
}

try {
  const intro = template.defaults.theme.intro;
  const introMs = INTRO_MS[new URLSearchParams(values.query).get('intro') || intro] ?? 1200;

  // 1) intro, opening, hero (mobile, real motion)
  {
    const { ctx, page } = await context({ width: 390, height: 844 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1600);
    await shot(page, 'intro.png');
    if (await openIntro(page)) {
      await page.waitForTimeout(Math.max(250, introMs * 0.5));
      await shot(page, 'opening.png');
      await page.waitForTimeout(introMs * 0.5 + 1500);
    }
    await page.waitForTimeout(1000);
    await shot(page, 'hero.png');
    await ctx.close();
  }

  // 2) desktop first screen
  {
    const { ctx, page } = await context({ width: 1366, height: 860 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await openIntro(page);
    await page.waitForTimeout(introMs + 1800);
    await shot(page, 'desktop.png');
    await ctx.close();
  }

  // 3) full page (reduced motion so every section is visible) + overflow checks
  for (const width of [390, 320]) {
    const { ctx, page } = await context({ width, height: 800 }, 'reduce');
    await page.goto(url, { waitUntil: 'networkidle' });
    await openIntro(page);
    await page.waitForTimeout(400);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle');
    report.overflow[width] = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('.page *')) {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (r.width && r.right > W + 1 && style.position !== 'fixed') offenders.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
      }
      return { scrollOverflow: document.documentElement.scrollWidth - W, offenders: [...new Set(offenders)].slice(0, 10) };
    });
    if (width === 390) {
      const full = path.join(outDir, 'full.png');
      await page.screenshot({ path: full, fullPage: true });
      const meta = await sharp(full).metadata();
      const colW = Math.round(meta.width / 2);
      const scaled = await sharp(full).resize({ width: colW }).png().toBuffer();
      const H = Math.round(meta.height / 2);
      const sliceH = 1500;
      const slices = Math.ceil(H / sliceH);
      for (let start = 0, sheet = 0; start < slices; start += 4, sheet++) {
        const comps = [];
        for (let i = 0; i < 4 && start + i < slices; i++) {
          const top = (start + i) * sliceH;
          const input = await sharp(scaled).extract({ left: 0, top, width: colW, height: Math.min(sliceH, H - top) }).png().toBuffer();
          comps.push({ input, left: i * (colW + 10), top: 0 });
        }
        const file = path.join(outDir, `sheet-${sheet + 1}.png`);
        await sharp({ create: { width: 4 * (colW + 10), height: sliceH, channels: 3, background: '#777777' } }).composite(comps).png().toFile(file);
        report.files.push(path.relative(ROOT, file));
      }
      fs.rmSync(full);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await app.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

report.errors = [...new Set(report.errors)];
report.failedRequests = [...new Set(report.failedRequests)];
report.ok = !report.errors.length && !report.failedRequests.length && Object.values(report.overflow).every((o) => o.scrollOverflow <= 1);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);
