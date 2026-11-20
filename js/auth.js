// Đăng nhập bằng email + mật khẩu, tạo tài khoản, quên / đặt lại mật khẩu,
// đăng xuất, và chế độ dùng thử.
import { supabase, isConfigured } from './supabase.js';
import { $, $$, toast, friendlyError, setBusy } from './ui.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6; // mặc định của Supabase
const DEMO_KEY = 'demoMode';

// Mở trang từ link "đặt lại mật khẩu" trong email: URL có type=recovery.
// Ghi nhận ngay khi tải trang vì Supabase sẽ xóa phần này khỏi URL.
let recovering = /type=recovery/.test(window.location.hash + window.location.search);
export const isRecovering = () => recovering;

export function isDemo() {
  try { return localStorage.getItem(DEMO_KEY) === '1'; } catch { return false; }
}
function setDemo(on) {
  try {
    if (on) localStorage.setItem(DEMO_KEY, '1');
    else localStorage.removeItem(DEMO_KEY);
  } catch { /* bỏ qua */ }
}

const redirectUrl = () => window.location.origin + window.location.pathname;

// handlers.onDemo(): vào chế độ dùng thử
// handlers.onLoggedOut(): quay về màn hình đăng nhập
// handlers.onPasswordReset(): đặt mật khẩu mới xong
export function initAuthUI(handlers) {
  const form = $('#auth-form');
  const email = $('#f-email');
  const pass = $('#f-pass');
  const pass2 = $('#f-pass2');
  const name = $('#f-name');
  const submit = $('#auth-submit');
  const errorBox = $('#auth-error');
  const note = $('#login-note');
  let mode = 'login'; // 'login' | 'signup' | 'forgot'

  const showError = (msg) => {
    errorBox.hidden = !msg;
    errorBox.textContent = msg || '';
  };

  // Đổi giữa Đăng nhập / Tạo tài khoản / Quên mật khẩu
  function setMode(next) {
    mode = next;
    showError('');
    note.hidden = true;
    $$('#auth-tabs [data-auth-mode]').forEach((b) => b.classList.toggle('active', b.dataset.authMode === mode));
    $('#auth-tabs').hidden = mode === 'forgot';
    $('#forgot-title').hidden = mode !== 'forgot';
    $('#forgot-hint').hidden = mode !== 'forgot';
    $('#f-name-wrap').hidden = mode !== 'signup';
    $('#f-pass-wrap').hidden = mode === 'forgot';
    $('#f-pass2-wrap').hidden = mode !== 'signup';
    $('#forgot-btn').hidden = mode !== 'login';
    $('#forgot-back').hidden = mode !== 'forgot';
    // Gợi ý cho trình duyệt / trình quản lý mật khẩu điền đúng
    pass.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    submit.textContent = { login: 'Đăng nhập', signup: 'Tạo tài khoản', forgot: 'Gửi email đặt lại mật khẩu' }[mode];
  }

  $$('#auth-tabs [data-auth-mode]').forEach((b) => { b.onclick = () => setMode(b.dataset.authMode); });
  $('#forgot-btn').onclick = () => setMode('forgot');
  $('#forgot-back').onclick = () => setMode('login');

  // Nút con mắt: hiện / ẩn mật khẩu
  $$('[data-toggle-pw]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $(`#${btn.dataset.togglePw}`);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      btn.innerHTML = `<i data-lucide="${show ? 'eye-off' : 'eye'}"></i>`;
    });
  });

  if (!isConfigured) {
    $('#config-warning').hidden = false;
    form.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
    $$('#auth-tabs button').forEach((el) => { el.disabled = true; });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isConfigured) return;
    const emailValue = email.value.trim().toLowerCase();
    if (!EMAIL_RE.test(emailValue)) {
      showError('Email chưa đúng định dạng, ví dụ: ten@gmail.com');
      email.focus();
      return;
    }

    if (mode === 'forgot') {
      setBusy(submit, true, 'Đang gửi…');
      const { error } = await supabase.auth.resetPasswordForEmail(emailValue, { redirectTo: redirectUrl() });
      setBusy(submit, false);
      if (error) return showError(friendlyError(error));
      note.hidden = false;
      note.textContent = `Nếu ${emailValue} đã có tài khoản, một email đặt lại mật khẩu vừa được gửi. ` +
        'Mở email (xem cả mục Spam) và bấm vào link trên cùng trình duyệt này.';
      return undefined;
    }

    if (pass.value.length < MIN_PASSWORD) {
      showError(`Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`);
      pass.focus();
      return undefined;
    }

    if (mode === 'signup') {
      if (pass.value !== pass2.value) {
        showError('Hai mật khẩu không giống nhau.');
        pass2.focus();
        return undefined;
      }
      setBusy(submit, true, 'Đang tạo tài khoản…');
      const { data, error } = await supabase.auth.signUp({
        email: emailValue,
        password: pass.value,
        options: { data: { display_name: name.value.trim() }, emailRedirectTo: redirectUrl() },
      });
      setBusy(submit, false);
      if (error) return showError(friendlyError(error));
      if (data.session) {
        toast('Đã tạo tài khoản. Chào mừng bạn!', 'success'); // onAuthStateChange sẽ mở ứng dụng
        return undefined;
      }
      // Supabase bật "Confirm email": cần bấm link xác nhận trước khi đăng nhập.
      // Nếu email đã có tài khoản, Supabase trả về user không có identities.
      if (data.user && data.user.identities?.length === 0) {
        return showError('Email này đã có tài khoản. Hãy chọn "Đăng nhập" (hoặc "Quên mật khẩu?").');
      }
      note.hidden = false;
      note.textContent = `Đã tạo tài khoản. Supabase vừa gửi email xác nhận tới ${emailValue}: ` +
        'hãy bấm link trong email (xem cả mục Spam), sau đó quay lại đây và đăng nhập.';
      setMode('login');
      note.hidden = false;
      return undefined;
    }

    // Đăng nhập
    setBusy(submit, true, 'Đang đăng nhập…');
    const { error } = await supabase.auth.signInWithPassword({ email: emailValue, password: pass.value });
    setBusy(submit, false);
    if (error) return showError(friendlyError(error));
    pass.value = '';
    return undefined;
  });

  // Đặt mật khẩu mới sau khi bấm link trong email "quên mật khẩu"
  $('#reset-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const p1 = $('#r-pass').value;
    const p2 = $('#r-pass2').value;
    const box = $('#reset-error');
    const fail = (msg) => { box.hidden = false; box.textContent = msg; };
    if (p1.length < MIN_PASSWORD) return fail(`Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`);
    if (p1 !== p2) return fail('Hai mật khẩu không giống nhau.');
    const btn = $('#reset-submit');
    setBusy(btn, true, 'Đang lưu…');
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(btn, false);
    if (error) return fail(friendlyError(error));
    box.hidden = true;
    recovering = false;
    toast('Đã đổi mật khẩu. Bạn đã đăng nhập.', 'success');
    handlers.onPasswordReset();
    return undefined;
  });

  $('#demo-btn').addEventListener('click', () => {
    setDemo(true);
    handlers.onDemo();
    toast('Đã vào chế độ dùng thử.', 'success');
  });

  $('#logout-btn').addEventListener('click', async () => {
    if (isDemo()) {
      setDemo(false);
      handlers.onLoggedOut();
      toast('Đã thoát chế độ dùng thử. Dữ liệu dùng thử vẫn còn trên trình duyệt này.', 'info');
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) toast(friendlyError(error), 'error');
    else toast('Bạn đã đăng xuất.', 'info');
  });
}

// Gọi callback(session, event) mỗi khi trạng thái đăng nhập thay đổi (kể cả lần đầu).
export function onSessionChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') recovering = true;
    if (session) setDemo(false); // đăng nhập thật thì tắt chế độ dùng thử
    // Chạy ở lượt sau để không gọi Supabase ngay trong listener (khuyến nghị của supabase-js)
    setTimeout(() => callback(session, event), 0);
  });
}
