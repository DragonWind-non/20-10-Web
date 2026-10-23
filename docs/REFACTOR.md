# Kết quả dọn repository · 22/10/2026

## Phạm vi thay đổi

- Tách toàn bộ website vào `public/`, giữ nguyên 21 module runtime và kiến
  trúc Vanilla JavaScript + Three.js r128. Server, test và tài liệu nằm ngoài
  gốc được phục vụ.
- Chuyển ảnh, video, bản sao triển khai, báo cáo phiên làm việc, model TinyRobot
  không còn được import, SVG cũ và ba audio mẫu không được dùng sang thư mục
  lưu trữ cục bộ ngoài repository. 411 tệp đã được đối chiếu nội dung với
  Git HEAD ban đầu; khác biệt CRLF/LF của working tree được tính đến.
- Giữ nguyên byte của tài nguyên còn sử dụng. 41 tệp runtime đã được đối
  chiếu với phiên bản trước. Chỉ HTML, CSS của link cá nhân và chú thích
  playlist được sửa: bỏ link hồ sơ cá nhân, dùng Three.js cục bộ và bỏ CSS thừa.
- Thêm README, tài liệu kiến trúc/kiểm thử/bảo mật, npm scripts và quy tắc
  bỏ qua secret, cache, kết quả kiểm thử. Giữ thông báo bản quyền tài nguyên.
- Chuẩn hóa ES Modules trong các test, cập nhật đường dẫn, thay hoặc loại
  sáu test chỉ kiểm tra bản sao logic trong chính bài test. Điều chỉnh các
  predicate Playwright để tương thích CSP mà không cần `unsafe-eval`.

## Bảo mật đã sửa

Kiểm thử bổ sung trước sửa đã tái hiện server trả nội dung `.env` với mã 200
và nhận POST như GET. Server hiện chỉ phục vụ `public/`, chặn đường dẫn vượt
thư mục, tệp ẩn, đường dẫn Windows đặc biệt và junction/symlink ra ngoài;
giới hạn GET/HEAD và trả lỗi không lộ đường dẫn nội bộ. Giữ byte-range để
nhạc có thể phát và seek. Thêm CSP, nosniff, chống nhúng iframe và các header
riêng tư; bỏ CORS wildcard.

Quét theo mẫu trên các tệp văn bản nguồn và 333 blob văn bản trong lịch sử
Git không phát hiện định dạng token thông dụng, private key hoặc credential
gán trực tiếp. Đây không phải chứng nhận rằng mọi dạng bí mật đều được phát
hiện. Lịch sử Git cũ vẫn được giữ ở máy; bản xuất nguồn sạch không chứa nó.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| `npm test` | 43/43 đạt, gồm 21 kiểm thử server |
| Import và tài nguyên public | Các module đều được dùng, đường dẫn hợp lệ, không có tệp ẩn/symlink trong public |
| Giao diện và tương tác lần đầu | 6 cảnh × 4 viewport; desktop, mobile, tiny, landscape đều đạt |
| Fallback | 12 trường hợp: thiếu engine, thiếu WebGL, chế độ thường × 4 viewport |
| Cảm ứng và nhạc | Mobile, tiny và landscape đều đạt: tap, swipe, đọc thư, pause/resume và hai bài nhạc |
| Chuyển cảnh desktop | 6 chuyển cảnh, hàng đợi, tạm dừng, giảm chuyển động; không lỗi JavaScript |
| Chạy dưới `/20-10/` | Đạt, hai bài nhạc phát được, đến stage 6; không request runtime ngoài origin, lỗi HTTP hoặc console |
| Cú pháp và diff | Mọi tệp Python parse được; JavaScript qua `node --check`; `git diff --check` đạt |

Môi trường kiểm tra: Windows, Node.js 24.16.0 và Chrome qua Python Playwright.
Đã xem ảnh desktop và mobile sau thay đổi. Chưa chạy toàn bộ từng script
Python lịch sử, kiểm tra Safari/iPhone thật hoặc đo hiệu năng thiết bị yếu.

## Công khai mã nguồn

Bản xuất sạch chỉ gồm nguồn, test và tài liệu, không có `.git/`, output hay
cache. Xem README trước khi tải lên GitHub: commit việc xóa output không xóa
nó khỏi lịch sử cũ. Quyền phân phối hai bản nhạc chưa được xác minh; cần xử
lý riêng trước khi công khai tài nguyên. Chưa cấp giấy phép chung cho dự án.

Chi tiết kiểm thử, ảnh và báo cáo máy đọc nằm trong `output/` cục bộ, được
Git bỏ qua. Không thay đổi lịch sử Git, commit, push hoặc triển khai production
trong đợt dọn này.
