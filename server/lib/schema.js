import { z } from 'zod';
import { cleanLine, cleanText } from './text.js';

/* ------------------------------------------------------------------ */
/* Catalogues shared by the server, the templates and the studio UI.  */
/* ------------------------------------------------------------------ */

/** Google Fonts that ship a Vietnamese subset (verified). `axes` follows the css2 API syntax. */
export const FONTS = [
  { family: 'Playfair Display', category: 'serif', axes: 'ital,wght@0,400;0,600;0,700;1,400' },
  { family: 'Cormorant Garamond', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500' },
  { family: 'Lora', category: 'serif', axes: 'ital,wght@0,400;0,600;1,400' },
  { family: 'Prata', category: 'serif', axes: '' },
  { family: 'Noto Serif Display', category: 'serif', axes: 'ital,wght@0,400;0,600;1,400' },
  { family: 'EB Garamond', category: 'serif', axes: 'ital,wght@0,400;0,600;1,400' },
  { family: 'Cormorant Upright', category: 'serif', axes: 'wght@400;600' },
  { family: 'Be Vietnam Pro', category: 'sans', axes: 'wght@300;400;500;600' },
  { family: 'Montserrat', category: 'sans', axes: 'wght@300;400;500;600' },
  { family: 'Quicksand', category: 'sans', axes: 'wght@400;500;600' },
  { family: 'Josefin Sans', category: 'sans', axes: 'wght@300;400;600' },
  { family: 'Nunito', category: 'sans', axes: 'wght@400;600' },
  { family: 'Raleway', category: 'sans', axes: 'wght@300;400;600' },
  { family: 'Great Vibes', category: 'script', axes: '' },
  { family: 'Dancing Script', category: 'script', axes: 'wght@400;600' },
  { family: 'Allura', category: 'script', axes: '' },
  { family: 'Alex Brush', category: 'script', axes: '' },
  { family: 'Imperial Script', category: 'script', axes: '' },
  { family: 'Pinyon Script', category: 'script', axes: '' },
  { family: 'Corinthia', category: 'script', axes: '' },
  { family: 'Charm', category: 'script', axes: 'wght@400;700' },
  { family: 'Italianno', category: 'script', axes: '' },
  { family: 'Birthstone', category: 'script', axes: '' },
  { family: 'Mea Culpa', category: 'script', axes: '' },
  { family: 'Ephesis', category: 'script', axes: '' },
];
const FONT_FAMILIES = FONTS.map((f) => f.family);

export const EFFECTS = [
  { id: 'none', label: 'Không hiệu ứng' },
  { id: 'petals', label: 'Cánh hoa rơi' },
  { id: 'hearts', label: 'Trái tim bay' },
  { id: 'sparkles', label: 'Lấp lánh' },
  { id: 'snow', label: 'Tuyết rơi' },
  { id: 'confetti', label: 'Pháo giấy' },
];

export const INTROS = [
  { id: 'envelope', label: 'Mở phong bì' },
  { id: 'curtain', label: 'Kéo rèm' },
  { id: 'fade', label: 'Hiện dần' },
  { id: 'none', label: 'Không có' },
];

export const TONES = [
  { id: 'classic', label: 'Trang trọng' },
  { id: 'romantic', label: 'Lãng mạn' },
  { id: 'modern', label: 'Hiện đại, trẻ trung' },
  { id: 'traditional', label: 'Truyền thống' },
];

export const SECTIONS = [
  { key: 'hero', label: 'Ảnh bìa & tên', locked: true },
  { key: 'quote', label: 'Câu trích dẫn' },
  { key: 'invitation', label: 'Lời mời & gia đình' },
  { key: 'couple', label: 'Cô dâu & chú rể' },
  { key: 'calendar', label: 'Lịch tháng cưới' },
  { key: 'countdown', label: 'Đếm ngược' },
  { key: 'events', label: 'Sự kiện & bản đồ' },
  { key: 'story', label: 'Chuyện tình yêu' },
  { key: 'gallery', label: 'Album ảnh' },
  { key: 'rsvp', label: 'Xác nhận tham dự' },
  { key: 'wishes', label: 'Sổ lưu bút' },
  { key: 'gift', label: 'Hộp mừng cưới' },
  { key: 'thanks', label: 'Lời cảm ơn' },
];
export const SECTION_KEYS = SECTIONS.map((s) => s.key);

export const EVENT_TYPES = [
  { id: 'an-hoi', label: 'Lễ Ăn Hỏi' },
  { id: 'vu-quy', label: 'Lễ Vu Quy' },
  { id: 'thanh-hon', label: 'Lễ Thành Hôn' },
  { id: 'tiec-cuoi', label: 'Tiệc Cưới' },
  { id: 'khac', label: 'Sự kiện khác' },
];

/* ------------------------------------------------------------------ */
/* Primitive validators                                                */
/* ------------------------------------------------------------------ */

const line = (max) => z.string().max(max, `Tối đa ${max} ký tự`).transform(cleanLine);
const text = (max) => z.string().max(max, `Tối đa ${max} ký tự`).transform(cleanText);
const optLine = (max) => line(max).default('');
const optText = (max) => text(max).default('');
const id = () => z.string().regex(/^[A-Za-z0-9_-]{1,32}$/, 'ID không hợp lệ');

export const isoDate = z.string().refine((v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] && +m[1] >= 1900 && +m[1] <= 2199;
}, 'Ngày không hợp lệ (định dạng YYYY-MM-DD)');
const optDate = z.union([isoDate, z.literal('')]).default('');

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ không hợp lệ (HH:mm)');
const optTime = z.union([hhmm, z.literal('')]).default('');

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Màu phải ở dạng #RRGGBB').transform((c) => c.toLowerCase());

