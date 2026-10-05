import { useEffect, useRef, useState } from 'preact/hooks';

const SAMPLE_SCRIPT = 'Anh & Hà';
const SAMPLE_TEXT = 'Thiệp Cưới Ấm Áp';
const CATEGORY_LABEL = { script: 'Viết tay', serif: 'Có chân', sans: 'Không chân' };

/**
 * Load every font once, subset to just the glyphs of the preview texts (`text=` makes the
 * whole catalogue weigh a few dozen KB), so pickers can render each option in its own face.
 */
let previewsLoaded = false;
export function useFontPreviews(fonts) {
  useEffect(() => {
    if (previewsLoaded || !fonts?.length) return;
    previewsLoaded = true;
    const glyphs = [...new Set(SAMPLE_SCRIPT + SAMPLE_TEXT + 'Lễ Thành Hôn Trân trọng kính mời 0123456789')].join('');
    const chunks = [];
    for (let i = 0; i < fonts.length; i += 25) chunks.push(fonts.slice(i, i + 25));
    for (const chunk of chunks) {
      const families = chunk.map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}`).join('&');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(glyphs)}&display=swap`;
      document.head.appendChild(link);
    }
  }, [fonts]);
}

/** Dropdown that renders every font in its own typeface. */
export function FontPicker({ label, value, fonts, onChange, sample }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const ref = useRef();
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const current = fonts.find((f) => f.family === value);
  const shown = filter === 'all' ? fonts : fonts.filter((f) => f.category === filter);
  return (
    <div class="font-picker" ref={ref}>
      <span class="field__label">{label}</span>
      <button type="button" class="font-picker__button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span class="font-picker__sample" style={{ fontFamily: `"${value}"` }}>{sample}</span>
        <span class="font-picker__name">{value}{current?.note ? ` · ${current.note}` : ''}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div class="font-picker__menu" role="listbox" aria-label={label}>
          <div class="segmented segmented--sm font-picker__filter">
            {['all', 'script', 'serif', 'sans'].map((c) => (
              <button type="button" key={c} class={filter === c ? 'is-active' : ''} onClick={() => setFilter(c)}>
                {c === 'all' ? 'Tất cả' : CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <ul>
            {shown.map((f) => (
              <li key={f.family}>
                <button
                  type="button"
                  role="option"
                  aria-selected={f.family === value}
                  class={f.family === value ? 'is-active' : ''}
                  onClick={() => {
                    onChange(f.family);
                    setOpen(false);
                  }}
                >
                  <span class="font-picker__sample" style={{ fontFamily: `"${f.family}"` }}>{f.category === 'script' ? SAMPLE_SCRIPT : SAMPLE_TEXT}</span>
                  <span class="font-picker__name">{f.family}{f.note ? ` · ${f.note}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One-click heading/body/script combinations. */
export function FontPairs({ pairs, current, onPick }) {
  return (
    <div class="font-pairs">
      {pairs.map((p) => {
        const active = current.heading === p.heading && current.body === p.body && current.script === p.script;
        return (
          <button type="button" key={p.id} class={`font-pair${active ? ' is-active' : ''}`} onClick={() => onPick(p)} title={`${p.script} · ${p.heading} · ${p.body}`}>
            <span class="font-pair__script" style={{ fontFamily: `"${p.script}"` }}>{SAMPLE_SCRIPT}</span>
            <span class="font-pair__heading" style={{ fontFamily: `"${p.heading}"` }}>{SAMPLE_TEXT}</span>
            <span class="font-pair__name">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Grid of icon + label choices (effects, intros, bursts…). */
export function ChoiceGrid({ label, hint, options, value, onChange, compact }) {
  return (
    <div class="field">
      {label && <span class="field__label">{label}</span>}
      <div class={`choice-grid${compact ? ' choice-grid--compact' : ''}`} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button type="button" key={o.id} role="radio" aria-checked={value === o.id} class={`choice-tile${value === o.id ? ' is-active' : ''}`} onClick={() => onChange(o.id)}>
            {o.icon && <span class="choice-tile__icon" aria-hidden="true">{o.icon}</span>}
            <span class="choice-tile__label">{o.label}</span>
          </button>
        ))}
      </div>
      {hint && <p class="field__hint">{hint}</p>}
    </div>
  );
}
