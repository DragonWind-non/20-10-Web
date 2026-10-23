# Ranh giới bảo mật

## Website và server preview

- Chỉ `public/` được phục vụ. Không đặt token, `.env`, cấu hình tài khoản,
  bản sao lưu hoặc tài liệu riêng trong thư mục này.
- Server chỉ lắng nghe `127.0.0.1`, hỗ trợ GET và HEAD. Các phương thức khác
  trả 405. Không bật CORS wildcard.
- URL lỗi trả 400; tệp ẩn, traversal và symlink/junction thoát khỏi public trả
  404. Đường dẫn được decode, kiểm tra và resolve trước khi mở tệp.
- Nội dung lỗi HTTP không trả stack trace hay đường dẫn máy.
- CSP chỉ cho script cùng origin; Three.js r128 đã nằm trong `public/vendor/`.
  CSS vẫn cho phép inline style vì giao diện hiện dùng thuộc tính style và
  cập nhật style qua JavaScript. Không bật `unsafe-eval` hoặc inline script.
- Server gửi `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`
  và tắt camera, microphone, geolocation qua Permissions Policy.

Hosting khác cần cấu hình các header này riêng. GitHub Pages không thực thi
các header của `server.js`; luôn xuất bản riêng `public/`. Thư mục này không
chứa dữ liệu cần xác thực. Mã JavaScript và nội dung thiệp đều công khai theo
thiết kế; giấu nút hay đổi tên tệp không bảo vệ được bí mật.

## Git và dữ liệu cục bộ

`.gitignore` ngăn tệp môi trường, khóa riêng, cache và `output/` mới được thêm
nhầm. Nó không loại bỏ tệp đã được commit trong lịch sử. Bản ZIP nguồn sạch
không chứa `.git/`, lịch sử cũ, ảnh kiểm thử hay thông tin lần triển khai trước.

Nếu phát hiện credential thật trong bất kỳ commit nào, thu hồi hoặc đổi
credential đó trước; sau đó xử lý lịch sử theo hướng dẫn của nhà cung cấp và
[GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
Không tự force-push hoặc viết lại lịch sử của người cùng làm việc.

Không có tài khoản người dùng, database hoặc upload trong website này. Không
thêm các tầng xác thực hay xử lý dữ liệu giả định chỉ để làm cấu trúc phức tạp.

## Thư viện và tài nguyên

Three.js được giữ tại r128 để bảo toàn hành vi hiện có; đây là phiên bản cũ,
không phải tuyên bố đã audit toàn bộ thư viện. Khi nâng cấp, cần kiểm tra lại
vật liệu, shader, render và các hoạt ảnh. Ghi rõ nguồn và giữ giấy phép MIT.

Quyền phân phối nhạc là vấn đề riêng với bảo mật. Thông báo tác giả không
thay thế giấy phép sử dụng; xem `THIRD_PARTY_NOTICES.md` trước khi công khai.
