import { z } from 'zod';
import { generateInvitation } from '../lib/content-generator.js';
import { isoDate, hhmm, parseInvitationData, publishProblems, TONES } from '../lib/schema.js';
import { hashToken, newEditToken, randomId } from '../lib/security.js';
import { cleanLine, isValidSlug, shortName, slugify } from '../lib/text.js';
import { buildViewModel } from '../templates/view-model.js';
import { demoInvitation, DEMO_WISHES } from '../templates/demo.js';

/** Quick-start form: the only thing a user must fill to get a complete invitation. */
export const quickStartSchema = z.object({
  templateId: z.string().max(60),
  groomName: z.string().transform(cleanLine).pipe(z.string().min(1, 'Vui lòng nhập tên chú rể').max(80)),
  brideName: z.string().transform(cleanLine).pipe(z.string().min(1, 'Vui lòng nhập tên cô dâu').max(80)),
  date: z.union([isoDate, z.literal('')]).default(''),
  time: z.union([hhmm, z.literal('')]).default(''),
  venue: z.string().max(120).transform(cleanLine).default(''),
  address: z.string().max(250).transform(cleanLine).default(''),
  tone: z.enum(TONES.map((t) => t.id)).optional(),
});

export function createInvitationService({ config, repo, registry, previews, brand }) {
  function uniqueSlug(base, invitationId = '') {
    let root = slugify(base) || 'thiep-cuoi';
    if (root.length < 3) root = `thiep-${root}`;
    root = root.slice(0, 48).replace(/-+$/, '');
    if (isValidSlug(root) && repo.isSlugAvailable(root, invitationId)) return root;
    for (let i = 0; i < 20; i++) {
      const candidate = `${root}-${randomId(4).toLowerCase()}`;
      if (isValidSlug(candidate) && repo.isSlugAvailable(candidate, invitationId)) return candidate;
    }
    return `thiep-${randomId(10).toLowerCase()}`;
  }

  function create(rawInput) {
    const input = quickStartSchema.parse(rawInput);
    const template = registry.get(input.templateId);
    if (!template) {
      const err = new Error('Mẫu thiệp không tồn tại.');
      err.statusCode = 400;
      err.expose = true;
      throw err;
    }
    const generated = generateInvitation({
      ...input,
      tone: input.tone || template.defaults.tone,
      seed: Math.floor(Math.random() * 1000),
    });
    const data = parseInvitationData(generated);
    const id = randomId(12);
    const token = newEditToken();
    const slug = uniqueSlug(`${shortName(input.groomName)}-${shortName(input.brideName)}`);
    const invitation = repo.createInvitation({ id, slug, templateId: template.id, data, editTokenHash: hashToken(token) });
    return { invitation, token };
  }

  async function renderInvitation(invitation, { mode = 'live', guestName = '', previewOptions = {}, wishes } = {}) {
    const template = registry.resolve(invitation.templateId);
    if (!template) throw new Error('Không có template nào khả dụng — kiểm tra thư mục templates.');
    const vm = await buildViewModel({
      invitation,
      template,
      registry,
      mode,
      guestName,
      baseUrl: config.baseUrl,
      tz: config.timezoneOffset,
      wishes: wishes ?? (invitation.id && mode === 'live' ? repo.listWishes(invitation.id, { limit: 50 }) : []),
      brand,
      previewOptions,
    });
    return registry.render(template, vm);
  }

  async function renderDemo(template, { guestName = '' } = {}) {
    const invitation = demoInvitation(template);
    const vm = await buildViewModel({
      invitation,
      template,
      registry,
      mode: 'demo',
      guestName,
      baseUrl: config.baseUrl,
      tz: config.timezoneOffset,
      wishes: DEMO_WISHES,
      brand,
    });
    vm.meta.noindex = false;
    vm.meta.title = `Mẫu thiệp "${template.name}" — ${brand.name || 'Thiệp cưới online'}`;
    if (template.previewUrl && !template.previewUrl.includes('.svg')) vm.meta.ogImage = `${config.baseUrl}${template.previewUrl}`;
    return registry.render(template, vm);
  }

  /** Render unsaved editor data into a short-lived preview URL. */
  async function createPreview(invitation, { data, templateId, scrollY = 0, skipIntro = false }) {
    const parsed = parseInvitationData(data);
    const draft = { ...invitation, data: parsed, templateId: registry.get(templateId) ? templateId : invitation.templateId };
    const html = await renderInvitation(draft, { mode: 'preview', previewOptions: { scrollY, skipIntro }, wishes: repo.listWishes(invitation.id, { limit: 20 }) });
    previews.pruneOwner(invitation.id);
    const key = previews.put(html, invitation.id);
    return `/preview/${key}`;
  }

  function toJson(invitation, { includeStats = false } = {}) {
    const { editTokenHash, ...rest } = invitation;
    const out = {
      ...rest,
      publicUrl: `${config.baseUrl}/w/${invitation.slug}`,
      problems: publishProblems(invitation.data),
      templateMissing: !registry.isUsable(invitation.templateId),
    };
    if (includeStats) out.rsvpStats = repo.rsvpStats(invitation.id);
    return out;
  }

  return { create, uniqueSlug, renderInvitation, renderDemo, createPreview, toJson };
}
