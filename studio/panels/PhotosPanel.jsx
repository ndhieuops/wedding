import { useRef, useState } from 'preact/hooks';
import { upload } from '../api.js';
import { Group, ItemToolbar, Segmented } from '../components/fields.jsx';
import { ImageField } from '../components/ImageField.jsx';
import { toast } from '../components/toast.jsx';
import { moveItem, shrinkImage, uid } from '../util.js';

export function PhotosPanel({ data, update, ctx, meta }) {
  const input = useRef();
  const [queue, setQueue] = useState(null); // { done, total }
  const gallery = data.gallery;
  const latest = useRef(gallery);
  latest.current = gallery;

  async function addFiles(files) {
    const list = [...files].slice(0, Math.max(0, 60 - gallery.length));
    if (!list.length) return;
    setQueue({ done: 0, total: list.length });
    let added = [];
    for (const file of list) {
      try {
        const small = await shrinkImage(file);
        const { asset } = await upload(`/api/invitations/${ctx.id}/assets`, small, { token: ctx.token });
        added = [...added, { id: uid(), image: asset, caption: '' }];
        const item = added[added.length - 1];
        update('gallery', (prev) => [...prev, item]);
      } catch (err) {
        toast(`${file.name}: ${err.message}`, 'error', 5000);
      }
      setQueue((q) => ({ ...q, done: q.done + 1 }));
    }
    setQueue(null);
    if (input.current) input.current.value = '';
  }

  return (
    <>
      <Group title="Ảnh bìa" description="Ảnh lớn ở đầu thiệp. Để trống để dùng thiết kế trang trí của mẫu.">
        <ImageField value={data.cover.image} ctx={ctx} aspect="3 / 4" onChange={(v) => update('cover.image', v)} />
        {data.cover.image && (
          <Segmented
            label="Căn ảnh"
            value={data.cover.position}
            onChange={(v) => update('cover.position', v)}
            options={[{ value: 'top', label: 'Trên' }, { value: 'center', label: 'Giữa' }, { value: 'bottom', label: 'Dưới' }]}
          />
        )}
      </Group>
      <Group title="Ảnh cô dâu & chú rể">
        <div class="row">
          <ImageField label="Chú rể" value={data.groom.photo} ctx={ctx} aspect="3 / 4" onChange={(v) => update('groom.photo', v)} />
          <ImageField label="Cô dâu" value={data.bride.photo} ctx={ctx} aspect="3 / 4" onChange={(v) => update('bride.photo', v)} />
        </div>
      </Group>
      <Group
        title={`Album ảnh (${gallery.length}/60)`}
        description={`Chọn nhiều ảnh cùng lúc. Ảnh được tự động nén & xoá thông tin vị trí GPS. Tối đa ${meta.limits.maxImageMb}MB/ảnh.`}
        actions={
          <button type="button" class="btn btn--sm" onClick={() => input.current.click()} disabled={!!queue || gallery.length >= 60}>
            {queue ? `Đang tải ${queue.done}/${queue.total}…` : '+ Thêm ảnh'}
          </button>
        }
      >
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.currentTarget.files)} />
        {!gallery.length && (
          <button type="button" class="dropzone" onClick={() => input.current.click()}>
            Bấm để chọn ảnh cưới của bạn
          </button>
        )}
        <ul class="gallery-list">
          {gallery.map((g, i) => (
            <li key={g.id} class="gallery-list__item">
              <img src={g.image.thumb || g.image.url} alt="" loading="lazy" />
              <input class="input input--sm" placeholder="Chú thích (tuỳ chọn)" value={g.caption} maxLength={120} onInput={(e) => update(`gallery.${i}.caption`, e.currentTarget.value)} />
              <ItemToolbar index={i} total={gallery.length} onMove={(a, b) => update('gallery', moveItem(gallery, a, b))} onRemove={(idx) => update('gallery', gallery.filter((_, j) => j !== idx))} />
            </li>
          ))}
        </ul>
      </Group>
    </>
  );
}
