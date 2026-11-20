// Chế độ Viết theo khung câu: xem khung câu + câu mẫu, tự viết câu của mình, lưu vào my_examples.
import { db } from '../db.js';
import { $, escapeHtml, toast, run, friendlyError } from '../ui.js';
import { header, wireAudio } from './common.js';
import { speak, canSpeak } from '../speech.js';

export function render(el, ctx) {
  const seg = ctx.current;
  el.innerHTML = `
    <div class="card">
      ${header('<i data-lucide="blocks"></i> Viết theo khung câu', ctx, 'Dựa vào khung câu, hãy viết một câu mới về chính bạn. Câu được lưu lại để ôn sau.')}
      <div class="sentence-box">
        ${seg.pattern
          ? `<div class="muted small">Khung câu</div><div class="sentence-en grad-text">${escapeHtml(seg.pattern)}</div>`
          : '<div class="muted small">Câu này chưa có khung câu (thêm trong "Quản lý câu"). Bạn vẫn có thể viết câu dựa theo câu mẫu.</div>'}
        <div style="margin-top:.6rem"><span class="muted small">Câu mẫu:</span> <b>${escapeHtml(seg.en)}</b></div>
        ${seg.vi ? `<div class="sentence-vi muted">${escapeHtml(seg.vi)}</div>` : ''}
      </div>
      <form id="p-form" novalidate>
        <label for="p-input">Câu của bạn</label>
        <textarea id="p-input" rows="2" placeholder="Ví dụ: Thank you for helping me with my homework."></textarea>
        <div class="mode-actions">
          <button class="btn btn-primary" id="p-save"><i data-lucide="save"></i> Lưu câu</button>
          <button type="button" class="btn btn-ghost" data-act="play"><i data-lucide="play"></i> Nghe câu mẫu</button>
          <button type="button" class="btn btn-ghost" data-act="next">Câu tiếp <i data-lucide="skip-forward"></i></button>
        </div>
      </form>
      <h3 style="margin-top:1rem">Các câu bạn đã viết</h3>
      <div id="p-list"><div class="spinner"></div></div>
    </div>`;
  wireAudio(el, ctx);

  const list = $('#p-list', el);
  const load = async () => {
    try {
      const items = await db.listExamples(seg.id);
      list.innerHTML = items.length
        ? `<ul class="list">${items.map((x) => `
            <li class="list-item" style="flex-direction:row;align-items:center">
              <div class="list-main">${escapeHtml(x.text)}
                <div class="muted small">${new Date(x.created_at).toLocaleDateString('vi-VN')}</div></div>
              ${canSpeak ? `<button class="btn btn-ghost btn-small" data-say="${escapeHtml(x.text)}" aria-label="Đọc câu"><i data-lucide="volume-2"></i></button>` : ''}
              <button class="btn btn-danger btn-small" data-del="${x.id}" aria-label="Xóa câu"><i data-lucide="trash-2"></i></button>
            </li>`).join('')}</ul>`
        : '<p class="muted">Chưa có câu nào. Hãy viết câu đầu tiên!</p>';
      list.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => speak(b.dataset.say); });
      list.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm('Xóa câu này?')) return;
          const ok = await run(b, () => db.deleteExample(b.dataset.del).then(() => true), '…');
          if (ok) load();
        };
      });
    } catch (error) {
      list.innerHTML = `<p class="field-error">${escapeHtml(friendlyError(error))}</p>`;
    }
  };
  load();

  $('#p-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#p-input', el);
    const text = input.value.trim().replace(/\s+/g, ' ');
    if (!text) {
      toast('Hãy viết một câu trước khi lưu.', 'error');
      input.focus();
      return;
    }
    const saved = await run($('#p-save', el), () => db.addExample(seg.id, text), 'Đang lưu…');
    if (!saved) return;
    ctx.log('pattern', 10);
    toast('Đã lưu câu của bạn. +10 XP', 'success');
    input.value = '';
    load();
  });
}
