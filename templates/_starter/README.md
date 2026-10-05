# Template mẫu (`_starter`)

Đây là **khung gốc** để tạo ra các mẫu thiệp mới. Thư mục bắt đầu bằng `_` nên mẫu này
không hiện ở trang công khai, nhưng vẫn render được đầy đủ (admin xem tại `/templates/_starter`).

## 1. Tạo mẫu mới trong 30 giây

```bash
npm run template:new -- vuon-xanh --name "Vườn Xanh" --description "Mẫu tông xanh lá"
# → tạo thư mục templates/vuon-xanh (copy từ _starter), published = false

npm run template:validate          # kiểm tra mọi template.json
npm run dev                         # mở http://localhost:3000/templates/vuon-xanh (đăng nhập admin)
npm run template:shot -- vuon-xanh  # chụp intro / lúc mở / hero / toàn trang + tự kiểm tra lỗi → .shots/vuon-xanh/
npm run template:preview vuon-xanh  # chụp ảnh preview.webp cho trang chọn mẫu
```

Khi đã ưng ý: đặt `"published": true` trong `template.json`. Ở môi trường Docker production,
vào trang **Admin → Mẫu thiệp → Tải lại** (hoặc restart container) để nạp mẫu mới.

## 2. Cấu trúc thư mục

```
templates/
├── _shared/              ← dùng chung, KHÔNG sửa khi làm mẫu mới
│   ├── layout.njk        ← <head>, SEO, font, biến màu, intro, nhạc, script
│   ├── macros.njk        ← title(), divider(), icon(), photo()...
│   ├── sections/*.njk    ← HTML chuẩn của 13 section
│   ├── partials/*.njk    ← intro (phong bì/rèm), nút nhạc, footer
│   ├── base.css          ← bố cục & component cho mọi mẫu
│   └── runtime.js        ← hiệu ứng, đếm ngược, lightbox, RSVP...
└── ten-mau/
    ├── template.json     ← khai báo (bắt buộc)
    ├── index.njk         ← trang chính, kế thừa layout.njk (bắt buộc)
    ├── style.css         ← "cá tính" của mẫu
    ├── preview.webp      ← ảnh thumbnail (tạo bằng template:preview)
    ├── sections/hero.njk ← (tuỳ chọn) ghi đè section dùng chung
    └── *.svg             ← (tuỳ chọn) hoạ tiết trang trí
```

**Quy tắc ghi đè:** engine tìm file trong thư mục mẫu trước, rồi mới tới `_shared`.
Muốn đổi HTML phần nào → tạo file cùng đường dẫn, ví dụ `sections/hero.njk`,
`partials/intro.njk`, hoặc `macros.njk`. Nên copy file gốc từ `_shared` rồi sửa.

## 3. `template.json`

| Trường | Ý nghĩa |
|---|---|
| `name`, `description`, `tags` | Hiển thị ở trang chọn mẫu |
| `published` | `false` = ẩn khỏi trang công khai (chỉ admin thấy) |
| `order` | Thứ tự hiển thị (nhỏ đứng trước) |
| `preview` | Ảnh thumbnail (`.webp/.png/.jpg` — dùng làm ảnh chia sẻ Zalo/Facebook) |
| `styles`, `scripts` | File CSS/JS riêng của mẫu (đường dẫn tương đối) |
| `defaults.tone` | Giọng văn tự sinh: `classic` · `romantic` · `modern` · `traditional` |
| `defaults.theme.colors` | 6 màu: `primary`, `secondary`, `background`, `surface`, `text`, `accent` |
| `defaults.theme.fonts` | `heading`, `body`, `script` — phải nằm trong danh sách `FONTS` (`server/lib/schema.js`, đều hỗ trợ tiếng Việt) |
| `defaults.theme.effect`, `effect2` | Hiệu ứng nền, có thể chồng 2 lớp: `petals` · `sakura` · `plum` (hoa mai) · `leaves` · `hearts` · `sparkles` · `golddust` · `fireflies` · `bokeh` · `butterflies` · `stars` · `lanterns` · `bubbles` · `balloons` · `snow` · `confetti` · `none` |
| `defaults.theme.effectIntensity` | `low` · `medium` · `high` |
| `defaults.theme.burst` | Hiệu ứng ngay khi mở thiệp: `fireworks` · `confetti` · `hearts` · `petals` · `none` |
| `defaults.theme.tap` | Hiệu ứng khi khách chạm màn hình: `hearts` · `sparkles` · `ripple` · `none` |
| `defaults.theme.nameAnimation` | Tên cô dâu chú rể xuất hiện: `fade` · `handwrite` · `letters` · `shimmer` · `glow` · `float` · `none` |
| `defaults.theme.intro` | `envelope` · `curtain` · `doors` · `card` · `scroll` · `circle` · `fade` · `none` |
| `defaults.sections` | Các section bật sẵn + thứ tự mặc định |
| `palettes` | Bảng màu gợi ý cho người dùng chọn nhanh trong editor |

## 4. Biến dùng trong template (Nunjucks)

