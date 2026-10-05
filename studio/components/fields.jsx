import { useId } from 'preact/hooks';

export function Field({ label, hint, error, children, id }) {
  return (
    <div class={`field${error ? ' field--error' : ''}`}>
      {label && <label class="field__label" for={id}>{label}</label>}
      {children}
      {error ? <p class="field__error">{error}</p> : hint ? <p class="field__hint">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, hint, value, onInput, placeholder, maxLength = 200, type = 'text', error, suffix, ...rest }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <div class="input-wrap">
        <input id={id} class="input" type={type} value={value ?? ''} placeholder={placeholder} maxLength={maxLength} onInput={(e) => onInput(e.currentTarget.value)} {...rest} />
        {suffix}
      </div>
    </Field>
  );
}

export function TextArea({ label, hint, value, onInput, placeholder, maxLength = 1000, rows = 3, action, error }) {
  const id = useId();
  const len = (value || '').length;
  return (
    <Field label={label} error={error} id={id} hint={hint}>
      <textarea id={id} class="input input--area" rows={rows} value={value ?? ''} placeholder={placeholder} maxLength={maxLength} onInput={(e) => onInput(e.currentTarget.value)} />
      <div class="field__meta">
        {action}
        <span class={`counter${len > maxLength * 0.9 ? ' counter--warn' : ''}`}>{len}/{maxLength}</span>
      </div>
    </Field>
  );
}

export function Select({ label, hint, value, onChange, options, error }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <select id={id} class="input" value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value)}>
        {options.map((o) =>
          o.group ? (
            <optgroup key={o.group} label={o.group}>
              {o.options.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </optgroup>
          ) : (
            <option key={o.value} value={o.value}>{o.label}</option>
          ),
        )}
      </select>
    </Field>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <label class="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span class="toggle__track" aria-hidden="true"><span class="toggle__thumb" /></span>
      <span class="toggle__text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function Segmented({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <div class="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button type="button" key={o.value} role="radio" aria-checked={value === o.value} class={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function ColorField({ label, value, onChange }) {
  const id = useId();
  return (
    <div class="color-field">
      <input id={id} type="color" value={value || '#000000'} onInput={(e) => onChange(e.currentTarget.value)} />
      <label for={id}>
        <span>{label}</span>
        <code>{value}</code>
      </label>
    </div>
  );
}

export function Group({ title, description, children, actions }) {
  return (
    <section class="group">
      {(title || actions) && (
        <header class="group__head">
          <div>
            {title && <h3 class="group__title">{title}</h3>}
            {description && <p class="group__desc">{description}</p>}
          </div>
          {actions && <div class="group__actions">{actions}</div>}
        </header>
      )}
      <div class="group__body">{children}</div>
    </section>
  );
}

export function SuggestButton({ onClick, busy, label = 'Gợi ý khác' }) {
  return (
    <button type="button" class="link-btn" onClick={onClick} disabled={busy}>
      ✨ {busy ? 'Đang viết…' : label}
    </button>
  );
}

export function ItemToolbar({ index, total, onMove, onRemove, removeLabel = 'Xoá' }) {
  return (
    <div class="item-toolbar">
      <button type="button" class="icon-btn" title="Lên trên" disabled={index === 0} onClick={() => onMove(index, index - 1)}>↑</button>
      <button type="button" class="icon-btn" title="Xuống dưới" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>↓</button>
      <button type="button" class="icon-btn icon-btn--danger" title={removeLabel} onClick={() => onRemove(index)}>✕</button>
    </div>
  );
}
