# Thư mục `templates/`

Mỗi thư mục con là **một mẫu thiệp**. Ứng dụng tự quét thư mục này khi khởi động
(và khi bấm *Tải lại mẫu* trong trang Quản trị).

| Thư mục | Vai trò |
|---|---|
| `_shared/` | Phần dùng chung: layout, 13 section HTML, `base.css`, `runtime.js` (hiệu ứng, đếm ngược, RSVP…), ảnh demo |
| `_starter/` | **Template mẫu gốc** có chú thích đầy đủ — dùng để sinh template mới. Đọc [`_starter/README.md`](_starter/README.md) |
| `classic-gold/` | Hoàng Kim — sang trọng, viền ánh kim, phong bì sáp |
| `floral-blush/` | Hoa Hồng Pastel — hoa vẽ tay SVG đổi màu theo theme, kéo rèm |
| `minimal-modern/` | Tối Giản — kiểu tạp chí, đánh số section |
| `traditional-red/` | Song Hỷ — đỏ vàng truyền thống, chữ 囍, đèn lồng, lịch âm |

Tạo mẫu mới:

```bash
npm run template:new -- ten-mau --name "Tên Mẫu"     # copy từ _starter
npm run template:new -- ten-mau --from floral-blush  # hoặc copy từ một mẫu có sẵn
npm run template:validate
npm run template:preview ten-mau                    # chụp ảnh preview.webp
```

Thư mục bắt đầu bằng `_` (hoặc `"published": false`) sẽ không hiện ở trang công khai.
