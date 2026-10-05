/** Minimal RFC 5545 calendar file for "Lưu vào lịch" on iPhone / Outlook. */

function esc(text = '') {
  return String(text).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/** Fold lines longer than 75 octets as required by the spec (UTF-8 aware). */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function stamp(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcs({ uid, title, date, time, endTime, tz = '+07:00', location = '', description = '', url = '' }) {
  const start = Date.parse(`${date}T${time || '08:00'}:00${tz}`);
  if (Number.isNaN(start)) return null;
  let end = endTime ? Date.parse(`${date}T${endTime}:00${tz}`) : start + 3 * 3600 * 1000;
  if (!(end > start)) end = start + 3 * 3600 * 1000;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding Studio//Thiep Cuoi//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    location && `LOCATION:${esc(location)}`,
    description && `DESCRIPTION:${esc(description)}`,
    url && `URL:${url}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map(fold).join('\r\n') + '\r\n';
}
