import { Group, ItemToolbar, Select, TextArea, TextField, Toggle } from '../components/fields.jsx';
import { moveItem, uid } from '../util.js';

export function EventsPanel({ data, update, meta }) {
  const events = data.events;
  const set = (list) => update('events', list);
  const typeTitle = (type) => meta.eventTypes.find((t) => t.id === type)?.label || '';

  function add() {
    if (events.length >= 6) return;
    set([...events, { id: uid(), type: 'tiec-cuoi', title: 'Tiệc Cưới', date: data.wedding.date || '', time: '', endTime: '', venue: '', address: '', mapUrl: '', note: '', showMap: true }]);
  }

  return (
    <>
      {events.map((ev, i) => (
        <Group key={ev.id} title={ev.title || typeTitle(ev.type) || `Sự kiện ${i + 1}`} actions={<ItemToolbar index={i} total={events.length} onMove={(a, b) => set(moveItem(events, a, b))} onRemove={(idx) => confirm('Xoá sự kiện này?') && set(events.filter((_, j) => j !== idx))} />}>
          <div class="row">
            <Select
              label="Loại"
              value={ev.type}
              onChange={(v) => {
                const autoTitle = !ev.title || ev.title === typeTitle(ev.type);
                update(`events.${i}`, { ...ev, type: v, title: autoTitle ? typeTitle(v) : ev.title });
              }}
              options={meta.eventTypes.map((t) => ({ value: t.id, label: t.label }))}
            />
            <TextField label="Tên hiển thị" value={ev.title} maxLength={80} onInput={(v) => update(`events.${i}.title`, v)} />
          </div>
          <div class="row row--3">
            <TextField label="Ngày" type="date" value={ev.date} onInput={(v) => update(`events.${i}.date`, v)} />
            <TextField label="Bắt đầu" type="time" value={ev.time} onInput={(v) => update(`events.${i}.time`, v)} />
            <TextField label="Kết thúc" type="time" value={ev.endTime} onInput={(v) => update(`events.${i}.endTime`, v)} />
          </div>
          <TextField label="Địa điểm" placeholder="VD: Trung tâm tiệc cưới Riverside" value={ev.venue} maxLength={120} onInput={(v) => update(`events.${i}.venue`, v)} />
          <TextField label="Địa chỉ" placeholder="Số nhà, đường, phường, quận, tỉnh/thành" value={ev.address} maxLength={250} onInput={(v) => update(`events.${i}.address`, v)} />
          <TextField
            label="Link Google Maps (tuỳ chọn)"
            hint="Để trống sẽ tự tìm theo địa chỉ. Dán link nếu muốn ghim chính xác vị trí."
            value={ev.mapUrl}
            maxLength={1000}
            placeholder="https://maps.app.goo.gl/..."
            onInput={(v) => update(`events.${i}.mapUrl`, v)}
          />
          <TextArea label="Ghi chú" rows={2} maxLength={300} placeholder="VD: Đón khách 17:00 — Khai tiệc 18:00" value={ev.note} onInput={(v) => update(`events.${i}.note`, v)} />
          <Toggle label="Hiện nút xem bản đồ" checked={ev.showMap} onChange={(v) => update(`events.${i}.showMap`, v)} />
        </Group>
      ))}
      {!events.length && <p class="empty">Chưa có sự kiện nào — thêm ít nhất 1 sự kiện (lễ cưới hoặc tiệc cưới) để công bố thiệp.</p>}
      <button type="button" class="btn btn--block btn--dashed" onClick={add} disabled={events.length >= 6}>+ Thêm sự kiện</button>
    </>
  );
}
