import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, fallback, { min = -Infinity, max = Infinity } = {}) {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Build runtime configuration from environment variables.
 * Every value has a safe default so `npm start` works out of the box;
 * production deployments should at least set BASE_URL, ADMIN_PASSWORD and SESSION_SECRET.
 */
export function loadConfig(env = process.env, overrides = {}) {
  const isProd = env.NODE_ENV === 'production';
  const warnings = [];

  let sessionSecret = env.SESSION_SECRET || '';
  if (sessionSecret.length < 32) {
    if (sessionSecret) warnings.push('SESSION_SECRET quá ngắn (< 32 ký tự) — đã tự sinh khoá tạm thời.');
    else warnings.push('SESSION_SECRET chưa được đặt — đã tự sinh khoá tạm thời (phiên admin sẽ mất khi restart).');
    sessionSecret = crypto.randomBytes(32).toString('hex');
  }

  const adminPassword = env.ADMIN_PASSWORD || '';
  if (!adminPassword) warnings.push('ADMIN_PASSWORD chưa được đặt — trang quản trị bị tắt.');
  else if (adminPassword === 'doi-mat-khau-nay') warnings.push('ADMIN_PASSWORD vẫn là giá trị mẫu trong .env.example — hãy đổi ngay!');
  else if (isProd && adminPassword.length < 10) warnings.push('ADMIN_PASSWORD nên dài ít nhất 10 ký tự.');

  const port = int(env.PORT, 3000, { min: 1, max: 65535 });
  const baseUrl = (env.BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  const dataDir = path.resolve(ROOT, env.DATA_DIR || 'data');

  const config = {
    root: ROOT,
    isProd,
    host: env.HOST || '0.0.0.0',
    port,
    baseUrl,
    dataDir,
    dbFile: path.join(dataDir, 'wedding.db'),
    uploadsDir: path.join(dataDir, 'uploads'),
    templatesDir: path.resolve(ROOT, env.TEMPLATES_DIR || 'templates'),
    viewsDir: path.join(ROOT, 'views'),
    publicDir: path.join(ROOT, 'public'),
    studioDir: path.join(ROOT, 'dist', 'studio'),
    adminPassword,
    sessionSecret,
    brandName: env.BRAND_NAME ?? 'Thiệp Cưới Online',
    templateHotReload: bool(env.TEMPLATE_HOT_RELOAD, !isProd),
    allowPublicCreate: bool(env.ALLOW_PUBLIC_CREATE, true),
    trustProxy: bool(env.TRUST_PROXY, false),
    logLevel: env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    prettyLogs: bool(env.PRETTY_LOGS, !isProd),
    maxImageBytes: int(env.MAX_IMAGE_MB, 12, { min: 1, max: 50 }) * 1024 * 1024,
    maxAudioBytes: int(env.MAX_AUDIO_MB, 15, { min: 1, max: 50 }) * 1024 * 1024,
    maxImagesPerInvitation: int(env.MAX_IMAGES_PER_INVITATION, 60, { min: 1, max: 500 }),
    assetGcGraceHours: int(env.ASSET_GC_GRACE_HOURS, 24, { min: 1, max: 24 * 30 }),
    timezoneOffset: env.WEDDING_TZ_OFFSET || '+07:00',
    warnings,
    ...overrides,
  };
  return config;
}
