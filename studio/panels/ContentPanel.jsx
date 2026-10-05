import { Group, SuggestButton, TextArea, TextField } from '../components/fields.jsx';

const FIELDS = [
  { key: 'headline', label: 'Tiêu đề nhỏ (trên tên)', max: 80, line: true },
  { key: 'invitation', label: 'Lời mời', max: 1200, rows: 5 },
  { key: 'quote', label: 'Câu trích dẫn', max: 400, rows: 2 },
  { key: 'coupleIntro', label: 'Giới thiệu cặp đôi', max: 600, rows: 2 },
  { key: 'thankYou', label: 'Lời cảm ơn', max: 800, rows: 3 },
  { key: 'rsvpNote', label: 'Ghi chú xác nhận tham dự', max: 300, rows: 2 },
  { key: 'giftNote', label: 'Ghi chú hộp mừng cưới', max: 400, rows: 2 },
  { key: 'hashtag', label: 'Hashtag', max: 40, line: true },
];

export function ContentPanel({ data, update, meta, suggest, busy, regenerateAll }) {
  const toneLabel = meta.tones.find((t) => t.id === data.tone)?.label || data.tone;
  const c = data.content;
  const suggestField = (key) =>
    suggest(key, (v) => {
      if (key === 'quote') {
        update('content', { ...data.content, quote: v.quote, quoteAuthor: v.quoteAuthor });
      } else update(`content.${key}`, v);
    });

  return (
    <>
      <div class="callout">
        <p>Toàn bộ lời văn đã được viết sẵn theo giọng <strong>{toneLabel.toLowerCase()}</strong> (đổi ở tab Cặp đôi). Bấm <strong>✨ Gợi ý khác</strong> ở từng mục để đổi, hoặc tự viết theo ý bạn.</p>
        <button type="button" class="btn btn--sm" onClick={regenerateAll} disabled={!!busy}>✨ Viết lại tất cả</button>
      </div>
      <Group>
        {FIELDS.map((f) =>
          f.line ? (
            <TextField
              key={f.key}
              label={f.label}
              value={c[f.key]}
              maxLength={f.max}
              onInput={(v) => update(`content.${f.key}`, v)}
              suffix={<SuggestButton busy={busy === f.key} label="Gợi ý" onClick={() => suggestField(f.key)} />}
            />
          ) : (
            <div key={f.key}>
              <TextArea
                label={f.label}
                value={c[f.key]}
                maxLength={f.max}
                rows={f.rows}
                onInput={(v) => update(`content.${f.key}`, v)}
                action={<SuggestButton busy={busy === f.key} onClick={() => suggestField(f.key)} />}
              />
              {f.key === 'quote' && <TextField label="Tác giả câu trích dẫn" value={c.quoteAuthor} maxLength={80} onInput={(v) => update('content.quoteAuthor', v)} />}
            </div>
          ),
        )}
      </Group>
      <Group title="SEO & chia sẻ" description="Tiêu đề và mô tả khi gửi link qua Zalo, Messenger, Facebook.">
        <TextField label="Tiêu đề trang" placeholder="Mặc định: Minh & Hà — Thiệp cưới" value={data.seo.title} maxLength={120} onInput={(v) => update('seo.title', v)} />
        <TextArea label="Mô tả" rows={2} maxLength={300} placeholder="Mặc định: ngày cưới + trích lời mời" value={data.seo.description} onInput={(v) => update('seo.description', v)} />
      </Group>
    </>
  );
}
