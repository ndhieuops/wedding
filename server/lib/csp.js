import crypto from 'node:crypto';

/** Tiny inline bootstrap: flips `no-js` → `js` before first paint so reveal animations never flash. */
export const BOOT_SCRIPT = "document.documentElement.classList.replace('no-js','js')";
const BOOT_HASH = `'sha256-${crypto.createHash('sha256').update(BOOT_SCRIPT).digest('base64')}'`;

/** Content-Security-Policy for public invitation pages (strict: no third-party scripts). */
export function invitationCsp({ allowFraming = false } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' ${BOOT_HASH}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "media-src 'self' https: blob:",
    'frame-src https://www.google.com https://maps.google.com',
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${allowFraming ? "'self'" : "'none'"}`,
  ].join('; ');
}

/** CSP for the platform pages (landing, studio, admin). */
export function platformCsp() {
  return [
    "default-src 'self'",
    `script-src 'self' ${BOOT_HASH}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "media-src 'self' https: blob:",
    "frame-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}
