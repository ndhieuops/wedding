import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { Group, TextArea, TextField } from '../components/fields.jsx';
import { toast } from '../components/toast.jsx';
import { copyText } from '../util.js';

const STATUS = { draft: ['Bản nháp', 'badge--draft'], published: ['Đã công bố', 'badge--ok'], disabled: ['Bị tạm khoá', 'badge--danger'] };

export function SharePanel({ inv, setInv, ctx, flush, onDeleted }) {
  const [busy, setBusy] = useState('');
  const [qr, setQr] = useState('');
  const [slug, setSlug] = useState(inv.slug);
  const [slugMsg, setSlugMsg] = useState(null);
  const [guest, setGuest] = useState('');
  const [guestList, setGuestList] = useState('');
  const [problems, setProblems] = useState([]);
  const publicUrl = `${location.origin}/w/${inv.slug}`;
  const guestUrl = (name) => `${publicUrl}?to=${encodeURIComponent(name.trim())}`;
  const editUrl = ctx.token ? `${location.origin}/edit/${inv.id}#token=${ctx.token}` : '';

  useEffect(() => {
    QRCode.toDataURL(publicUrl, { width: 480, margin: 2, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [publicUrl]);

  useEffect(() => {
    if (slug === inv.slug) return setSlugMsg(null);
    const t = setTimeout(async () => {
      try {
        const r = await api(`/api/invitations/${inv.id}/slug-check?slug=${encodeURIComponent(slug)}`, { token: ctx.token });
        setSlugMsg(r.available ? { ok: true, text: 'Có thể dùng đường dẫn này' } : { ok: false, text: r.reason });
      } catch (err) {
        setSlugMsg({ ok: false, text: err.message });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  async function run(name, fn) {
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      if (err.details && Array.isArray(err.details)) setProblems(err.details);
      toast(err.message, 'error', 5000);
    } finally {
      setBusy('');
    }
  }

  const publish = () =>
    run('publish', async () => {
      await flush();
      const { invitation } = await api(`/api/invitations/${inv.id}/publish`, { method: 'POST', token: ctx.token });
      setInv(invitation);
      setProblems([]);
      toast('🎉 Thiệp đã được công bố!', 'success');
    });
  const unpublish = () =>
    run('unpublish', async () => {
      const { invitation } = await api(`/api/invitations/${inv.id}/unpublish`, { method: 'POST', token: ctx.token });
      setInv(invitation);
      toast('Đã chuyển thiệp về bản nháp');
    });
  const saveSlug = () =>
    run('slug', async () => {
      const { invitation } = await api(`/api/invitations/${inv.id}/slug`, { method: 'PUT', token: ctx.token, body: { slug } });
      setInv(invitation);
      toast('Đã đổi đường dẫn. Link cũ vẫn tự chuyển hướng sang link mới.');
    });
  const remove = () =>
    run('delete', async () => {
      if (!confirm('Xoá vĩnh viễn thiệp này cùng toàn bộ ảnh, xác nhận tham dự và lời chúc? Không thể hoàn tác.')) return;
      await api(`/api/invitations/${inv.id}`, { method: 'DELETE', token: ctx.token });
      onDeleted();
    });

  const copy = async (text, msg = 'Đã sao chép') => toast((await copyText(text)) ? msg : 'Không sao chép được', 'info');
  const [label, cls] = STATUS[inv.status] || STATUS.draft;
  const shownProblems = problems.length ? problems : inv.problems || [];
  const names = guestList.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 300);

  return (
    <>
      <Group title="Trạng thái" actions={<span class={`badge ${cls}`}>{label}</span>}>
        {inv.status === 'published' ? (
          <p class="muted">Khách có link đều xem được thiệp. Mọi chỉnh sửa được cập nhật ngay lập tức.</p>
        ) : (
          <p class="muted">Thiệp đang ở chế độ nháp — chỉ bạn xem được trong trình chỉnh sửa.</p>
        )}
        {shownProblems.length > 0 && inv.status !== 'published' && (
          <ul class="checklist">
            {shownProblems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        <div class="row row--center">
          {inv.status === 'published' ? (
            <button type="button" class="btn btn--ghost" onClick={unpublish} disabled={!!busy}>Chuyển về nháp</button>
          ) : (
            <button type="button" class="btn btn--primary" onClick={publish} disabled={!!busy || inv.status === 'disabled'}>
              {busy === 'publish' ? 'Đang công bố…' : '🚀 Công bố thiệp'}
            </button>
          )}
          <a class="btn btn--ghost" href={publicUrl} target="_blank" rel="noopener">Mở thiệp ↗</a>
        </div>
      </Group>

      <Group title="Đường dẫn thiệp">
        <div class="copy-row">
          <code>{publicUrl}</code>
          <button type="button" class="btn btn--sm" onClick={() => copy(publicUrl, 'Đã sao chép link thiệp')}>Sao chép</button>
        </div>
        <TextField
          label="Tuỳ chỉnh đường dẫn"
          value={slug}
          maxLength={60}
          onInput={(v) => setSlug(v.toLowerCase().replace(/\s+/g, '-'))}
          error={slugMsg && !slugMsg.ok ? slugMsg.text : ''}
          hint={slugMsg?.ok ? `✓ ${slugMsg.text}` : `${location.host}/w/…`}
          suffix={<button type="button" class="btn btn--sm" disabled={slug === inv.slug || !slugMsg?.ok || !!busy} onClick={saveSlug}>Lưu</button>}
        />
        {qr && (
          <div class="qr-box">
            <img src={qr} alt="Mã QR tới thiệp" width="160" height="160" />
            <div>
              <p class="muted">In mã QR lên thiệp giấy hoặc bảng chào khách.</p>
              <a class="btn btn--sm" href={qr} download={`qr-${inv.slug}.png`}>Tải mã QR</a>
            </div>
          </div>
        )}
      </Group>

      <Group title="Link riêng cho từng khách" description="Thiệp sẽ hiện “Kính gửi: <tên khách>” và tên được điền sẵn trong form xác nhận.">
        <TextField
          label="Tên khách"
          placeholder="VD: Anh Tuấn & gia đình"
          value={guest}
          maxLength={60}
          onInput={setGuest}
          suffix={<button type="button" class="btn btn--sm" disabled={!guest.trim()} onClick={() => copy(guestUrl(guest), `Đã sao chép link cho ${guest.trim()}`)}>Sao chép link</button>}
        />
        <TextArea label="Tạo hàng loạt (mỗi dòng một khách)" rows={4} maxLength={10000} value={guestList} onInput={setGuestList} placeholder={'Anh Tuấn\nChị Lan & gia đình\nBác Ba'} />
        {names.length > 0 && (
          <>
            <ul class="guest-links">
              {names.slice(0, 50).map((n) => (
                <li key={n}>
                  <span>{n}</span>
                  <button type="button" class="link-btn" onClick={() => copy(guestUrl(n), `Đã sao chép link cho ${n}`)}>Sao chép</button>
                </li>
              ))}
            </ul>
            <button type="button" class="btn btn--sm" onClick={() => copy(names.map((n) => `${n}\t${guestUrl(n)}`).join('\n'), `Đã sao chép ${names.length} link (dán được vào Excel)`)}>
              Sao chép tất cả ({names.length})
            </button>
          </>
        )}
      </Group>

      {editUrl && (
        <Group title="🔑 Link chỉnh sửa bí mật" description="Ai có link này đều sửa được thiệp. Hãy lưu lại cẩn thận (ghi chú, email cho chính mình) và không gửi cho khách.">
          <div class="copy-row">
            <code class="secret">{editUrl}</code>
            <button type="button" class="btn btn--sm" onClick={() => copy(editUrl, 'Đã sao chép link chỉnh sửa')}>Sao chép</button>
          </div>
        </Group>
      )}

      <Group title="Vùng nguy hiểm">
        <button type="button" class="btn btn--danger" onClick={remove} disabled={!!busy}>Xoá thiệp vĩnh viễn</button>
      </Group>
    </>
  );
}
