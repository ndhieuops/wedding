# Thư mục `templates/`

Mỗi thư mục con là **một mẫu thiệp**. Ứng dụng tự quét thư mục này khi khởi động
(và khi bấm *Tải lại mẫu* trong trang Quản trị).

| Thư mục | Vai trò |
|---|---|
| `_shared/` | Phần dùng chung: layout, 13 section HTML, `base.css`, `effects.js` (hiệu ứng canvas), `runtime.js` (mở thiệp, đếm ngược, RSVP…), ảnh demo |
| `_starter/` | **Template mẫu gốc** có chú thích đầy đủ — dùng để sinh template mới. Đọc [`_starter/README.md`](_starter/README.md) |
| `classic-gold/` | Hoàng Kim — sang trọng, viền ánh kim, phong bì sáp |
| `floral-blush/` | Hoa Hồng Pastel — hoa vẽ tay SVG đổi màu theo theme, kéo rèm |
| `minimal-modern/` | Tối Giản — kiểu tạp chí, đánh số section |
| `traditional-red/` | Song Hỷ — đỏ vàng truyền thống, chữ 囍, đèn lồng, lịch âm |
| `garden-sage/` | Vườn Xanh — cổng vòm vườn, cành bạch đàn & ô liu tự vẽ nét, mở cổng gỗ mắt cáo |
| `midnight-stars/` | Đêm Sao — nền navy, bản đồ sao, chòm sao tự vẽ nét, rèm nhung (giao diện tối) |
| `lotus-heritage/` | Sen Việt — hoa sen, sóng nước, hoa văn trống đồng, mở cuộn thư lụa |
| `sakura-dream/` | Anh Đào — giấy washi, cành anh đào nét mực, vòng Ensō, triện son chữ lồng |
| `rustic-kraft/` | Mộc Mạc — giấy kraft, dây gai, nhãn viết tay, ảnh polaroid, phong bì kraft |
| `ocean-breeze/` | Biển Xanh — sóng biển chuyển động, hoàng hôn, vỏ sò, lá dừa |
| `luxury-marble/` | Cẩm Thạch — đá cẩm thạch, vàng hồng, hoạ tiết Art Deco, cửa mạ vàng |
| `indochine/` | Đông Dương — cửa vòm, cửa chớp lá sách, gạch bông, lá chuối |
| `tet-blossom/` | Xuân Hỷ — mai vàng, hoa đào, dây pháo, tờ lịch, chữ 囍 trên nền kem |
| `playful-pastel/` | Kẹo Ngọt — pastel trẻ trung, sticker, ca rô, bóng bay |

Tạo mẫu mới:

```bash
npm run template:new -- ten-mau --name "Tên Mẫu"     # copy từ _starter
npm run template:new -- ten-mau --from floral-blush  # hoặc copy từ một mẫu có sẵn
npm run template:validate
npm run template:preview ten-mau                    # chụp ảnh preview.webp
npm run template:shot -- ten-mau                    # chụp mọi trạng thái để tự kiểm tra (.shots/ten-mau/)
```

Thư mục bắt đầu bằng `_` (hoặc `"published": false`) sẽ không hiện ở trang công khai.
