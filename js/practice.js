// Trang học một video: trình phát, chọn câu, cài đặt lặp/tốc độ, và các chế độ luyện tập.
// Mỗi chế độ là một module có hàm render(container, ctx) và có thể trả về hàm dọn dẹp.
import { db } from './db.js';
import { $, escapeHtml, getPref, setPref, toast } from './ui.js';
import { SegmentPlayer } from './player.js';
import { stopSpeaking } from './speech.js';
import { formatTime, watchUrl } from './utils/youtube.js';
import * as listen from './modes/listen.js';
import * as dictation from './modes/dictation.js';
import * as backtranslate from './modes/backtranslate.js';
import * as cloze from './modes/cloze.js';
import * as pattern from './modes/pattern.js';
import * as speak from './modes/speak.js';
import * as manage from './segments.js';

const MODES = [
  { id: 'listen', label: '<i data-lucide="headphones"></i> Nghe & lặp', mod: listen },
  { id: 'dictation', label: '<i data-lucide="pen-line"></i> Chép chính tả', mod: dictation },
  { id: 'backtranslate', label: '<i data-lucide="languages"></i> Dịch ngược', mod: backtranslate },
  { id: 'cloze', label: '<i data-lucide="puzzle"></i> Điền từ', mod: cloze },
  { id: 'pattern', label: '<i data-lucide="blocks"></i> Khung câu', mod: pattern },
  { id: 'speak', label: '<i data-lucide="mic"></i> Luyện nói', mod: speak },
  { id: 'manage', label: '<i data-lucide="clipboard-list"></i> Quản lý câu', mod: manage, always: true },
];
const RATES = [0.5, 0.75, 1];
const REPEATS = [1, 2, 3, 5, 10];

let active = null; // trang đang mở (chỉ một)

export function closePractice() {
  active?.destroy();
  active = null;
}

