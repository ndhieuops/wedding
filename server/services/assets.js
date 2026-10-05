import fs from 'node:fs';
import path from 'node:path';
import { referencedAssetIds } from '../lib/schema.js';
import { randomId } from '../lib/security.js';
import { MediaError, processImage, validateAudio } from '../lib/media.js';

function invitationDir(config, invitationId) {
  return path.join(config.uploadsDir, invitationId);
}

/** Validate, normalise and store an uploaded file. Returns the asset reference saved into invitation data. */
export async function storeUpload({ config, repo, invitationId, buffer, kind }) {
  const dir = invitationDir(config, invitationId);
  fs.mkdirSync(dir, { recursive: true });
  const id = randomId(10);

  if (kind === 'audio') {
    if (buffer.length > config.maxAudioBytes) throw new MediaError(`File nhạc tối đa ${Math.round(config.maxAudioBytes / 1048576)}MB.`, 413);
    if (repo.countAssets(invitationId, 'audio') >= 5) throw new MediaError('Mỗi thiệp chỉ được tải lên tối đa 5 file nhạc.', 409);
    const type = validateAudio(buffer);
    const file = `${id}.${type.ext}`;
    await fs.promises.writeFile(path.join(dir, file), buffer);
    repo.addAsset({ id, invitation_id: invitationId, kind: 'audio', file, mime: type.mime, bytes: buffer.length });
    return { id, url: `/uploads/${invitationId}/${file}` };
  }

  if (buffer.length > config.maxImageBytes) throw new MediaError(`Ảnh tối đa ${Math.round(config.maxImageBytes / 1048576)}MB.`, 413);
  if (repo.countAssets(invitationId, 'image') >= config.maxImagesPerInvitation) {
    throw new MediaError(`Mỗi thiệp chỉ được tải lên tối đa ${config.maxImagesPerInvitation} ảnh.`, 409);
  }
  const img = await processImage(buffer);
  const file = `${id}.webp`;
  const thumb = `${id}_t.webp`;
  await Promise.all([fs.promises.writeFile(path.join(dir, file), img.full), fs.promises.writeFile(path.join(dir, thumb), img.thumb)]);
  repo.addAsset({
    id,
    invitation_id: invitationId,
    kind: 'image',
    file,
    thumb,
    mime: img.mime,
    width: img.width,
    height: img.height,
    bytes: img.full.length + img.thumb.length,
  });
  return { id, url: `/uploads/${invitationId}/${file}`, thumb: `/uploads/${invitationId}/${thumb}`, w: img.width, h: img.height };
}

export function removeInvitationFiles(config, invitationId) {
  fs.rmSync(invitationDir(config, invitationId), { recursive: true, force: true });
}

/**
 * Delete uploads that are no longer referenced by their invitation (photo replaced, gallery item removed…).
 * A grace period keeps recently uploaded files so "undo" and unsaved drafts never lose pictures.
 */
export function collectGarbage({ config, repo, log }) {
  const cutoff = new Date(Date.now() - config.assetGcGraceHours * 3600 * 1000).toISOString();
  let removed = 0;
  for (const asset of repo.assetsOlderThan(cutoff)) {
    let referenced;
    try {
      referenced = referencedAssetIds(JSON.parse(asset.invitation_data));
    } catch {
      continue;
    }
    if (referenced.has(asset.id)) continue;
    const dir = invitationDir(config, asset.invitation_id);
    for (const f of [asset.file, asset.thumb].filter(Boolean)) fs.rmSync(path.join(dir, f), { force: true });
    repo.deleteAsset(asset.id);
    removed++;
  }
  if (removed) log?.info?.({ removed }, 'Asset GC removed unused uploads');
  return removed;
}

export function startAssetGc({ config, repo, log }) {
  const run = () => {
    try {
      collectGarbage({ config, repo, log });
    } catch (err) {
      log?.error?.({ err }, 'Asset GC failed');
    }
  };
  const first = setTimeout(run, 30_000);
  const timer = setInterval(run, 60 * 60 * 1000);
  first.unref();
  timer.unref();
  return { stop: () => (clearTimeout(first), clearInterval(timer)) };
}
