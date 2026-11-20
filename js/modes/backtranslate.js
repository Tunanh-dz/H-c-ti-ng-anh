// Chế độ Dịch ngược: nhìn nghĩa tiếng Việt, viết lại câu tiếng Anh.
import { $, escapeHtml } from '../ui.js';
import { header, wireAudio, showCheckResult } from './common.js';
import { toWords } from '../utils/normalize.js';

export function render(el, ctx) {
  const seg = ctx.current;
  if (!seg.vi) {
    el.innerHTML = `
      <div class="card">
        ${header('<i data-lucide="languages"></i> Dịch ngược', ctx)}
        <div class="empty"><div class="empty-icon"><i data-lucide="languages"></i></div>
          <p><b>Câu này chưa có nghĩa tiếng Việt.</b></p>
          <p>Thêm nghĩa trong "Quản lý câu" (nút Sửa), hoặc chuyển sang câu khác.</p>
          <div class="row" style="justify-content:center;margin-top:.6rem">
            <button class="btn btn-soft" id="b-manage"><i data-lucide="clipboard-list"></i> Quản lý câu</button>
            <button class="btn btn-ghost" data-act="next">Câu tiếp <i data-lucide="skip-forward"></i></button>
          </div></div>
      </div>`;
    $('#b-manage', el).onclick = () => ctx.setMode('manage');
    wireAudio(el, ctx);
    return;
  }

  el.innerHTML = `
    <div class="card">
      ${header('<i data-lucide="languages"></i> Dịch ngược', ctx, 'Đọc nghĩa tiếng Việt và viết lại câu tiếng Anh gốc trong video.')}
      <div class="sentence-box"><div class="sentence-vi" style="font-size:1.25rem;font-weight:600;margin:0">${escapeHtml(seg.vi)}</div></div>
      <div id="b-hint" class="muted small" style="margin-top:.5rem"></div>
      <label for="b-input">Câu tiếng Anh</label>
      <textarea id="b-input" rows="3" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Viết câu tiếng Anh…"></textarea>
      <div class="mode-actions">
        <button class="btn btn-primary" id="b-check"><i data-lucide="check"></i> Kiểm tra</button>
        <button class="btn btn-soft" id="b-hint-btn"><i data-lucide="lightbulb"></i> Gợi ý</button>
        <button class="btn btn-ghost" data-act="play"><i data-lucide="play"></i> Nghe câu gốc</button>
        <button class="btn btn-ghost" data-act="next">Câu tiếp <i data-lucide="skip-forward"></i></button>
      </div>
      <div id="b-result"></div>
    </div>`;

  wireAudio(el, ctx);
  // Gợi ý tăng dần: khung câu → số từ và chữ cái đầu mỗi từ
  let hintLevel = 0;
  $('#b-hint-btn', el).onclick = () => {
    hintLevel++;
    const words = toWords(seg.en);
    const parts = [];
    if (seg.pattern) parts.push(`<i data-lucide="blocks"></i> Khung câu: <b>${escapeHtml(seg.pattern)}</b>`);
    if (hintLevel >= (seg.pattern ? 2 : 1)) {
      parts.push(`<i data-lucide="type"></i> ${words.length} từ: <b>${words.map((w) => escapeHtml(w[0]) + '…').join(' ')}</b>`);
    }
    $('#b-hint', el).innerHTML = parts.join('<br>') || 'Không còn gợi ý.';
  };

  const input = $('#b-input', el);
  const check = () => {
    if (!input.value.trim()) {
      input.focus();
      return;
    }
    showCheckResult($('#b-result', el), ctx, input.value, 'backtranslate');
  };
  $('#b-check', el).onclick = check;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      check();
    }
  });
}
