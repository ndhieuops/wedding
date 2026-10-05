import { Group, Segmented, Select, SuggestButton, TextArea, TextField } from '../components/fields.jsx';

function PersonFields({ who, label, data, update, suggest, busy }) {
  const p = data[who];
  return (
    <Group title={label}>
      <TextField label="Họ và tên" value={p.fullName} maxLength={80} placeholder={who === 'groom' ? 'Nguyễn Văn Minh' : 'Trần Thị Thu Hà'} onInput={(v) => update(`${who}.fullName`, v)} />
      <TextField
        label="Tên gọi trên thiệp"
        hint="Để trống sẽ tự lấy tên cuối. Điền nếu muốn dùng tên thân mật (VD: Bin, Su)."
        placeholder={(p.fullName || '').trim().split(/\s+/).pop() || ''}
        value={p.shortName}
        maxLength={30}
        onInput={(v) => update(`${who}.shortName`, v)}
      />
      <TextArea
        label="Giới thiệu ngắn"
        value={p.bio}
        maxLength={600}
        rows={2}
        onInput={(v) => update(`${who}.bio`, v)}
        action={<SuggestButton busy={busy === `${who}Bio`} onClick={() => suggest(`${who}Bio`, (v) => update(`${who}.bio`, v))} />}
      />
    </Group>
  );
}

export function CouplePanel({ data, update, meta, suggest, busy }) {
  return (
    <>
      <PersonFields who="groom" label="Chú rể" data={data} update={update} suggest={suggest} busy={busy} />
      <PersonFields who="bride" label="Cô dâu" data={data} update={update} suggest={suggest} busy={busy} />
      <Group title="Ngày cưới" description="Dùng cho ảnh bìa, lịch tháng, đếm ngược và lịch âm.">
        <div class="row">
          <TextField label="Ngày" type="date" value={data.wedding.date} onInput={(v) => update('wedding.date', v)} />
          <TextField label="Giờ" type="time" value={data.wedding.time} onInput={(v) => update('wedding.time', v)} />
        </div>
        <Segmented
          label="Thứ tự tên trên thiệp"
          value={data.order}
          onChange={(v) => update('order', v)}
          options={[{ value: 'groom-first', label: 'Chú rể trước' }, { value: 'bride-first', label: 'Cô dâu trước' }]}
        />
        <Select label="Giọng văn gợi ý" value={data.tone} onChange={(v) => update('tone', v)} options={meta.tones.map((t) => ({ value: t.id, label: t.label }))} hint="Áp dụng cho các nút ✨ Gợi ý." />
      </Group>
      <Group title="Gia đình hai bên" description="Hiện ở phần Thư mời. Để trống nếu không muốn ghi tên bố mẹ.">
        <div class="row">
          <TextField label="Bố chú rể" value={data.groom.father} maxLength={80} onInput={(v) => update('groom.father', v)} />
          <TextField label="Mẹ chú rể" value={data.groom.mother} maxLength={80} onInput={(v) => update('groom.mother', v)} />
        </div>
        <TextField label="Địa chỉ nhà trai" value={data.groom.address} maxLength={200} onInput={(v) => update('groom.address', v)} />
        <div class="row">
          <TextField label="Bố cô dâu" value={data.bride.father} maxLength={80} onInput={(v) => update('bride.father', v)} />
          <TextField label="Mẹ cô dâu" value={data.bride.mother} maxLength={80} onInput={(v) => update('bride.mother', v)} />
        </div>
        <TextField label="Địa chỉ nhà gái" value={data.bride.address} maxLength={200} onInput={(v) => update('bride.address', v)} />
        <Segmented
          label="Thiệp này của nhà"
          value={data.hostSide}
          onChange={(v) => update('hostSide', v)}
          options={[{ value: 'both', label: 'Cả hai' }, { value: 'groom', label: 'Nhà trai' }, { value: 'bride', label: 'Nhà gái' }]}
        />
      </Group>
    </>
  );
}
