#!/usr/bin/env node
/**
 * End-to-end smoke test in a real browser (Chromium via playwright-core).
 *
 *   npm run build && npm run test:e2e
 *
 * Covers: every template demo opens without JS errors on mobile & desktop, the envelope
 * intro works, a guest submits RSVP + wish on a published invitation, and the studio
 * wizard → editor → autosave → publish flow works.
 * Set CHROMIUM_PATH if Chromium is not auto-detected.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../../server/app.js';
import { loadConfig } from '../../server/config.js';

const { chromium } = await import('playwright-core').catch(() => {
  console.error('Cần playwright-core: npm i -D playwright-core');
  process.exit(1);
});

function findChromium() {
  const list = [process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root && fs.existsSync(root)) for (const d of fs.readdirSync(root)) if (d.startsWith('chromium-')) list.push(path.join(root, d, 'chrome-linux', 'chrome'));
  return list.filter(Boolean).find((p) => fs.existsSync(p));
}

const ROOT = path.resolve(import.meta.dirname, '..', '..');
if (!fs.existsSync(path.join(ROOT, 'dist', 'studio', 'index.html'))) {
  console.error('Chưa build studio — chạy "npm run build" trước.');
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-e2e-'));
const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATA_DIR: tmp, ADMIN_PASSWORD: 'e2e-admin-password', SESSION_SECRET: 'e'.repeat(48), TEMPLATE_HOT_RELOAD: 'false' });
const app = await buildApp(config);
await app.listen({ host: '127.0.0.1', port: 0 });
const base = `http://127.0.0.1:${app.server.address().port}`;
config.baseUrl = base;

const browser = await chromium.launch(findChromium() ? { executablePath: findChromium() } : {});
let failures = 0;
const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push(`✓ ${name} (${Date.now() - started}ms)`);
  } catch (err) {
    failures++;
    results.push(`✗ ${name}\n    ${err.message.split('\n').slice(0, 4).join('\n    ')}`);
  }
}

async function newPage(viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  // Fonts are fetched through Node so the test also works behind HTTPS-intercepting proxies.
  await context.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    try {
      const res = await fetch(route.request().url(), { headers: { 'user-agent': route.request().headers()['user-agent'] } });
      const headers = Object.fromEntries(res.headers);
      delete headers['content-encoding'];
      delete headers['content-length'];
      headers['access-control-allow-origin'] = '*';
      await route.fulfill({ status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) });
    } catch {
      await route.fulfill({ status: 200, body: '' });
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  return { page, errors, context };
}

try {
  for (const t of app.registry.list()) {
    for (const [label, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1366, height: 860 }]]) {
      await check(`template ${t.id} (${label}) mở thiệp, hiệu ứng, không lỗi JS`, async () => {
        const { page, errors, context } = await newPage(viewport);
        await page.goto(`${base}/templates/${t.id}?to=Anh%20Tu%E1%BA%A5n`, { waitUntil: 'networkidle' });
        assert.ok(await page.isVisible('[data-intro-open]'), 'intro button visible');
        assert.match(await page.textContent('.intro__guest'), /Anh Tuấn/);
        await page.click('[data-intro-open]');
        await page.waitForSelector('[data-intro]', { state: 'detached', timeout: 5000 });
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('intro-lock')), false, 'scroll unlocked');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `horizontal overflow ${overflow}px`);
        await page.evaluate(() => document.getElementById('gallery').scrollIntoView());
        await page.click('[data-lightbox]');
        await page.waitForSelector('.lightbox.is-open');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Escape');
        await page.waitForSelector('.lightbox', { state: 'detached' });
        const countdown = await page.textContent('[data-unit="days"]');
        assert.ok(Number(countdown) > 0, `countdown running (${countdown})`);
        assert.deepEqual(errors, []);
        await context.close();
      });
    }
  }

  await check('khách gửi RSVP & lời chúc trên thiệp đã công bố', async () => {
    const { invitation, editToken } = (await app.inject({ method: 'POST', url: '/api/invitations', payload: { templateId: 'floral-blush', groomName: 'Minh', brideName: 'Hà', date: '2031-05-01', venue: 'Hoa Sen' } })).json();
    await app.inject({ method: 'POST', url: `/api/invitations/${invitation.id}/publish`, headers: { authorization: `Bearer ${editToken}` } });
    const { page, errors, context } = await newPage();
    await page.goto(`${base}/w/${invitation.slug}?to=Ch%E1%BB%8B%20Lan`, { waitUntil: 'networkidle' });
    await page.click('[data-intro-open]');
    await page.waitForSelector('[data-intro]', { state: 'detached' });
    assert.equal(await page.inputValue('#rsvp-name'), 'Chị Lan', 'guest name prefilled');
    await page.check('input[name="attending"][value="yes"]');
    await page.selectOption('#rsvp-guests', '3');
    await page.click('form[data-form="rsvp"] button[type="submit"]');
    await page.waitForSelector('form[data-form="rsvp"].is-done');
    await page.fill('#wish-message', 'Chúc hai bạn trăm năm hạnh phúc!');
    await page.click('form[data-form="wishes"] button[type="submit"]');
    await page.waitForSelector('.wish:has-text("trăm năm hạnh phúc")');
    const stats = app.repo.rsvpStats(invitation.id);
    assert.equal(stats.guestsYes, 3);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await check('studio: tạo thiệp → chỉnh sửa → tự lưu → công bố', async () => {
    const { page, errors, context } = await newPage({ width: 1366, height: 860 });
    await page.goto(`${base}/new?template=classic-gold`, { waitUntil: 'networkidle' });
    await page.fill('input[placeholder="Nguyễn Văn Minh"]', 'lê   hoàng long');
    await page.fill('input[placeholder="Trần Thị Thu Hà"]', 'Phạm Mai Anh');
    await page.fill('input[type="date"]', '2031-10-10');
    await page.fill('input[placeholder^="VD: Trung tâm"]', 'Riverside Palace');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Thiệp của bạn đã sẵn sàng');
    await page.click('text=Bắt đầu chỉnh sửa');
    await page.waitForSelector('.preview__frame.is-active[src*="/preview/"]', { timeout: 10000 });
    assert.ok(!page.url().includes('token='), 'secret token removed from the address bar');
    await page.fill('.editor__panel input >> nth=1', 'Long Bin');
    await page.waitForSelector('.save-state--saved', { timeout: 6000 });
    await page.waitForFunction(() => {
      const f = document.querySelector('.preview__frame.is-active');
      try {
        return f && f.contentDocument === null; // sandboxed (opaque origin) — just ensure it exists
      } catch {
        return true;
      }
    });
    await page.click('.editor__tab:has-text("Chia sẻ")');
    await page.click('text=Công bố thiệp');
    await page.waitForSelector('.badge--ok:has-text("Đã công bố")', { timeout: 6000 });
    const inv = app.repo.listInvitations({ q: 'Riverside' }).items[0];
    assert.equal(inv.status, 'published');
    assert.equal(inv.data.groom.shortName, 'Long Bin');
    assert.equal(inv.data.groom.fullName, 'Lê Hoàng Long');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await check('không JavaScript: thiệp vẫn đọc được đầy đủ', async () => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${base}/templates/minimal-modern`);
    assert.equal(await page.isVisible('[data-intro]'), false, 'intro hidden without JS');
    assert.ok(await page.isVisible('#events'));
    await context.close();
  });
} finally {
  await browser.close();
  await app.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} kiểm thử E2E thất bại.` : '\nTất cả kiểm thử E2E đều đạt.');
process.exit(failures ? 1 : 0);
