import { findBank } from '../lib/banks.js';
import { describeLunar } from '../lib/lunar.js';
import { EVENT_TYPES, FONTS, SECTION_KEYS } from '../lib/schema.js';
import { jsonForScript } from '../lib/security.js';
import { initial, shortName, stripDiacritics } from '../lib/text.js';
import { vietQrSvg } from '../lib/vietqr.js';

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FONT_FALLBACK = { serif: 'Georgia, "Times New Roman", serif', sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', script: 'cursive' };

function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

/** Everything a template may want to print about a calendar date. */
export function describeDate(iso, time = '') {
  const p = parseIso(iso);
  if (!p) return null;
  const weekdayIndex = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  const dd = String(p.d).padStart(2, '0');
  const mm = String(p.m).padStart(2, '0');
  const [hh, mi] = (time || '').split(':');
  return {
    iso,
    day: dd,
    month: mm,
    year: String(p.y),
    weekday: WEEKDAYS[weekdayIndex],
    weekdayEn: WEEKDAYS_EN[weekdayIndex],
    monthEn: MONTHS_EN[p.m - 1],
    display: `${dd}.${mm}.${p.y}`,
    slash: `${dd}/${mm}/${p.y}`,
    long: `${WEEKDAYS[weekdayIndex]}, ngày ${dd} tháng ${mm} năm ${p.y}`,
    time: time || '',
    timeText: time ? `${Number(hh)} giờ ${mi === '00' ? '' : mi}`.trim() : '',
    lunar: describeLunar(iso),
  };
}

/** Month grid (Monday-first) used by the "calendar" section. */
export function monthGrid(iso) {
  const p = parseIso(iso);
  if (!p) return null;
  const first = new Date(Date.UTC(p.y, p.m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
  const offset = (first + 6) % 7;
  const cells = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month: p.m, year: p.y, monthEn: MONTHS_EN[p.m - 1], highlight: p.d, headers: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], weeks };
}

function toUtcStamp(iso, time, tz, addMinutes = 0) {
  const t = Date.parse(`${iso}T${time || '00:00'}:00${tz}`);
  if (Number.isNaN(t)) return '';
  return new Date(t + addMinutes * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function mapQuery(ev) {
  return [ev.venue, ev.address].filter(Boolean).join(', ');
}

export function googleCalendarUrl({ title, date, time, endTime, location, details }, tz) {
  const start = toUtcStamp(date, time || '08:00', tz);
  if (!start) return '';
  const end = endTime ? toUtcStamp(date, endTime, tz) : toUtcStamp(date, time || '08:00', tz, 180);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${start}/${end}`, details: details || '', location: location || '' });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function fontsHref(fonts) {
  const families = [...new Set(Object.values(fonts))]
    .map((name) => FONTS.find((f) => f.family === name))
    .filter(Boolean)
    .map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}${f.axes ? `:${f.axes}` : ''}`);
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

function fontStack(name) {
  const f = FONTS.find((x) => x.family === name);
  return `"${name}", ${FONT_FALLBACK[f?.category || 'serif']}`;
}

/** Merge user section order/toggles with the template defaults. */
export function effectiveSections(userSections, templateDefaults) {
  const list = [];
  const seen = new Set();
  for (const s of userSections || []) {
    if (SECTION_KEYS.includes(s.key) && !seen.has(s.key)) {
      list.push({ key: s.key, enabled: s.key === 'hero' ? true : !!s.enabled });
      seen.add(s.key);
    }
  }
  // Keys the user never touched: insert in the template's default order (enabled), then the rest (disabled).
  for (const key of templateDefaults) {
    if (!seen.has(key)) {
      list.push({ key, enabled: true });
      seen.add(key);
    }
  }
  for (const key of SECTION_KEYS) {
    if (!seen.has(key)) list.push({ key, enabled: false });
  }
  return list;
}

function person(p, fallbackName) {
  const full = p.fullName || '';
  return {
    ...p,
    fullName: full || fallbackName,
    shortName: p.shortName || shortName(full) || fallbackName,
    initial: initial(p.shortName || full) || fallbackName.charAt(0),
    hasParents: Boolean(p.father || p.mother),
  };
}

/**
 * Turn stored invitation data into the context object templates render with.
 * See templates/_starter/README.md for the documented shape.
 */
export async function buildViewModel({ invitation, template, registry, mode = 'live', guestName = '', baseUrl = '', tz = '+07:00', wishes = [], brand = {}, previewOptions = {} }) {
  const data = invitation.data;
  const defaults = template.defaults;
  const theme = {
    colors: { ...defaults.theme.colors, ...data.theme.colors },
    fonts: { ...defaults.theme.fonts, ...data.theme.fonts },
    effect: data.theme.effect || defaults.theme.effect,
    effectIntensity: data.theme.effectIntensity || defaults.theme.effectIntensity,
    intro: data.theme.intro || defaults.theme.intro,
  };
  theme.fontsHref = fontsHref(theme.fonts);
  theme.cssVars = [
    `--c-primary:${theme.colors.primary}`,
    `--c-secondary:${theme.colors.secondary}`,
    `--c-bg:${theme.colors.background}`,
    `--c-surface:${theme.colors.surface}`,
    `--c-text:${theme.colors.text}`,
    `--c-accent:${theme.colors.accent}`,
    `--f-heading:${fontStack(theme.fonts.heading)}`,
    `--f-body:${fontStack(theme.fonts.body)}`,
    `--f-script:${fontStack(theme.fonts.script)}`,
  ].join(';');

  const groom = person(data.groom, 'Chú rể');
  const bride = person(data.bride, 'Cô dâu');
  const [first, second] = data.order === 'bride-first' ? [bride, groom] : [groom, bride];

  const wedding = describeDate(data.wedding.date, data.wedding.time) || {};
  wedding.countdownTarget = data.wedding.date ? `${data.wedding.date}T${data.wedding.time || '00:00'}:00${tz}` : '';
  wedding.calendar = monthGrid(data.wedding.date);

  const events = data.events.map((ev) => {
    const typeLabel = EVENT_TYPES.find((t) => t.id === ev.type)?.label || '';
    const title = ev.title || typeLabel || 'Sự kiện';
    const query = mapQuery(ev);
    return {
      ...ev,
      title,
      when: describeDate(ev.date, ev.time),
      mapLink: ev.mapUrl || (query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''),
      mapEmbed: ev.showMap && query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed` : '',
      calendarLink: ev.date
        ? googleCalendarUrl(
            { title: `${title} — ${first.shortName} & ${second.shortName}`, date: ev.date, time: ev.time, endTime: ev.endTime, location: query, details: baseUrl && invitation.slug ? `${baseUrl}/w/${invitation.slug}` : '' },
            tz,
          )
        : '',
      icsUrl: invitation.slug && ev.date ? `/w/${invitation.slug}/calendar/${ev.id}.ics` : '',
    };
  });

  const accounts = await Promise.all(
    data.gift.accounts
      .filter((a) => a.accountNumber)
      .map(async (a) => {
        const bank = findBank({ code: a.bankCode, bin: a.bankBin });
        const bin = a.bankBin || bank?.bin || '';
        return {
          ...a,
          bankName: a.bankName || bank?.name || '',
          ownerLabel: a.label || (a.owner === 'groom' ? `Mừng cưới chú rể` : a.owner === 'bride' ? `Mừng cưới cô dâu` : 'Mừng cưới'),
          qrSvg: a.showQr && bin ? await vietQrSvg({ bin, accountNumber: a.accountNumber, message: `Mung cuoi ${first.shortName} ${second.shortName}` }) : null,
        };
      }),
  );

  const available = {
    hero: true,
    quote: Boolean(data.content.quote),
    invitation: Boolean(data.content.invitation || groom.hasParents || bride.hasParents),
    couple: true,
    calendar: Boolean(wedding.calendar),
    countdown: Boolean(wedding.countdownTarget),
    events: events.length > 0,
    story: data.story.length > 0,
    gallery: data.gallery.length > 0,
    rsvp: true,
    wishes: true,
    gift: accounts.length > 0,
    thanks: true,
  };
  const sectionList = effectiveSections(data.sections, defaults.sections);
  const sections = sectionList.filter((s) => s.enabled && available[s.key]).map((s) => s.key);

  const musicSrc = data.music.enabled ? data.music.asset?.url || data.music.url || '' : '';
  const absolute = (url) => (url && url.startsWith('/') ? `${baseUrl}${url}` : url);
  const publicUrl = invitation.slug ? `${baseUrl}/w/${invitation.slug}` : baseUrl;
  const names = `${first.shortName} & ${second.shortName}`;
  const ogImage = absolute(data.cover.image?.url || '') || (template.previewUrl && !template.previewUrl.includes('.svg') ? absolute(template.previewUrl) : '');
  const description =
    data.seo.description ||
    `${guestName ? `Trân trọng kính mời ${guestName}. ` : ''}${wedding.long ? `${wedding.long}. ` : ''}${(data.content.invitation || '').slice(0, 140)}`;

  const config = {
    mode,
    slug: invitation.slug || '',
    countdownTarget: wedding.countdownTarget,
    effect: theme.effect,
    effectIntensity: theme.effectIntensity,
    intro: theme.intro,
    colors: theme.colors,
    music: musicSrc ? { src: musicSrc, title: data.music.title || '' } : null,
    endpoints: invitation.slug && mode === 'live' ? { rsvp: `/api/w/${invitation.slug}/rsvp`, wishes: `/api/w/${invitation.slug}/wishes` } : null,
    preview: mode === 'preview' ? { skipIntro: Boolean(previewOptions.skipIntro), scrollY: previewOptions.scrollY || 0 } : null,
  };

  return {
    mode,
    skipIntro: mode === 'preview' && Boolean(previewOptions.skipIntro),
    template: { id: template.id, name: template.name },
    asset: (file) => `/t/${template.id}/${file}?v=${template.version}`,
    shared: (file) => registry.sharedUrl(file),
    styles: template.styleUrls,
    scripts: template.scriptUrls,
    theme,
    groom,
    bride,
    first,
    second,
    names,
    monogram: `${first.initial}${second.initial}`,
    order: data.order,
    hostSide: data.hostSide,
    wedding,
    events,
    mainEvent: events.find((e) => e.type === 'tiec-cuoi') || events[events.length - 1] || null,
    content: data.content,
    story: data.story,
    cover: data.cover,
    gallery: data.gallery,
    gift: { accounts },
    rsvp: {
      ...data.rsvp,
      deadlineText: describeDate(data.rsvp.deadline)?.slash || '',
      action: invitation.slug ? `/w/${invitation.slug}/rsvp` : '#',
    },
    wishes: wishes.map((w) => ({ ...w, initial: initial(w.name) || '♥' })),
    wishesAction: invitation.slug ? `/w/${invitation.slug}/wishes` : '#',
    music: config.music,
    guest: { name: guestName },
    sections,
    hasSection: Object.fromEntries(sections.map((k) => [k, true])),
    brand,
    hashtagPlain: stripDiacritics(data.content.hashtag || ''),
    meta: {
      title: data.seo.title || `${names} — Thiệp cưới`,
      ogTitle: guestName ? `Trân trọng kính mời ${guestName} — Thiệp cưới ${names}` : data.seo.title || `Thiệp cưới ${names}`,
      description: description.trim(),
      ogImage,
      url: publicUrl,
      noindex: true,
    },
    configJson: jsonForScript(config),
  };
}