export async function openPractice(panel, video, { mode, onBack } = {}) {
  closePractice();
  const segments = await db.listSegments(video.id);
  const playerId = `yt-player-${Date.now()}`;
  let cleanup = null;
  let destroyed = false;
  const logged = new Set(); // tránh cộng XP lặp lại cho cùng câu trong một lần mở

  const ctx = {
    video,
    segments,
    index: Math.min(getPref(`lastIndex.${video.id}`, 0), Math.max(0, segments.length - 1)),
    mode: mode || (segments.length ? getPref('mode', 'listen') : 'manage'),
    settings: { repeat: getPref('repeat', 1), rate: getPref('rate', 1) },
    player: null,
    autoplay: false,

    get current() {
      return this.segments[this.index] || null;
    },
    // Phát câu hiện tại (hoặc câu seg) theo số lần lặp đã chọn
    play({ onDone, repeat, seg } = {}) {
      const s = seg || this.current;
      if (!s) return;
      stopSpeaking();
      this.player.playSegment(s, { repeat: repeat ?? this.settings.repeat, onDone });
    },
    stop() {
      this.player.stop();
    },
    goTo(i, { autoplay = false } = {}) {
      if (!this.segments.length) return;
      this.index = Math.max(0, Math.min(i, this.segments.length - 1));
      setPref(`lastIndex.${video.id}`, this.index);
      this.autoplay = autoplay;
      this.player.stop();
      renderNav();
      renderMode();
    },
    next(opts) {
      if (this.index < this.segments.length - 1) this.goTo(this.index + 1, opts);
      else toast('Đây là câu cuối cùng của video.', 'info');
    },
    prev() {
      this.goTo(this.index - 1);
    },
    // Chế độ "Nghe & lặp" dùng để tự phát khi chuyển câu
    takeAutoplay() {
      const a = this.autoplay;
      this.autoplay = false;
      return a;
    },
    setMode(id) {
      this.mode = id;
      if (id !== 'manage') setPref('mode', id);
      renderModeChips();
      renderMode();
    },
    // Tải lại danh sách câu sau khi thêm / sửa / xóa
    async reload(keepId) {
      this.segments = await db.listSegments(video.id);
      const idx = keepId != null ? this.segments.findIndex((s) => String(s.id) === String(keepId)) : -1;
      this.index = idx >= 0 ? idx : Math.min(this.index, Math.max(0, this.segments.length - 1));
      renderNav();
    },
    // Ghi nhật ký học để tính XP / streak. once = chỉ tính một lần mỗi câu.
    log(kind, xp, once = false) {
      const seg = this.current;
      const key = `${kind}:${seg?.id}`;
      if (once && logged.has(key)) return;
      logged.add(key);
      db.logStudy(kind, seg?.id, xp).catch((e) => console.warn('Không ghi được nhật ký học', e));
    },
  };

  panel.innerHTML = `
    <div class="detail-head">
      <button class="icon-btn" id="p-back" aria-label="Quay lại danh sách video"><i data-lucide="arrow-left"></i></button>
      <h1>${escapeHtml(video.title)}</h1>
      <a class="btn btn-ghost btn-small" href="${watchUrl(video.youtube_id)}" target="_blank" rel="noopener">YouTube <i data-lucide="external-link"></i></a>
    </div>
    <div class="detail-grid">
      <div class="detail-left">
        <div class="player-wrap"><div id="${playerId}"></div><div class="player-msg" id="p-msg">Đang tải video…</div></div>
        <div class="seg-nav">
          <button class="btn btn-soft" id="p-prev" aria-label="Câu trước"><i data-lucide="chevron-left"></i></button>
          <select id="p-select" aria-label="Chọn câu"></select>
          <button class="btn btn-soft" id="p-next" aria-label="Câu sau"><i data-lucide="chevron-right"></i></button>
        </div>
        <div class="play-settings">
          <div class="setting"><i data-lucide="repeat"></i> Lặp
            <select id="p-repeat" aria-label="Số lần lặp">${REPEATS.map((n) => `<option value="${n}">${n} lần</option>`).join('')}</select>
          </div>
          <div class="setting"><i data-lucide="gauge"></i> Tốc độ
            <div class="speed-chips" id="p-rates">${RATES.map((r) => `<button class="chip" data-rate="${r}">${r}x</button>`).join('')}</div>
          </div>
        </div>
      </div>
      <div class="detail-right">
        <div class="chips mode-chips" id="p-modes" role="tablist"></div>
        <div id="p-body"></div>
      </div>
    </div>`;

  const body = $('#p-body', panel);
  const select = $('#p-select', panel);

  function renderNav() {
    const n = ctx.segments.length;
    select.innerHTML = n
      ? ctx.segments.map((s, i) => {
        const text = s.en.length > 48 ? s.en.slice(0, 46) + '…' : s.en;
        return `<option value="${i}">${i + 1}/${n} · ${formatTime(s.start_sec)} · ${escapeHtml(text)}</option>`;
      }).join('')
      : '<option>Chưa có câu nào</option>';
    select.value = String(ctx.index);
    select.disabled = !n;
    $('#p-prev', panel).disabled = !n || ctx.index === 0;
    $('#p-next', panel).disabled = !n || ctx.index >= n - 1;
  }

  function renderModeChips() {
    $('#p-modes', panel).innerHTML = MODES.map((m) =>
      `<button class="chip ${m.id === ctx.mode ? 'active' : ''}" role="tab" aria-selected="${m.id === ctx.mode}" data-mode="${m.id}">${m.label}</button>`,
    ).join('');
    $('#p-modes', panel).querySelectorAll('[data-mode]').forEach((b) => {
      b.onclick = () => ctx.setMode(b.dataset.mode);
    });
    $('#p-modes', panel).querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function renderMode() {
    if (destroyed) return;
    try { cleanup?.(); } catch { /* bỏ qua */ }
    cleanup = null;
    stopSpeaking();
    const m = MODES.find((x) => x.id === ctx.mode) || MODES[0];
    if (!m.always && !ctx.segments.length) {
      body.innerHTML = `
        <div class="empty"><div class="empty-icon"><i data-lucide="clipboard-list"></i></div>
          <p><b>Video này chưa có câu nào.</b></p>
          <p>Thêm câu (hoặc dán bản chép lời YouTube) để bắt đầu luyện tập.</p>
          <button class="btn btn-primary" id="p-to-manage" style="margin-top:.6rem"><i data-lucide="clipboard-list"></i> Thêm câu</button></div>`;
      $('#p-to-manage', body).onclick = () => ctx.setMode('manage');
      return;
    }
    cleanup = m.mod.render(body, ctx) || null;
  }

  function paintRates() {
    $('#p-rates', panel).querySelectorAll('[data-rate]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.rate) === ctx.settings.rate);
    });
  }

  // Sự kiện điều khiển
  $('#p-back', panel).onclick = () => {
    closePractice();
    onBack?.();
  };
  $('#p-prev', panel).onclick = () => ctx.prev();
  $('#p-next', panel).onclick = () => ctx.next();
  select.onchange = () => ctx.goTo(Number(select.value));
  const repeatSel = $('#p-repeat', panel);
  repeatSel.value = String(ctx.settings.repeat);
  repeatSel.onchange = () => {
    ctx.settings.repeat = Number(repeatSel.value);
    setPref('repeat', ctx.settings.repeat);
  };
  $('#p-rates', panel).querySelectorAll('[data-rate]').forEach((b) => {
    b.onclick = () => {
      ctx.settings.rate = Number(b.dataset.rate);
      setPref('rate', ctx.settings.rate);
      ctx.player.setRate(ctx.settings.rate);
      paintRates();
    };
  });

  // Trình phát YouTube
  const msg = $('#p-msg', panel);
  ctx.player = new SegmentPlayer(playerId, {
    onError: (text) => {
      msg.hidden = false;
      msg.innerHTML = `<i data-lucide="triangle-alert"></i> ${escapeHtml(text)}`;
    },
  });
  ctx.player.setRate(ctx.settings.rate);
  ctx.player.init(video.youtube_id)
    .then(() => { msg.hidden = true; })
    .catch((e) => { msg.innerHTML = `<i data-lucide="triangle-alert"></i> ${escapeHtml(e.message)}`; });

  renderNav();
  renderModeChips();
  paintRates();
  renderMode();

  active = {
    destroy() {
      destroyed = true;
      try { cleanup?.(); } catch { /* bỏ qua */ }
      stopSpeaking();
      ctx.player.destroy();
    },
  };
  return ctx;
}
