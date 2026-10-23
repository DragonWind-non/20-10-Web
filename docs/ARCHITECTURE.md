# Kiến trúc

Ứng dụng giữ nguyên Vanilla JavaScript và Three.js r128. Các module được tải
trực tiếp qua HTTP; không có bundler, backend dữ liệu, API tài khoản hoặc
dịch vụ streaming âm thanh bên ngoài.

| Nhóm | Module trong `public/js/` | Trách nhiệm |
| --- | --- | --- |
| Điều phối | `app.js` | Khởi tạo ứng dụng, sự kiện, stage và vòng render |
| Cảnh | `scene3d.js`, `scene-layout.js`, `seasonal-world.js`, `anime-sky.js` | Camera, ánh sáng, nền, vật thể và bố cục |
| Nhân vật | `wall-e.js`, `eve.js`, `space-motion.js`, `robot-interaction.js` | Model, chuyển động, biểu cảm và nắm tay |
| Chuyển cảnh | `scene-transition.js`, `liquid-transition.js` | Trình tự rời cảnh, hiệu ứng và vào cảnh |
| Quà và tương tác | `seasonal-props.js`, `prop-delivery.js`, `rose-gift.js`, `pair-moments.js` | Vật phẩm, tặng hoa, thư và tương tác đôi |
| Màn kết | `finale.js`, `lunar-bloom.js` | Cảnh mặt trăng, lời chúc và mầm xanh |
| Giao diện phụ | `pov-guide.js`, `touch-navigation.js` | Hướng dẫn và điều hướng cảm ứng |
| Âm thanh | `audio-manager.js`, `vinyl-dock.js` | Phát nhạc, hủy thao tác cũ, đĩa than và lời nhạc |

`public/config.js` cung cấp nội dung cho ứng dụng. CSS chia theo nhóm giao
diện hiện có; không đổi thứ tự các stylesheet nếu chưa kiểm tra cascade.

Tài nguyên runtime chỉ nằm trong `public/`. `server.js` đặt gốc phục vụ theo
vị trí tệp của chính nó, độc lập với thư mục làm việc khi khởi chạy. Kiểm thử
có thể dùng `createServer(root)` với thư mục fixture riêng; CLI luôn dùng
`public/` của dự án.

Khi sửa luồng stage, cần kiểm tra cả điều hướng, quà đang chạy, thao tác chạm,
chế độ giảm chuyển động và màn kết. Giữ thứ tự nắm tay, rời cảnh, chuyển nền,
đến cảnh mới. Giao diện và vòng render vẫn dùng các module gốc để tránh thay
đổi hoạt ảnh chỉ vì tổ chức lại repository.
