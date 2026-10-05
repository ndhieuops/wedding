import { randomId } from './security.js';

/**
 * Short-lived in-memory store for live-preview HTML.
 * The editor POSTs draft data, receives `/preview/<key>`, and points an iframe at it.
 * Bounded in both size and age so it can never grow without limit.
 */
export function createPreviewStore({ maxEntries = 300, ttlMs = 10 * 60 * 1000 } = {}) {
  const store = new Map();

  function sweep() {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expires < now) store.delete(key);
    }
    while (store.size > maxEntries) store.delete(store.keys().next().value);
  }

  return {
    put(html, owner) {
      sweep();
      const key = randomId(20);
      store.set(key, { html, owner, expires: Date.now() + ttlMs });
      return key;
    },
    get(key) {
      const entry = store.get(key);
      if (!entry || entry.expires < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.html;
    },
    /** Drop older previews of the same invitation — only the latest few are ever displayed. */
    pruneOwner(owner, keep = 4) {
      const keys = [...store.entries()].filter(([, e]) => e.owner === owner).map(([k]) => k);
      keys.slice(0, Math.max(0, keys.length - keep)).forEach((k) => store.delete(k));
    },
    get size() {
      return store.size;
    },
  };
}
