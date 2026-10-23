# Kiểm thử

## Node.js

```sh
npm test
```

Không cần `npm install`. Kiểm thử HTTP tự mở cổng ngẫu nhiên và tự đóng server;
không phụ thuộc preview trên cổng 3000. Có thể chạy riêng:

```sh
node --test tests/test-server.js
node --test tests/test-public-files.js
```

Kiểm thử server bao gồm URL lỗi, GET/HEAD, phương thức bị từ chối, byte ranges,
tệp rỗng, tệp nội bộ, traversal đã encode, đường dẫn Windows, junction/symlink
vượt thư mục và chạy CLI từ một working directory khác. Các fixture junction
chỉ trỏ tới thư mục tạm của chính bài kiểm thử.

Một số kiểm thử còn kiểm tra cấu trúc nguồn; chúng không chứng minh giao diện
thực tế. Sáu tệp cũ chỉ kiểm tra bản sao công thức nằm trong chính bài test đã
được loại bỏ hoặc thay bằng kiểm thử trực tiếp các module hiện tại. Các tên
tệp trong hướng dẫn cục bộ được giữ hoạt động. Kiểm thử lyric gọi trực tiếp `AudioManager.checkLyrics`.
Dùng kiểm thử trình duyệt bên dưới cho luồng người dùng.

## Trình duyệt

Cần Google Chrome, Python 3 và gói Python `playwright`. Nếu máy chưa có:

```sh
python -m pip install playwright
```

Mở `npm start` ở terminal thứ nhất. Ở terminal thứ hai, chạy từ gốc dự án:

```sh
python tests/test-discovery.py
python tests/test-greeting-fallback.py --output output/validation/fallback
python tests/test-mobile-input.py
python tests/test-liquid-passage.py --viewport desktop --output output/validation/passage
```

`test-discovery.py` kiểm tra cả sáu stage tại desktop 1440×900, mobile 390×844,
màn nhỏ 320×568 và ngang 844×390: nút dễ thấy, kích thước chạm, quà và thư,
focus bàn phím, giảm chuyển động, màn kết và lỗi JavaScript.

`test-greeting-fallback.py` chặn engine Three.js hoặc WebGL rồi kiểm tra thiệp
fallback, đọc và cuộn lời chúc, thử lại và chuyển sang giao diện thường.

`test-mobile-input.py` kiểm tra chạm, vuốt và ngăn điều hướng khi đang đọc.
`test-liquid-passage.py` kiểm tra chuyển cảnh có thứ tự, liên tục và thao tác
đổi hướng nhanh. Các bài này dùng đồng hồ cảnh có thể điều khiển để quan sát
chính xác hoạt ảnh. Kiểm tra thêm trên thiết bị thật khi thay đổi render hoặc
hiệu năng; trình duyệt headless không thay thế phép đo trên điện thoại thật.

Ảnh và kết quả nằm trong `output/` hoặc thư mục tạm theo tùy chọn từng bài.
Không commit các tệp sinh ra này.
