import { Group, ItemToolbar, TextArea, TextField } from '../components/fields.jsx';
import { ImageField } from '../components/ImageField.jsx';
import { moveItem, uid } from '../util.js';

export function StoryPanel({ data, update, ctx, suggest, busy }) {
  const story = data.story;
  const set = (list) => update('story', list);
  return (
    <>
      <div class="callout">
        <p>Kể lại những cột mốc đáng nhớ. Có thể để trống phần ngày hoặc ảnh.</p>
        <button
          type="button"
          class="btn btn--sm"
          disabled={busy === 'story'}
          onClick={() => (!story.length || confirm('Thay toàn bộ câu chuyện hiện tại bằng nội dung gợi ý?')) && suggest('story', (v) => set(v.map((s) => ({ ...s, id: uid() }))))}
        >
          ✨ Dùng câu chuyện gợi ý
        </button>
      </div>
      {story.map((s, i) => (
        <Group key={s.id} title={s.title || `Cột mốc ${i + 1}`} actions={<ItemToolbar index={i} total={story.length} onMove={(a, b) => set(moveItem(story, a, b))} onRemove={(idx) => set(story.filter((_, j) => j !== idx))} />}>
          <div class="row">
            <TextField label="Tiêu đề" value={s.title} maxLength={80} onInput={(v) => update(`story.${i}.title`, v)} />
            <TextField label="Thời gian" placeholder="VD: Mùa thu 2019" value={s.date} maxLength={40} onInput={(v) => update(`story.${i}.date`, v)} />
          </div>
          <TextArea label="Nội dung" rows={3} maxLength={1500} value={s.text} onInput={(v) => update(`story.${i}.text`, v)} />
          <ImageField label="Ảnh (tuỳ chọn)" value={s.image} ctx={ctx} aspect="16 / 10" onChange={(v) => update(`story.${i}.image`, v)} />
        </Group>
      ))}
      <button type="button" class="btn btn--block btn--dashed" disabled={story.length >= 12} onClick={() => set([...story, { id: uid(), title: '', date: '', text: '', image: null }])}>
        + Thêm cột mốc
      </button>
    </>
  );
}
