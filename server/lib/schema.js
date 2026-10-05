import { z } from 'zod';
import { cleanLine, cleanText } from './text.js';

/* ------------------------------------------------------------------ */
/* Catalogues shared by the server, the templates and the studio UI.  */
/* ------------------------------------------------------------------ */

/**
 * Google Fonts with a Vietnamese subset — each one was rendered with Vietnamese names and
 * checked by eye (fonts that mangle diacritics were left out). `axes` follows the css2 API
 * and only lists weights that exist, so the combined stylesheet URL never 400s.
 */
export const FONTS = [
  { family: 'Cormorant Garamond', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Cổ điển, thanh mảnh' },
  { family: 'Cormorant', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Cổ điển' },
  { family: 'Cormorant Infant', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Cổ điển, số dễ đọc' },
  { family: 'Cormorant SC', category: 'serif', axes: 'wght@400;500;600;700', note: 'Chữ hoa nhỏ sang trọng' },
  { family: 'Cormorant Upright', category: 'serif', axes: 'wght@400;500;600;700', note: 'Nghiêng thư pháp' },
  { family: 'Playfair Display', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Sang trọng, tương phản cao' },
  { family: 'Playfair Display SC', category: 'serif', axes: 'ital,wght@0,400;0,700;1,400', note: 'Chữ hoa nhỏ tạp chí' },
  { family: 'Libre Bodoni', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Bodoni kiểu tạp chí' },
  { family: 'Prata', category: 'serif', axes: '', note: 'Didone thanh lịch' },
  { family: 'Bona Nova', category: 'serif', axes: 'ital,wght@0,400;0,700;1,400', note: 'Cổ điển châu Âu' },
  { family: 'Bona Nova SC', category: 'serif', axes: 'ital,wght@0,400;0,700;1,400', note: 'Chữ hoa nhỏ cổ điển' },
  { family: 'Fraunces', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Mềm mại, ấm áp' },
  { family: 'Literata', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Dễ đọc, sách' },
  { family: 'Newsreader', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Báo chí tinh tế' },
  { family: 'Lora', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Ấm áp, dễ đọc' },
  { family: 'EB Garamond', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Garamond kinh điển' },
  { family: 'Spectral', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Thanh lịch hiện đại' },
  { family: 'Spectral SC', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Chữ hoa nhỏ thanh lịch' },
  { family: 'Crimson Pro', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Sách cổ điển' },
  { family: 'Old Standard TT', category: 'serif', axes: 'ital,wght@0,400;0,700;1,400', note: 'Cổ điển thế kỷ 19' },
  { family: 'Gideon Roman', category: 'serif', axes: '', note: 'La Mã thanh mảnh' },
  { family: 'Taviraj', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Đường nét mềm' },
  { family: 'Trirong', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Trang nhã' },
  { family: 'Petrona', category: 'serif', axes: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500', note: 'Hiện đại có chân' },
  { family: 'Be Vietnam Pro', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Thiết kế cho tiếng Việt' },
  { family: 'Montserrat', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Hình học hiện đại' },
  { family: 'Josefin Sans', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Hình học, cổ điển' },
  { family: 'Quicksand', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Bo tròn, nhẹ nhàng' },
  { family: 'Raleway', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Thanh lịch' },
  { family: 'Nunito', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Bo tròn, thân thiện' },
  { family: 'Lexend', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Rất dễ đọc' },
  { family: 'Inter', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Trung tính, hiện đại' },
  { family: 'Manrope', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Hiện đại tinh tế' },
  { family: 'Plus Jakarta Sans', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Trẻ trung' },
  { family: 'Mulish', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Tối giản' },
  { family: 'Work Sans', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Gọn gàng' },
  { family: 'Hanken Grotesk', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Grotesk tinh tế' },
  { family: 'Afacad', category: 'sans', axes: 'wght@400;500;600;700', note: 'Mềm mại hiện đại' },
  { family: 'Comfortaa', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Tròn, đáng yêu' },
  { family: 'Dosis', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Hẹp, bo tròn' },
  { family: 'Arima', category: 'sans', axes: 'wght@300;400;500;600;700', note: 'Mềm, nghệ thuật' },
  { family: 'Varela Round', category: 'sans', axes: '', note: 'Bo tròn' },
  { family: 'Great Vibes', category: 'script', axes: '', note: 'Thư pháp kinh điển' },
  { family: 'Pinyon Script', category: 'script', axes: '', note: 'Copperplate trang trọng' },
  { family: 'Alex Brush', category: 'script', axes: '', note: 'Nét cọ mềm' },
  { family: 'Allura', category: 'script', axes: '', note: 'Uyển chuyển' },
  { family: 'Ephesis', category: 'script', axes: '', note: 'Bay bổng' },
  { family: 'Send Flowers', category: 'script', axes: '', note: 'Lãng mạn, dễ đọc' },
  { family: 'Moon Dance', category: 'script', axes: '', note: 'Hiện đại, dễ đọc' },
  { family: 'Whisper', category: 'script', axes: '', note: 'Thanh thoát' },
  { family: 'Ms Madi', category: 'script', axes: '', note: 'Nhẹ nhàng bay bổng' },
  { family: 'Beau Rivage', category: 'script', axes: '', note: 'Sang trọng Pháp' },
  { family: 'Bonheur Royale', category: 'script', axes: '', note: 'Hoàng gia' },
  { family: 'MonteCarlo', category: 'script', axes: '', note: 'Xa hoa' },
  { family: 'Carattere', category: 'script', axes: '', note: 'Cổ điển Ý' },
  { family: 'Waterfall', category: 'script', axes: '', note: 'Mảnh mai' },
  { family: 'Hurricane', category: 'script', axes: '', note: 'Nét cọ mạnh' },
  { family: 'Corinthia', category: 'script', axes: 'wght@400;700', note: 'Thanh mảnh' },
  { family: 'Italianno', category: 'script', axes: '', note: 'Ý cổ điển' },
  { family: 'Imperial Script', category: 'script', axes: '', note: 'Đế vương' },
  { family: 'Dancing Script', category: 'script', axes: 'wght@400;500;600;700', note: 'Tươi vui' },
  { family: 'Charm', category: 'script', axes: 'wght@400;700', note: 'Thư pháp Á Đông' },
  { family: 'Charmonman', category: 'script', axes: 'wght@400;700', note: 'Thư pháp mềm' },
  { family: 'Bad Script', category: 'script', axes: '', note: 'Viết tay tự nhiên' },
  { family: 'Oooh Baby', category: 'script', axes: '', note: 'Viết tay nhẹ' },
  { family: 'Birthstone', category: 'script', axes: '', note: 'Gọn gàng' },
  { family: 'Vujahday Script', category: 'script', axes: '', note: 'Đậm, rõ nét' },
  { family: 'Mea Culpa', category: 'script', axes: '', note: 'Hoa mỹ' },
  { family: 'Smooch', category: 'script', axes: '', note: 'Cọ đậm vui' },
  { family: 'Pacifico', category: 'script', axes: '', note: 'Retro vui nhộn' },
];
const FONT_FAMILIES = FONTS.map((f) => f.family);

/** Fonts removed from the catalogue → closest replacement (keeps old invitations valid). */
export const LEGACY_FONTS = { 'Noto Serif Display': 'Playfair Display' };

/** Hand-picked heading / body / script combinations shown as one-click presets in the studio. */
export const FONT_PAIRS = [
  { id: 'classic', name: 'Cổ điển sang trọng', heading: 'Cormorant Garamond', body: 'Lora', script: 'Pinyon Script' },
  { id: 'romantic', name: 'Lãng mạn', heading: 'Playfair Display', body: 'Quicksand', script: 'Send Flowers' },
  { id: 'royal', name: 'Hoàng gia', heading: 'Playfair Display SC', body: 'EB Garamond', script: 'MonteCarlo' },
  { id: 'french', name: 'Thanh lịch kiểu Pháp', heading: 'Bona Nova', body: 'Manrope', script: 'Beau Rivage' },
  { id: 'editorial', name: 'Tạp chí', heading: 'Libre Bodoni', body: 'Inter', script: 'Whisper' },
  { id: 'minimal', name: 'Tối giản', heading: 'Josefin Sans', body: 'Manrope', script: 'Cormorant Garamond' },
  { id: 'soft', name: 'Mềm mại', heading: 'Fraunces', body: 'Nunito', script: 'Ms Madi' },
  { id: 'traditional', name: 'Truyền thống Việt', heading: 'Prata', body: 'EB Garamond', script: 'Charmonman' },
  { id: 'vintage', name: 'Hoài cổ', heading: 'Old Standard TT', body: 'Spectral', script: 'Carattere' },
  { id: 'young', name: 'Trẻ trung', heading: 'Lexend', body: 'Plus Jakarta Sans', script: 'Moon Dance' },
  { id: 'sweet', name: 'Ngọt ngào', heading: 'Arima', body: 'Quicksand', script: 'Dancing Script' },
  { id: 'calligraphy', name: 'Thư pháp', heading: 'Cormorant Upright', body: 'Literata', script: 'Imperial Script' },
];

/** Ambient particle effects (runtime.js → EFFECTS). Two can be layered (effect + effect2). */
export const EFFECTS = [
  { id: 'none', label: 'Không hiệu ứng', icon: '∅' },
  { id: 'petals', label: 'Cánh hoa hồng rơi', icon: '🌹' },
  { id: 'sakura', label: 'Hoa anh đào', icon: '🌸' },
  { id: 'plum', label: 'Hoa mai vàng', icon: '🌼' },
  { id: 'leaves', label: 'Lá xanh bay', icon: '🍃' },
  { id: 'hearts', label: 'Trái tim bay lên', icon: '💗' },
  { id: 'sparkles', label: 'Lấp lánh', icon: '✨' },
  { id: 'golddust', label: 'Bụi vàng', icon: '🌟' },
  { id: 'fireflies', label: 'Đom đóm', icon: '🪲' },
  { id: 'bokeh', label: 'Đốm sáng mờ', icon: '🔆' },
  { id: 'butterflies', label: 'Bướm bay', icon: '🦋' },
  { id: 'stars', label: 'Sao đêm & sao băng', icon: '🌠' },
  { id: 'lanterns', label: 'Đèn trời', icon: '🏮' },
  { id: 'bubbles', label: 'Bong bóng', icon: '🫧' },
  { id: 'balloons', label: 'Bóng bay', icon: '🎈' },
  { id: 'snow', label: 'Tuyết rơi', icon: '❄️' },
  { id: 'confetti', label: 'Pháo giấy', icon: '🎊' },
];

/** One-shot celebration played right after the guest opens the invitation. */
export const BURSTS = [
  { id: 'none', label: 'Không', icon: '∅' },
  { id: 'fireworks', label: 'Pháo hoa', icon: '🎆' },
  { id: 'confetti', label: 'Tung pháo giấy', icon: '🎉' },
  { id: 'hearts', label: 'Mưa tim', icon: '💕' },
  { id: 'petals', label: 'Mưa cánh hoa', icon: '🌸' },
];

/** Small effect where the guest taps/clicks. */
export const TAPS = [
  { id: 'none', label: 'Không', icon: '∅' },
  { id: 'hearts', label: 'Tim nhỏ', icon: '💗' },
  { id: 'sparkles', label: 'Lấp lánh', icon: '✨' },
  { id: 'ripple', label: 'Gợn sóng', icon: '◎' },
];

/** How the couple's names appear in the hero. */
export const NAME_ANIMATIONS = [
  { id: 'none', label: 'Đứng yên' },
  { id: 'fade', label: 'Hiện dần' },
  { id: 'handwrite', label: 'Viết tay' },
  { id: 'letters', label: 'Từng chữ cái' },
  { id: 'shimmer', label: 'Ánh kim lướt qua' },
  { id: 'glow', label: 'Toả sáng' },
  { id: 'float', label: 'Bồng bềnh' },
];

export const INTROS = [
  { id: 'envelope', label: 'Mở phong bì', icon: '💌' },
  { id: 'curtain', label: 'Kéo rèm', icon: '🎭' },
  { id: 'doors', label: 'Mở cổng', icon: '🚪' },
  { id: 'card', label: 'Mở thiệp gập', icon: '📖' },
  { id: 'scroll', label: 'Cuộn thư', icon: '📜' },
  { id: 'circle', label: 'Vòng tròn mở', icon: '⭕' },
  { id: 'fade', label: 'Hiện dần', icon: '🌫️' },
  { id: 'none', label: 'Không có', icon: '∅' },
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

const fontField = z.preprocess((v) => (typeof v === 'string' && LEGACY_FONTS[v]) || v, z.enum(FONT_FAMILIES)).optional();

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
        heading: fontField,
        body: fontField,
        script: fontField,
      })
      .prefault({}),
    effect: z.enum(EFFECTS.map((e) => e.id)).optional(),
    effect2: z.enum(EFFECTS.map((e) => e.id)).optional(),
    effectIntensity: z.enum(['low', 'medium', 'high']).optional(),
    burst: z.enum(BURSTS.map((e) => e.id)).optional(),
    tap: z.enum(TAPS.map((e) => e.id)).optional(),
    nameAnimation: z.enum(NAME_ANIMATIONS.map((e) => e.id)).optional(),
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
