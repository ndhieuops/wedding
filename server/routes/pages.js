import fs from 'node:fs';
import path from 'node:path';
import { invitationCsp } from '../lib/csp.js';
import { HttpError } from '../lib/errors.js';
import { buildIcs } from '../lib/ics.js';
import { cleanLine } from '../lib/text.js';

function guestFromQuery(query) {
  const raw = typeof query?.to === 'string' ? query.to : '';
  return cleanLine(raw).slice(0, 60);
}

export function registerPageRoutes(app) {
  const { config, repo, registry, invitations } = app;

  /* ---------------- marketing pages ---------------- */
  const listTemplates = () =>
    registry.list().map((t) => ({ id: t.id, name: t.name, description: t.description, tags: t.tags, previewUrl: t.previewUrl, colors: t.defaults.theme.colors }));

  app.get('/', async (request, reply) => reply.view('landing.njk', { templates: listTemplates() }));
  app.get('/templates', async (request, reply) => reply.view('landing.njk', { templates: listTemplates(), focusTemplates: true }));

  app.get('/templates/:id', async (request, reply) => {
    const template = registry.get(request.params.id);
    if (!template || (!template.published && !request.isAdmin())) throw new HttpError(404, 'Mẫu thiệp không tồn tại.');
    const html = await invitations.renderDemo(template, { guestName: guestFromQuery(request.query), query: request.query || {} });
    return reply.header('content-security-policy', invitationCsp({ allowFraming: true })).type('text/html; charset=utf-8').send(html);
  });

  /* ---------------- public invitation ---------------- */
  app.get('/w/:slug', async (request, reply) => {
    const slug = String(request.params.slug).toLowerCase();
    const { invitation, redirected } = repo.findBySlug(slug);
    if (!invitation) throw new HttpError(404, 'Không tìm thấy thiệp cưới này. Có thể đường link đã bị thay đổi.');
    if (redirected) {
      const qs = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '';
      return reply.redirect(`/w/${invitation.slug}${qs}`, 301);
    }
    if (invitation.status !== 'published') {
      return reply.view('message.njk', {
        title: invitation.status === 'disabled' ? 'Thiệp đang tạm khoá' : 'Thiệp chưa được công bố',
        message: invitation.status === 'disabled' ? 'Thiệp này đang tạm thời không khả dụng.' : 'Cô dâu chú rể đang hoàn thiện thiệp, bạn quay lại sau nhé!',
        status: 404,
      }, 404);
    }
    if (request.method === 'GET') repo.bumpViews(invitation.id);
    const html = await invitations.renderInvitation(invitation, { guestName: guestFromQuery(request.query) });
    return reply
      .header('content-security-policy', invitationCsp())
      .header('cache-control', 'private, no-cache')
      .type('text/html; charset=utf-8')
      .send(html);
  });

  app.get('/w/:slug/calendar/:file', async (request, reply) => {
    const { invitation } = repo.findBySlug(String(request.params.slug).toLowerCase());
    const eventId = String(request.params.file).replace(/\.ics$/, '');
    const ev = invitation?.status === 'published' ? invitation.data.events.find((e) => e.id === eventId) : null;
    if (!ev || !ev.date) throw new HttpError(404, 'Không tìm thấy sự kiện.');
    const names = [invitation.data.groom.shortName || invitation.data.groom.fullName, invitation.data.bride.shortName || invitation.data.bride.fullName].filter(Boolean).join(' & ');
    const ics = buildIcs({
      uid: `${invitation.id}-${ev.id}@wedding-studio`,
      title: `${ev.title || 'Đám cưới'} — ${names}`,
      date: ev.date,
      time: ev.time,
      endTime: ev.endTime,
      tz: config.timezoneOffset,
      location: [ev.venue, ev.address].filter(Boolean).join(', '),
      description: `Thiệp mời: ${config.baseUrl}/w/${invitation.slug}`,
      url: `${config.baseUrl}/w/${invitation.slug}`,
    });
    if (!ics) throw new HttpError(404, 'Sự kiện chưa có ngày giờ hợp lệ.');
    return reply
      .header('content-type', 'text/calendar; charset=utf-8')
      .header('content-disposition', `attachment; filename="${invitation.slug}-${ev.id}.ics"`)
      .send(ics);
  });

  /* ---------------- live preview (editor iframe) ---------------- */
  app.get('/preview/:key', async (request, reply) => {
    const html = app.previews.get(request.params.key);
    if (!html) {
      return reply.view('message.njk', { title: 'Bản xem trước đã hết hạn', message: 'Hãy chỉnh sửa một chút để tạo lại bản xem trước.', status: 410 }, 410);
    }
    return reply
      .header('content-security-policy', invitationCsp({ allowFraming: true }))
      .header('cache-control', 'no-store')
      .header('x-robots-tag', 'noindex')
      .type('text/html; charset=utf-8')
      .send(html);
  });

  /* ---------------- studio SPA ---------------- */
  const studioIndex = path.join(config.studioDir, 'index.html');
  let cachedIndex = null;
  const sendStudio = async (request, reply) => {
    if (!cachedIndex || !config.isProd) {
      if (!fs.existsSync(studioIndex)) {
        return reply.view('message.njk', { title: 'Studio chưa được build', message: 'Hãy chạy "npm run build" (hoặc dùng Docker) để build giao diện chỉnh sửa.', status: 503 }, 503);
      }
      cachedIndex = fs.readFileSync(studioIndex, 'utf8');
    }
    return reply.header('cache-control', 'no-cache').header('x-robots-tag', 'noindex').type('text/html; charset=utf-8').send(cachedIndex);
  };
  app.get('/new', sendStudio);
  app.get('/my', sendStudio);
  app.get('/edit/:id', sendStudio);
  app.get('/admin', sendStudio);
  app.get('/admin/*', sendStudio);

  /* ---------------- infra ---------------- */
  app.get('/healthz', { logLevel: 'warn' }, async (request, reply) => {
    try {
      repo.db.prepare('SELECT 1').get();
      return { ok: true, templates: registry.list({ includeHidden: true }).length, uptime: Math.round(process.uptime()) };
    } catch (err) {
      return reply.code(503).send({ ok: false, error: err.message });
    }
  });

  app.get('/robots.txt', async (request, reply) =>
    reply.type('text/plain').send(['User-agent: *', 'Disallow: /w/', 'Disallow: /edit/', 'Disallow: /preview/', 'Disallow: /api/', 'Disallow: /admin', ''].join('\n')),
  );
}
