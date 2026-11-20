// Điểm khởi động: chọn màn hình theo trạng thái đăng nhập, điều hướng các tab.
import { isConfigured } from './supabase.js';
import { initAuthUI, onSessionChange, isDemo, isRecovering } from './auth.js';
import { db, useSupabase, useLocal, session } from './db.js';
import { $, $$, nav, initTheme, getPref, setPref } from './ui.js';
import * as home from './home.js';
import * as videos from './videos.js';
import * as review from './review.js';
import * as shared from './shared.js';
import { initIcons } from './icons.js';

// Mỗi tab có show(panel, params) và có thể có hide() khi rời tab.
const PAGES = {
  home,
  videos,
  review,
  share: { show: shared.showShare },
  shared: { show: shared.showShared, hide: shared.hideShared },
};

let currentTab = null;
let currentUserKey = null;

function showScreen(name) {
  for (const s of ['loading', 'login', 'reset', 'app']) $(`#screen-${s}`).hidden = s !== name;
}

function showTab(name, params) {
  if (!PAGES[name]) name = 'home';
  if (currentTab && currentTab !== name) PAGES[currentTab].hide?.();
  $$('.tab').forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
  $$('.panel').forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
  currentTab = name;
  setPref('tab', name);
  window.scrollTo({ top: 0 });
  PAGES[name].show($(`.panel[data-panel="${name}"]`), params);
}

// Cập nhật số câu đến hạn trên tab "Ôn tập".
async function refreshDue() {
  const badge = $('#due-badge');
  try {
    const n = await db.countDue();
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? '99+' : String(n);
  } catch {
    badge.hidden = true;
  }
}

function enterApp(userKey) {
  if (currentUserKey === userKey) return; // ví dụ: Supabase tự làm mới token, không cần vẽ lại
  currentUserKey = userKey;
  videos.reset();
  $('#user-email').textContent = session.isLocal ? 'Chế độ dùng thử' : session.user.email;
  $('#user-email').title = session.isLocal ? '' : session.user.name;
  $('#logout-text').textContent = session.isLocal ? 'Thoát dùng thử' : 'Đăng xuất';
  $('#logout-btn').setAttribute('aria-label', $('#logout-text').textContent);
  $('#user-box').hidden = false;
  $('#demo-banner').hidden = !session.isLocal;
  showScreen('app');
  currentTab = null;
  showTab(getPref('tab', 'home'));
  refreshDue();
}

function leaveApp() {
  if (currentTab) PAGES[currentTab].hide?.();
  currentTab = null;
  currentUserKey = null;
  videos.reset();
  $('#user-box').hidden = true;
  showScreen('login');
}

function start() {
  initIcons();
  initTheme($('#theme-btn'));
  $$('.tab').forEach((btn) => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
  nav.go = showTab;
  nav.refreshDue = refreshDue;

  let lastSession = null;
  const enterUser = (user) => {
    useSupabase(user);
    enterApp(user.id);
  };
  const enterDemo = () => { useLocal(); enterApp('demo'); };
  initAuthUI({
    onDemo: enterDemo,
    onLoggedOut: leaveApp,
    onPasswordReset: () => { if (lastSession?.user) enterUser(lastSession.user); },
  });

  if (!isConfigured) {
    if (isDemo()) enterDemo();
    else showScreen('login');
    return;
  }

  onSessionChange((sess) => {
    lastSession = sess;
    if (sess?.user && isRecovering()) {
      // Bấm link "quên mật khẩu": bắt đặt mật khẩu mới trước khi vào ứng dụng
      leaveApp();
      showScreen('reset');
    } else if (sess?.user) {
      enterUser(sess.user);
    } else if (isDemo()) {
      enterDemo();
    } else {
      leaveApp();
    }
  });
}

start();
