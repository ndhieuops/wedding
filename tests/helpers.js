import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';

export const ADMIN_PASSWORD = 'test-admin-password';

/** Isolated app instance: temp data dir, real templates, no logging. */
export async function createTestApp(env = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-test-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    DATA_DIR: dataDir,
    ADMIN_PASSWORD,
    SESSION_SECRET: 's'.repeat(48),
    TEMPLATE_HOT_RELOAD: 'false',
    BASE_URL: 'http://test.local',
    ...env,
  });
  const app = await buildApp(config);
  await app.ready();
  const close = async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
  return { app, config, close };
}

export async function createInvitation(app, body = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/invitations',
    payload: { templateId: 'classic-gold', groomName: 'Nguyễn Văn Minh', brideName: 'Trần Thu Hà', date: '2030-12-20', time: '17:30', venue: 'Nhà hàng Hoa Sen', address: '1 Lê Duẩn, Quận 1', ...body },
  });
  if (res.statusCode !== 201) throw new Error(`create failed: ${res.statusCode} ${res.body}`);
  const json = res.json();
  return { ...json, id: json.invitation.id, slug: json.invitation.slug, token: json.editToken, auth: { authorization: `Bearer ${json.editToken}` } };
}

export async function adminCookie(app) {
  const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: ADMIN_PASSWORD } });
  const cookie = res.cookies.find((c) => c.name === 'ws_admin');
  return `${cookie.name}=${cookie.value}`;
}

/** Build a multipart/form-data body for app.inject (no extra dependency needed). */
export function multipart(fields, file) {
  const boundary = `----test${Math.random().toString(16).slice(2)}`;
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
  parts.push(file.data);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
