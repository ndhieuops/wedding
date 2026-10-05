import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { parseInvitationData } from '../server/lib/schema.js';
import { createTemplateRegistry } from '../server/templates/registry.js';
import { demoInvitation, DEMO_WISHES } from '../server/templates/demo.js';
import { buildViewModel, effectiveSections, monthGrid } from '../server/templates/view-model.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const quiet = { warn() {}, info() {}, error() {} };
const registry = createTemplateRegistry({ templatesDir: path.join(ROOT, 'templates'), logger: quiet });

async function render(template, invitation, extra = {}) {
  const vm = await buildViewModel({ invitation, template, registry, mode: 'live', baseUrl: 'http://x', wishes: [], ...extra });
  return registry.render(template, vm);
}

describe('Template registry', () => {
  it('loads every bundled template without errors', () => {
    assert.deepEqual(registry.errors, []);
    const ids = registry.list({ includeHidden: true }).map((t) => t.id);
    for (const id of ['_starter', 'classic-gold', 'floral-blush', 'minimal-modern', 'traditional-red']) assert.ok(ids.includes(id), id);
  });

  it('hides unpublished and _private templates from the public list', () => {
    const publicIds = registry.list().map((t) => t.id);
    assert.ok(!publicIds.includes('_starter'));
    assert.ok(publicIds.length >= 4);
  });

  it('falls back to a public template when the folder disappears', () => {
    assert.equal(registry.get('deleted-template'), null);
    assert.ok(registry.resolve('deleted-template'));
  });
});

describe('Render mọi template', () => {
  for (const template of registry.list({ includeHidden: true })) {
    it(`${template.id}: full demo data`, async () => {
      const html = await render(template, { ...demoInvitation(template), slug: 'demo' }, { wishes: DEMO_WISHES, guestName: 'Anh Tuấn' });
      for (const id of ['hero', 'invitation', 'events', 'gallery', 'rsvp', 'gift', 'thanks']) assert.ok(html.includes(`id="${id}"`), `missing section ${id}`);
      assert.ok(html.includes('id="wedding-config"'));
      assert.ok(html.includes('Anh Tuấn'));
      assert.ok(html.includes('<svg'), 'VietQR svg');
      assert.ok(!html.includes('undefined'), 'leaked "undefined"');
      assert.ok(!html.includes('[object Object]'));
    });

    it(`${template.id}: nearly empty data still renders and hides empty sections`, async () => {
      const data = parseInvitationData({ groom: { fullName: 'A' }, bride: { fullName: 'B' } });
      const html = await render(template, { id: 'x', slug: 'x', templateId: template.id, data });
      assert.ok(html.includes('id="hero"'));
      for (const id of ['gallery', 'story', 'gift', 'events', 'countdown', 'calendar']) assert.ok(!html.includes(`id="${id}"`), `should hide ${id}`);
    });

    it(`${template.id}: escapes hostile input everywhere`, async () => {
      const evil = '<img src=x onerror=alert(1)>';
      const data = parseInvitationData({
        groom: { fullName: evil, bio: evil },
        bride: { fullName: '"><script>alert(2)</script>' },
        wedding: { date: '2030-01-01' },
        content: { invitation: evil, quote: '</script><script>alert(3)</script>', hashtag: evil },
        events: [{ id: 'e1', title: evil, date: '2030-01-01', venue: evil, address: evil, note: evil }],
        seo: { title: evil, description: evil },
      });
      const html = await render(template, { id: 'x', slug: 'x', templateId: template.id, data }, { guestName: evil, wishes: [{ id: 1, name: evil, message: evil }] });
      assert.ok(!html.includes('<img src=x'), 'raw <img> injected');
      assert.ok(!html.includes('<script>alert'), 'raw <script> injected');
      assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    });
  }
});

describe('View model helpers', () => {
  it('month grid starts on Monday', () => {
    const g = monthGrid('2026-12-20'); // 1/12/2026 is a Tuesday
    assert.deepEqual(g.weeks[0], [null, 1, 2, 3, 4, 5, 6]);
    assert.equal(g.highlight, 20);
  });
  it('effective sections keep user order, force hero on, append new keys', () => {
    const s = effectiveSections([{ key: 'gallery', enabled: true }, { key: 'hero', enabled: false }], ['hero', 'events']);
    assert.equal(s[0].key, 'gallery');
    assert.equal(s.find((x) => x.key === 'hero').enabled, true);
    assert.equal(s.find((x) => x.key === 'events').enabled, true);
    assert.equal(s.find((x) => x.key === 'story').enabled, false);
  });
});

describe('Template mới & ghi đè partial', () => {
  let dir;
  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-'));
    fs.cpSync(path.join(ROOT, 'templates', '_shared'), path.join(dir, '_shared'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'templates', '_starter'), path.join(dir, 'custom'), { recursive: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'custom', 'template.json'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'custom', 'template.json'), JSON.stringify({ ...manifest, published: true }));
    fs.mkdirSync(path.join(dir, 'custom', 'sections'));
    fs.writeFileSync(path.join(dir, 'custom', 'sections', 'thanks.njk'), '<section id="thanks">CUSTOM-THANKS {{ names }}</section>');
    fs.mkdirSync(path.join(dir, 'broken'));
    fs.writeFileSync(path.join(dir, 'broken', 'template.json'), '{ "name": "Broken", "defaults": { "theme": { "colors": {} } } }');
    fs.mkdirSync(path.join(dir, 'bad-json'));
    fs.writeFileSync(path.join(dir, 'bad-json', 'template.json'), '{ nope');
  });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('template folder overrides shared partials; invalid templates are skipped, not fatal', async () => {
    const reg = createTemplateRegistry({ templatesDir: dir, logger: quiet });
    assert.ok(reg.get('custom'));
    assert.deepEqual(reg.errors.map((e) => e.id).sort(), ['bad-json', 'broken']);
    const t = reg.get('custom');
    const data = parseInvitationData({ groom: { fullName: 'Minh' }, bride: { fullName: 'Hà' } });
    const vm = await buildViewModel({ invitation: { id: 'x', slug: 'x', data }, template: t, registry: reg });
    const html = await reg.render(t, vm);
    assert.ok(html.includes('CUSTOM-THANKS Minh &amp; Hà'));
  });
});
