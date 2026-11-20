# 🎧 Học tiếng Anh qua video YouTube

Trang web tự học tiếng Anh: dán link YouTube, chia video thành từng câu, rồi luyện
**nghe & lặp, chép chính tả, dịch ngược, điền từ, viết theo khung câu, luyện nói** và
**ôn tập theo lịch** (hộp Leitner). Đăng nhập bằng email + mật khẩu, tiến độ đồng bộ
giữa điện thoại và máy tính. Giao diện tiếng Việt, màu tím, có chế độ sáng / tối.

Không cần cài thư viện, không cần npm. Chỉ có HTML, CSS và JavaScript.

---

## Mục lục
1. [Dùng thử ngay (không cần Supabase)](#1-dùng-thử-ngay-không-cần-supabase)
2. [Tạo dự án Supabase](#2-tạo-dự-án-supabase)
3. [Điền config.js](#3-điền-configjs)
4. [Cài đặt đăng nhập bằng email + mật khẩu](#4-cài-đặt-đăng-nhập-bằng-email--mật-khẩu)
5. [Chạy trên máy và đăng nhập](#5-chạy-trên-máy-và-đăng-nhập)
6. [Đưa lên mạng bằng GitHub Pages (để dùng trên điện thoại)](#6-đưa-lên-mạng-bằng-github-pages)
7. [Cách dùng](#7-cách-dùng)
8. [Danh sách tự kiểm tra](#8-danh-sách-tự-kiểm-tra)
9. [Gặp lỗi thì làm gì](#9-gặp-lỗi-thì-làm-gì)
10. [Cấu trúc thư mục](#10-cấu-trúc-thư-mục)
11. [Giới hạn đã biết](#11-giới-hạn-đã-biết)

---

## 1. Dùng thử ngay (không cần Supabase)

Bạn cần **Python** (máy bạn đã có). Kiểm tra: mở **PowerShell** và gõ

```bash
python --version
```

✅ Thấy dòng dạng `Python 3.x.x` là được.

1. Mở PowerShell **trong thư mục dự án** (trong File Explorer, mở thư mục dự án,
   bấm vào thanh địa chỉ, gõ `powershell` rồi Enter).
2. Chạy:
   ```bash
   python serve.py
   ```
   ✅ Thấy dòng `Đang chạy tại http://localhost:5500`. **Để nguyên cửa sổ này**.
3. Mở trình duyệt, vào `http://localhost:5500`.
4. Bấm **🚀 Dùng thử không cần đăng nhập**.

✅ Bạn thấy trang chủ màu tím, có dải vàng "Bạn đang ở chế độ dùng thử".

> Chế độ dùng thử lưu dữ liệu trên trình duyệt này thôi, không đồng bộ và không chia sẻ được.
> Muốn dùng đầy đủ thì làm tiếp các bước 2 → 5.

> ⚠️ Không mở file `index.html` bằng cách bấm đúp — trang sẽ không chạy (trình duyệt chặn
> JavaScript dạng module khi mở trực tiếp file). Luôn mở qua `http://localhost:5500`.

---

## 2. Tạo dự án Supabase

1. Vào <https://supabase.com>, đăng ký / đăng nhập.
2. Bấm **New project**. Đặt tên (ví dụ `hoc-tieng-anh`), đặt mật khẩu database (lưu lại
   ở chỗ an toàn), chọn Region gần nhất (ví dụ **Singapore**). Bấm **Create**. Đợi 1–2 phút.
3. Ở menu bên trái chọn **SQL Editor** → **New query**.
4. Mở file `sql/schema.sql` bằng Notepad, **chọn tất cả (Ctrl + A), sao chép (Ctrl + C)**,
   dán vào ô SQL của Supabase, bấm **Run**.

✅ Kiểm tra: dòng kết quả ghi **Success. No rows returned**.
✅ Vào **Table Editor**: thấy 6 bảng `videos`, `segments`, `progress`, `my_examples`,
`shares`, `study_log`. Mỗi bảng **không** có nhãn đỏ "RLS disabled / Unrestricted".

> File SQL chạy lại nhiều lần cũng không sao.

---

## 3. Điền config.js

1. Trong Supabase: **Project Settings** (bánh răng) → **API** (hoặc **Data API**).
2. Sao chép **Project URL** (dạng `https://abcdxyz.supabase.co`).
3. Sao chép khóa **anon public** (có thể tên là **Publishable key**).
4. Mở `config.js`, thay:
   ```js
   export const SUPABASE_URL = 'DIEN_PROJECT_URL_VAO_DAY';
   export const SUPABASE_ANON_KEY = 'DIEN_ANON_KEY_VAO_DAY';
   ```
   thành giá trị của bạn (giữ nguyên dấu nháy `'...'`). Lưu file.

> 🔐 **Chỉ** dùng khóa *anon / publishable*. **Không bao giờ** dán khóa `service_role`
> hay `secret` vào đây — ai mở trang web cũng đọc được file này. Khóa anon thì an toàn
> để công khai, vì dữ liệu đã được bảo vệ bằng Row Level Security trong `schema.sql`.

✅ Tải lại trang `http://localhost:5500`: dải vàng "Chưa cấu hình Supabase" **biến mất**,
các ô Email / Mật khẩu bấm được.

---

## 4. Cài đặt đăng nhập bằng email + mật khẩu

Trong Supabase:

1. **Authentication** → **Sign In / Providers** (hoặc **Providers**) → **Email**:
   - **Enable Email provider**: bật (mặc định đã bật).
   - **Confirm email**: nên **TẮT** → tạo tài khoản xong là vào học ngay, không cần mở email.
     (Nếu để BẬT: sau khi tạo tài khoản phải bấm link xác nhận trong email rồi mới đăng nhập được.)
   - Bấm **Save**.
2. **Authentication** → **URL Configuration** (dùng cho email "Quên mật khẩu"):
   - **Site URL**: `http://localhost:5500`
   - **Redirect URLs** → **Add URL**: `http://localhost:5500`
     (sau khi làm bước 6, thêm cả link GitHub Pages).
   - Bấm **Save**.

> Email "quên mật khẩu" / "xác nhận" do Supabase gửi miễn phí nhưng **giới hạn vài email mỗi giờ**.

---

## 5. Chạy trên máy và đăng nhập

1. Đang chạy `python serve.py` (bước 1). Nếu lỡ tắt thì chạy lại.
2. Vào `http://localhost:5500`. Nếu đang ở chế độ dùng thử, bấm nút thoát ở góc trên bên phải.
3. Chọn **Tạo tài khoản** → nhập tên hiển thị (không bắt buộc), email, mật khẩu (ít nhất 6 ký tự)
   hai lần → **Tạo tài khoản**.
4. Lần sau: chọn **Đăng nhập** → email + mật khẩu.
5. Quên mật khẩu: bấm **Quên mật khẩu?** → nhập email → mở email → bấm link
   (trên cùng trình duyệt) → nhập mật khẩu mới.

✅ Vào được trang chủ, thấy "Chào *tên của bạn*!", góc trên hiện email. Tải lại trang (F5) vẫn đăng nhập.
✅ Trong Supabase → **Authentication → Users** thấy tài khoản vừa tạo.

---

## 6. Đưa lên mạng bằng GitHub Pages

Để mở được trên điện thoại, trang cần một địa chỉ trên mạng.

1. Tạo tài khoản tại <https://github.com> (nếu chưa có).
2. Bấm **+** (góc trên phải) → **New repository**. Đặt tên, ví dụ `hoc-tieng-anh`.
   Chọn **Public**. Bấm **Create repository**.
3. Trong trang repository vừa tạo, bấm **uploading an existing file**
   (hoặc **Add file → Upload files**).
4. Mở thư mục dự án, **kéo thả** các file và thư mục sau vào trang GitHub:
   `index.html`, `style.css`, `config.js`, thư mục `js`, thư mục `sql`, thư mục `tests`,
   `README.md`. (Không cần `serve.py`, không cần thư mục `.claude`.)
   Bấm **Commit changes**.
5. Vào **Settings** → **Pages**. Ở **Branch** chọn `main` và thư mục `/ (root)` → **Save**.
6. Đợi 1–2 phút, tải lại trang Settings → Pages. Thấy link dạng
   `https://ten-ban.github.io/hoc-tieng-anh/`.
7. Quay lại Supabase → **Authentication → URL Configuration**:
   - Thêm link GitHub Pages ở trên vào **Redirect URLs** (kể cả dấu `/` ở cuối).
   - Đổi **Site URL** thành link GitHub Pages.

✅ Mở link GitHub Pages trên điện thoại, đăng nhập bằng cùng email + mật khẩu.
Video và câu bạn đã thêm trên máy tính hiện ra đầy đủ.

> Khi sửa code: vào repository → bấm vào file → biểu tượng ✏️ để sửa, hoặc tải file mới
> lên lại bằng **Add file → Upload files** (file trùng tên sẽ được thay). Đợi 1–2 phút.

---

## 7. Cách dùng

### Thêm video
Tab **🎬 Video** → dán link YouTube (hỗ trợ `youtube.com/watch?v=`, `youtu.be/`,
`youtube.com/shorts/`, `youtube.com/embed/`) → tiêu đề tự điền nếu để trống → **Thêm video**.
Hoặc bấm **Thêm bài mẫu** để thêm video "Nice to meet you!".

### Thêm câu (chế độ 📝 Quản lý câu) — 3 cách
1. **Nhập từ bản chép lời YouTube** (nhanh nhất): trên YouTube bấm **…Thêm** dưới video →
   **Hiện bản chép lời** → bôi đen toàn bộ → Ctrl + C → dán vào ô → **Xem trước** → **Lưu**.
   Thời gian được tách tự động. Nghĩa tiếng Việt bổ sung sau bằng nút ✏️ Sửa.
2. **Nhập hàng loạt**: mỗi dòng
   `00:20-00:35 | câu tiếng Anh | nghĩa tiếng Việt | /phiên âm/ | khung câu`.
   Bấm **Điền dữ liệu mẫu** để xem ví dụ. Dòng nào sai sẽ được báo rõ.
3. **Thêm một câu**: cho video chạy, bấm ⏱ để lấy thời điểm hiện tại.

### Luyện tập
Chọn câu ở ô bên dưới video (◀ ▶), chọn **số lần lặp** và **tốc độ** (0.5x / 0.75x / 1x), rồi chọn chế độ:

| Chế độ | Làm gì |
|---|---|
| 🎧 Nghe & lặp | Phát câu lặp N lần, ẩn/hiện tiếng Anh – tiếng Việt, tự chuyển câu |
| ✍️ Chép chính tả | Nghe rồi gõ lại; chấm % và tô màu từng từ (xanh đúng, đỏ sai, gạch chân thiếu) |
| 🔄 Dịch ngược | Nhìn nghĩa tiếng Việt, viết câu tiếng Anh; có gợi ý |
| 🧩 Điền từ | Che ~20% số từ, điền lại; bấm 🎲 để đổi chỗ trống |
| 🧱 Khung câu | Viết câu của bạn theo khung, lưu lại để xem sau |
| 🎤 Luyện nói | Ghi âm giọng bạn, nghe lại, so với câu gốc (bản ghi không lưu) |

### Ôn tập
Tab **🔁 Ôn tập**: thẻ hiện nghĩa tiếng Việt → nhớ lại câu → **Xem đáp án** → **Nhớ** / **Quên**.
Trên máy tính: phím **Space** xem đáp án, **1** = Quên, **2** = Nhớ.

| Hộp | Ôn lại sau |
|---|---|
| 1 | 1 ngày |
| 2 | 3 ngày |
| 3 | 7 ngày |
| 4 | 30 ngày |
| Nhớ ở hộp 4 | 🏆 Đã thuộc |

Câu mới tự vào hộp 1 và đến hạn ngay. Quên → về hộp 1.

### Điểm và mục tiêu
Trang chủ hiện chuỗi ngày học 🔥, XP, số câu đã thuộc, mục tiêu số câu mỗi ngày (chỉnh được)
và biểu đồ 7 ngày. XP: chép chính tả / dịch ngược / điền từ = điểm % ÷ 10; khung câu +10;
nghe hết câu +2; luyện nói +3; ôn tập Nhớ +5, Quên +2.

### Chia sẻ tiến độ
- Tab **📤 Chia sẻ**: nhập email người xem → **Chia sẻ**. Bấm **Thu hồi** để ngừng.
- Người đó đăng nhập bằng email ấy → tab **👀 Được chia sẻ** → thấy số câu đã thuộc / tổng số,
  bấm **Xem chi tiết** để xem từng video và từng câu (chỉ xem, không sửa).

---

## 8. Danh sách tự kiểm tra

**Kiểm thử hàm** — mở `http://localhost:5500/tests/`:
- [ ] Thấy "Tất cả 10 ca đều đạt ✔".
  (Nếu cài Node.js 22 trở lên, có thể chạy thêm `node --test tests/`.)

**Đăng nhập**
- [ ] Nhập `abc` → báo "Email chưa đúng định dạng".
- [ ] Mật khẩu 3 ký tự → báo "Mật khẩu cần ít nhất 6 ký tự". Hai ô mật khẩu khác nhau → báo lỗi.
- [ ] Tạo tài khoản → vào trang chủ, thấy "Chào *tên*!".
- [ ] Đăng xuất, đăng nhập sai mật khẩu → báo "Sai email hoặc mật khẩu". Đúng mật khẩu → vào được.
- [ ] F5 vẫn đăng nhập. Nút con mắt hiện / ẩn mật khẩu.
- [ ] Quên mật khẩu → nhận email → bấm link → đặt mật khẩu mới → đăng nhập bằng mật khẩu mới.

**Video và câu**
- [ ] Dán `https://vimeo.com/123` → báo link chưa đúng.
- [ ] Dán link YouTube, để trống tiêu đề → tiêu đề tự điền.
- [ ] Nhập hàng loạt có 1 dòng sai → báo "Dòng X: …", không lưu dòng nào.
- [ ] **Điền dữ liệu mẫu** → **Kiểm tra & lưu** → 3 câu xuất hiện, sắp theo thời gian.
- [ ] Sửa một câu, đặt kết thúc nhỏ hơn bắt đầu → báo lỗi; sửa lại đúng → lưu được.
- [ ] Xóa câu, xóa video → có hộp xác nhận.

**Trình phát**
- [ ] Bấm ▶ Phát câu → video phát đúng từ mốc bắt đầu và **tự dừng** ở mốc kết thúc.
- [ ] Chọn Lặp 2 lần → câu phát 2 lần rồi dừng. Chọn 0.5x → phát chậm.
- [ ] Đang phát mà chuyển câu → câu cũ dừng ngay.

**Luyện tập, ôn tập, chia sẻ**
- [ ] Chép chính tả gõ thiếu 1 từ → điểm < 100%, từ thiếu gạch chân.
- [ ] Tab Ôn tập có số câu đến hạn; bấm Nhớ → số giảm 1.
- [ ] Trang chủ: XP hôm nay tăng sau khi luyện.
- [ ] Tạo tài khoản thứ hai (email khác) ở cửa sổ ẩn danh. Tài khoản 1 chia sẻ cho email đó
      → tab Được chia sẻ thấy tiến độ, không có nút sửa/xóa.
- [ ] Mở trên điện thoại (qua GitHub Pages): thanh tab nằm ở đáy, không phải kéo ngang.

---

## 9. Gặp lỗi thì làm gì

| Hiện tượng | Cách xử lý |
|---|---|
| "Không kết nối được máy chủ" | Kiểm tra `SUPABASE_URL` trong `config.js` (bắt đầu `https://`, không thừa dấu cách); dự án Supabase không bị **Paused** (bấm Restore); tải lại bằng **Ctrl + F5**. |
| "Chưa có bảng trong cơ sở dữ liệu" | Chạy lại `sql/schema.sql` trong SQL Editor. |
| "Sai email hoặc mật khẩu" | Kiểm tra lại; nếu quên thì bấm **Quên mật khẩu?**. Chưa có tài khoản thì chọn **Tạo tài khoản**. |
| "Tài khoản chưa xác nhận email" | Mở email xác nhận của Supabase (xem cả Spam) và bấm link, hoặc tắt **Confirm email** (bước 4) rồi tạo lại. |
| Bấm link "quên mật khẩu" nhưng không hiện ô đặt mật khẩu mới | Kiểm tra bước 4 (Redirect URLs có đúng địa chỉ đang mở). Mở link trên **cùng trình duyệt**. |
| Tạo tài khoản báo "Email này đã có tài khoản" | Chọn **Đăng nhập**, hoặc **Quên mật khẩu?**. |
| "Bạn gửi yêu cầu quá nhanh" | Giới hạn email của Supabase. Đợi vài phút. |
| Video báo "không cho phép phát nhúng" | Chủ video tắt phát nhúng. Chọn video khác. |
| Sửa file mà trang không đổi | Dùng `python serve.py` (đã tắt bộ nhớ đệm) và nhấn **Ctrl + F5**. |
| Trang trắng | Bấm **F12** → tab **Console** → chụp lỗi màu đỏ (đừng chụp phần có key). |

---

## 10. Cấu trúc thư mục

```
index.html, style.css     Giao diện
config.js                 URL và anon key Supabase (bạn tự điền)
serve.py                  Máy chủ chạy thử trên máy (tắt bộ nhớ đệm)
sql/schema.sql            Bảng, Row Level Security, policy, trigger
js/
  app.js                  Khởi động, điều hướng tab
  supabase.js             Tạo Supabase client
  db.js / db-local.js     Truy cập dữ liệu: Supabase / chế độ dùng thử
  auth.js                 Đăng nhập, đăng xuất, dùng thử
  ui.js                   Thông báo, sáng/tối, tiện ích chung
  icons.js                Icon SVG (bộ Lucide): viết <i data-lucide="tên"></i> là có icon
  home.js                 Trang chủ (streak, XP, mục tiêu, biểu đồ)
  videos.js               Danh sách video, thêm bằng link
  practice.js             Trang học một video (trình phát + chọn câu + chế độ)
  segments.js             Thêm / sửa / xóa câu, nhập hàng loạt, nhập bản chép lời
  player.js               Bọc YouTube IFrame API: phát đoạn, lặp, tốc độ
  speech.js               Đọc bằng giọng máy
  modes/                  listen, dictation, backtranslate, cloze, pattern, speak (+ common)
  review.js               Ôn tập flashcard theo lịch
  shared.js               Chia sẻ / xem tiến độ được chia sẻ
  utils/                  Hàm thuần: normalize, srs, youtube, bulk
tests/                    Kiểm thử hàm thuần (trình duyệt hoặc node --test)
```

Bảo mật: mọi bảng bật **Row Level Security**. Mỗi người chỉ đọc/ghi dữ liệu của mình;
người được chia sẻ chỉ **đọc** `videos`, `segments`, `progress` của chủ sở hữu.
`my_examples` và `study_log` luôn riêng tư. Trang **không tải, không lưu** file video —
chỉ lưu link YouTube, nội dung câu và mốc thời gian.

---

## 11. Giới hạn đã biết

- **Chưa có nhận diện giọng nói**: Luyện nói chỉ ghi âm để bạn tự nghe so sánh, chưa chấm phát âm.
- **Chưa tự lấy phụ đề**: phải tự sao chép bản chép lời từ YouTube rồi dán vào
  (trình duyệt không được phép tự tải phụ đề từ YouTube). Video không có bản chép lời thì phải nhập tay.
- **Chưa tự dịch**: câu nhập từ bản chép lời chưa có nghĩa tiếng Việt; phải tự thêm.
- **Bản chép lời tự động** của YouTube thường không có dấu câu → câu có thể bị cắt chưa tròn
  (tối đa ~15 giây mỗi câu). Nên sửa lại mốc thời gian và câu khi cần.
- **Chế độ dùng thử** chỉ lưu trên một trình duyệt; xóa dữ liệu trình duyệt là mất.
  Chưa có chức năng chuyển dữ liệu dùng thử lên tài khoản.
- **Mục tiêu mỗi ngày** lưu trên từng thiết bị (không đồng bộ).
- **Ghi âm** cần trang mở bằng `https://` hoặc `localhost`, và trình duyệt cho phép micro.
  Một số trình duyệt cũ / trong ứng dụng (Zalo, Facebook) không hỗ trợ.
- **Giọng máy** phụ thuộc giọng đọc có sẵn trên thiết bị; có máy không có giọng tiếng Anh.
- **Phát chính xác đến ~0,2 giây**: trang kiểm tra thời gian mỗi 200 ms nên có thể lố nhẹ.
  Trên iPhone, lần phát đầu đôi khi phải bấm 2 lần (chính sách tự phát của Safari).
- **Số lượng lớn**: mỗi lần tải tối đa ~1000 câu mỗi bảng (giới hạn mặc định của Supabase)
  và 5000 dòng nhật ký học trong 1 năm.
- Chưa có: chế độ ngoại tuyến, sắp xếp lại thứ tự câu bằng kéo thả, xuất/nhập dữ liệu, thông báo nhắc ôn.
