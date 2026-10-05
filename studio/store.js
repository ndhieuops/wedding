/** Invitations created on this device are remembered (id + secret edit token) in localStorage. */
const KEY = 'wedding-studio:invitations';

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode / storage full: the edit link still works */
  }
}

export const myInvitations = {
  list: () => read().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  get: (id) => read().find((x) => x.id === id) || null,
  save(entry) {
    const list = read().filter((x) => x.id !== entry.id);
    list.push({ ...(read().find((x) => x.id === entry.id) || {}), ...entry, updatedAt: new Date().toISOString() });
    write(list);
  },
  remove(id) {
    write(read().filter((x) => x.id !== id));
  },
};
