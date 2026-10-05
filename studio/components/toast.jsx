import { useEffect, useState } from 'preact/hooks';

const listeners = new Set();
let seq = 0;

/** toast('Đã lưu') / toast('Lỗi...', 'error') — callable from anywhere. */
export function toast(message, type = 'info', ms = 3200) {
  const item = { id: ++seq, message, type };
  listeners.forEach((fn) => fn(item, ms));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (item, ms) => {
      setItems((list) => [...list.slice(-3), item]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== item.id)), ms);
    };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return (
    <div class="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} class={`toast toast--${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}