const httpUrl = z
  .string()
  .max(1000)
  .transform((v) => v.trim())
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'Đường dẫn phải bắt đầu bằng http:// hoặc https://')
  .default('');

/** Reference to a file uploaded through the asset API (never an arbitrary URL). */
const uploadUrl = z.string().regex(/^\/uploads\/[A-Za-z0-9_-]{1,32}\/[A-Za-z0-9_.-]{1,80}$/, 'Ảnh không hợp lệ');
export const assetRef = z
  .object({
    id: id(),
    url: uploadUrl,
    thumb: uploadUrl.optional(),
    w: z.number().int().positive().max(20000).optional(),
    h: z.number().int().positive().max(20000).optional(),
  })
  .nullable()
  .default(null);

/* ------------------------------------------------------------------ */
/* Invitation document                                                 */
/* ------------------------------------------------------------------ */

const person = z
  .object({
    fullName: optLine(80),
    shortName: optLine(30),
    bio: optText(600),
    photo: assetRef,
    father: optLine(80),
    mother: optLine(80),
    address: optLine(200),
  })
  .prefault({});

const event = z.object({
  id: id(),
  type: z.enum(EVENT_TYPES.map((t) => t.id)).default('khac'),
  title: optLine(80),
  date: optDate,
  time: optTime,
  endTime: optTime,
  venue: optLine(120),
  address: optLine(250),
  mapUrl: httpUrl,
  note: optText(300),
  showMap: z.boolean().default(true),
});

const storyItem = z.object({
  id: id(),
  title: optLine(80),
  date: optLine(40),
  text: optText(1500),
  image: assetRef,
});

const galleryItem = z.object({
  id: id(),
  image: assetRef.refine((v) => v !== null, 'Thiếu ảnh'),
  caption: optLine(120),
});

const bankAccount = z.object({
  id: id(),
  owner: z.enum(['groom', 'bride', 'other']).default('other'),
  label: optLine(60),
  bankCode: optLine(16),
  bankBin: z.union([z.string().regex(/^\d{6}$/, 'BIN gồm 6 chữ số'), z.literal('')]).default(''),
  bankName: optLine(60),
  accountNumber: z.union([z.string().regex(/^[0-9A-Za-z]{4,19}$/, 'Số tài khoản gồm 4–19 chữ số/chữ cái'), z.literal('')]).default(''),
  accountName: optLine(60),
  showQr: z.boolean().default(true),
});

const sectionEntry = z.object({ key: z.enum(SECTION_KEYS), enabled: z.boolean() });

export const themeSchema = z
  .object({
    colors: z
      .object({
        primary: color.optional(),
        secondary: color.optional(),
        background: color.optional(),
        surface: color.optional(),
        text: color.optional(),
        accent: color.optional(),
      })
      .prefault({}),
    fonts: z
      .object({
        heading: z.enum(FONT_FAMILIES).optional(),
        body: z.enum(FONT_FAMILIES).optional(),
        script: z.enum(FONT_FAMILIES).optional(),
      })
      .prefault({}),
    effect: z.enum(EFFECTS.map((e) => e.id)).optional(),
    effectIntensity: z.enum(['low', 'medium', 'high']).optional(),
    intro: z.enum(INTROS.map((i) => i.id)).optional(),
  })
  .prefault({});

