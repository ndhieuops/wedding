import crypto from 'node:crypto';
import { shortName, stripDiacritics, titleCaseName } from './text.js';

/**
 * Rule-based Vietnamese copywriter for wedding invitations.
 * Given the couple's names (and optionally date/venue) it fills every text block so a
 * brand-new invitation already looks finished. Output is deterministic for a given seed,
 * and "Gợi ý khác" in the editor simply bumps the seed.
 */

const HEADLINES = {
  classic: ['Lễ Thành Hôn', 'Trân Trọng Báo Tin Vui', 'Thiệp Mời Cưới', 'Save the Date'],
  romantic: ['Chúng Mình Cưới!', 'Save the Date', 'Mãi Mãi Bên Nhau', 'Together Forever'],
  modern: ["We're Getting Married", 'Save the Date', 'Về Chung Một Nhà', 'Tụi Mình Cưới Nhé!'],
  traditional: ['Lễ Thành Hôn', 'Song Hỷ Lâm Môn', 'Thiệp Báo Hỷ', 'Lễ Tân Hôn'],
};

const INVITATIONS = {
  classic: [
    'Trân trọng kính mời Quý khách đến dự buổi tiệc chung vui cùng gia đình chúng tôi nhân ngày thành hôn của {G} và {B}. Sự hiện diện của Quý khách là niềm vinh hạnh cho gia đình chúng tôi.',
    'Gia đình chúng tôi trân trọng báo tin vui: hai con {GF} và {BF} sẽ chính thức nên duyên vợ chồng. Rất mong Quý khách dành chút thời gian đến chung vui và chúc phúc cho hai cháu.',
    'Hạnh phúc sẽ trọn vẹn hơn khi có sự chung vui của Quý vị. Trân trọng kính mời Quý vị tới dự lễ thành hôn của {G} & {B}{DATE_SUFFIX}.',
  ],
  romantic: [
    'Sau bao mùa yêu thương, {G} và {B} quyết định cùng nhau viết tiếp câu chuyện của mình. Chúng mình rất mong bạn sẽ có mặt trong ngày đặc biệt ấy để cùng chia sẻ niềm hạnh phúc này.',
    'Có những người bước vào đời ta và ở lại mãi mãi. Chúng mình đã tìm thấy nhau, và giờ đây muốn mời bạn đến chứng kiến khoảnh khắc chúng mình nói lời hẹn ước trọn đời.',
    'Tình yêu đã đưa hai trái tim về chung một nhịp đập. Thật hạnh phúc nếu ngày vui của {G} & {B} có thêm nụ cười và lời chúc phúc của bạn.',
  ],
  modern: [
    'Tin vui đây! {G} và {B} chính thức về chung một nhà. Ngày vui sẽ trọn vẹn hơn rất nhiều nếu có bạn ở đó — đến chung vui với tụi mình nhé!',
    'Sau một hành trình dài đầy kỷ niệm, tụi mình quyết định "nâng cấp" mối quan hệ lên vợ chồng. Hẹn gặp bạn trong bữa tiệc đánh dấu chương mới này!',
    'Một ngày thật đặc biệt đang đến gần và {G} & {B} muốn có bạn bên cạnh — để cùng ăn, cùng cười và cùng lưu giữ những khoảnh khắc đáng nhớ.',
  ],
  traditional: [
    'Trân trọng báo tin Lễ Thành Hôn của hai con chúng tôi: {GF} và {BF}. Kính mời Quý khách đến dự tiệc rượu chung vui cùng gia đình. Sự hiện diện của Quý khách là niềm vinh hạnh cho gia đình chúng tôi.',
    'Nhân dịp hai cháu {GF} và {BF} nên duyên giai ngẫu, gia đình chúng tôi trân trọng kính mời Quý khách tới dự bữa cơm thân mật chung vui cùng gia đình.',
    'Thuận theo lời ông bà, cha mẹ, hai con {G} và {B} xin được kết tóc se duyên. Gia đình kính mời Quý vị quang lâm chung vui và chúc phúc cho đôi trẻ.',
  ],
};