| Biến | Ví dụ / mô tả |
|---|---|
| `first`, `second` | Người đứng trước / sau (theo tuỳ chọn thứ tự tên). Có `fullName`, `shortName`, `initial`, `photo`, `bio`, `father`, `mother`, `address` |
| `groom`, `bride` | Chú rể, cô dâu (cùng cấu trúc như trên) |
| `names`, `monogram` | `"Anh & Hà"`, `"AH"` |
| `wedding` | `day`, `month`, `year`, `weekday` ("Chủ Nhật"), `display` ("20.12.2026"), `long`, `timeText`, `lunar.text` ("ngày 12 tháng 11 năm Bính Ngọ"), `lunar.canChi`, `calendar` (lưới tháng) |
| `events[]` | `title`, `when` (giống `wedding`), `venue`, `address`, `mapLink`, `mapEmbed`, `calendarLink`, `note` |
| `mainEvent` | Sự kiện chính (tiệc cưới) |
| `content` | `headline`, `invitation`, `quote`, `quoteAuthor`, `coupleIntro`, `thankYou`, `rsvpNote`, `giftNote`, `hashtag` |
| `story[]`, `gallery[]` | Chuyện tình yêu, album ảnh (`image.url`, `image.thumb`, `image.w`, `image.h`) |
| `gift.accounts[]` | `ownerLabel`, `bankName`, `accountNumber`, `accountName`, `qrSvg` (VietQR tạo sẵn) |
| `guest.name` | Tên khách lấy từ `?to=` trên link (đã escape) |
| `sections`, `hasSection` | Danh sách section đang bật / tra nhanh `hasSection.gallery` |
| `theme` | Màu, font, hiệu ứng đang dùng |
| `mode` | `live` · `preview` · `demo` |
| `asset('file.svg')` | URL tới file trong thư mục mẫu (có cache-busting) |

Bộ lọc tiện ích: `| nl2br` (xuống dòng), `| paragraphs` (tách đoạn), `| pad2`.
Mọi biến đều được **tự động escape** — đừng dùng `| safe` cho dữ liệu người dùng nhập.

## 5. CSS

Màu & font người dùng chọn được đưa vào biến CSS — **luôn dùng biến, đừng hard-code** để
người dùng đổi màu được:

```css
--c-primary --c-secondary --c-accent --c-bg --c-surface --c-text
--f-heading --f-body --f-script
/* phái sinh sẵn trong base.css */
--c-muted --c-line --c-soft --radius --shadow --shadow-sm
```

- Tạo sắc độ: `color-mix(in srgb, var(--c-primary) 30%, #fff)`.
- Hoạ tiết SVG đổi màu theo theme: dùng `mask: url(corner.svg)` + `background: var(--c-primary)`
  (xem `classic-gold/style.css`).
- Chỉ CSS của **một** mẫu được nạp mỗi trang, nên selector `.tpl ...` là đủ.
- Chữ ánh kim (`background-clip: text`) cho tên cô dâu chú rể: đặt lên **các span con** (`.hero__name`)
  chứ không đặt lên thẻ `[data-names]` — runtime tự xử lý, nhưng đặt trên span con luôn an toàn nhất.
- Hình dạng phong bì, cổng, thiệp gập, cuộn thư… lấy màu từ `--c-primary`/`--c-accent`/`--c-surface`;
  có thể tinh chỉnh bằng class `.intro--<kiểu>`, `.envelope`, `.door`, `.gcard__cover`, `.scrollpaper__paper`.
- Trang trí bên trong thẻ mở thiệp: tạo `partials/intro-decor.njk` (không cần chép lại cả intro).

## 6. Hook của runtime (không cần viết JS)

| Thuộc tính | Tác dụng |
|---|---|
| `data-reveal="up|fade|zoom|left|right|rise|blur|flip|drop"` | Hiện dần khi cuộn tới |
| `data-stagger` (trên thẻ cha) | Các con có `data-reveal` hiện lần lượt |
| `data-names` (trên thẻ `<h1>` tên) | Bắt buộc ở hero — để áp dụng kiểu chữ chuyển động (viết tay, từng chữ…) |
| `data-parallax="0.2"` | Hoạ tiết trôi chậm hơn khi cuộn (hiệu ứng chiều sâu) |
| `<svg data-draw>` | Các nét SVG tự vẽ khi cuộn tới (đường viền, hoa văn) |
| `data-countdown="2026-12-20T10:00:00+07:00"` | Đồng hồ đếm ngược (kèm `[data-unit=days|hours|minutes|seconds]`) |
| `data-lightbox` trên thẻ `<a href="ảnh-lớn">` | Mở ảnh toàn màn hình, vuốt qua lại |
| `data-copy="nội dung"` | Nút sao chép |
| `data-form="rsvp|wishes"` | Gửi form không reload trang |
| `data-intro-open` | Nút mở thiệp |

## 7. Xem thử nhanh mọi hiệu ứng

Trang demo nhận tham số để thử kết hợp mà không phải sửa `template.json`:

```
/templates/vuon-xanh?effect=butterflies&effect2=golddust&intro=doors&burst=fireworks&name=handwrite&tap=hearts
/templates/vuon-xanh?script=Send%20Flowers&heading=Bona%20Nova&body=Manrope
```

## 8. Checklist trước khi `published: true`

- [ ] Màn hình 320px, 390px và desktop 1366px đều đẹp, không tràn ngang.
- [ ] Tên rất dài ("Nguyễn Hoàng Bảo Ngọc Anh Thư") vẫn xuống dòng gọn gàng.
- [ ] Không có ảnh nào (chưa upload) vẫn đẹp — section ảnh tự ẩn, ảnh cô dâu/chú rể hiện chữ cái đầu.
- [ ] Thử 2–3 bảng màu khác nhau trong editor: chữ vẫn đủ tương phản.
- [ ] Bật "Giảm chuyển động" của hệ điều hành: nội dung vẫn hiện đầy đủ.
- [ ] Tắt JavaScript: vẫn đọc được toàn bộ thiệp.
- [ ] `npm run template:validate` không báo lỗi; `npm test` xanh.