export const invitationDataSchema = z.object({
  groom: person,
  bride: person,
  order: z.enum(['groom-first', 'bride-first']).default('groom-first'),
  hostSide: z.enum(['both', 'groom', 'bride']).default('both'),
  wedding: z.object({ date: optDate, time: optTime }).prefault({}),
  events: z.array(event).max(6, 'Tối đa 6 sự kiện').default([]),
  content: z
    .object({
      headline: optLine(80),
      invitation: optText(1200),
      quote: optText(400),
      quoteAuthor: optLine(80),
      coupleIntro: optText(600),
      thankYou: optText(800),
      rsvpNote: optText(300),
      giftNote: optText(400),
      hashtag: optLine(40),
    })
    .prefault({}),
  story: z.array(storyItem).max(12, 'Tối đa 12 cột mốc').default([]),
  cover: z.object({ image: assetRef, position: z.enum(['center', 'top', 'bottom']).default('center') }).prefault({}),
  gallery: z.array(galleryItem).max(60, 'Tối đa 60 ảnh').default([]),
  gift: z.object({ accounts: z.array(bankAccount).max(4, 'Tối đa 4 tài khoản').default([]) }).prefault({}),
  rsvp: z
    .object({
      deadline: optDate,
      askGuests: z.boolean().default(true),
      askSide: z.boolean().default(true),
    })
    .prefault({}),
  music: z
    .object({
      enabled: z.boolean().default(false),
      asset: assetRef,
      url: httpUrl,
      title: optLine(80),
    })
    .prefault({}),
  theme: themeSchema,
  sections: z.array(sectionEntry).max(SECTION_KEYS.length * 2).default([]),
  seo: z.object({ title: optLine(120), description: optText(300) }).prefault({}),
  tone: z.enum(TONES.map((t) => t.id)).default('classic'),
  seed: z.number().int().min(0).max(1_000_000).default(0),
});

/** Parse & normalise invitation data. Throws a ZodError with Vietnamese messages on invalid input. */
export function parseInvitationData(input) {
  const data = invitationDataSchema.parse(input ?? {});
  // De-duplicate section entries (keep first occurrence) and drop unknown ones.
  const seen = new Set();
  data.sections = data.sections.filter((s) => (seen.has(s.key) ? false : seen.add(s.key)));
  return data;
}

/** Flatten a ZodError into `[{ path: 'groom.fullName', message }]` for API responses. */
export function formatZodError(err) {
  return (err.issues || []).map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/** Fields required before an invitation can be published. Returns a list of human-readable problems. */
export function publishProblems(data) {
  const problems = [];
  if (!data.groom.fullName) problems.push('Chưa nhập tên chú rể');
  if (!data.bride.fullName) problems.push('Chưa nhập tên cô dâu');
  if (!data.wedding.date) problems.push('Chưa chọn ngày cưới');
  if (!data.events.length) problems.push('Cần ít nhất 1 sự kiện (lễ cưới hoặc tiệc cưới)');
  data.events.forEach((e, i) => {
    if (!e.date) problems.push(`Sự kiện #${i + 1} chưa có ngày`);
    if (!e.venue && !e.address) problems.push(`Sự kiện #${i + 1} chưa có địa điểm`);
  });
  data.gift.accounts.forEach((a, i) => {
    if (!a.accountNumber || !a.accountName) problems.push(`Tài khoản mừng cưới #${i + 1} thiếu số tài khoản hoặc tên chủ tài khoản`);
  });
  return problems;
}

/** Collect every uploaded asset id referenced by the document (used by the asset garbage collector). */
export function referencedAssetIds(data) {
  const ids = new Set();
  const add = (ref) => ref && ref.id && ids.add(ref.id);
  add(data.groom?.photo);
  add(data.bride?.photo);
  add(data.cover?.image);
  add(data.music?.asset);
  (data.story || []).forEach((s) => add(s.image));
  (data.gallery || []).forEach((g) => add(g.image));
  return ids;
}
