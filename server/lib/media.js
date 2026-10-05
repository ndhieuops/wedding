import sharp from 'sharp';

sharp.cache(false);
sharp.concurrency(Math.max(1, Math.min(4, (await import('node:os')).cpus().length)));

export class MediaError extends Error {
  constructor(message, statusCode = 415) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Sniff the real file type from magic bytes — never trust the client-provided MIME type. */
export function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  const hex = (start, len) => buf.subarray(start, start + len).toString('hex');
  const ascii = (start, len) => buf.subarray(start, start + len).toString('latin1');

  if (hex(0, 3) === 'ffd8ff') return { kind: 'image', mime: 'image/jpeg' };
  if (hex(0, 8) === '89504e470d0a1a0a') return { kind: 'image', mime: 'image/png' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { kind: 'image', mime: 'image/webp' };
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return { kind: 'image', mime: 'image/gif' };
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (['avif', 'avis'].includes(brand)) return { kind: 'image', mime: 'image/avif' };
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) return { kind: 'image', mime: 'image/heic' };
    if (['M4A ', 'M4B ', 'mp42', 'isom', 'dash'].includes(brand)) return { kind: 'audio', mime: 'audio/mp4', ext: 'm4a' };
  }
  if (ascii(0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3' };
  if (ascii(0, 4) === 'OggS') return { kind: 'audio', mime: 'audio/ogg', ext: 'ogg' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return { kind: 'audio', mime: 'audio/wav', ext: 'wav' };
  return null;
}

/**
 * Normalise an uploaded photo: auto-rotate from EXIF, strip metadata (GPS!),
 * resize to sane dimensions and re-encode as WebP + a small thumbnail.
 */
export async function processImage(buf) {
  const type = sniff(buf);
  if (!type || type.kind !== 'image') throw new MediaError('Định dạng ảnh không được hỗ trợ (chỉ nhận JPG, PNG, WebP, GIF, AVIF).');
  if (type.mime === 'image/heic') {
    throw new MediaError('Ảnh HEIC chưa được hỗ trợ — hãy chọn "Định dạng tương thích nhất" trên iPhone hoặc chuyển sang JPG.');
  }

  const input = sharp(buf, { limitInputPixels: 60_000_000, failOn: 'error', animated: false });
  let meta;
  try {
    meta = await input.metadata();
  } catch {
    throw new MediaError('Không đọc được ảnh — file có thể bị hỏng.');
  }
  if (!meta.width || !meta.height) throw new MediaError('Không đọc được kích thước ảnh.');

  const base = input.clone().rotate();
  const [full, thumb] = await Promise.all([
    base
      .clone()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true }),
    base
      .clone()
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 74, effort: 4 })
      .toBuffer({ resolveWithObject: true }),
  ]);
  return {
    full: full.data,
    thumb: thumb.data,
    width: full.info.width,
    height: full.info.height,
    mime: 'image/webp',
  };
}

export function validateAudio(buf) {
  const type = sniff(buf);
  if (!type || type.kind !== 'audio') throw new MediaError('Định dạng nhạc không được hỗ trợ (chỉ nhận MP3, M4A, OGG, WAV).');
  return type;
}
