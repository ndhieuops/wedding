#!/usr/bin/env node
/**
 * Validate every template: manifest schema, required files, and a full test render
 * with demo data (catches Nunjucks syntax errors and missing partials). Exit code 1 on failure.
 *
 *   npm run template:validate
 */
import fs from 'node:fs';
import path from 'node:path';
import { createTemplateRegistry } from '../server/templates/registry.js';
import { buildViewModel } from '../server/templates/view-model.js';
import { demoInvitation, DEMO_WISHES } from '../server/templates/demo.js';
import { parseInvitationData } from '../server/lib/schema.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const templatesDir = path.resolve(ROOT, process.env.TEMPLATES_DIR || 'templates');
const quiet = { warn() {}, info() {}, error() {} };
const registry = createTemplateRegistry({ templatesDir, logger: quiet });

let failed = 0;
for (const e of registry.errors) {
  failed++;
  console.error(`✗ ${e.id}: ${e.error}`);
}

for (const t of registry.list({ includeHidden: true })) {
  const problems = [];
  if (!t.previewUrl) problems.push(`thiếu ảnh preview "${t.preview}" (chạy: npm run template:preview ${t.id})`);
  else if (t.preview.endsWith('.svg')) problems.push('preview dạng SVG không dùng được làm ảnh chia sẻ mạng xã hội — nên dùng .webp/.png');
  try {
    // 1) full demo data, 2) almost empty data — both must render without throwing.
    for (const invitation of [demoInvitation(t), { id: 'x', slug: 'x', templateId: t.id, data: parseInvitationData({ groom: { fullName: 'A' }, bride: { fullName: 'B' } }) }]) {
      const vm = await buildViewModel({ invitation, template: t, registry, mode: 'demo', wishes: DEMO_WISHES });
      const html = await registry.render(t, vm);
      if (!html.includes('id="wedding-config"')) problems.push('trang không chứa #wedding-config — index.njk có kế thừa layout.njk không?');
    }
  } catch (err) {
    problems.push(`render lỗi: ${err.message.split('\n')[0]}`);
  }
  for (const css of t.styles) {
    const content = fs.readFileSync(path.join(t.dir, css), 'utf8');
    const hardcoded = content.match(/#[0-9a-fA-F]{6}\b/g) || [];
    if (hardcoded.length > 8) problems.push(`${css} có ${hardcoded.length} mã màu cố định — nên dùng biến --c-* để người dùng đổi màu được (cảnh báo)`);
  }
  const fatal = problems.filter((p) => p.startsWith('render') || p.startsWith('trang'));
  if (fatal.length) failed++;
  const status = fatal.length ? '✗' : problems.length ? '!' : '✓';
  console.log(`${status} ${t.id} — ${t.name}${t.published ? '' : ' (ẩn)'}`);
  problems.forEach((p) => console.log(`    · ${p}`));
}

console.log(failed ? `\n${failed} template lỗi.` : '\nTất cả template hợp lệ.');
process.exit(failed ? 1 : 0);