const QUOTES = {
  classic: [
    ['Hôn nhân không phải là đích đến của tình yêu, mà là nơi tình yêu bắt đầu một hành trình mới.', ''],
    ['Yêu không phải là nhìn nhau, mà là cùng nhau nhìn về một hướng.', 'Antoine de Saint-Exupéry'],
    ['Hạnh phúc là được nắm tay nhau đi qua từng mùa của cuộc đời.', ''],
  ],
  romantic: [
    ['Dù linh hồn ta được tạo nên từ điều gì, linh hồn anh và em cũng là một.', 'Emily Brontë'],
    ['Chỉ cần là em, mọi nơi đều là nhà.', ''],
    ['Cảm ơn vì đã đến, đã thương và đã chọn ở lại.', ''],
    ['I have found the one whom my soul loves.', 'Song of Solomon 3:4'],
  ],
  modern: [
    ['Một mình có thể đi nhanh, nhưng hai người mới đi được xa.', ''],
    ['Best friends → lovers → husband & wife.', ''],
    ['Hai người xa lạ trở thành một gia đình — đó là điều kỳ diệu nhất của tình yêu.', ''],
  ],
  traditional: [
    ['Trăm năm tình viên mãn — Bạc đầu nghĩa phu thê.', ''],
    ['Thuận vợ thuận chồng, tát biển Đông cũng cạn.', 'Ca dao Việt Nam'],
    ['Duyên do trời định, phận bởi ta xây.', ''],
  ],
};

const COUPLE_INTROS = [
  'Hai con người, một tình yêu, một lời hứa trọn đời.',
  'Chúng mình gặp nhau như một sự tình cờ, và chọn nhau là điều chắc chắn nhất.',
  'Từ hai thế giới riêng, giờ đây chúng mình cùng chung một hành trình.',
];

const GROOM_BIOS = [
  'Chàng trai điềm đạm, chu đáo — người luôn biết cách khiến những người xung quanh cảm thấy bình yên.',
  'Một người đàn ông ấm áp, chân thành và luôn nỗ lực vì gia đình nhỏ của mình.',
  'Thích cà phê sáng, những chuyến đi xa và đặc biệt thích nụ cười của {B}.',
];

const BRIDE_BIOS = [
  'Cô gái dịu dàng, tinh tế, mang đến niềm vui cho mọi người bằng nụ cười rạng rỡ.',
  'Một người con gái hiền hậu, yêu cái đẹp và luôn nhìn cuộc sống bằng ánh mắt tích cực.',
  'Mê đọc sách, thích nấu ăn và đã nói "Em đồng ý" với {G}.',
];

const STORY = [
  [
    'Lần đầu gặp gỡ',
    'Chúng mình gặp nhau vào một ngày rất bình thường, nhưng từ khoảnh khắc ấy mọi thứ bỗng trở nên khác biệt. Một ánh nhìn, một câu chào — và câu chuyện bắt đầu.',
  ],
  [
    'Hẹn hò',
    'Những buổi hẹn đầu tiên, những tin nhắn chúc ngủ ngon, những chuyến đi xa… từng chút một, chúng mình nhận ra người kia chính là mảnh ghép còn thiếu.',
  ],
  ['Lời cầu hôn', '{G} đã ngỏ lời với chiếc nhẫn trên tay, và {B} đã nói "Em đồng ý" trong niềm hạnh phúc vỡ oà.'],
  ['Về chung một nhà', 'Và giờ đây, chúng mình sẵn sàng bước sang một chương mới: cùng nhau xây dựng một mái ấm nhỏ ngập tràn yêu thương.'],
];

