#!/usr/bin/env node
/**
 * Scaffold a new invitation template from templates/_starter.
 *
 *   npm run template:new -- <id> [--name "Tên hiển thị"] [--description "..."] [--from <template-id>] [--publish]
 *
 * <id>: lowercase letters, digits and dashes (becomes the folder name and URL /templates/<id>).
 * --from: copy an existing template instead of the starter (e.g. --from floral-blush).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(import.meta.dirname, '..');
const TEMPLATES = path.resolve(ROOT, process.env.TEMPLATES_DIR || 'templates');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    description: { type: 'string' },
    from: { type: 'string', default: '_starter' },
    publish: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
});

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const id = positionals[0];
if (values.help || !id) {
  console.log('Cách dùng: npm run template:new -- <id> [--name "Tên"] [--description "Mô tả"] [--from _starter] [--publish]');
  process.exit(values.help ? 0 : 1);
}
if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) fail('id chỉ gồm chữ thường không dấu, số và dấu "-" (2–41 ký tự), ví dụ: vuon-xanh');

const source = path.join(TEMPLATES, values.from);
const target = path.join(TEMPLATES, id);
if (values.from === '_shared' || !fs.existsSync(path.join(source, 'template.json'))) fail(`Không tìm thấy template nguồn "${values.from}"`);
if (fs.existsSync(target)) fail(`Thư mục templates/${id} đã tồn tại`);

fs.cpSync(source, target, { recursive: true, filter: (src) => !src.endsWith('README.md') || values.from !== '_starter' });

const manifestPath = path.join(target, 'template.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.name = values.name || id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
if (values.description) manifest.description = values.description;
else if (values.from === '_starter') manifest.description = `Mẫu thiệp ${manifest.name}`;
manifest.published = values.publish;
manifest.version = '1.0.0';
manifest.order = 50;
const existingTags = (manifest.tags || []).filter((t) => t !== 'mẫu gốc');
manifest.tags = existingTags;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`✓ Đã tạo templates/${id} (từ ${values.from})`);
console.log('');
console.log('Bước tiếp theo:');
console.log(`  1. Sửa templates/${id}/style.css và template.json (màu, font, hiệu ứng)`);
console.log(`  2. npm run dev  →  mở /templates/${id}${values.publish ? '' : ' (đăng nhập admin vì mẫu chưa publish)'}`);
console.log(`  3. npm run template:preview ${id}   (chụp ảnh preview.webp)`);
console.log(`  4. npm run template:validate`);
console.log(`  Hướng dẫn chi tiết: templates/_starter/README.md`);
