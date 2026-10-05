import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { Preview } from '../components/Preview.jsx';
import { toast } from '../components/toast.jsx';
import { CouplePanel } from '../panels/CouplePanel.jsx';
import { ContentPanel } from '../panels/ContentPanel.jsx';
import { DesignPanel } from '../panels/DesignPanel.jsx';
import { EventsPanel } from '../panels/EventsPanel.jsx';
import { GiftPanel } from '../panels/GiftPanel.jsx';
import { GuestsPanel } from '../panels/GuestsPanel.jsx';
import { PhotosPanel } from '../panels/PhotosPanel.jsx';
import { SectionsPanel } from '../panels/SectionsPanel.jsx';
import { SharePanel } from '../panels/SharePanel.jsx';
import { StoryPanel } from '../panels/StoryPanel.jsx';
import { myInvitations } from '../store.js';
import { coupleTitle, getIn, setIn } from '../util.js';

const TABS = [
  { id: 'couple', label: 'Cặp đôi', icon: '💑', focus: 'hero' },
  { id: 'events', label: 'Sự kiện', icon: '📍', focus: 'events' },
  { id: 'content', label: 'Lời văn', icon: '✍️', focus: 'invitation' },
  { id: 'photos', label: 'Ảnh', icon: '🖼️', focus: 'gallery' },
  { id: 'story', label: 'Chuyện tình', icon: '💌', focus: 'story' },
  { id: 'gift', label: 'Mừng cưới', icon: '🎁', focus: 'gift' },
  { id: 'design', label: 'Giao diện', icon: '🎨', focus: 'hero' },
  { id: 'sections', label: 'Bố cục', icon: '🧩', focus: null },
  { id: 'share', label: 'Chia sẻ', icon: '🚀', focus: null },
  { id: 'guests', label: 'Khách mời', icon: '👥', focus: 'rsvp' },
];

const SAVE_LABEL = {
  saved: '✓ Đã lưu',
  dirty: 'Chưa lưu…',
  saving: 'Đang lưu…',
  offline: '⚠ Mất kết nối — sẽ thử lại',
  error: '⚠ Chưa lưu được',
  conflict: '⚠ Xung đột phiên bản',
};

/** Same merge as the server (view-model.js → effectiveSections). */
function effectiveSections(userSections, defaults, allKeys) {
  const out = [];
  const seen = new Set();
  for (const s of userSections || []) {
    if (allKeys.includes(s.key) && !seen.has(s.key)) {
      out.push({ key: s.key, enabled: s.key === 'hero' ? true : !!s.enabled });
      seen.add(s.key);
    }
  }
  for (const k of defaults) if (!seen.has(k)) (out.push({ key: k, enabled: true }), seen.add(k));
  for (const k of allKeys) if (!seen.has(k)) out.push({ key: k, enabled: false });
  const hero = out.findIndex((s) => s.key === 'hero');
  if (hero > 0) out.unshift(...out.splice(hero, 1));
  return out;
}

