// Các tiện ích giao diện dùng chung: thông báo, chống chèn HTML, điều hướng, sáng/tối.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Thoát ký tự đặc biệt trước khi chèn chữ người dùng nhập vào innerHTML.
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Hiện thông báo nổi. type: 'success' | 'error' | 'info'
export function toast(message, type = 'info', ms = 4000) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? Math.max(ms, 6000) : ms);
}

// Đổi lỗi kỹ thuật sang câu tiếng Việt dễ hiểu.
export function friendlyError(error) {
  const raw = error?.message || String(error || '');
  const msg = raw.toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
    return 'Không kết nối được máy chủ. Hãy kiểm tra mạng, kiểm tra SUPABASE_URL trong config.js ' +
      '(và dự án Supabase không bị tạm dừng), rồi tải lại trang.';
  }
  if (msg.includes('rate limit') || msg.includes('security purposes')) {
    return 'Bạn gửi yêu cầu quá nhanh. Hãy đợi khoảng 1 phút rồi thử lại.';
  }
  // Lỗi đăng nhập / tạo tài khoản
  if (msg.includes('invalid login credentials')) return 'Sai email hoặc mật khẩu.';
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'Email này đã có tài khoản. Hãy chọn "Đăng nhập" (hoặc "Quên mật khẩu?").';
  }
  if (msg.includes('email not confirmed')) {
    return 'Tài khoản chưa xác nhận email. Hãy bấm link trong email xác nhận Supabase đã gửi (xem cả mục Spam).';
  }
  if (msg.includes('password should be at least')) return 'Mật khẩu quá ngắn (cần ít nhất 6 ký tự).';
  if (msg.includes('password') && (msg.includes('weak') || msg.includes('characters'))) {
    return 'Mật khẩu chưa đủ mạnh theo cài đặt của Supabase. Hãy dùng mật khẩu dài hơn, có cả chữ và số.';
  }
  if (msg.includes('different from the old password')) return 'Mật khẩu mới phải khác mật khẩu cũ.';
  if (msg.includes('signups not allowed') || msg.includes('signup is disabled')) {
    return 'Supabase đang tắt chức năng tạo tài khoản mới (Authentication → Sign In / Providers).';
  }
  if (msg.includes('invalid') && msg.includes('email')) return 'Email không hợp lệ.';
  if (error?.code === '23505' || msg.includes('duplicate key')) return 'Dữ liệu này đã có rồi.';
  if (error?.code === '42P01' || (msg.includes('relation') && msg.includes('does not exist'))) {
    return 'Chưa có bảng trong cơ sở dữ liệu. Hãy chạy file sql/schema.sql trong Supabase SQL Editor.';
  }
  if (msg.includes('row-level security') || msg.includes('permission denied')) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }
  if (msg.includes('jwt') || msg.includes('not authenticated')) {
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
  }
  if (/[À-ỹ]/.test(raw)) return raw; // lỗi đã viết sẵn bằng tiếng Việt
  return 'Đã có lỗi xảy ra: ' + raw;
}

// Bật/tắt trạng thái "đang xử lý" của nút để tránh bấm hai lần.
export function setBusy(button, busy, busyText = 'Đang xử lý…') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    if (button.dataset.label) button.innerHTML = button.dataset.label;
    button.disabled = false;
  }
}

// Chạy một thao tác bất đồng bộ: khóa nút, báo lỗi tiếng Việt nếu hỏng.
// Trả về kết quả, hoặc undefined nếu lỗi.
export async function run(button, task, busyText) {
  setBusy(button, true, busyText);
  try {
    return await task();
  } catch (error) {
    console.error(error);
    toast(friendlyError(error), 'error');
    return undefined;
  } finally {
    setBusy(button, false);
  }
}

export const spinner = () => '<div class="spinner" aria-label="Đang tải"></div>';

// Điều hướng giữa các tab. app.js gán hàm thật khi khởi động
// (tránh import vòng giữa các module).
export const nav = {
  go: (_tab, _params) => {},
  refreshDue: () => {},
};

// Lưu / đọc cài đặt nhỏ trên trình duyệt (bọc try vì có thể bị chặn).
export function getPref(key, fallback) {
  try {
    const v = localStorage.getItem('pref.' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
export function setPref(key, value) {
  try { localStorage.setItem('pref.' + key, JSON.stringify(value)); } catch { /* bỏ qua */ }
}

// ---------- Sáng / tối ----------
// Không có lựa chọn = theo máy. Bấm nút để chọn ngược lại với giao diện đang hiện.
function currentTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function initTheme(button) {
  const paint = () => {
    button.innerHTML = `<i data-lucide="${currentTheme() === 'dark' ? 'sun' : 'moon'}"></i>`;
  };
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* bỏ qua */ }
    paint();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint);
  paint();
}
