import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import nunjucks from 'nunjucks';
import { ZodError } from 'zod';
import { openDatabase } from './db.js';
import { createRepo } from './repo.js';
import { BOOT_SCRIPT, platformCsp } from './lib/csp.js';
import { HttpError } from './lib/errors.js';
import { createPreviewStore } from './lib/preview-store.js';
import { formatZodError } from './lib/schema.js';
import { ADMIN_COOKIE, hashToken, safeEqual, verifySignedToken } from './lib/security.js';
import { createTemplateRegistry } from './templates/registry.js';
import { startAssetGc } from './services/assets.js';
import { createInvitationService } from './services/invitations.js';
import { registerPageRoutes } from './routes/pages.js';
import { registerPublicApi } from './routes/api-public.js';
import { registerInvitationApi } from './routes/api-invitations.js';
import { registerAdminApi } from './routes/api-admin.js';

/**
 * Build the Fastify application. Kept separate from server/index.js so tests can
 * create isolated instances (in-memory DB, temp folders) and use `app.inject()`.
 */
export async function buildApp(config, { logger = false } = {}) {
  const app = Fastify({
    logger,
    trustProxy: config.trustProxy,
    bodyLimit: 512 * 1024,
    routerOptions: { ignoreTrailingSlash: true },
  });

  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const db = openDatabase(config.dbFile);
  const repo = createRepo(db);
  const registry = createTemplateRegistry({ templatesDir: config.templatesDir, hotReload: config.templateHotReload, logger: app.log });
  const previews = createPreviewStore();
  const brand = { name: config.brandName, url: config.baseUrl };

  const views = new nunjucks.Environment(new nunjucks.FileSystemLoader(config.viewsDir, { noCache: !config.isProd }), { autoescape: true });
  views.addGlobal('bootScript', BOOT_SCRIPT);
  views.addGlobal('brand', brand);

  const invitations = createInvitationService({ config, repo, registry, previews, brand });

  app.decorate('config', config);
  app.decorate('repo', repo);
  app.decorate('registry', registry);
  app.decorate('previews', previews);
  app.decorate('invitations', invitations);
  app.decorate('views', views);
  app.decorate('brand', brand);

  /** Render a platform page (views/*.njk). */
  app.decorateReply('view', function view(name, context = {}, status = 200) {
    const html = views.render(name, { ...context, config: { baseUrl: config.baseUrl, allowPublicCreate: config.allowPublicCreate } });
    return this.code(status).type('text/html; charset=utf-8').send(html);
  });

  /* ---------------- auth helpers ---------------- */
  app.decorateRequest('isAdmin', function isAdmin() {
    if (!config.adminPassword) return false;
    const session = verifySignedToken(this.cookies?.[ADMIN_COOKIE], config.sessionSecret);
    return Boolean(session && session.role === 'admin');
  });

  /** Owner (edit token) or admin may manage an invitation. Throws 401/403/404. */
  app.decorateRequest('requireOwner', function requireOwner(invitationId) {
    const invitation = repo.getInvitation(invitationId);
    if (!invitation) throw new HttpError(404, 'Không tìm thấy thiệp.');
    if (this.isAdmin()) return invitation;
    const header = this.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new HttpError(401, 'Thiếu mã chỉnh sửa. Hãy mở lại đường link chỉnh sửa của bạn.');
    if (!safeEqual(hashToken(token), invitation.editTokenHash)) throw new HttpError(403, 'Mã chỉnh sửa không đúng hoặc đã bị thay đổi.');
    return invitation;
  });

  /* ---------------- plugins ---------------- */
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    originAgentCluster: false,
    hsts: config.baseUrl.startsWith('https://') ? { maxAge: 15552000 } : false, // only meaningful over HTTPS
  });
  app.addHook('onSend', async (request, reply, payload) => {
    const type = String(reply.getHeader('content-type') || '');
    if (type.startsWith('text/html') && !reply.getHeader('content-security-policy')) {
      reply.header('content-security-policy', platformCsp());
    }
    return payload;
  });
  await app.register(compress, { global: true, threshold: 1024, encodings: ['br', 'gzip'] });
  await app.register(cookie);
  await app.register(formbody, { bodyLimit: 64 * 1024 });
  await app.register(multipart, {
    limits: { fileSize: Math.max(config.maxImageBytes, config.maxAudioBytes), files: 1, fields: 5, fieldSize: 1024 },
  });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, ctx) => new HttpError(429, `Bạn thao tác quá nhanh, vui lòng thử lại sau ${Math.ceil(ctx.ttl / 1000)} giây.`),
  });

  /* ---------------- static files ---------------- */
  const immutable = (res) => {
    res.header('Cache-Control', 'public, max-age=31536000, immutable');
  };
  await app.register(fastifyStatic, {
    root: config.templatesDir,
    prefix: '/t/',
    decorateReply: true,
    index: false,
    // Only expose browser assets — never the .njk sources or manifests.
    allowedPath: (pathName) => /\.(css|js|svg|png|jpe?g|webp|gif|avif|ico|woff2?|ttf|otf|mp3|m4a|ogg)$/i.test(pathName),
    setHeaders: (res) => {
      res.header('Cache-Control', config.templateHotReload ? 'no-cache' : 'public, max-age=31536000, immutable');
      // Public design assets; CORS lets the sandboxed (opaque-origin) editor preview use them as CSS masks.
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
  await app.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
    index: false,
    setHeaders: immutable,
  });
  if (fs.existsSync(path.join(config.studioDir, 'assets'))) {
    await app.register(fastifyStatic, {
      root: path.join(config.studioDir, 'assets'),
      prefix: '/assets/',
      decorateReply: false,
      index: false,
      setHeaders: immutable,
    });
  }
  await app.register(fastifyStatic, {
    root: config.publicDir,
    prefix: '/static/',
    decorateReply: false,
    index: false,
    setHeaders: (res) => res.header('Cache-Control', 'public, max-age=86400'),
  });
  app.get('/favicon.svg', (req, reply) => reply.sendFile('favicon.svg', config.publicDir, { maxAge: 86400000 }));
  app.get('/favicon.ico', (req, reply) => reply.redirect('/favicon.svg', 301));

  /* ---------------- routes ---------------- */
  registerPublicApi(app);
  registerInvitationApi(app);
  registerAdminApi(app);
  registerPageRoutes(app);

  /* ---------------- errors ---------------- */
  const wantsJson = (request) => request.url.startsWith('/api/') || (request.headers.accept || '').includes('application/json');

  app.setErrorHandler((error, request, reply) => {
    let status = error.statusCode || 500;
    let message = error.expose || status < 500 ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại sau.';
    let details = error.details;
    if (error instanceof ZodError) {
      status = 400;
      details = formatZodError(error);
      message = details[0]?.message ? `Dữ liệu không hợp lệ: ${details[0].message}` : 'Dữ liệu không hợp lệ.';
    } else if (error.code === 'FST_REQ_FILE_TOO_LARGE' || error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      status = 413;
      message = 'File hoặc dữ liệu gửi lên quá lớn.';
    } else if (error.validation) {
      status = 400;
      message = 'Yêu cầu không hợp lệ.';
    }
    if (status >= 500) request.log.error({ err: error }, 'Unhandled error');
    if (wantsJson(request)) return reply.code(status).send({ error: true, message, details });
    return reply.view('message.njk', { title: status === 404 ? 'Không tìm thấy trang' : 'Có lỗi xảy ra', message, status }, status);
  });

  app.setNotFoundHandler((request, reply) => {
    if (wantsJson(request)) return reply.code(404).send({ error: true, message: 'Không tìm thấy.' });
    return reply.view('message.njk', { title: 'Không tìm thấy trang', message: 'Đường dẫn không tồn tại hoặc thiệp đã bị gỡ.', status: 404 }, 404);
  });

  /* ---------------- lifecycle ---------------- */
  const gc = startAssetGc({ config, repo, log: app.log });
  app.addHook('onClose', async () => {
    gc.stop();
    db.close();
  });

  return app;
}
