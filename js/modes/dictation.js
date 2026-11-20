// Chế độ Chép chính tả: nghe câu rồi gõ lại, kiểm tra từng từ.
import { $ } from '../ui.js';
import { header, audioButtons, wireAudio, showCheckResult } from './common.js';

export function render(el, ctx) {
  el.innerHTML = `
    <div class="card">
      ${header('<i data-lucide="pen-line"></i> Chép chính tả', ctx, 'Nghe câu (phát lại bao nhiêu lần cũng được) rồi gõ lại. Nhấn Ctrl + Enter để kiểm tra nhanh.')}
      <div class="mode-actions">${audioButtons({ next: false, tts: false, playLabel: '<i data-lucide="play"></i> Phát / phát lại' })}</div>
      <label for="d-input">Bạn nghe được gì?</label>
      <textarea id="d-input" rows="3" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Gõ câu tiếng Anh bạn nghe được…"></textarea>
      <div class="mode-actions">
        <button class="btn btn-primary" id="d-check"><i data-lucide="check"></i> Kiểm tra</button>
        <button class="btn btn-ghost" data-act="next">Câu tiếp <i data-lucide="skip-forward"></i></button>
      </div>
      <div id="d-result"></div>
    </div>`;

  wireAudio(el, ctx);
  const input = $('#d-input', el);
  const check = () => {
    if (!input.value.trim()) {
      input.focus();
      return;
    }
    showCheckResult($('#d-result', el), ctx, input.value, 'dictation');
  };
  $('#d-check', el).onclick = check;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      check();
    }
  });
}
