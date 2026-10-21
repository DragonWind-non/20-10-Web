# Hành trình bốn mùa · 20/10

Website thiệp chúc mừng Ngày Phụ nữ Việt Nam, với WALL-E và EVE, sáu phân cảnh
3D, quà theo mùa, lời chúc và trình phát nhạc. Dùng HTML, CSS, JavaScript ES
Modules và Three.js r128; không cần bước build hay cài dependency để chạy.

## Chạy tại máy

Cài Node.js **22.13 trở lên**, rồi chạy trong thư mục dự án:

```sh
npm start
```

Mở **http://127.0.0.1:3000**. Có thể chạy trực tiếp bằng `node server.js`.
Server chỉ lắng nghe trên loopback. Đổi cổng trong PowerShell:

```powershell
$env:PORT = '3001'
npm start
```

Đừng mở `index.html` bằng `file://`: ES Modules cần HTTP. Nhạc bắt đầu sau
tương tác của người dùng theo chính sách autoplay của trình duyệt. Nếu Three.js
hoặc WebGL không hoạt động, trang chuyển sang thiệp lời chúc có thể đọc được.

## Cấu trúc

```text
public/                 Toàn bộ website được phép phục vụ qua HTTP
  index.html            Giao diện và các nút tương tác
  config.js             Nội dung lời chúc, người nhận và playlist công khai
  js/                   Các module giao diện, robot, cảnh và âm thanh
  css/                  Giao diện và bố cục responsive
  assets/               Ảnh nền, texture và hai bản nhạc đang sử dụng
  vendor/               Three.js r128 và giấy phép MIT gốc
server.js               Server preview; chỉ phục vụ public/
tests/                  Kiểm thử Node.js và kiểm thử trình duyệt bằng Python
docs/                   Kiến trúc, tài nguyên, kiểm thử và bảo mật
output/                 Báo cáo và ảnh kiểm thử cục bộ, được Git bỏ qua
```

Luồng ứng dụng bắt đầu ở `public/js/app.js`. Xem [kiến trúc](docs/ARCHITECTURE.md)
trước khi sửa các tương tác hoặc chuyển cảnh. Tùy chỉnh nội dung trong
`public/config.js`; đây là tệp **công khai**, không được chứa bí mật.

## Kiểm tra

```sh
npm test
```

Lệnh này chạy tất cả kiểm thử JavaScript bằng test runner có sẵn của Node.js,
bao gồm kiểm thử HTTP, Range audio, ranh giới thư mục public và các module.
Kiểm thử trình duyệt cần Chrome và Python Playwright; xem [hướng dẫn kiểm thử](docs/TESTING.md).

## Đưa lên GitHub và hosting

Nguồn của dự án gồm `public/`, `tests/`, `docs/`, `server.js`, `package.json`,
`.gitignore` và các tệp Markdown ở gốc. Không đưa `output/`, `.env`, khóa riêng,
cache công cụ hoặc bản sao triển khai lên kho công khai.

**Lưu ý với kho Git đã có lịch sử:** xóa tệp khỏi phiên bản hiện tại hoặc thêm
vào `.gitignore` không loại bỏ nội dung của các commit cũ. Thư mục `output/`
của phiên bản trước từng chứa khoảng 506 MiB ảnh, video và bản sao website.
Nếu muốn kho công khai mới không mang các nội dung đó, dùng bản nguồn xuất
sạch hoặc sao chép các mục nguồn kể trên sang một thư mục mới, không sao chép
`.git/`. Giữ kho gốc làm lịch sử cục bộ. Không force-push lịch sử đã viết lại
khi chưa thống nhất với những người cùng dùng kho.

Khi triển khai website tĩnh, chọn **`public/` làm thư mục xuất bản**; không
cần lệnh build. Các đường dẫn tài nguyên là tương đối nên có thể phục vụ dưới
đường dẫn con của repository. GitHub lưu mã nguồn không tự chạy `server.js`.
Nếu dùng GitHub Pages, cần cấu hình quy trình xuất bản `public/` riêng.

Các HTTP security header của server preview chỉ có hiệu lực khi dùng server
này. Khi dùng hosting khác, thiết lập header tương ứng tại hosting; xem
[ranh giới bảo mật](docs/SECURITY.md).

## Tài nguyên và quyền sử dụng

Thông tin nguồn ảnh và credit nằm trong [docs/ASSETS.md](docs/ASSETS.md).
Giữ [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) và giấy phép Three.js.
Hai bản nhạc hiện có chưa kèm giấy phép phân phối lại; cần xác minh quyền sử
dụng hoặc thay bằng bản nhạc được phép chia sẻ trước khi công khai. Dự án
chưa cấp giấy phép chung cho toàn bộ mã và tài nguyên.
