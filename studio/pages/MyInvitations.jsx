import { useState } from 'preact/hooks';
import { myInvitations } from '../store.js';
import { formatDateTime } from '../util.js';

export function MyInvitations({ meta, navigate }) {
  const [list, setList] = useState(myInvitations.list());
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');

  function openLink(e) {
    e.preventDefault();
    try {
      const url = new URL(link.trim(), location.origin);
      const m = /^\/edit\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
      const token = new URLSearchParams(url.hash.slice(1)).get('token');
      if (!m || !token) throw new Error();
      navigate(`/edit/${m[1]}#token=${token}`);
    } catch {
      setLinkError('Link không đúng định dạng …/edit/<mã>#token=<mã bí mật>');
    }
  }

  return (
    <div class="page-narrow">
      <header class="page-head">
        <h1>Thiệp của tôi</h1>
        {(meta.allowPublicCreate || meta.isAdmin) && <a class="btn btn--primary" href="/new" onClick={(e) => (e.preventDefault(), navigate('/new'))}>+ Tạo thiệp mới</a>}
      </header>
      <p class="muted">Danh sách các thiệp đã tạo hoặc mở trên trình duyệt này.</p>
      {!list.length && <div class="empty-card">Chưa có thiệp nào trên thiết bị này.</div>}
      <ul class="inv-list">
        {list.map((x) => (
          <li key={x.id} class="inv-list__item">
            <div>
              <strong>{x.title || x.id}</strong>
              <span class="muted">Cập nhật {formatDateTime(x.updatedAt)}{x.slug ? ` · /w/${x.slug}` : ''}</span>
            </div>
            <div class="row">
              {x.slug && <a class="btn btn--sm btn--ghost" href={`/w/${x.slug}`} target="_blank" rel="noopener">Xem</a>}
              <a class="btn btn--sm" href={`/edit/${x.id}`} onClick={(e) => (e.preventDefault(), navigate(`/edit/${x.id}`))}>Chỉnh sửa</a>
              <button
                type="button"
                class="icon-btn"
                title="Bỏ khỏi danh sách (không xoá thiệp)"
                onClick={() => {
                  if (!confirm('Bỏ thiệp khỏi danh sách trên thiết bị này? (Thiệp vẫn còn — bạn cần link chỉnh sửa để mở lại)')) return;
                  myInvitations.remove(x.id);
                  setList(myInvitations.list());
                }}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form class="card open-link" onSubmit={openLink}>
        <h2>Mở thiệp bằng link chỉnh sửa</h2>
        <p class="muted">Dán link chỉnh sửa bí mật bạn đã lưu khi tạo thiệp.</p>
        <div class="row">
          <input class="input" value={link} onInput={(e) => (setLink(e.currentTarget.value), setLinkError(''))} placeholder={`${location.origin}/edit/…#token=…`} />
          <button type="submit" class="btn" disabled={!link.trim()}>Mở</button>
        </div>
        {linkError && <p class="field__error">{linkError}</p>}
      </form>
    </div>
  );
}