const THANK_YOUS = {
  classic: [
    'Cảm ơn Quý vị đã dành thời gian quý báu để chung vui cùng gia đình chúng tôi. Sự hiện diện của Quý vị là món quà ý nghĩa nhất!',
    'Gia đình chúng tôi xin chân thành cảm ơn và rất hân hạnh được đón tiếp Quý vị.',
  ],
  romantic: [
    'Cảm ơn bạn đã là một phần trong câu chuyện của chúng mình. Hẹn gặp bạn trong ngày vui nhé!',
    'Mỗi lời chúc của bạn là một món quà vô giá. Cảm ơn vì đã yêu thương và đồng hành cùng chúng mình.',
  ],
  modern: [
    'Cảm ơn bạn rất nhiều! Hẹn gặp nhau ở tiệc cưới — nhớ mang theo thật nhiều năng lượng nha!',
    'Thanks for being part of our story! Rất mong được gặp bạn trong ngày trọng đại của tụi mình.',
  ],
  traditional: [
    'Sự hiện diện của Quý khách là niềm vinh hạnh cho gia đình chúng tôi. Xin trân trọng cảm ơn!',
    'Gia đình hai họ xin chân thành cảm ơn Quý vị đã đến chung vui và chúc phúc cho hai cháu.',
  ],
};

const RSVP_NOTES = {
  formal: 'Để việc đón tiếp được chu đáo nhất, Quý khách vui lòng xác nhận tham dự{DEADLINE}.',
  casual: 'Báo cho tụi mình biết bạn có đến được không{DEADLINE} nhé!',
};

const GIFT_NOTES = [
  'Nếu không thể đến chung vui, bạn vẫn có thể gửi lời chúc và quà mừng cưới đến cô dâu chú rể qua thông tin dưới đây. Xin chân thành cảm ơn!',
  'Sự hiện diện của bạn đã là món quà lớn nhất. Nếu muốn gửi thêm chút yêu thương, bạn có thể dùng thông tin bên dưới.',
];

export const GENERATABLE_FIELDS = [
  'headline', 'invitation', 'quote', 'coupleIntro', 'thankYou', 'rsvpNote', 'giftNote', 'hashtag', 'groomBio', 'brideBio', 'story',
];

/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, seed, salt) {
  const h = crypto.createHash('sha1').update(`${seed}:${salt}`).digest().readUInt32BE(0);
  return list[Math.floor(mulberry32(h)() * list.length)];
}

