import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { collectGarbage } from '../server/services/assets.js';
import { adminCookie, createInvitation, createTestApp, multipart } from './helpers.js';

describe('API thiệp cưới', () => {
  let t;
  before(async () => {
    t = await createTestApp();
  });
  after(async () => t.close());

  it('health check & robots', async () => {
    const res = await t.app.inject('/healthz');
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
    assert.match((await t.app.inject('/robots.txt')).body, /Disallow: \/w\//);
  });

  it('landing & template demo pages render', async () => {
    const home = await t.app.inject('/');
    assert.equal(home.statusCode, 200);
    assert.match(home.body, /Hoàng Kim/);
    assert.ok(home.headers['content-security-policy']);
    const demo = await t.app.inject('/templates/classic-gold?to=Anh%20T%C3%BA');
    assert.equal(demo.statusCode, 200);
    assert.match(demo.body, /Anh Tú/);
    assert.match(demo.headers['content-security-policy'], /script-src 'self' 'sha256-/);
    assert.equal((await t.app.inject('/templates/_starter')).statusCode, 404, 'hidden template needs admin');
    assert.equal((await t.app.inject('/templates/nope')).statusCode, 404);
  });

  it('meta exposes catalogue for the studio', async () => {
    const meta = (await t.app.inject('/api/meta')).json();
    assert.ok(meta.templates.length >= 4);
    assert.ok(meta.fonts.some((f) => f.family === 'Great Vibes'));
    assert.ok(meta.banks.some((b) => b.bin === '970436'));
  });

  it('validates the quick-start form', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/api/invitations', payload: { templateId: 'classic-gold', groomName: '   ', brideName: 'B' } });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().message, /tên chú rể/);
    const bad = await t.app.inject({ method: 'POST', url: '/api/invitations', payload: { templateId: 'nope', groomName: 'A', brideName: 'B' } });
    assert.equal(bad.statusCode, 400);
  });

  describe('vòng đời một thiệp', () => {
    let inv;
    before(async () => {
      inv = await createInvitation(t.app);
    });

    it('creates a filled-in draft with a readable slug and secret edit link', () => {
      assert.equal(inv.slug, 'minh-ha');
      assert.equal(inv.invitation.status, 'draft');
      assert.match(inv.editUrl, /\/edit\/[A-Za-z0-9]+#token=/);
      assert.ok(inv.invitation.data.content.invitation.length > 40);
      assert.equal(inv.invitation.editTokenHash, undefined, 'never leak the token hash');
    });

    it('requires the edit token', async () => {
      assert.equal((await t.app.inject(`/api/invitations/${inv.id}`)).statusCode, 401);
      assert.equal((await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: { authorization: 'Bearer wrong' } })).statusCode, 403);
      assert.equal((await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: inv.auth })).statusCode, 200);
      assert.equal((await t.app.inject({ url: '/api/invitations/doesnotexist', headers: inv.auth })).statusCode, 404);
    });

    it('draft is not public', async () => {
      const res = await t.app.inject(`/w/${inv.slug}`);
      assert.equal(res.statusCode, 404);
      assert.match(res.body, /chưa được công bố/);
    });

    it('saves with optimistic concurrency (409 on stale version)', async () => {
      const current = (await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: inv.auth })).json().invitation;
      const data = { ...current.data, content: { ...current.data.content, headline: 'Save the Date' } };
      const ok = await t.app.inject({ method: 'PUT', url: `/api/invitations/${inv.id}`, headers: inv.auth, payload: { data, templateId: 'floral-blush', version: current.version } });
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.json().version, current.version + 1);
      const stale = await t.app.inject({ method: 'PUT', url: `/api/invitations/${inv.id}`, headers: inv.auth, payload: { data, templateId: 'floral-blush', version: current.version } });
      assert.equal(stale.statusCode, 409);
    });

    it('rejects invalid data with a precise message', async () => {
      const current = (await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: inv.auth })).json().invitation;
      const res = await t.app.inject({
        method: 'PUT',
        url: `/api/invitations/${inv.id}`,
        headers: inv.auth,
        payload: { data: { ...current.data, music: { url: 'javascript:alert(1)' } }, templateId: current.templateId, version: current.version },
      });
      assert.equal(res.statusCode, 400);
      assert.equal(res.json().details[0].path, 'music.url');
    });

    it('renders a live preview URL', async () => {
      const current = (await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: inv.auth })).json().invitation;
      const res = await t.app.inject({ method: 'POST', url: `/api/invitations/${inv.id}/preview`, headers: inv.auth, payload: { data: current.data, templateId: 'traditional-red', scrollY: 120, skipIntro: true } });
      assert.equal(res.statusCode, 200);
      const page = await t.app.inject(res.json().url);
      assert.equal(page.statusCode, 200);
      assert.match(page.body, /tpl--traditional-red/);
      assert.match(page.body, /"skipIntro":true/);
      assert.ok(!page.body.includes('data-intro>'), 'intro skipped in preview re-renders');
      assert.equal((await t.app.inject('/preview/unknownkey')).statusCode, 410);
    });

    it('publishes only when complete', async () => {
      const blank = await createInvitation(t.app, { groomName: 'X', brideName: 'Y', date: '' });
      const res = await t.app.inject({ method: 'POST', url: `/api/invitations/${blank.id}/publish`, headers: blank.auth });
      assert.equal(res.statusCode, 422);
      assert.ok(res.json().details.includes('Chưa chọn ngày cưới'));

      const ok = await t.app.inject({ method: 'POST', url: `/api/invitations/${inv.id}/publish`, headers: inv.auth });
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.json().invitation.status, 'published');
    });

    it('public page: personalised, escaped, counted, strict CSP', async () => {
      const res = await t.app.inject(`/w/${inv.slug}?to=${encodeURIComponent('<b>Anh Tuấn</b>')}`);
      assert.equal(res.statusCode, 200);
      assert.match(res.body, /&lt;b&gt;Anh Tuấn&lt;\/b&gt;/);
      assert.match(res.body, /og:title" content="Trân trọng kính mời/);
      assert.match(res.headers['content-security-policy'], /frame-ancestors 'none'/);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      const me = (await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: inv.auth })).json().invitation;
      assert.ok(me.viewCount >= 1);
    });

    it('calendar file for an event', async () => {
      const ev = inv.invitation.data.events[1];
      const res = await t.app.inject(`/w/${inv.slug}/calendar/${ev.id}.ics`);
      assert.equal(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/calendar/);
      assert.match(res.body, /BEGIN:VEVENT/);
      assert.equal((await t.app.inject(`/w/${inv.slug}/calendar/nope.ics`)).statusCode, 404);
    });

    it('RSVP: validates, upserts the same guest, honeypot, CSV export', async () => {
      const post = (payload) => t.app.inject({ method: 'POST', url: `/api/w/${inv.slug}/rsvp`, payload });
      assert.equal((await post({ name: '', attending: 'yes' })).statusCode, 400);
      assert.equal((await post({ name: 'A', attending: 'perhaps' })).statusCode, 400);
      assert.equal((await post({ name: 'Lê Văn An', attending: 'yes', guests: 3, side: 'groom' })).statusCode, 200);
      assert.equal((await post({ name: 'le van an', attending: 'no' })).statusCode, 200); // same guest → update
      assert.equal((await post({ name: 'Bot', attending: 'yes', website: 'spam.example' })).statusCode, 200); // honeypot: silently ignored
      assert.equal((await post({ name: '=HYPERLINK("http://evil")', attending: 'maybe', guests: 2 })).statusCode, 200);

      const list = (await t.app.inject({ url: `/api/invitations/${inv.id}/rsvps`, headers: inv.auth })).json();
      assert.equal(list.items.length, 2);
      assert.equal(list.stats.no, 1);
      assert.equal(list.stats.maybe, 1);

      const csv = await t.app.inject({ url: `/api/invitations/${inv.id}/rsvps?format=csv`, headers: inv.auth });
      assert.ok(csv.body.startsWith('﻿'), 'BOM for Excel');
      assert.match(csv.body, /'=HYPERLINK/, 'formula injection neutralised');
    });

    it('RSVP form fallback works without JavaScript', async () => {
      const res = await t.app.inject({ method: 'POST', url: `/w/${inv.slug}/rsvp`, payload: 'name=Kh%C3%A1ch&attending=yes&guests=2', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
      assert.equal(res.statusCode, 303);
      assert.match(res.headers.location, /sent=rsvp/);
    });

    it('wishes: stored, shown escaped, moderated', async () => {
      const res = await t.app.inject({ method: 'POST', url: `/api/w/${inv.slug}/wishes`, payload: { name: 'Bạn thân', message: '<script>alert(1)</script> Chúc mừng!' } });
      assert.equal(res.statusCode, 200);
      const page = await t.app.inject(`/w/${inv.slug}`);
      assert.match(page.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt; Chúc mừng!/);
      const wishes = (await t.app.inject({ url: `/api/invitations/${inv.id}/wishes`, headers: inv.auth })).json().items;
      const hide = await t.app.inject({ method: 'PATCH', url: `/api/invitations/${inv.id}/wishes/${wishes[0].id}`, headers: inv.auth, payload: { hidden: true } });
      assert.equal(hide.statusCode, 200);
      assert.ok(!(await t.app.inject(`/w/${inv.slug}`)).body.includes('Bạn thân'));
    });

    it('renaming the slug keeps old links working (301)', async () => {
      const taken = await createInvitation(t.app, { groomName: 'Taken', brideName: 'Slug' });
      const conflict = await t.app.inject({ method: 'PUT', url: `/api/invitations/${inv.id}/slug`, headers: inv.auth, payload: { slug: taken.slug } });
      assert.equal(conflict.statusCode, 409);
      assert.equal((await t.app.inject({ method: 'PUT', url: `/api/invitations/${inv.id}/slug`, headers: inv.auth, payload: { slug: 'Bad Slug!' } })).statusCode, 400);
      const ok = await t.app.inject({ method: 'PUT', url: `/api/invitations/${inv.id}/slug`, headers: inv.auth, payload: { slug: 'minh-ha-2030' } });
      assert.equal(ok.statusCode, 200);
      const old = await t.app.inject(`/w/minh-ha?to=Lan`);
      assert.equal(old.statusCode, 301);
      assert.equal(old.headers.location, '/w/minh-ha-2030?to=Lan');
      const check = (await t.app.inject({ url: `/api/invitations/${taken.id}/slug-check?slug=minh-ha`, headers: taken.auth })).json();
      assert.equal(check.available, false, 'old slug is reserved for redirects');
      inv.slug = 'minh-ha-2030';
    });

    it('uploads: images are re-encoded, fakes rejected, unused files garbage-collected', async () => {
      const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#e0a0b0' } }).png().toBuffer();
      const up = multipart({ kind: 'image' }, { name: 'photo.png', type: 'image/png', data: png });
      const res = await t.app.inject({ method: 'POST', url: `/api/invitations/${inv.id}/assets`, headers: { ...inv.auth, ...up.headers }, payload: up.payload });
      assert.equal(res.statusCode, 201, res.body);
      const { asset } = res.json();
      assert.match(asset.url, /\.webp$/);
      assert.equal(asset.w, 2000, 'resized to max 2000px');
      const file = await t.app.inject(asset.url);
      assert.equal(file.statusCode, 200);
      assert.match(file.headers['cache-control'], /immutable/);

      const fake = multipart({ kind: 'image' }, { name: 'evil.png', type: 'image/png', data: Buffer.from('<?php system($_GET["c"]); ?>'.padEnd(64, ' ')) });
      const rejected = await t.app.inject({ method: 'POST', url: `/api/invitations/${inv.id}/assets`, headers: { ...inv.auth, ...fake.headers }, payload: fake.payload });
      assert.equal(rejected.statusCode, 415);

      const noAuth = await t.app.inject({ method: 'POST', url: `/api/invitations/${inv.id}/assets`, headers: up.headers, payload: up.payload });
      assert.equal(noAuth.statusCode, 401);

      // The upload is not referenced by the invitation → removed once older than the grace period.
      const removed = collectGarbage({ config: { ...t.config, assetGcGraceHours: -1 }, repo: t.app.repo });
      assert.equal(removed, 1);
      assert.ok(!fs.existsSync(path.join(t.config.uploadsDir, inv.id, path.basename(asset.url))));
    });

    it('never exposes template sources', async () => {
      assert.equal((await t.app.inject('/t/classic-gold/index.njk')).statusCode, 404);
      assert.equal((await t.app.inject('/t/classic-gold/template.json')).statusCode, 404);
      assert.equal((await t.app.inject('/t/classic-gold/style.css')).statusCode, 200);
      assert.notEqual((await t.app.inject('/t/../server/config.js')).statusCode, 200);
      assert.notEqual((await t.app.inject('/uploads/../wedding.db')).statusCode, 200);
    });

    it('unpublish & delete (removes files too)', async () => {
      assert.equal((await t.app.inject({ method: 'POST', url: `/api/invitations/${inv.id}/unpublish`, headers: inv.auth })).statusCode, 200);
      assert.equal((await t.app.inject(`/w/${inv.slug}`)).statusCode, 404);
      assert.equal((await t.app.inject({ method: 'DELETE', url: `/api/invitations/${inv.id}`, headers: inv.auth })).statusCode, 200);
      assert.equal((await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: inv.auth })).statusCode, 404);
      assert.ok(!fs.existsSync(path.join(t.config.uploadsDir, inv.id)));
    });
  });

  describe('quản trị', () => {
    it('rejects wrong password and protects admin APIs', async () => {
      assert.equal((await t.app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'nope' } })).statusCode, 401);
      assert.equal((await t.app.inject('/api/admin/stats')).statusCode, 401);
      assert.equal((await t.app.inject({ url: '/api/admin/stats', headers: { cookie: 'ws_admin=forged.value' } })).statusCode, 401);
    });

    it('admin can list, lock, edit any invitation and reset edit links', async () => {
      const cookie = await adminCookie(t.app);
      const inv = await createInvitation(t.app, { groomName: 'Quản', brideName: 'Trị' });
      const stats = (await t.app.inject({ url: '/api/admin/stats', headers: { cookie } })).json();
      assert.ok(stats.total >= 1);
      const list = (await t.app.inject({ url: '/api/admin/invitations?q=Qu%E1%BA%A3n', headers: { cookie } })).json();
      assert.ok(list.items.some((x) => x.id === inv.id));
      assert.equal((await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: { cookie } })).statusCode, 200, 'admin edits without token');

      const locked = await t.app.inject({ method: 'POST', url: `/api/admin/invitations/${inv.id}/status`, headers: { cookie }, payload: { status: 'disabled' } });
      assert.equal(locked.json().invitation.status, 'disabled');
      assert.equal((await t.app.inject({ method: 'POST', url: `/api/invitations/${inv.id}/publish`, headers: inv.auth })).statusCode, 403, 'owner cannot bypass a lock');

      const reset = (await t.app.inject({ method: 'POST', url: `/api/admin/invitations/${inv.id}/reset-token`, headers: { cookie } })).json();
      const newToken = new URL(reset.editUrl).hash.split('token=')[1];
      assert.equal((await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: inv.auth })).statusCode, 403, 'old link revoked');
      assert.equal((await t.app.inject({ url: `/api/invitations/${inv.id}`, headers: { authorization: `Bearer ${newToken}` } })).statusCode, 200);

      assert.equal((await t.app.inject({ url: '/templates/_starter', headers: { cookie } })).statusCode, 200, 'admin previews hidden templates');
      const reload = (await t.app.inject({ method: 'POST', url: '/api/admin/templates/reload', headers: { cookie } })).json();
      assert.ok(reload.count >= 5);
    });
  });
});

