#!/usr/bin/env node
/**
 * Capture `preview.webp` thumbnails for templates (used in the gallery and as
 * the social-share image of demos).
 *
 *   npm run template:preview              # every template
 *   npm run template:preview classic-gold # one template
 *
 * Requires a Chromium binary. Set CHROMIUM_PATH if it is not auto-detected.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { ADMIN_COOKIE, createSignedToken } from '../server/lib/security.js';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('Cần cài playwright-core: npm i -D playwright-core');
  process.exit(1);
}

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwRoot && fs.existsSync(pwRoot)) {
    for (const dir of fs.readdirSync(pwRoot).filter((d) => d.startsWith('chromium-'))) {
      candidates.push(path.join(pwRoot, dir, 'chrome-linux', 'chrome'));
    }
  }
  return candidates.find((p) => fs.existsSync(p));
}

const only = process.argv[2];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-preview-'));
const config = loadConfig({ ...process.env, DATA_DIR: tmp, TEMPLATE_HOT_RELOAD: 'true', ADMIN_PASSWORD: 'preview-only-password' });
const app = await buildApp(config);
await app.listen({ host: '127.0.0.1', port: 0 });
const base = `http://127.0.0.1:${app.server.address().port}`;

const executablePath = findChromium();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
await context.addCookies([{ name: ADMIN_COOKIE, value: createSignedToken({ role: 'admin' }, config.sessionSecret, 600), url: base }]);
// Fetch web fonts through Node (works behind corporate proxies that the browser does not trust).
await context.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
  try {
    const res = await fetch(route.request().url(), { headers: { 'user-agent': route.request().headers()['user-agent'] } });
    const headers = Object.fromEntries(res.headers);
    delete headers['content-encoding'];
    delete headers['content-length'];
    headers['access-control-allow-origin'] = '*';
    await route.fulfill({ status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) });
  } catch {
    await route.abort();
  }
});

let failures = 0;
try {
  const templates = app.registry.list({ includeHidden: true }).filter((t) => !only || t.id === only);
  if (!templates.length) throw new Error(only ? `Không tìm thấy template "${only}"` : 'Không có template nào');
  for (const t of templates) {
    const page = await context.newPage();
    try {
      await page.goto(`${base}/templates/${t.id}`, { waitUntil: 'networkidle' });
      const open = await page.$('[data-intro-open]');
      if (open) await open.click();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const png = await page.screenshot({ type: 'png' });
      const sharp = (await import('sharp')).default;
      const target = path.join(t.dir, t.preview.replace(/\.(svg|png|jpe?g)$/i, '.webp'));
      await sharp(png).resize({ width: 600 }).webp({ quality: 80 }).toFile(target);
      console.log(`✓ ${t.id} → ${path.relative(process.cwd(), target)}`);
      if (!t.preview.endsWith('.webp')) console.log(`  (nhớ đổi "preview" trong ${t.id}/template.json thành "${path.basename(target)}")`);
    } catch (err) {
      failures++;
      console.error(`✗ ${t.id}: ${err.message}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  await app.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(failures ? 1 : 0);