export function Editor({ id, meta, navigate }) {
  const [ctx, setCtx] = useState(null);
  const [inv, setInv] = useState(null);
  const [data, setData] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('couple');
  const [status, setStatus] = useState('saved');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState('');
  const [device, setDevice] = useState('mobile');
  const [replayKey, setReplayKey] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const dataRef = useRef(null);
  const templateRef = useRef('');
  const versionRef = useRef(0);
  const dirty = useRef(false);
  const saving = useRef(null);
  const saveTimer = useRef(null);
  const retryDelay = useRef(2000);
  const statusRef = useRef('saved');
  const seed = useRef(1);
  const setSaveStatus = (s) => {
    statusRef.current = s;
    setStatus(s);
  };

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    const hashToken = new URLSearchParams(location.hash.slice(1)).get('token');
    if (hashToken) history.replaceState(null, '', location.pathname + location.search); // keep the secret out of history/screenshots
    const token = hashToken || myInvitations.get(id)?.token || '';
    try {
      const { invitation } = await api(`/api/invitations/${id}`, { token });
      const c = { id, token };
      setCtx(c);
      setInv(invitation);
      setData(invitation.data);
      dataRef.current = invitation.data;
      setTemplateId(invitation.templateId);
      templateRef.current = invitation.templateId;
      versionRef.current = invitation.version;
      seed.current = (invitation.data.seed || 0) + 1;
      dirty.current = false;
      setSaveStatus('saved');
      if (token) myInvitations.save({ id, token, slug: invitation.slug, title: coupleTitle(invitation.data) });
      if (invitation.templateMissing) toast('Mẫu thiệp cũ không còn — đang hiển thị bằng mẫu khác. Hãy chọn mẫu mới ở tab Giao diện.', 'error', 7000);
    } catch (err) {
      setLoadError(err);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------- autosave ---------------- */
  const doSave = useCallback(async () => {
    if (saving.current) return saving.current;
    if (!dirty.current || statusRef.current === 'conflict' || !ctx) return undefined;
    clearTimeout(saveTimer.current);
    dirty.current = false;
    setSaveStatus('saving');
    const snapshot = dataRef.current;
    const tpl = templateRef.current;
    saving.current = (async () => {
      try {
        const r = await api(`/api/invitations/${ctx.id}`, { method: 'PUT', token: ctx.token, body: { data: snapshot, templateId: tpl, version: versionRef.current } });
        versionRef.current = r.version;
        retryDelay.current = 2000;
        setSaveError('');
        setInv((prev) => ({ ...prev, version: r.version, problems: r.problems, templateId: tpl, updatedAt: r.updatedAt }));
        setSaveStatus(dirty.current ? 'dirty' : 'saved');
        if (ctx.token) myInvitations.save({ id: ctx.id, token: ctx.token, title: coupleTitle(snapshot) });
      } catch (err) {
        dirty.current = true;
        if (err.status === 409) {
          setSaveStatus('conflict');
        } else if (err.status === 0 || err.status >= 500 || err.status === 429) {
          setSaveStatus('offline');
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => doSaveRef.current(), retryDelay.current);
          retryDelay.current = Math.min(retryDelay.current * 2, 30000);
        } else {
          setSaveStatus('error');
          const where = err.details?.[0]?.path ? ` (${err.details[0].path})` : '';
          setSaveError(`${err.message}${where}`);
          toast(`${err.message}${where}`, 'error', 6000);
        }
      } finally {
        saving.current = null;
      }
      if (dirty.current && statusRef.current === 'dirty') scheduleSave(300);
    })();
    return saving.current;
  }, [ctx]);
  const doSaveRef = useRef(doSave);
  doSaveRef.current = doSave;

  function scheduleSave(delay = 800) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSaveRef.current(), delay);
  }

  /** Wait until every pending change is persisted (used before publishing). */
  const flush = useCallback(async () => {
    for (let i = 0; i < 5; i++) {
      if (saving.current) await saving.current;
      if (!dirty.current) break;
      await doSaveRef.current();
    }
    if (dirty.current) throw new Error('Chưa lưu được thay đổi — kiểm tra kết nối rồi thử lại.');
  }, []);

  const update = useCallback((path, value) => {
    setData((prev) => {
      const v = typeof value === 'function' ? value(getIn(prev, path)) : value;
      const next = setIn(prev, path, v);
      dataRef.current = next;
      return next;
    });
    dirty.current = true;
    if (statusRef.current !== 'conflict') {
      setSaveStatus('dirty');
      scheduleSave();
    }
  }, []);

  useEffect(() => {
    const beforeUnload = (e) => {
      if (dirty.current || saving.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const onHide = () => document.visibilityState === 'hidden' && dirty.current && doSaveRef.current();
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', onHide);
      clearTimeout(saveTimer.current);
    };
  }, []);

  /* ---------------- content suggestions ---------------- */
  async function suggest(field, apply) {
    setBusy(field);
    try {
      const d = dataRef.current;
      const r = await api('/api/generate', {
        method: 'POST',
        body: {
          field,
          groomName: d.groom.fullName,
          brideName: d.bride.fullName,
          groomShort: d.groom.shortName || undefined,
          brideShort: d.bride.shortName || undefined,
          date: d.wedding.date,
          tone: d.tone,
          seed: seed.current++,
        },
      });
      apply(r[field]);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function regenerateAll() {
    if (!confirm('Viết lại toàn bộ lời văn (tiêu đề, lời mời, trích dẫn, lời cảm ơn…) theo giọng văn hiện tại? Nội dung bạn đã sửa sẽ bị thay thế.')) return;
    setBusy('all');
    try {
      const d = dataRef.current;
      const r = await api('/api/generate', {
        method: 'POST',
        body: { groomName: d.groom.fullName, brideName: d.bride.fullName, groomShort: d.groom.shortName || undefined, brideShort: d.bride.shortName || undefined, date: d.wedding.date, tone: d.tone, seed: seed.current++ },
      });
      update('content', (c) => ({ ...c, headline: r.headline, invitation: r.invitation, quote: r.quote.quote, quoteAuthor: r.quote.quoteAuthor, coupleIntro: r.coupleIntro, thankYou: r.thankYou, rsvpNote: r.rsvpNote, giftNote: r.giftNote, hashtag: r.hashtag }));
      update('groom.bio', r.groomBio);
      update('bride.bio', r.brideBio);
      toast('Đã viết lại lời văn ✨');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  /* ---------------- template & sections ---------------- */
  const template = meta.templates.find((t) => t.id === templateId);
  const allKeys = meta.sections.map((s) => s.key);
  const sections = useMemo(
    () => (data ? effectiveSections(data.sections, template?.defaults.sections || allKeys, allKeys) : []),
    [data?.sections, template],
  );
  const setSections = (list) => update('sections', list);
  const sectionEnabled = (key) => sections.find((s) => s.key === key)?.enabled;
  const setSectionEnabled = (key, enabled) => setSections(sections.map((s) => (s.key === key ? { ...s, enabled } : s)));

  function switchTemplate(nextId) {
    setTemplateId(nextId);
    templateRef.current = nextId;
    update('theme', (t) => ({ ...t, colors: {}, fonts: {}, effect: undefined, effectIntensity: undefined, intro: undefined }));
    const name = meta.templates.find((t) => t.id === nextId)?.name;
    toast(`Đã chuyển sang mẫu “${name}” — màu, font & hiệu ứng theo mặc định của mẫu.`);
  }

  /* ---------------- render ---------------- */
  if (loadError) {
    const denied = loadError.status === 401 || loadError.status === 403;
    return (
      <div class="center-page">
        <div class="card card--narrow">
          <h1>{denied ? 'Cần link chỉnh sửa' : loadError.status === 404 ? 'Không tìm thấy thiệp' : 'Không tải được thiệp'}</h1>
          <p class="muted">
            {denied
              ? 'Hãy mở thiệp bằng đúng “link chỉnh sửa bí mật” bạn nhận được khi tạo thiệp (có dạng …/edit/xxx#token=…). Nếu bị mất link, hãy liên hệ quản trị viên để được cấp lại.'
              : loadError.message}
          </p>
          <div class="row row--center">
            <a class="btn" href="/my" onClick={(e) => (e.preventDefault(), navigate('/my'))}>Thiệp của tôi</a>
            <button type="button" class="btn btn--ghost" onClick={() => (setLoadError(null), load())}>Thử lại</button>
          </div>
        </div>
      </div>
    );
  }
  if (!data || !inv) return <div class="center-page"><div class="spinner" aria-label="Đang tải" /></div>;

  const focus = TABS.find((t) => t.id === tab)?.focus;
  const panelProps = { data, update, meta, ctx, suggest, busy, inv, setInv };
  const title = coupleTitle(data);

  return (
    <div class={`editor${showPreview ? ' editor--preview' : ''}`}>
      <header class="editor__bar">
        <a class="editor__back" href="/my" onClick={(e) => (e.preventDefault(), navigate('/my'))} title="Thiệp của tôi">←</a>
        <div class="editor__title">
          <strong>{title}</strong>
          <span class={`save-state save-state--${status}`} title={saveError}>{SAVE_LABEL[status]}</span>
        </div>
        <div class="editor__tools">
          <div class="segmented segmented--sm hide-mobile">
            <button type="button" class={device === 'mobile' ? 'is-active' : ''} onClick={() => setDevice('mobile')}>📱 Điện thoại</button>
            <button type="button" class={device === 'desktop' ? 'is-active' : ''} onClick={() => setDevice('desktop')}>🖥️ Máy tính</button>
          </div>
          <button type="button" class="btn btn--sm btn--ghost hide-mobile" onClick={() => setReplayKey((k) => k + 1)}>▶ Xem mở thiệp</button>
          <button type="button" class={`btn btn--sm${inv.status === 'published' ? ' btn--ghost' : ''}`} onClick={() => (setTab('share'), setShowPreview(false))}>
            {inv.status === 'published' ? 'Chia sẻ' : 'Công bố'}
          </button>
        </div>
      </header>

      {status === 'conflict' && (
        <div class="banner banner--warn">
          Thiệp vừa được sửa ở tab/thiết bị khác. Tải lại để lấy bản mới nhất (thay đổi chưa lưu ở đây sẽ mất).
          <button type="button" class="btn btn--sm" onClick={() => location.reload()}>Tải lại</button>
        </div>
      )}
      {status === 'error' && saveError && <div class="banner banner--error">{saveError}</div>}

      <div class="editor__body">
        <nav class="editor__tabs" aria-label="Các mục chỉnh sửa">
          {TABS.map((t) => (
            <button type="button" key={t.id} class={`editor__tab${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
              {t.id === 'share' && inv.status !== 'published' && inv.problems?.length > 0 && <i class="dot" />}
            </button>
          ))}
        </nav>

        <div class="editor__panel" key={tab}>
          <h2 class="editor__panel-title">{TABS.find((t) => t.id === tab)?.label}</h2>
          {tab === 'couple' && <CouplePanel {...panelProps} />}
          {tab === 'events' && <EventsPanel {...panelProps} />}
          {tab === 'content' && <ContentPanel {...panelProps} regenerateAll={regenerateAll} />}
          {tab === 'photos' && <PhotosPanel {...panelProps} />}
          {tab === 'story' && <StoryPanel {...panelProps} />}
          {tab === 'gift' && <GiftPanel {...panelProps} sectionEnabled={sectionEnabled} setSectionEnabled={setSectionEnabled} />}
          {tab === 'design' && <DesignPanel {...panelProps} templateId={templateId} switchTemplate={switchTemplate} />}
          {tab === 'sections' && <SectionsPanel {...panelProps} sections={sections} setSections={setSections} />}
          {tab === 'share' && (
            <SharePanel
              {...panelProps}
              flush={flush}
              onDeleted={() => {
                myInvitations.remove(inv.id);
                dirty.current = false;
                toast('Đã xoá thiệp');
                navigate('/my');
              }}
            />
          )}
          {tab === 'guests' && <GuestsPanel {...panelProps} />}
        </div>

        <div class="editor__preview">
          <Preview ctx={ctx} data={data} templateId={templateId} device={device} focus={focus} replayKey={replayKey} />
        </div>
      </div>

      <button type="button" class="fab show-mobile" onClick={() => setShowPreview((v) => !v)}>
        {showPreview ? '✎ Chỉnh sửa' : '👁 Xem trước'}
      </button>
    </div>
  );
}