describe('Cấu hình', () => {
  it('ALLOW_PUBLIC_CREATE=false restricts creation to admins', async () => {
    const t = await createTestApp({ ALLOW_PUBLIC_CREATE: 'false' });
    try {
      const res = await t.app.inject({ method: 'POST', url: '/api/invitations', payload: { templateId: 'classic-gold', groomName: 'A', brideName: 'B' } });
      assert.equal(res.statusCode, 403);
      const cookie = await adminCookie(t.app);
      const ok = await t.app.inject({ method: 'POST', url: '/api/invitations', headers: { cookie }, payload: { templateId: 'classic-gold', groomName: 'A', brideName: 'B' } });
      assert.equal(ok.statusCode, 201);
    } finally {
      await t.close();
    }
  });

  it('admin is disabled without ADMIN_PASSWORD', async () => {
    const t = await createTestApp({ ADMIN_PASSWORD: '' });
    try {
      assert.equal((await t.app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: '' } })).statusCode, 404);
      assert.equal((await t.app.inject('/api/admin/session')).json().enabled, false);
    } finally {
      await t.close();
    }
  });

  it('guest endpoints are rate limited', async () => {
    const t = await createTestApp();
    try {
      const inv = await createInvitation(t.app);
      await t.app.inject({ method: 'POST', url: `/api/invitations/${inv.id}/publish`, headers: inv.auth });
      const codes = [];
      for (let i = 0; i < 10; i++) {
        codes.push((await t.app.inject({ method: 'POST', url: `/api/w/${inv.slug}/wishes`, payload: { name: `Khách ${i}`, message: 'Chúc mừng!' } })).statusCode);
      }
      assert.ok(codes.includes(429), codes.join(','));
      const last = await t.app.inject({ method: 'POST', url: `/api/w/${inv.slug}/wishes`, payload: { name: 'x', message: 'yy' } });
      assert.match(last.json().message, /thử lại/);
    } finally {
      await t.close();
    }
  });
});

describe('Xem thử hiệu ứng qua URL', () => {
  it('demo pages accept safe theme overrides and ignore invalid ones', async () => {
    const t = await createTestApp();
    try {
      const ok = await t.app.inject('/templates/classic-gold?effect=butterflies&intro=doors&burst=fireworks&name=letters&script=Moon%20Dance');
      assert.equal(ok.statusCode, 200);
      assert.match(ok.body, /"effects":\[\{"type":"butterflies"/);
      assert.match(ok.body, /intro--doors/);
      assert.match(ok.body, /Moon\+Dance/);
      const bad = await t.app.inject('/templates/classic-gold?effect=%3Cscript%3E&intro=nope');
      assert.equal(bad.statusCode, 200);
      assert.ok(!bad.body.includes('<script>"'));
      assert.match(bad.body, /intro--envelope/, 'falls back to template defaults');
      const meta = (await t.app.inject('/api/meta')).json();
      assert.ok(meta.fontPairs.length >= 10 && meta.bursts.length && meta.taps.length && meta.nameAnimations.length);
    } finally {
      await t.close();
    }
  });
});
