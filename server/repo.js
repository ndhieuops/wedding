import { nameKey } from './lib/text.js';

const now = () => new Date().toISOString();

/** Thin data-access layer over better-sqlite3 (synchronous, prepared statements). */
export function createRepo(db) {
  const st = {
    insertInvitation: db.prepare(`
      INSERT INTO invitations (id, slug, template_id, data, status, edit_token_hash, version, created_at, updated_at)
      VALUES (@id, @slug, @template_id, @data, 'draft', @edit_token_hash, 1, @now, @now)`),
    byId: db.prepare('SELECT * FROM invitations WHERE id = ?'),
    bySlug: db.prepare('SELECT * FROM invitations WHERE slug = ?'),
    slugTaken: db.prepare('SELECT 1 FROM invitations WHERE slug = ? UNION SELECT 1 FROM slug_history WHERE slug = ? AND invitation_id != ?'),
    historySlug: db.prepare('SELECT invitation_id FROM slug_history WHERE slug = ?'),
    addHistory: db.prepare('INSERT OR REPLACE INTO slug_history (slug, invitation_id, created_at) VALUES (?, ?, ?)'),
    dropHistory: db.prepare('DELETE FROM slug_history WHERE slug = ?'),
    update: db.prepare(`
      UPDATE invitations SET data = @data, template_id = @template_id, version = version + 1, updated_at = @now
      WHERE id = @id AND version = @version`),
    setSlug: db.prepare('UPDATE invitations SET slug = ?, updated_at = ? WHERE id = ?'),
    setStatus: db.prepare(`
      UPDATE invitations SET status = @status, updated_at = @now,
        published_at = CASE WHEN @status = 'published' THEN COALESCE(published_at, @now) ELSE published_at END
      WHERE id = @id`),
    setToken: db.prepare('UPDATE invitations SET edit_token_hash = ? WHERE id = ?'),
    bumpViews: db.prepare('UPDATE invitations SET view_count = view_count + 1 WHERE id = ?'),
    delete: db.prepare('DELETE FROM invitations WHERE id = ?'),
    count: db.prepare(`SELECT
        COUNT(*) AS total,
        SUM(status = 'published') AS published,
        SUM(status = 'draft') AS draft,
        SUM(status = 'disabled') AS disabled,
        COALESCE(SUM(view_count), 0) AS views
      FROM invitations`),

    upsertRsvp: db.prepare(`
      INSERT INTO rsvps (invitation_id, name, name_key, contact, attending, guests, side, message, created_at, updated_at)
      VALUES (@invitation_id, @name, @name_key, @contact, @attending, @guests, @side, @message, @now, @now)
      ON CONFLICT (invitation_id, name_key, contact) DO UPDATE SET
        name = excluded.name, attending = excluded.attending, guests = excluded.guests,
        side = excluded.side, message = excluded.message, updated_at = excluded.updated_at`),
    listRsvps: db.prepare('SELECT * FROM rsvps WHERE invitation_id = ? ORDER BY updated_at DESC'),
    rsvpStats: db.prepare(`SELECT
        COUNT(*) AS responses,
        COALESCE(SUM(CASE WHEN attending = 'yes' THEN guests ELSE 0 END), 0) AS guestsYes,
        SUM(attending = 'yes') AS yes, SUM(attending = 'no') AS no, SUM(attending = 'maybe') AS maybe
      FROM rsvps WHERE invitation_id = ?`),
    deleteRsvp: db.prepare('DELETE FROM rsvps WHERE id = ? AND invitation_id = ?'),
    totalRsvps: db.prepare('SELECT COUNT(*) AS n FROM rsvps'),

    insertWish: db.prepare('INSERT INTO wishes (invitation_id, name, message, created_at) VALUES (?, ?, ?, ?)'),
    listWishes: db.prepare('SELECT id, name, message, hidden, created_at FROM wishes WHERE invitation_id = ? ORDER BY id DESC LIMIT ?'),
    listVisibleWishes: db.prepare('SELECT id, name, message, created_at FROM wishes WHERE invitation_id = ? AND hidden = 0 ORDER BY id DESC LIMIT ?'),
    setWishHidden: db.prepare('UPDATE wishes SET hidden = ? WHERE id = ? AND invitation_id = ?'),
    deleteWish: db.prepare('DELETE FROM wishes WHERE id = ? AND invitation_id = ?'),

    insertAsset: db.prepare(`
      INSERT INTO assets (id, invitation_id, kind, file, thumb, mime, width, height, bytes, created_at)
      VALUES (@id, @invitation_id, @kind, @file, @thumb, @mime, @width, @height, @bytes, @now)`),
    assetsFor: db.prepare('SELECT * FROM assets WHERE invitation_id = ?'),
    assetCount: db.prepare('SELECT COUNT(*) AS n FROM assets WHERE invitation_id = ? AND kind = ?'),
    deleteAsset: db.prepare('DELETE FROM assets WHERE id = ?'),
    staleAssets: db.prepare('SELECT a.*, i.data AS invitation_data FROM assets a JOIN invitations i ON i.id = a.invitation_id WHERE a.created_at < ?'),
  };

  return {
    db,
    createInvitation({ id, slug, templateId, data, editTokenHash }) {
      st.insertInvitation.run({
        id,
        slug,
        template_id: templateId,
        data: JSON.stringify(data),
        edit_token_hash: editTokenHash,
        now: now(),
      });
      return this.getInvitation(id);
    },

    getInvitation(id) {
      return hydrate(st.byId.get(id));
    },

    /** Resolve a public slug; also follows renamed slugs so old shared links keep working. */
    findBySlug(slug) {
      const row = st.bySlug.get(slug);
      if (row) return { invitation: hydrate(row), redirected: false };
      const hist = st.historySlug.get(slug);
      if (hist) {
        const inv = hydrate(st.byId.get(hist.invitation_id));
        if (inv) return { invitation: inv, redirected: true };
      }
      return { invitation: null, redirected: false };
    },

    isSlugAvailable(slug, invitationId = '') {
      return !st.slugTaken.get(slug, slug, invitationId);
    },

    /** Optimistic concurrency: returns null when `version` is stale (someone else saved first). */
    updateInvitation(id, { data, templateId, version }) {
      const res = st.update.run({ id, data: JSON.stringify(data), template_id: templateId, version, now: now() });
      return res.changes ? this.getInvitation(id) : null;
    },

    changeSlug(id, newSlug) {
      return db.transaction(() => {
        const current = st.byId.get(id);
        if (!current || current.slug === newSlug) return;
        st.dropHistory.run(newSlug);
        st.addHistory.run(current.slug, id, now());
        st.setSlug.run(newSlug, now(), id);
      })();
    },

    setStatus(id, status) {
      st.setStatus.run({ id, status, now: now() });
      return this.getInvitation(id);
    },

    setEditTokenHash(id, hash) {
      st.setToken.run(hash, id);
    },

    bumpViews(id) {
      st.bumpViews.run(id);
    },

    deleteInvitation(id) {
      return st.delete.run(id).changes > 0;
    },

    listInvitations({ q = '', status = '', limit = 20, offset = 0 } = {}) {
      const where = [];
      const params = {};
      if (status) {
        where.push('status = @status');
        params.status = status;
      }
      if (q) {
        where.push('(slug LIKE @q OR data LIKE @q OR id = @exact)');
        params.q = `%${q.replace(/[%_]/g, '')}%`;
        params.exact = q;
      }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = db
        .prepare(`SELECT * FROM invitations ${clause} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`)
        .all({ ...params, limit, offset });
      const { n } = db.prepare(`SELECT COUNT(*) AS n FROM invitations ${clause}`).get(params);
      return { items: rows.map(hydrate), total: n };
    },

    stats() {
      const c = st.count.get();
      return {
        total: c.total || 0,
        published: c.published || 0,
        draft: c.draft || 0,
        disabled: c.disabled || 0,
        views: c.views || 0,
        rsvps: st.totalRsvps.get().n,
      };
    },

    /* ---------------- RSVP ---------------- */
    saveRsvp(invitationId, r) {
      st.upsertRsvp.run({
        invitation_id: invitationId,
        name: r.name,
        name_key: nameKey(r.name),
        contact: r.contact || '',
        attending: r.attending,
        guests: r.attending === 'no' ? 0 : r.guests,
        side: r.side || '',
        message: r.message || '',
        now: now(),
      });
    },
    listRsvps(invitationId) {
      return st.listRsvps.all(invitationId);
    },
    rsvpStats(invitationId) {
      const s = st.rsvpStats.get(invitationId);
      return { responses: s.responses || 0, guestsYes: s.guestsYes || 0, yes: s.yes || 0, no: s.no || 0, maybe: s.maybe || 0 };
    },
    deleteRsvp(invitationId, rsvpId) {
      return st.deleteRsvp.run(rsvpId, invitationId).changes > 0;
    },

    /* ---------------- Wishes ---------------- */
    addWish(invitationId, { name, message }) {
      const info = st.insertWish.run(invitationId, name, message, now());
      return { id: Number(info.lastInsertRowid), name, message, created_at: now() };
    },
    listWishes(invitationId, { includeHidden = false, limit = 200 } = {}) {
      return includeHidden ? st.listWishes.all(invitationId, limit) : st.listVisibleWishes.all(invitationId, limit);
    },
    setWishHidden(invitationId, wishId, hidden) {
      return st.setWishHidden.run(hidden ? 1 : 0, wishId, invitationId).changes > 0;
    },
    deleteWish(invitationId, wishId) {
      return st.deleteWish.run(wishId, invitationId).changes > 0;
    },

    /* ---------------- Assets ---------------- */
    addAsset(asset) {
      st.insertAsset.run({ thumb: null, width: null, height: null, ...asset, now: now() });
    },
    listAssets(invitationId) {
      return st.assetsFor.all(invitationId);
    },
    countAssets(invitationId, kind) {
      return st.assetCount.get(invitationId, kind).n;
    },
    deleteAsset(id) {
      st.deleteAsset.run(id);
    },
    assetsOlderThan(iso) {
      return st.staleAssets.all(iso);
    },
  };
}

function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    templateId: row.template_id,
    data: JSON.parse(row.data),
    status: row.status,
    editTokenHash: row.edit_token_hash,
    version: row.version,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}
