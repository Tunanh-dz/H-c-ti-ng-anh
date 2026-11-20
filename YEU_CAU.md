# Yêu cầu đã điều chỉnh — Giai đoạn 1

Bản này bổ sung cho prompt gốc. Chỗ nào khác prompt gốc thì theo bản này.

## Giao diện
- Phong cách **tím gradient hiện đại**: nền sáng, tiêu đề và nút chuyển màu tím → hồng/xanh,
  bo góc lớn, bóng đổ mềm, biểu tượng rõ ràng.
- **Sáng / tối**: mặc định theo cài đặt của máy, có nút đổi tay (ghi nhớ lựa chọn).
- Điện thoại: một cột, thanh tab ở đáy màn hình, nút cao ≥ 44px.

## Chức năng thêm
1. **Chế độ dùng thử**: nút "Dùng thử không cần đăng nhập" ở màn hình đăng nhập.
   Dữ liệu lưu trên trình duyệt (localStorage), không đồng bộ, có thông báo rõ.
   Mọi chức năng chạy được, trừ chia sẻ tiến độ (cần tài khoản).
   → Thêm `js/db.js`: một lớp truy cập dữ liệu, chọn Supabase hoặc bộ nhớ trình duyệt.
2. **Động lực học**: chuỗi ngày học liên tiếp (streak), điểm kinh nghiệm (XP),
   mục tiêu số câu mỗi ngày (mặc định 10, chỉnh được), biểu đồ 7 ngày gần nhất.
   → Thêm bảng `study_log` (mỗi lần luyện/ôn một dòng) + RLS.
3. **Luyện nói (shadowing)**: ghi âm giọng đọc theo câu, nghe lại, phát lại câu gốc để so.
   Bản ghi chỉ giữ tạm trong trang, **không lưu, không tải lên**.
4. **Đọc câu bằng giọng máy**: nút loa dùng giọng đọc có sẵn của trình duyệt (Web Speech API).
5. **Bài học mẫu có sẵn**: người dùng sẽ gửi link video và các câu kèm mốc thời gian.
   Có nút "Thêm bài học mẫu" để nạp vào tài khoản.

## Cách làm
- Làm liền các bước B → G, tự chạy thử trong trình duyệt sau mỗi bước,
  chỉ dừng khi cần người dùng quyết định.
- Cuối cùng: README từng bước, danh sách tự kiểm tra, giới hạn đã biết.
- Hướng dẫn đưa lên mạng bằng **GitHub Pages**.
