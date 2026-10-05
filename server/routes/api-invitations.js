import { z } from 'zod';
import { findBank, BANKS } from '../lib/banks.js';
import { GENERATABLE_FIELDS, generateField } from '../lib/content-generator.js';
import { HttpError } from '../lib/errors.js';
import { MediaError } from '../lib/media.js';
import {
  EFFECTS, EVENT_TYPES, FONTS, INTROS, SECTIONS, TONES, isoDate, parseInvitationData, publishProblems,
} from '../lib/schema.js';
import { isValidSlug } from '../lib/text.js';
import { removeInvitationFiles, storeUpload } from '../services/assets.js';

const updateSchema = z.object({
  data: z.record(z.string(), z.any()),
  templateId: z.string().max(60),
  version: z.number().int().positive(),
});

const previewSchema = z.object({
  data: z.record(z.string(), z.any()),
  templateId: z.string().max(60),
  scrollY: z.number().min(0).max(1_000_000).default(0),
  skipIntro: z.boolean().default(false),
});

const generateSchema = z.object({
  field: z.enum(GENERATABLE_FIELDS).optional(),
  groomName: z.string().max(80).default(''),
  brideName: z.string().max(80).default(''),
  groomShort: z.string().max(30).optional(),
  brideShort: z.string().max(30).optional(),
  date: z.union([isoDate, z.literal('')]).default(''),
  tone: z.enum(TONES.map((t) => t.id)).default('classic'),
  seed: z.number().int().min(0).max(1_000_000).default(0),
});

