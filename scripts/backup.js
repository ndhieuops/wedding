#!/usr/bin/env node
/**
 * Online, consistent backup of the SQLite database (safe while the app is running).
 * Output: $DATA_DIR/backups/wedding-YYYYMMDD-HHMMSS.db — keeps the 14 most recent.
 *
 *   node scripts/backup.js                      (local)
 *   docker compose exec app node scripts/backup.js
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { loadConfig } from '../server/config.js';

const config = loadConfig();
if (!fs.existsSync(config.dbFile)) {
  console.error(`Không tìm thấy database: ${config.dbFile}`);
  process.exit(1);
}
const dir = path.join(config.dataDir, 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const target = path.join(dir, `wedding-${stamp}.db`);

const db = new Database(config.dbFile, { readonly: true });
await db.backup(target);
db.close();

const old = fs.readdirSync(dir).filter((f) => /^wedding-\d{8}-\d{6}\.db$/.test(f)).sort().reverse().slice(14);
old.forEach((f) => fs.rmSync(path.join(dir, f)));
console.log(`✓ Đã sao lưu database → ${target}${old.length ? ` (xoá ${old.length} bản cũ)` : ''}`);
console.log('  Ảnh & nhạc nằm trong thư mục uploads/ của cùng volume — sao lưu cả volume để đầy đủ (make backup).');