function fill(template, ctx) {
  return template
    .replaceAll('{GF}', ctx.groomFull || ctx.groom)
    .replaceAll('{BF}', ctx.brideFull || ctx.bride)
    .replaceAll('{G}', ctx.groom)
    .replaceAll('{B}', ctx.bride)
    .replaceAll('{DATE_SUFFIX}', ctx.dateText ? ` vào ${ctx.dateText}` : '')
    .replaceAll('{DEADLINE}', ctx.deadlineText ? ` trước ngày ${ctx.deadlineText}` : '');
}

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Today's date in Vietnam (UTC+7) as YYYY-MM-DD. */
export function todayIso(now = Date.now()) {
  return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Default RSVP deadline: 10 days before the wedding, or none if that is already in the past. */
export function defaultRsvpDeadline(weddingDate, now = Date.now()) {
  const deadline = shiftDate(weddingDate, -10);
  return deadline && deadline >= todayIso(now) ? deadline : '';
}

/** ISO date shifted by `days` (negative = earlier). */
export function shiftDate(iso, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
  return d.toISOString().slice(0, 10);
}

function buildContext(input) {
  const groomFull = titleCaseName(input.groomName || '');
  const brideFull = titleCaseName(input.brideName || '');
  const tone = HEADLINES[input.tone] ? input.tone : 'classic';
  const deadline = input.rsvpDeadline ?? defaultRsvpDeadline(input.date);
  return {
    tone,
    seed: Number.isInteger(input.seed) ? input.seed : 0,
    groomFull,
    brideFull,
    groom: input.groomShort || shortName(groomFull) || 'Chú rể',
    bride: input.brideShort || shortName(brideFull) || 'Cô dâu',
    dateText: formatDate(input.date),
    deadlineText: formatDate(deadline),
    year: (input.date || '').slice(0, 4),
  };
}

/** Generate a single field — powers the "✨ Gợi ý khác" buttons in the editor. */
export function generateField(field, input) {
  const ctx = buildContext(input);
  const { tone, seed } = ctx;
  switch (field) {
    case 'headline':
      return pick(HEADLINES[tone], seed, 'headline');
    case 'invitation':
      return fill(pick(INVITATIONS[tone], seed, 'invitation'), ctx);
    case 'quote': {
      const [quote, author] = pick(QUOTES[tone], seed, 'quote');
      return { quote, quoteAuthor: author };
    }
    case 'coupleIntro':
      return pick(COUPLE_INTROS, seed, 'intro');
    case 'thankYou':
      return pick(THANK_YOUS[tone], seed, 'thanks');
    case 'rsvpNote':
      return fill(tone === 'modern' || tone === 'romantic' ? RSVP_NOTES.casual : RSVP_NOTES.formal, ctx);
    case 'giftNote':
      return pick(GIFT_NOTES, seed, 'gift');
    case 'hashtag': {
      const g = stripDiacritics(ctx.groom).replace(/[^A-Za-z0-9]/g, '');
      const b = stripDiacritics(ctx.bride).replace(/[^A-Za-z0-9]/g, '');
      const variants = [`#${g}${b}Wedding`, `#${g}And${b}`, `#${g}${b}${ctx.year || 'Forever'}`];
      return pick(variants, seed, 'hashtag');
    }
    case 'groomBio':
      return fill(pick(GROOM_BIOS, seed, 'groomBio'), ctx);
    case 'brideBio':
      return fill(pick(BRIDE_BIOS, seed, 'brideBio'), ctx);
    case 'story':
      return STORY.map(([title, text], i) => ({ id: `story${i + 1}`, title, date: '', text: fill(text, ctx), image: null }));
    default:
      throw new Error(`Không hỗ trợ sinh nội dung cho trường "${field}"`);
  }
}

/**
 * Build a complete first draft of an invitation from the quick-start form.
 * The result is plain invitation data and still goes through the schema before saving.
 */
export function generateInvitation(input) {
  const ctx = buildContext(input);
  const quote = generateField('quote', input);
  const date = input.date || '';
  const time = input.time || '11:00';

  const events = [];
  if (input.includeCeremony !== false) {
    events.push({
      id: 'ev1',
      type: 'thanh-hon',
      title: 'Lễ Thành Hôn',
      date,
      time: time < '10:00' ? time : '09:00',
      venue: 'Tư gia nhà trai',
      address: input.groomAddress || '',
      note: '',
      showMap: Boolean(input.groomAddress),
    });
  }
  events.push({
    id: 'ev2',
    type: 'tiec-cuoi',
    title: 'Tiệc Cưới',
    date,
    time,
    venue: input.venue || '',
    address: input.address || '',
    note: '',
    showMap: true,
  });

  return {
    groom: {
      fullName: ctx.groomFull,
      shortName: '', // derived from fullName at render time unless the user sets one
      bio: generateField('groomBio', input),
      address: input.groomAddress || '',
    },
    bride: {
      fullName: ctx.brideFull,
      shortName: '',
      bio: generateField('brideBio', input),
      address: input.brideAddress || '',
    },
    wedding: { date, time },
    events,
    content: {
      headline: generateField('headline', input),
      invitation: generateField('invitation', input),
      quote: quote.quote,
      quoteAuthor: quote.quoteAuthor,
      coupleIntro: generateField('coupleIntro', input),
      thankYou: generateField('thankYou', input),
      rsvpNote: generateField('rsvpNote', input),
      giftNote: generateField('giftNote', input),
      hashtag: generateField('hashtag', input),
    },
    story: generateField('story', input),
    rsvp: { deadline: defaultRsvpDeadline(date) },
    tone: ctx.tone,
    seed: ctx.seed,
  };
}