function csvCell(value) {
  const s = String(value ?? '');
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function registerInvitationApi(app) {
  const { repo, registry, invitations, config } = app;

  /* ---------------- catalogue for the studio UI ---------------- */
  app.get('/api/meta', async (request) => {
    const isAdmin = request.isAdmin();
    return {
      brand: app.brand,
      allowPublicCreate: config.allowPublicCreate,
      isAdmin,
      templates: registry.list({ includeHidden: isAdmin }).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        tags: t.tags,
        published: t.published,
        previewUrl: t.previewUrl,
        demoUrl: `/templates/${t.id}`,
        defaults: t.defaults,
        palettes: t.palettes,
      })),
      fonts: FONTS.map(({ family, category }) => ({ family, category })),
      effects: EFFECTS,
      intros: INTROS,
      tones: TONES,
      sections: SECTIONS,
      eventTypes: EVENT_TYPES,
      banks: BANKS,
      limits: { maxImageMb: Math.round(config.maxImageBytes / 1048576), maxAudioMb: Math.round(config.maxAudioBytes / 1048576), maxImages: config.maxImagesPerInvitation },
    };
  });

  /* ---------------- content suggestions ---------------- */
  app.post('/api/generate', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
    const input = generateSchema.parse(request.body || {});
    const fields = input.field ? [input.field] : GENERATABLE_FIELDS;
    const result = {};
    for (const f of fields) result[f] = generateField(f, input);
    return result;
  });

  /* ---------------- create ---------------- */
  app.post('/api/invitations', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request, reply) => {
    if (!config.allowPublicCreate && !request.isAdmin()) {
      throw new HttpError(403, 'Chỉ quản trị viên mới được tạo thiệp mới.');
    }
    const { invitation, token } = invitations.create(request.body || {});
    request.log.info({ invitation: invitation.id, template: invitation.templateId }, 'Invitation created');
    return reply.code(201).send({
      invitation: invitations.toJson(invitation),
      editToken: token,
      editUrl: `${config.baseUrl}/edit/${invitation.id}#token=${token}`,
    });
  });

  /* ---------------- read / update ---------------- */
  app.get('/api/invitations/:id', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    return { invitation: invitations.toJson(invitation, { includeStats: true }) };
  });

  app.put('/api/invitations/:id', async (request) => {
    const current = request.requireOwner(request.params.id);
    const body = updateSchema.parse(request.body || {});
    const data = parseInvitationData(body.data);
    const templateId = registry.get(body.templateId) ? body.templateId : current.templateId;
    const updated = repo.updateInvitation(current.id, { data, templateId, version: body.version });
    if (!updated) {
      throw new HttpError(409, 'Thiệp vừa được chỉnh sửa ở nơi khác (tab hoặc thiết bị khác). Hãy tải lại để xem bản mới nhất.');
    }
    return { version: updated.version, updatedAt: updated.updatedAt, problems: publishProblems(updated.data) };
  });

  app.post('/api/invitations/:id/preview', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (request) => {
    const invitation = request.requireOwner(request.params.id);
    const body = previewSchema.parse(request.body || {});
    return { url: await invitations.createPreview(invitation, body) };
  });

  /* ---------------- publishing ---------------- */
  app.post('/api/invitations/:id/publish', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    if (invitation.status === 'disabled' && !request.isAdmin()) throw new HttpError(403, 'Thiệp đã bị quản trị viên tạm khoá.');
    const problems = publishProblems(invitation.data);
    if (problems.length) throw new HttpError(422, 'Thiệp chưa đủ thông tin để công bố.', problems);
    const updated = repo.setStatus(invitation.id, 'published');
    return { invitation: invitations.toJson(updated) };
  });

  app.post('/api/invitations/:id/unpublish', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    if (invitation.status === 'disabled' && !request.isAdmin()) throw new HttpError(403, 'Thiệp đã bị quản trị viên tạm khoá.');
    const updated = repo.setStatus(invitation.id, 'draft');
    return { invitation: invitations.toJson(updated) };
  });

  app.get('/api/invitations/:id/slug-check', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    const slug = String(request.query.slug || '').toLowerCase();
    if (slug === invitation.slug) return { available: true, current: true };
    if (!isValidSlug(slug)) return { available: false, reason: 'Chỉ dùng chữ thường không dấu, số và dấu "-" (3–60 ký tự).' };
    const available = repo.isSlugAvailable(slug, invitation.id);
    return { available, reason: available ? '' : 'Đường dẫn này đã có người dùng.' };
  });

  app.put('/api/invitations/:id/slug', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    const slug = String(request.body?.slug || '').toLowerCase().trim();
    if (!isValidSlug(slug)) throw new HttpError(400, 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu "-" (3–60 ký tự).');
    if (slug !== invitation.slug) {
      if (!repo.isSlugAvailable(slug, invitation.id)) throw new HttpError(409, 'Đường dẫn này đã có người dùng.');
      repo.changeSlug(invitation.id, slug);
    }
    return { invitation: invitations.toJson(repo.getInvitation(invitation.id)) };
  });

  /* ---------------- uploads ---------------- */
  app.post('/api/invitations/:id/assets', { config: { rateLimit: { max: 120, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const invitation = request.requireOwner(request.params.id);
    if (!request.isMultipart()) throw new HttpError(415, 'Yêu cầu phải là multipart/form-data.');
    const file = await request.file();
    if (!file) throw new HttpError(400, 'Chưa chọn file.');
    const kind = file.fields?.kind?.value === 'audio' ? 'audio' : 'image';
    let buffer;
    try {
      buffer = await file.toBuffer();
    } catch (err) {
      if (err.code === 'FST_REQ_FILE_TOO_LARGE') throw new HttpError(413, 'File quá lớn.');
      throw err;
    }
    try {
      const asset = await storeUpload({ config, repo, invitationId: invitation.id, buffer, kind });
      return reply.code(201).send({ asset });
    } catch (err) {
      if (err instanceof MediaError) throw new HttpError(err.statusCode, err.message);
      throw err;
    }
  });

  /* ---------------- RSVPs ---------------- */
  app.get('/api/invitations/:id/rsvps', async (request, reply) => {
    const invitation = request.requireOwner(request.params.id);
    const rows = repo.listRsvps(invitation.id);
    if (request.query.format === 'csv') {
      const label = { yes: 'Tham dự', no: 'Không tham dự', maybe: 'Chưa chắc' };
      const side = { groom: 'Nhà trai', bride: 'Nhà gái', '': '' };
      const header = ['Tên', 'Liên hệ', 'Trạng thái', 'Số người', 'Khách của', 'Lời nhắn', 'Cập nhật'];
      const lines = rows.map((r) => [r.name, r.contact, label[r.attending], r.guests, side[r.side] ?? '', r.message, r.updated_at].map(csvCell).join(','));
      // BOM so Excel opens Vietnamese text as UTF-8.
      const csv = '﻿' + [header.join(','), ...lines].join('\r\n');
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="xac-nhan-${invitation.slug}.csv"`)
        .send(csv);
    }
    return { items: rows, stats: repo.rsvpStats(invitation.id) };
  });

  app.delete('/api/invitations/:id/rsvps/:rid', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    if (!repo.deleteRsvp(invitation.id, Number(request.params.rid))) throw new HttpError(404, 'Không tìm thấy phản hồi.');
    return { ok: true };
  });

  /* ---------------- wishes moderation ---------------- */
  app.get('/api/invitations/:id/wishes', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    return { items: repo.listWishes(invitation.id, { includeHidden: true, limit: 1000 }) };
  });

  app.patch('/api/invitations/:id/wishes/:wid', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    if (!repo.setWishHidden(invitation.id, Number(request.params.wid), Boolean(request.body?.hidden))) throw new HttpError(404, 'Không tìm thấy lời chúc.');
    return { ok: true };
  });

  app.delete('/api/invitations/:id/wishes/:wid', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    if (!repo.deleteWish(invitation.id, Number(request.params.wid))) throw new HttpError(404, 'Không tìm thấy lời chúc.');
    return { ok: true };
  });

  /* ---------------- delete ---------------- */
  app.delete('/api/invitations/:id', async (request) => {
    const invitation = request.requireOwner(request.params.id);
    repo.deleteInvitation(invitation.id);
    removeInvitationFiles(config, invitation.id);
    request.log.info({ invitation: invitation.id }, 'Invitation deleted');
    return { ok: true };
  });

  /* ---------------- bank helper ---------------- */
  app.get('/api/banks/:code', async (request) => {
    const bank = findBank({ code: request.params.code });
    if (!bank) throw new HttpError(404, 'Không tìm thấy ngân hàng.');
    return bank;
  });
}
