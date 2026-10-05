import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import nunjucks from 'nunjucks';
import { z } from 'zod';
import { BOOT_SCRIPT } from '../lib/csp.js';
import { BURSTS, EFFECTS, FONTS, INTROS, NAME_ANIMATIONS, SECTION_KEYS, TAPS, TONES } from '../lib/schema.js';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'màu phải ở dạng #RRGGBB');
const colors = z.object({
  primary: color,
  secondary: color,
  background: color,
  surface: color,
  text: color,
  accent: color,
});
const fontFamily = z.enum(FONTS.map((f) => f.family), { message: 'font không nằm trong danh sách hỗ trợ (server/lib/schema.js → FONTS)' });
const relFile = z
  .string()
  .regex(/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/, 'đường dẫn file không hợp lệ')
  .refine((p) => !p.split('/').includes('..'), 'không được dùng ".."');

/** Contract every `templates/<id>/template.json` must satisfy. */
export const manifestSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).default(''),
  version: z.string().default('1.0.0'),
  author: z.string().default(''),
  tags: z.array(z.string().max(30)).max(8).default([]),
  published: z.boolean().default(true),
  order: z.number().default(100),
  preview: relFile.default('preview.svg'),
  entry: relFile.default('index.njk'),
  styles: z.array(relFile).default(['style.css']),
  scripts: z.array(relFile).default([]),
  defaults: z.object({
    tone: z.enum(TONES.map((t) => t.id)).default('classic'),
    theme: z.object({
      colors,
      fonts: z.object({ heading: fontFamily, body: fontFamily, script: fontFamily }),
      effect: z.enum(EFFECTS.map((e) => e.id)).default('petals'),
      effect2: z.enum(EFFECTS.map((e) => e.id)).default('none'),
      effectIntensity: z.enum(['low', 'medium', 'high']).default('medium'),
      burst: z.enum(BURSTS.map((e) => e.id)).default('none'),
      tap: z.enum(TAPS.map((e) => e.id)).default('none'),
      nameAnimation: z.enum(NAME_ANIMATIONS.map((e) => e.id)).default('fade'),
      intro: z.enum(INTROS.map((i) => i.id)).default('envelope'),
    }),
    sections: z
      .array(z.enum(SECTION_KEYS))
      .default(SECTION_KEYS)
      .refine((list) => list.includes('hero'), 'phải có section "hero"'),
  }),
  palettes: z.array(z.object({ name: z.string().max(40), colors })).max(8).default([]),
});

function hashFiles(files) {
  const h = crypto.createHash('sha1');
  for (const f of files) {
    try {
      h.update(fs.readFileSync(f));
    } catch {
      /* missing optional file */
    }
  }
  return h.digest('hex').slice(0, 10);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}

function addFilters(env) {
  const { escape } = nunjucks.lib;
  env.addFilter('nl2br', (value) => new nunjucks.runtime.SafeString(escape(String(value ?? '')).replace(/\n/g, '<br>')));
  env.addFilter('paragraphs', (value) => {
    const parts = String(value ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    return new nunjucks.runtime.SafeString(parts.map((p) => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`).join(''));
  });
  env.addFilter('pad2', (v) => String(v ?? '').padStart(2, '0'));
  env.addGlobal('bootScript', BOOT_SCRIPT);
}

/**
 * Discovers templates on disk and renders them with Nunjucks.
 *
 * Folder layout:
 *   templates/_shared/      layout, section partials, runtime JS/CSS used by every template
 *   templates/_starter/     the documented sample template (copied by `npm run template:new`)
 *   templates/<id>/         one folder per template — template.json + index.njk + style.css ...
 *
 * Template lookup order is [templates/<id>, templates/_shared], so a template can override
 * any shared partial (e.g. sections/hero.njk) just by creating a file with the same path.
 */
export function createTemplateRegistry({ templatesDir, hotReload = false, logger = console }) {
  const sharedDir = path.join(templatesDir, '_shared');
  let templates = new Map();
  let errors = [];
  let sharedVersion = '0';

  function loadOne(id, dir) {
    const manifestPath = path.join(dir, 'template.json');
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      throw new Error(`template.json không đọc được: ${err.message}`);
    }
    const parsed = manifestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => `${i.path.join('.') || '(gốc)'}: ${i.message}`).join('; '));
    }
    const manifest = parsed.data;
    for (const file of [manifest.entry, ...manifest.styles, ...manifest.scripts]) {
      if (!fs.existsSync(path.join(dir, file))) throw new Error(`thiếu file "${file}"`);
    }
    const env = new nunjucks.Environment(new nunjucks.FileSystemLoader([dir, sharedDir], { noCache: hotReload }), {
      autoescape: true,
      trimBlocks: true,
      lstripBlocks: true,
    });
    addFilters(env);
    const version = hashFiles(walk(dir));
    const hasPreview = fs.existsSync(path.join(dir, manifest.preview));
    return {
      id,
      dir,
      env,
      version,
      ...manifest,
      previewUrl: hasPreview ? `/t/${id}/${manifest.preview}?v=${version}` : null,
      styleUrls: manifest.styles.map((s) => `/t/${id}/${s}?v=${version}`),
      scriptUrls: manifest.scripts.map((s) => `/t/${id}/${s}?v=${version}`),
    };
  }

  function load() {
    const next = new Map();
    const nextErrors = [];
    if (!fs.existsSync(templatesDir)) {
      throw new Error(`Không tìm thấy thư mục templates: ${templatesDir}`);
    }
    if (!fs.existsSync(path.join(sharedDir, 'layout.njk'))) {
      throw new Error(`Thiếu templates/_shared/layout.njk — thư mục templates bị hỏng?`);
    }
    sharedVersion = hashFiles(walk(sharedDir));
    for (const entry of fs.readdirSync(templatesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === '_shared') continue;
      const id = entry.name;
      if (!/^_?[a-z0-9][a-z0-9-]{0,40}$/.test(id)) {
        nextErrors.push({ id, error: 'Tên thư mục chỉ gồm chữ thường, số và dấu "-"' });
        continue;
      }
      try {
        next.set(id, loadOne(id, path.join(templatesDir, id)));
      } catch (err) {
        nextErrors.push({ id, error: err.message });
        logger.warn?.({ template: id, err: err.message }, 'Bỏ qua template không hợp lệ');
      }
    }
    templates = next;
    errors = nextErrors;
    return { count: templates.size, errors };
  }

  function sorted(includeHidden) {
    return [...templates.values()]
      .filter((t) => includeHidden || (t.published && !t.id.startsWith('_')))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'vi'));
  }

  load();

  return {
    templatesDir,
    sharedDir,
    reload: load,
    get errors() {
      return errors;
    },
    sharedUrl: (file) => `/t/_shared/${file}?v=${sharedVersion}`,
    list({ includeHidden = false } = {}) {
      if (hotReload) load();
      return sorted(includeHidden);
    },
    get(id) {
      if (hotReload && id && !templates.has(id)) load();
      return templates.get(id) || null;
    },
    /** Template to use for an invitation — falls back to the first public template if the folder was removed. */
    resolve(id) {
      return this.get(id) || sorted(false)[0] || sorted(true)[0] || null;
    },
    isUsable(id) {
      return templates.has(id);
    },
    render(template, context) {
      return new Promise((resolve, reject) => {
        template.env.render(template.entry, context, (err, html) => (err ? reject(err) : resolve(html)));
      });
    },
  };
}
