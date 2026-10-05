import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { Group } from '../components/fields.jsx';
import { toast } from '../components/toast.jsx';
import { formatDateTime } from '../util.js';

const ATT = { yes: ['Tham dự', 'badge--ok'], no: ['Không đến', 'badge--danger'], maybe: ['Chưa chắc', 'badge--draft'] };
const SIDE = { groom: 'Nhà trai', bride: 'Nhà gái' };

export function GuestsPanel({ inv, ctx }) {
  const [rsvps, setRsvps] = useState(null);
  const [stats, setStats] = useState(null);
  const [wishes, setWishes] = useState(null);
  const [filter, setFilter] = useState('all');

  async function load() {
    try {
      const [r, w] = await Promise.all([
        api(`/api/invitations/${inv.id}/rsvps`, { token: ctx.token }),
        api(`/api/invitations/${inv.id}/wishes`, { token: ctx.token }),
      ]);
      setRsvps(r.items);
      setStats(r.stats);
      setWishes(w.items);
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  useEffect(() => {
    load();
  }, [inv.id]);

  async function exportCsv() {
    try {
      const res = await fetch(`/api/invitations/${inv.id}/rsvps?format=csv`, { headers: ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {} });
      if (!res.ok) throw new Error('Không xuất được file');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `xac-nhan-${inv.slug}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function removeRsvp(id) {
    if (!confirm('Xoá phản hồi này?')) return;
    await api(`/api/invitations/${inv.id}/rsvps/${id}`, { method: 'DELETE', token: ctx.token }).catch((e) => toast(e.message, 'error'));
    load();
  }
  async function toggleWish(w) {
    await api(`/api/invitations/${inv.id}/wishes/${w.id}`, { method: 'PATCH', token: ctx.token, body: { hidden: !w.hidden } }).catch((e) => toast(e.message, 'error'));
    load();
  }
  async function removeWish(w) {
    if (!confirm('Xoá lời chúc này?')) return;
    await api(`/api/invitations/${inv.id}/wishes/${w.id}`, { method: 'DELETE', token: ctx.token }).catch((e) => toast(e.message, 'error'));
    load();
  }

  if (!rsvps) return <p class="muted">Đang tải…</p>;
  const shown = filter === 'all' ? rsvps : rsvps.filter((r) => r.attending === filter);

  return (
    <>
      <div class="stats">
        <div class="stat"><strong>{stats.guestsYes}</strong><span>khách sẽ đến</span></div>
        <div class="stat"><strong>{stats.yes}</strong><span>phản hồi tham dự</span></div>
        <div class="stat"><strong>{stats.maybe}</strong><span>chưa chắc</span></div>
        <div class="stat"><strong>{stats.no}</strong><span>không đến</span></div>
      </div>
      <Group
        title={`Xác nhận tham dự (${rsvps.length})`}
        actions={
          <>
            <button type="button" class="btn btn--sm btn--ghost" onClick={load}>Làm mới</button>
            <button type="button" class="btn btn--sm" onClick={exportCsv} disabled={!rsvps.length}>Xuất Excel (CSV)</button>
          </>
        }
      >
        <div class="segmented segmented--sm">
          {[['all', 'Tất cả'], ['yes', 'Tham dự'], ['maybe', 'Chưa chắc'], ['no', 'Không đến']].map(([k, l]) => (
            <button type="button" key={k} class={filter === k ? 'is-active' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        {!shown.length && <p class="empty">Chưa có phản hồi nào. Gửi link thiệp cho khách để bắt đầu nhận xác nhận.</p>}
        <ul class="rsvp-list">
          {shown.map((r) => (
            <li key={r.id}>
              <div class="rsvp-list__main">
                <strong>{r.name}</strong>
                <span class={`badge ${ATT[r.attending][1]}`}>{ATT[r.attending][0]}{r.attending !== 'no' ? ` · ${r.guests} người` : ''}</span>
              </div>
              <div class="rsvp-list__meta">
                {[r.contact, SIDE[r.side], formatDateTime(r.updated_at)].filter(Boolean).join(' · ')}
              </div>
              {r.message && <p class="rsvp-list__msg">“{r.message}”</p>}
              <button type="button" class="icon-btn icon-btn--danger rsvp-list__del" title="Xoá" onClick={() => removeRsvp(r.id)}>✕</button>
            </li>
          ))}
        </ul>
      </Group>
      <Group title={`Sổ lưu bút (${wishes.length})`} description="Ẩn những lời chúc không phù hợp — khách sẽ không thấy nữa.">
        {!wishes.length && <p class="empty">Chưa có lời chúc nào.</p>}
        <ul class="rsvp-list">
          {wishes.map((w) => (
            <li key={w.id} class={w.hidden ? 'is-hidden' : ''}>
              <div class="rsvp-list__main">
                <strong>{w.name}</strong>
                {w.hidden ? <span class="badge badge--draft">Đang ẩn</span> : null}
              </div>
              <p class="rsvp-list__msg">{w.message}</p>
              <div class="row row--center">
                <button type="button" class="link-btn" onClick={() => toggleWish(w)}>{w.hidden ? 'Hiện lại' : 'Ẩn'}</button>
                <button type="button" class="link-btn link-btn--danger" onClick={() => removeWish(w)}>Xoá</button>
              </div>
            </li>
          ))}
        </ul>
      </Group>
    </>
  );
}
