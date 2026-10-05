import { Group, TextField, Toggle } from '../components/fields.jsx';

const NEEDS = {
  quote: (d) => (d.content.quote ? '' : 'chưa có câu trích dẫn'),
  events: (d) => (d.events.length ? '' : 'chưa có sự kiện'),
  story: (d) => (d.story.length ? '' : 'chưa có cột mốc'),
  gallery: (d) => (d.gallery.length ? '' : 'chưa có ảnh'),
  gift: (d) => (d.gift.accounts.some((a) => a.accountNumber) ? '' : 'chưa có tài khoản'),
  calendar: (d) => (d.wedding.date ? '' : 'chưa có ngày cưới'),
  countdown: (d) => (d.wedding.date ? '' : 'chưa có ngày cưới'),
};

export function SectionsPanel({ data, update, meta, sections, setSections }) {
  const label = (key) => meta.sections.find((s) => s.key === key)?.label || key;
  const move = (from, to) => {
    if (to < 1 || to >= sections.length) return; // hero stays first
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setSections(next);
  };
  const toggle = (i, enabled) => setSections(sections.map((s, j) => (j === i ? { ...s, enabled } : s)));

  return (
    <>
      <Group title="Bố cục thiệp" description="Bật/tắt và sắp xếp thứ tự các phần. Phần chưa có nội dung sẽ tự ẩn.">
        <ul class="section-list">
          {sections.map((s, i) => {
            const missing = NEEDS[s.key]?.(data);
            return (
              <li key={s.key} class={`section-list__item${s.enabled ? '' : ' is-off'}`}>
                <span class="section-list__name">
                  {label(s.key)}
                  {s.enabled && missing && <small> · tự ẩn: {missing}</small>}
                </span>
                {s.key === 'hero' ? (
                  <span class="badge">Cố định</span>
                ) : (
                  <span class="section-list__controls">
                    <button type="button" class="icon-btn" disabled={i <= 1} onClick={() => move(i, i - 1)} title="Lên">↑</button>
                    <button type="button" class="icon-btn" disabled={i === sections.length - 1} onClick={() => move(i, i + 1)} title="Xuống">↓</button>
                    <Toggle checked={s.enabled} onChange={(v) => toggle(i, v)} label="" />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {data.sections.length > 0 && (
          <button type="button" class="link-btn" onClick={() => update('sections', [])}>Khôi phục bố cục mặc định của mẫu</button>
        )}
      </Group>
      <Group title="Xác nhận tham dự (RSVP)">
        <TextField label="Hạn xác nhận" type="date" value={data.rsvp.deadline} onInput={(v) => update('rsvp.deadline', v)} hint="Hiện trong lời nhắc ở phần RSVP." />
        <Toggle label="Hỏi số người tham dự" checked={data.rsvp.askGuests} onChange={(v) => update('rsvp.askGuests', v)} />
        <Toggle label="Hỏi khách nhà trai hay nhà gái" checked={data.rsvp.askSide} onChange={(v) => update('rsvp.askSide', v)} />
      </Group>
    </>
  );
}
