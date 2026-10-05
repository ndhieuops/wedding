/** Immutable deep set: setIn(obj, 'events.0.title', 'x'). */
export function setIn(obj, path, value) {
  const keys = Array.isArray(path) ? path : String(path).split('.');
  if (!keys.length) return value;
  const [head, ...rest] = keys;
  const isIndex = /^\d+$/.test(head);
  const base = obj ?? (isIndex ? [] : {});
  const copy = Array.isArray(base) ? [...base] : { ...base };
  copy[isIndex ? Number(head) : head] = setIn(base[isIndex ? Number(head) : head], rest, value);
  return copy;
}

export function getIn(obj, path) {
  return String(path).split('.').reduce((acc, k) => (acc == null ? acc : acc[/^\d+$/.test(k) ? Number(k) : k]), obj);
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Downscale big photos in the browser before upload: phones produce 5–12MB images,
 * this makes uploads ~10x faster on 4G. The server still validates & re-encodes everything.
 */
export async function shrinkImage(file, maxSide = 2400) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < 600 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 4 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return file;
    return new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // browser cannot decode (e.g. HEIC on Chrome) — let the server answer
  }
}

/** Name shown on the invitation: explicit short name, else the last word of the full name. */
export function displayName(person, fallback) {
  return person?.shortName || (person?.fullName || '').trim().split(/\s+/).pop() || fallback;
}

export function coupleTitle(data) {
  return `${displayName(data.groom, 'Chú rể')} & ${displayName(data.bride, 'Cô dâu')}`;
}
