import { useRef, useState } from 'preact/hooks';
import { upload } from '../api.js';
import { ColorField, Group, Segmented, Select, TextField, Toggle } from '../components/fields.jsx';
import { toast } from '../components/toast.jsx';

const COLOR_LABELS = [
  ['primary', 'Màu chính'],
  ['secondary', 'Màu phụ'],
  ['accent', 'Màu nhấn'],
  ['background', 'Nền trang'],
  ['surface', 'Nền thẻ'],
  ['text', 'Chữ'],
];

export function DesignPanel({ data, update, meta, ctx, templateId, switchTemplate }) {
  const template = meta.templates.find((t) => t.id === templateId) || meta.templates[0];
  const defaults = template?.defaults.theme || { colors: {}, fonts: {} };
  const colors = { ...defaults.colors, ...data.theme.colors };
  const fonts = { ...defaults.fonts, ...data.theme.fonts };
  const audioInput = useRef();
  const [uploading, setUploading] = useState(false);

  const fontOptions = ['serif', 'sans', 'script'].map((cat) => ({
    group: { serif: 'Có chân (serif)', sans: 'Không chân (sans)', script: 'Viết tay (script)' }[cat],
    options: meta.fonts.filter((f) => f.category === cat).map((f) => ({ value: f.family, label: f.family })),
  }));

  async function uploadAudio(file) {
    if (!file) return;
    setUploading(true);
    try {
      const { asset } = await upload(`/api/invitations/${ctx.id}/assets`, file, { token: ctx.token, kind: 'audio' });
      update('music', { ...data.music, enabled: true, asset, title: data.music.title || file.name.replace(/\.\w+$/, '') });
      toast('Đã tải nhạc lên');
    } catch (err) {
      toast(err.message, 'error', 5000);
    } finally {
      setUploading(false);
      if (audioInput.current) audioInput.current.value = '';
    }
  }

  const musicSrc = data.music.asset?.url || data.music.url;

  return (
    <>
      <Group title="Mẫu thiệp" description="Đổi mẫu bất cứ lúc nào — nội dung được giữ nguyên.">
        <div class="template-picker">
          {meta.templates.map((t) => (
            <button type="button" key={t.id} class={`template-picker__item${t.id === templateId ? ' is-active' : ''}`} onClick={() => t.id !== templateId && switchTemplate(t.id)} aria-pressed={t.id === templateId}>
              <span class="template-picker__thumb" style={{ background: t.defaults.theme.colors.background }}>
                {t.previewUrl && <img src={t.previewUrl} alt="" loading="lazy" />}
              </span>
              <span class="template-picker__name">{t.name}{!t.published && ' (ẩn)'}</span>
            </button>
          ))}
        </div>
      </Group>

      {template?.palettes?.length > 0 && (
        <Group title="Bảng màu gợi ý">
          <div class="palettes">
            {template.palettes.map((p) => (
              <button type="button" key={p.name} class="palette" onClick={() => update('theme.colors', { ...p.colors })} title={p.name}>
                <span class="palette__swatches">
                  {['primary', 'secondary', 'accent', 'background'].map((k) => <i key={k} style={{ background: p.colors[k] }} />)}
                </span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </Group>
      )}

      <Group title="Màu sắc tuỳ chỉnh" actions={Object.keys(data.theme.colors || {}).length > 0 && <button type="button" class="link-btn" onClick={() => update('theme.colors', {})}>Khôi phục mặc định</button>}>
        <div class="color-grid">
          {COLOR_LABELS.map(([key, label]) => (
            <ColorField key={key} label={label} value={colors[key]} onChange={(v) => update(`theme.colors.${key}`, v)} />
          ))}
        </div>
      </Group>

      <Group title="Font chữ" description="Mọi font đều hỗ trợ đầy đủ tiếng Việt." actions={Object.keys(data.theme.fonts || {}).length > 0 && <button type="button" class="link-btn" onClick={() => update('theme.fonts', {})}>Khôi phục mặc định</button>}>
        <Select label="Tên cô dâu chú rể (chữ nghệ thuật)" value={fonts.script} onChange={(v) => update('theme.fonts.script', v)} options={fontOptions} />
        <Select label="Tiêu đề" value={fonts.heading} onChange={(v) => update('theme.fonts.heading', v)} options={fontOptions} />
        <Select label="Nội dung" value={fonts.body} onChange={(v) => update('theme.fonts.body', v)} options={fontOptions} />
      </Group>

      <Group title="Hiệu ứng">
        <Select label="Hiệu ứng nền" value={data.theme.effect || defaults.effect} onChange={(v) => update('theme.effect', v)} options={meta.effects.map((e) => ({ value: e.id, label: e.label }))} />
        <Segmented
          label="Mật độ"
          value={data.theme.effectIntensity || defaults.effectIntensity}
          onChange={(v) => update('theme.effectIntensity', v)}
          options={[{ value: 'low', label: 'Nhẹ' }, { value: 'medium', label: 'Vừa' }, { value: 'high', label: 'Nhiều' }]}
        />
        <Select label="Hiệu ứng mở thiệp" value={data.theme.intro || defaults.intro} onChange={(v) => update('theme.intro', v)} options={meta.intros.map((e) => ({ value: e.id, label: e.label }))} />
      </Group>

      <Group title="Nhạc nền" description="Nhạc phát khi khách bấm “Mở thiệp”. Hãy dùng bài hát bạn có quyền sử dụng.">
        <Toggle label="Bật nhạc nền" checked={data.music.enabled} onChange={(v) => update('music.enabled', v)} />
        <div class="row row--center">
          <button type="button" class="btn btn--sm" onClick={() => audioInput.current.click()} disabled={uploading}>
            {uploading ? 'Đang tải…' : data.music.asset ? 'Đổi file nhạc' : 'Tải file nhạc (MP3/M4A)'}
          </button>
          {data.music.asset && <button type="button" class="btn btn--sm btn--ghost" onClick={() => update('music.asset', null)}>Gỡ file</button>}
        </div>
        <input ref={audioInput} type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav" hidden onChange={(e) => uploadAudio(e.currentTarget.files[0])} />
        {!data.music.asset && <TextField label="Hoặc dán link file nhạc" placeholder="https://.../bai-hat.mp3" value={data.music.url} maxLength={1000} onInput={(v) => update('music.url', v)} />}
        <TextField label="Tên bài hát" value={data.music.title} maxLength={80} onInput={(v) => update('music.title', v)} />
        {musicSrc && <audio class="audio" controls preload="none" src={musicSrc} />}
      </Group>
    </>
  );
}
