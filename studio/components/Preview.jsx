import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';

const DEVICES = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

/**
 * Live preview with two stacked iframes (double buffering): the next render loads in
 * the hidden frame and is swapped in only once fully loaded, so typing never flashes
 * a blank page. Scroll position is kept across renders via postMessage.
 */
export function Preview({ ctx, data, templateId, device = 'mobile', focus, replayKey = 0 }) {
  const frameA = useRef();
  const frameB = useRef();
  const frames = [frameA, frameB];
  const box = useRef();
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [urls, setUrls] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const [boxHeight, setBoxHeight] = useState(800);
  const scrollY = useRef(0);
  const requestSeq = useRef(0);
  const pending = useRef(null);
  const lastReplay = useRef(replayKey);
  const firstRender = useRef(true);

  const size = DEVICES[device] || DEVICES.mobile;

  // Fit the virtual device into the available space.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => {
      const pad = device === 'mobile' ? 56 : 24; // room for the phone bezel
      const w = el.clientWidth - pad;
      const h = el.clientHeight - pad;
      setScale(Math.max(0.25, Math.min(1, w / size.width, device === 'mobile' ? h / size.height : 1)));
      setBoxHeight(h);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device, size.width, size.height]);

  // Track scroll position reported by the invitation runtime.
  useEffect(() => {
    const onMessage = (e) => {
      const win = frames[activeRef.current].current?.contentWindow;
      if (!e.data || e.source !== win) return;
      if (e.data.type === 'wedding:scroll') scrollY.current = e.data.y || 0;
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Re-render (debounced) whenever data/template change or the user asks to replay the intro.
  useEffect(() => {
    if (!data) return undefined;
    const delay = firstRender.current ? 0 : 380;
    const timer = setTimeout(async () => {
      firstRender.current = false;
      const seq = ++requestSeq.current;
      const replay = replayKey !== lastReplay.current;
      lastReplay.current = replayKey;
      setBusy(true);
      try {
        const { url } = await api(`/api/invitations/${ctx.id}/preview`, {
          method: 'POST',
          token: ctx.token,
          body: { data, templateId, scrollY: replay ? 0 : Math.round(scrollY.current), skipIntro: !replay },
        });
        if (seq !== requestSeq.current) return; // a newer render superseded this one
        const slot = 1 - activeRef.current;
        pending.current = slot;
        if (replay) scrollY.current = 0;
        setError('');
        setUrls((prev) => {
          const next = [...prev];
          next[slot] = url;
          return next;
        });
      } catch (err) {
        if (seq === requestSeq.current) {
          setBusy(false);
          setError(err.status === 400 ? `Chưa xem trước được: ${err.message}` : err.message);
        }
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [data, templateId, replayKey]);

  // Scroll the preview to the section matching the editor tab.
  useEffect(() => {
    if (!focus) return;
    frames[activeRef.current].current?.contentWindow?.postMessage({ type: 'wedding:scrollTo', section: focus }, '*');
  }, [focus]);

  function onLoad(slot) {
    if (pending.current !== slot || !urls[slot]) return;
    pending.current = null;
    activeRef.current = slot;
    setActive(slot);
    setBusy(false);
  }

  return (
    <div class={`preview preview--${device}`} ref={box}>
      <div
        class="preview__device"
        style={{
          width: `${size.width}px`,
          height: `${device === 'mobile' ? size.height : Math.round(boxHeight / scale)}px`,
          transform: device === 'mobile' ? `translate(-50%, -50%) scale(${scale})` : `translateX(-50%) scale(${scale})`,
        }}
      >
        {[0, 1].map((i) => (
          <iframe
            key={i}
            ref={frames[i]}
            src={urls[i] || 'about:blank'}
            title="Xem trước thiệp cưới"
            class={`preview__frame${i === active ? ' is-active' : ''}`}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => onLoad(i)}
            tabIndex={i === active ? 0 : -1}
            aria-hidden={i === active ? undefined : 'true'}
          />
        ))}
      </div>
      {busy && <div class="preview__busy" aria-hidden="true"><span /></div>}
      {error && <div class="preview__error">{error}</div>}
    </div>
  );
}
