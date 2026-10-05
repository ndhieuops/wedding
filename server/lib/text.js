/** Text helpers that are aware of Vietnamese diacritics. */

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'assets', 'edit', 'new', 'preview', 'static', 'studio', 'templates', 'uploads', 'vendor', 'w', 't',
  'login', 'logout', 'healthz', 'robots', 'sitemap', 'favicon',
]);

/** Remove Vietnamese (and other Latin) diacritics: "Đỗ Thị Hà" → "Do Thi Ha". */
export function stripDiacritics(input = '') {
  return String(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Collapse whitespace, trim and convert to NFC (macOS/iOS keyboards can emit NFD). */
export function cleanText(input = '') {
  return String(input)
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanLine(input = '') {
  return cleanText(input).replace(/\s+/g, ' ');
}

/** "nguyễn  văn MINH" → "Nguyễn Văn Minh" (Unicode-aware title case). */
export function titleCaseName(input = '') {
  return cleanLine(input)
    .toLocaleLowerCase('vi')
    .split(' ')
    .map((w) => (w ? w.charAt(0).toLocaleUpperCase('vi') + w.slice(1) : w))
    .join(' ');
}

/** Vietnamese given name is the last word of the full name: "Nguyễn Văn Minh" → "Minh". */
export function shortName(fullName = '') {
  const parts = cleanLine(fullName).split(' ').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

export function initial(name = '') {
  const s = shortName(name);
  return s ? s.charAt(0).toLocaleUpperCase('vi') : '';
}

export function slugify(input = '', maxLength = 60) {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

export function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_PATTERN.test(slug) && !slug.includes('--') && !RESERVED_SLUGS.has(slug);
}

/** Key used to de-duplicate RSVPs from the same guest ("Anh  Minh" == "anh minh"). */
export function nameKey(name = '') {
  return stripDiacritics(cleanLine(name)).toLowerCase();
}

/** ASCII-only, length-limited text (bank transfer descriptions do not accept diacritics). */
export function asciiLine(input = '', max = 25) {
  return stripDiacritics(cleanLine(input)).replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, max).trim();
}
