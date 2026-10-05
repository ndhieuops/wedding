import { z } from 'zod';
import { HttpError } from '../lib/errors.js';
import { ADMIN_COOKIE, createSignedToken, hashToken, newEditToken, safeEqual } from '../lib/security.js';

const SESSION_HOURS = 12;

export function registerAdminApi(app) {
  const { config, repo, registry, invitations } = app;

  function requireAdmin(request) {
    if (!config.adminPassword) throw new HttpError(404, 'Trang quản trị chưa được bật (thiếu ADMIN_PASSWORD).');
    if (!request.isAdmin()) throw new HttpError(401, 'Vui lòng đăng nhập quản trị.');
  }

  app.get('/api/admin/session', async (request) => ({ enabled: Boolean(config.adminPassword), authenticated: request.isAdmin() }));

  app.post('/api/admin/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!config.adminPassword) throw new HttpError(404, 'Trang quản trị chưa được bật (thiếu ADMIN_PASSWORD).');
    const password = String(request.body?.password || '');
    if (!safeEqual(password, config.adminPassword)) {
      request.log.warn({ ip: request.ip }, 'Failed admin login');
      throw new HttpError(401, 'Mật khẩu không đúng.');
    }
    const token = createSignedToken({ role: 'admin' }, config.sessionSecret, SESSION_HOURS * 3600);
    reply.setCookie(ADMIN_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: config.baseUrl.startsWith('https://'),
      maxAge: SESSION_HOURS * 3600,
    });
    return { ok: true };
  });

  app.post('/api/admin/logout', async (request, reply) => {
    reply.clearCookie(ADMIN_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/admin/stats', async (request) => {
    requireAdmin(request);
    return { ...repo.stats(), previews: app.previews.size };
  });

  const listSchema = z.object({
    q: z.string().max(100).default(''),
    status: z.enum(['', 'draft', 'published', 'disabled']).default(''),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(20),
  });

  app.get('/api/admin/invitations', async (request) => {
    requireAdmin(request);
    const q = listSchema.parse(request.query || {});
    const { items, total } = repo.listInvitations({ q: q.q.trim(), status: q.status, limit: q.pageSize, offset: (q.page - 1) * q.pageSize });
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: items.map((inv) => ({
        id: inv.id,
        slug: inv.slug,
        status: inv.status,
        templateId: inv.templateId,
        groom: inv.data.groom?.fullName || '',
        bride: inv.data.bride?.fullName || '',
        weddingDate: inv.data.wedding?.date || '',
        views: inv.viewCount,
        rsvp: repo.rsvpStats(inv.id),
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        publicUrl: `${config.baseUrl}/w/${inv.slug}`,
      })),
    };
  });

  app.post('/api/admin/invitations/:id/status', async (request) => {
    requireAdmin(request);
    const status = z.enum(['draft', 'published', 'disabled']).parse(request.body?.status);
    const invitation = repo.getInvitation(request.params.id);
    if (!invitation) throw new HttpError(404, 'Không tìm thấy thiệp.');
    return { invitation: invitations.toJson(repo.setStatus(invitation.id, status)) };
  });

  /** Owner lost their edit link → issue a new one (the old link stops working). */
  app.post('/api/admin/invitations/:id/reset-token', async (request) => {
    requireAdmin(request);
    const invitation = repo.getInvitation(request.params.id);
    if (!invitation) throw new HttpError(404, 'Không tìm thấy thiệp.');
    const token = newEditToken();
    repo.setEditTokenHash(invitation.id, hashToken(token));
    request.log.info({ invitation: invitation.id }, 'Edit token reset by admin');
    return { editUrl: `${config.baseUrl}/edit/${invitation.id}#token=${token}` };
  });

  app.get('/api/admin/templates', async (request) => {
    requireAdmin(request);
    return {
      templates: registry.list({ includeHidden: true }).map((t) => ({ id: t.id, name: t.name, published: t.published, version: t.version, previewUrl: t.previewUrl })),
      errors: registry.errors,
    };
  });

  app.post('/api/admin/templates/reload', async (request) => {
    requireAdmin(request);
    const result = registry.reload();
    request.log.info(result, 'Templates reloaded');
    return result;
  });
}
