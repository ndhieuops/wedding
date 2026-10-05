import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { toast } from '../components/toast.jsx';
import { copyText, formatDateTime } from '../util.js';

const STATUS = { draft: ['Nháp', 'badge--draft'], published: ['Công bố', 'badge--ok'], disabled: ['Khoá', 'badge--danger'] };

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: { password } });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="center-page">
      <form class="card card--narrow" onSubmit={submit}>
        <h1>Quản trị</h1>
        <p class="muted">Đăng nhập bằng mật khẩu ADMIN_PASSWORD.</p>
        <input class="input" type="password" autoComplete="current-password" value={password} onInput={(e) => setPassword(e.currentTarget.value)} placeholder="Mật khẩu" autoFocus />
        {error && <p class="field__error">{error}</p>}
        <button type="submit" class="btn btn--primary btn--block" disabled={busy || !password}>{busy ? 'Đang kiểm tra…' : 'Đăng nhập'}</button>
      </form>
    </div>
  );
}

export function Admin({ navigate, refreshMeta }) {
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [list, setList] = useState(null);
  const [query, setQuery] = useState({ q: '', status: '', page: 1 });
  const [templates, setTemplates] = useState(null);

  const checkSession = () => api('/api/admin/session').then(setSession).catch(() => setSession({ enabled: false }));
  useEffect(() => {
    checkSession();
  }, []);

  async function loadAll() {
    try {
      const qs = new URLSearchParams({ q: query.q, status: query.status, page: String(query.page) });
      const [s, l, t] = await Promise.all([api('/api/admin/stats'), api(`/api/admin/invitations?${qs}`), api('/api/admin/templates')]);
      setStats(s);
      setList(l);
      setTemplates(t);
    } catch (err) {
      if (err.status === 401) setSession({ enabled: true, authenticated: false });
      else toast(err.message, 'error');
    }
  }
  useEffect(() => {
    if (!session?.authenticated) return undefined;
    const t = setTimeout(loadAll, query.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [session, query]);

  if (!session) return <div class="center-page"><div class="spinner" /></div>;
  if (!session.enabled) {
    return (
      <div class="center-page">
        <div class="card card--narrow">
          <h1>Trang quản trị đang tắt</h1>
          <p class="muted">Đặt biến môi trường <code>ADMIN_PASSWORD</code> (xem file .env) rồi khởi động lại để bật.</p>
        </div>
      </div>
    );
  }
  if (!session.authenticated) return <Login onDone={() => (checkSession(), refreshMeta())} />;

  async function setStatus(inv, status) {
    try {
      await api(`/api/admin/invitations/${inv.id}/status`, { method: 'POST', body: { status } });
      loadAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  async function resetToken(inv) {
    if (!confirm(`Cấp link chỉnh sửa mới cho thiệp ${inv.groom} & ${inv.bride}? Link cũ sẽ ngừng hoạt động.`)) return;
    try {
      const { editUrl } = await api(`/api/admin/invitations/${inv.id}/reset-token`, { method: 'POST' });
      await copyText(editUrl);
      prompt('Link chỉnh sửa mới (đã sao chép):', editUrl);
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  async function remove(inv) {
    if (!confirm(`Xoá vĩnh viễn thiệp ${inv.groom} & ${inv.bride}?`)) return;
    try {
      await api(`/api/invitations/${inv.id}`, { method: 'DELETE' });
      toast('Đã xoá');
      loadAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  async function reloadTemplates() {
    try {
      const r = await api('/api/admin/templates/reload', { method: 'POST' });
      toast(`Đã nạp ${r.count} mẫu${r.errors.length ? `, ${r.errors.length} lỗi` : ''}`);
      loadAll();
      refreshMeta();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  async function logout() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setSession({ enabled: true, authenticated: false });
    refreshMeta();
  }

  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div class="page-wide">
      <header class="page-head">
        <h1>Quản trị</h1>
        <button type="button" class="btn btn--ghost btn--sm" onClick={logout}>Đăng xuất</button>
      </header>
      {stats && (
        <div class="stats">
          <div class="stat"><strong>{stats.total}</strong><span>thiệp</span></div>
          <div class="stat"><strong>{stats.published}</strong><span>đã công bố</span></div>
          <div class="stat"><strong>{stats.views}</strong><span>lượt xem</span></div>
          <div class="stat"><strong>{stats.rsvps}</strong><span>xác nhận tham dự</span></div>
        </div>
      )}

      <section class="card">
        <div class="toolbar">
          <input class="input" placeholder="Tìm theo tên, đường dẫn…" value={query.q} onInput={(e) => setQuery({ ...query, q: e.currentTarget.value, page: 1 })} />
          <select class="input" value={query.status} onChange={(e) => setQuery({ ...query, status: e.currentTarget.value, page: 1 })}>
            <option value="">Mọi trạng thái</option>
            <option value="published">Đã công bố</option>
            <option value="draft">Nháp</option>
            <option value="disabled">Bị khoá</option>
          </select>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Cặp đôi</th><th>Ngày cưới</th><th>Mẫu</th><th>Trạng thái</th><th>Xem / RSVP</th><th>Cập nhật</th><th /></tr>
            </thead>
            <tbody>
              {list?.items.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.groom || '—'} & {inv.bride || '—'}</strong>
                    <br />
                    <a class="muted" href={inv.publicUrl} target="_blank" rel="noopener">/w/{inv.slug}</a>
                  </td>
                  <td>{inv.weddingDate || '—'}</td>
                  <td>{inv.templateId}</td>
                  <td><span class={`badge ${STATUS[inv.status][1]}`}>{STATUS[inv.status][0]}</span></td>
                  <td>{inv.views} / {inv.rsvp.responses}</td>
                  <td>{formatDateTime(inv.updatedAt)}</td>
                  <td>
                    <div class="table__actions">
                    <a class="btn btn--sm" href={`/edit/${inv.id}`} onClick={(e) => (e.preventDefault(), navigate(`/edit/${inv.id}`))}>Sửa</a>
                    <select class="input input--sm" value="" onChange={(e) => {
                      const v = e.currentTarget.value;
                      e.currentTarget.value = '';
                      if (v === 'token') resetToken(inv);
                      else if (v === 'delete') remove(inv);
                      else if (v) setStatus(inv, v);
                    }}>
                      <option value="">Thao tác…</option>
                      {inv.status !== 'published' && <option value="published">Công bố</option>}
                      {inv.status !== 'draft' && <option value="draft">Chuyển về nháp</option>}
                      {inv.status !== 'disabled' && <option value="disabled">Khoá thiệp</option>}
                      <option value="token">Cấp lại link chỉnh sửa</option>
                      <option value="delete">Xoá thiệp</option>
                    </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list && !list.items.length && <p class="empty">Không có thiệp nào.</p>}
        </div>
        {pages > 1 && (
          <div class="pager">
            <button type="button" class="btn btn--sm btn--ghost" disabled={query.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>‹ Trước</button>
            <span>Trang {query.page}/{pages}</span>
            <button type="button" class="btn btn--sm btn--ghost" disabled={query.page >= pages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Sau ›</button>
          </div>
        )}
      </section>

      <section class="card">
        <div class="page-head">
          <h2>Mẫu thiệp</h2>
          <button type="button" class="btn btn--sm" onClick={reloadTemplates}>Tải lại mẫu từ thư mục</button>
        </div>
        <ul class="inv-list">
          {templates?.templates.map((t) => (
            <li key={t.id} class="inv-list__item">
              <div>
                <strong>{t.name}</strong>
                <span class="muted">{t.id} · v{t.version}{t.published ? '' : ' · ẩn'}</span>
              </div>
              <a class="btn btn--sm btn--ghost" href={`/templates/${t.id}`} target="_blank" rel="noopener">Xem demo ↗</a>
            </li>
          ))}
        </ul>
        {templates?.errors.length > 0 && (
          <div class="banner banner--error">
            <strong>Mẫu bị lỗi (đang bị bỏ qua):</strong>
            <ul>{templates.errors.map((e) => <li key={e.id}><code>{e.id}</code>: {e.error}</li>)}</ul>
          </div>
        )}
      </section>
    </div>
  );
}
