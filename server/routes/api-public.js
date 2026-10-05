import { z } from 'zod';
import { HttpError } from '../lib/errors.js';
import { cleanLine, cleanText } from '../lib/text.js';
import { effectiveSections } from '../templates/view-model.js';

const rsvpSchema = z.object({
  name: z.string().transform(cleanLine).pipe(z.string().min(1, 'Vui lòng nhập tên của bạn').max(80, 'Tên tối đa 80 ký tự')),
  contact: z.string().max(40).transform(cleanLine).default(''),
  attending: z.enum(['yes', 'no', 'maybe'], { message: 'Vui lòng chọn bạn có tham dự hay không' }),
  guests: z.coerce.number().int().min(0).max(20).default(1),
  side: z.enum(['', 'groom', 'bride']).default(''),
  message: z.string().max(500, 'Lời nhắn tối đa 500 ký tự').transform(cleanText).default(''),
  website: z.string().max(200).default(''),
});

const wishSchema = z.object({
  name: z.string().transform(cleanLine).pipe(z.string().min(1, 'Vui lòng nhập tên của bạn').max(80, 'Tên tối đa 80 ký tự')),
  message: z.string().transform(cleanText).pipe(z.string().min(2, 'Lời chúc quá ngắn').max(500, 'Lời chúc tối đa 500 ký tự')),
  website: z.string().max(200).default(''),
});

/** Find a published invitation that accepts guest interactions for a given section. */
function interactiveInvitation(app, slug, section) {
  const { invitation } = app.repo.findBySlug(slug);
  if (!invitation || invitation.status !== 'published') throw new HttpError(404, 'Thiệp không tồn tại hoặc chưa được công bố.');
  const template = app.registry.resolve(invitation.templateId);
  const enabled = effectiveSections(invitation.data.sections, template?.defaults.sections || []).find((s) => s.key === section)?.enabled;
  if (!enabled) throw new HttpError(403, section === 'rsvp' ? 'Thiệp này không nhận xác nhận tham dự.' : 'Thiệp này đã tắt sổ lưu bút.');
  return invitation;
}

function parse(schema, body) {
  const result = schema.safeParse(body || {});
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message || 'Dữ liệu không hợp lệ.');
  return result.data;
}

export function registerPublicApi(app) {
  const guestLimit = { rateLimit: { max: 8, timeWindow: '1 minute' } };

  function submitRsvp(slug, body) {
    const invitation = interactiveInvitation(app, slug, 'rsvp');
    const rsvp = parse(rsvpSchema, body);
    if (rsvp.website) return invitation; // honeypot: pretend success for bots
    app.repo.saveRsvp(invitation.id, rsvp);
    return invitation;
  }

  function submitWish(slug, body) {
    const invitation = interactiveInvitation(app, slug, 'wishes');
    const wish = parse(wishSchema, body);
    if (wish.website) return { invitation, wish: { name: wish.name, message: wish.message } };
    return { invitation, wish: app.repo.addWish(invitation.id, wish) };
  }

  /* JSON endpoints used by runtime.js */
  app.post('/api/w/:slug/rsvp', { config: guestLimit }, async (request) => {
    submitRsvp(request.params.slug, request.body);
    return { ok: true };
  });

  app.post('/api/w/:slug/wishes', { config: guestLimit }, async (request) => {
    const { wish } = submitWish(request.params.slug, request.body);
    return { ok: true, wish: { name: wish.name, message: wish.message } };
  });

  /* Plain HTML form fallbacks (work without JavaScript) */
  app.post('/w/:slug/rsvp', { config: guestLimit }, async (request, reply) => {
    try {
      const inv = submitRsvp(request.params.slug, request.body);
      return reply.redirect(`/w/${inv.slug}?sent=rsvp#rsvp`, 303);
    } catch (err) {
      if (err.statusCode === 400) return reply.view('message.njk', { title: 'Chưa gửi được', message: err.message, back: `/w/${request.params.slug}#rsvp` }, 400);
      throw err;
    }
  });

  app.post('/w/:slug/wishes', { config: guestLimit }, async (request, reply) => {
    try {
      const { invitation } = submitWish(request.params.slug, request.body);
      return reply.redirect(`/w/${invitation.slug}?sent=wish#wishes`, 303);
    } catch (err) {
      if (err.statusCode === 400) return reply.view('message.njk', { title: 'Chưa gửi được', message: err.message, back: `/w/${request.params.slug}#wishes` }, 400);
      throw err;
    }
  });
}
