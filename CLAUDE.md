# Hướng Dẫn Dự Án: 20/10 Romantic 4-Seasons & Anime Night Sky

Trang web trải nghiệm tương tác 3D kỷ niệm Ngày Phụ Nữ Việt Nam 20/10 với phong cách thẩm mỹ bầu trời anime Makoto Shinkai và bộ đôi robot WALL-E & EVE.

## Công Nghệ & Kiến Trúc
- **Ngôn ngữ**: Vanilla JavaScript (ES Modules), CSS3, HTML5
- **Đồ họa 3D**: Three.js (r128) dựng thủ công procedurally 100%, không phụ thuộc file 3D ngoài (GLTF/OBJ) để tối ưu dung lượng và tải tức thì.
- **Không gian âm thanh**: Web Audio API & SoundCloud streaming với đĩa than 3D và lời bài hát đồng bộ.

## Cấu Trúc Mã Nguồn
- `index.html`: Khung giao diện, hộp thoại dẫn truyện, dock nhạc và màn kết 20/10.
- `js/app.js`: Điều phối trung tâm, quản lý chuyển tiếp 6 giai đoạn (Stages 1–6), điều khiển sự kiện chuột/chạm và vòng lặp render.
- `js/scene3d.js`: Quản lý Three.js scene, camera, ánh sáng và hệ thống hạt 4 mùa (Sakura, đom đóm, lá phong thu, hoa tuyết mùa đông, mưa sao băng).
- `js/wall-e.js`: Model 3D robot WALL-E với hệ thống khớp cổ co giãn, xích lăn, mắt nghiêng tò mò, má hồng anime `///` và cử chỉ nắm tay.
- `js/eve.js`: Model 3D robot EVE phong cách Apple nano-ceramic, đầu và tay maglev lơ lửng, mắt LED cyan 2D CanvasTexture 6 trạng thái biểu cảm, bay phi trọng lực và tương tác đồng điệu với WALL-E.
- `js/seasonal-props.js`: Vật phẩm 3D tương tác theo mùa (Tinh thể vũ trụ, Cây Bonsai Sakura, Đèn trời rực rỡ, Hộp quà 20/10, Hộp nhạc tuyết).
- `js/anime-sky.js`: Bầu trời phong cách anime Makoto Shinkai chuyển màu sống động theo từng mùa.
- `js/vinyl-dock.js`: Đĩa than mini 3D, thanh điều khiển phát nhạc và hiển thị lyric karaoke đồng bộ.
- `js/finale.js`: Màn kết Grand Finale trên sườn đồi cỏ trời sao, dòng lời chúc 20/10 cuộn vô tận, WALL-E & EVE tựa vào nhau ngủ thanh thản.

## Quy Trình Kiểm Thử
Chạy các bài kiểm thử tự động với Node.js:
```bash
node tests/test-eve-and-walle-interaction.js
node tests/test-walle-natural-motion.js
node tests/test-robot-emotions.js
node tests/test-scene3d-logic.js
node tests/test-lyric-sync.js
```
