import { useState } from 'preact/hooks';
import { api } from '../api.js';
import { Segmented, TextField } from '../components/fields.jsx';
import { toast } from '../components/toast.jsx';
import { myInvitations } from '../store.js';
import { copyText, coupleTitle } from '../util.js';

export function NewInvitation({ meta, navigate }) {
  const params = new URLSearchParams(location.search);
  const initial = meta.templates.find((t) => t.id === params.get('template'))?.id || meta.templates[0]?.id || '';
  const [step, setStep] = useState(params.get('template') ? 2 : 1);
  const [templateId, setTemplateId] = useState(initial);
  const [form, setForm] = useState({ groomName: '', brideName: '', date: '', time: '11:00', venue: '', address: '', tone: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const template = meta.templates.find((t) => t.id === templateId);

  if (!meta.allowPublicCreate && !meta.isAdmin) {
    return (
      <div class="center-page">
        <div class="card card--narrow">
          <h1>Tạo thiệp đang tạm đóng</h1>
          <p class="muted">Vui lòng liên hệ quản trị viên để được tạo thiệp.</p>
        </div>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.groomName.trim()) errs.groomName = 'Vui lòng nhập tên chú rể';
    if (!form.brideName.trim()) errs.brideName = 'Vui lòng nhập tên cô dâu';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      const body = { ...form, templateId };
      if (!body.tone) delete body.tone;
      const r = await api('/api/invitations', { method: 'POST', body });
      const inv = r.invitation;
      myInvitations.save({ id: inv.id, token: r.editToken, slug: inv.slug, title: coupleTitle(inv.data) });
      setCreated(r);
    } catch (err) {
      toast(err.message, 'error', 5000);
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const editPath = `/edit/${created.invitation.id}#token=${created.editToken}`;
    return (
      <div class="center-page">
        <div class="card card--narrow created">
          <div class="created__icon" aria-hidden="true">🎉</div>
          <h1>Thiệp của bạn đã sẵn sàng!</h1>
          <p class="muted">Lời mời, lịch âm, đếm ngược, bản đồ… đã được tạo tự động. Hãy lưu lại <strong>link chỉnh sửa bí mật</strong> dưới đây — đây là cách duy nhất để sửa thiệp từ thiết bị khác.</p>
          <div class="copy-row">
            <code class="secret">{created.editUrl}</code>
            <button type="button" class="btn btn--sm" onClick={async () => toast((await copyText(created.editUrl)) ? 'Đã sao chép link chỉnh sửa' : 'Hãy chép thủ công')}>Sao chép</button>
          </div>
          <p class="hint">💡 Mẹo: gửi link này vào Zalo “Cloud của tôi” hoặc email cho chính mình.</p>
          <button type="button" class="btn btn--primary btn--block" onClick={() => navigate(editPath)}>Bắt đầu chỉnh sửa →</button>
        </div>
      </div>
    );
  }

  return (
    <div class="wizard">
      <ol class="wizard__steps">
        <li class={step === 1 ? 'is-active' : 'is-done'}><button type="button" onClick={() => setStep(1)}>1. Chọn mẫu</button></li>
        <li class={step === 2 ? 'is-active' : ''}>2. Thông tin cưới</li>
      </ol>

      {step === 1 && (
        <section>
          <h1 class="wizard__title">Chọn mẫu thiệp bạn thích</h1>
          <p class="muted center">Bạn có thể đổi mẫu, màu sắc và font bất cứ lúc nào sau này.</p>
          <div class="pick-grid">
            {meta.templates.map((t) => (
              <article key={t.id} class={`pick${t.id === templateId ? ' is-active' : ''}`}>
                <button type="button" class="pick__thumb" onClick={() => (setTemplateId(t.id), setStep(2))} style={{ background: t.defaults.theme.colors.background }}>
                  {t.previewUrl ? <img src={t.previewUrl} alt={`Mẫu ${t.name}`} loading="lazy" /> : <span>{t.name}</span>}
                </button>
                <div class="pick__body">
                  <h3>{t.name}</h3>
                  <p>{t.description}</p>
                  <div class="row row--center">
                    <a class="btn btn--sm btn--ghost" href={t.demoUrl} target="_blank" rel="noopener">Xem thử ↗</a>
                    <button type="button" class="btn btn--sm" onClick={() => (setTemplateId(t.id), setStep(2))}>Chọn mẫu này</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section class="wizard__form-wrap">
          <div class="wizard__chosen">
            {template?.previewUrl && <img src={template.previewUrl} alt="" />}
            <div>
              <p class="muted">Mẫu đã chọn</p>
              <strong>{template?.name}</strong>
              <button type="button" class="link-btn" onClick={() => setStep(1)}>Đổi mẫu</button>
            </div>
          </div>
          <form class="card wizard__form" onSubmit={submit} noValidate>
            <h1 class="wizard__title">Chỉ cần vài thông tin</h1>
            <p class="muted">Phần còn lại (lời mời, lịch âm, câu chuyện, lời cảm ơn…) sẽ được viết sẵn cho bạn.</p>
            <div class="row">
              <TextField label="Tên chú rể *" placeholder="Nguyễn Văn Minh" value={form.groomName} onInput={set('groomName')} maxLength={80} error={errors.groomName} autoComplete="off" />
              <TextField label="Tên cô dâu *" placeholder="Trần Thị Thu Hà" value={form.brideName} onInput={set('brideName')} maxLength={80} error={errors.brideName} autoComplete="off" />
            </div>
            <div class="row">
              <TextField label="Ngày cưới" type="date" value={form.date} onInput={set('date')} hint="Có thể bổ sung sau" />
              <TextField label="Giờ tiệc" type="time" value={form.time} onInput={set('time')} />
            </div>
            <TextField label="Nơi tổ chức tiệc" placeholder="VD: Trung tâm tiệc cưới Riverside" value={form.venue} onInput={set('venue')} maxLength={120} />
            <TextField label="Địa chỉ" placeholder="Số nhà, đường, phường, quận, tỉnh/thành" value={form.address} onInput={set('address')} maxLength={250} />
            <Segmented
              label="Giọng văn"
              value={form.tone || template?.defaults.tone}
              onChange={set('tone')}
              options={meta.tones.map((t) => ({ value: t.id, label: t.label }))}
            />
            <button type="submit" class="btn btn--primary btn--block btn--lg" disabled={submitting}>
              {submitting ? 'Đang tạo thiệp…' : '✨ Tạo thiệp'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
