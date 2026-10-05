import { useRef, useState } from 'preact/hooks';
import { upload } from '../api.js';
import { shrinkImage } from '../util.js';
import { toast } from './toast.jsx';

/** Single image slot with upload progress, replace & remove. */
export function ImageField({ label, value, onChange, ctx, aspect = '4 / 3', hint }) {
  const input = useRef();
  const [progress, setProgress] = useState(null);

  async function pick(file) {
    if (!file) return;
    setProgress(0);
    try {
      const small = await shrinkImage(file);
      const { asset } = await upload(`/api/invitations/${ctx.id}/assets`, small, { token: ctx.token, onProgress: setProgress });
      onChange(asset);
    } catch (err) {
      toast(err.message, 'error', 5000);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div class="image-field">
      {label && <span class="field__label">{label}</span>}
      <div class="image-field__box" style={{ aspectRatio: aspect }}>
        {value ? <img src={value.thumb || value.url} alt="" /> : <span class="image-field__empty">Chưa có ảnh</span>}
        {progress !== null && (
          <div class="image-field__progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        )}
      </div>
      <div class="image-field__actions">
        <button type="button" class="btn btn--sm" onClick={() => input.current.click()} disabled={progress !== null}>
          {progress !== null ? 'Đang tải…' : value ? 'Đổi ảnh' : 'Tải ảnh lên'}
        </button>
        {value && <button type="button" class="btn btn--sm btn--ghost" onClick={() => onChange(null)}>Gỡ ảnh</button>}
      </div>
      {hint && <p class="field__hint">{hint}</p>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.currentTarget.files[0])} />
    </div>
  );
}
