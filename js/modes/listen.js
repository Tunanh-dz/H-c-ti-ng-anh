// Chế độ Nghe và lặp: phát câu theo số lần lặp đã chọn, ẩn/hiện chữ, sang câu tiếp.
import { $, escapeHtml, getPref, setPref } from '../ui.js';
import { header, audioButtons, wireAudio } from './common.js';

export function render(el, ctx) {
  const seg = ctx.current;
  const opts = {
    en: getPref('listen.showEn', true),
    vi: getPref('listen.showVi', true),
    auto: getPref('listen.autoNext', false),
  };

  el.innerHTML = `
    <div class="card">
      ${header('<i data-lucide="headphones"></i> Nghe & lặp', ctx, 'Nghe câu lặp lại theo số lần đã chọn (ở dưới video), rồi nói nhại theo.')}
      <div class="mode-actions">${audioButtons()}</div>
      <div class="row small" style="gap:.25rem 1rem;margin-bottom:.75rem">
        <label class="check"><input type="checkbox" id="l-en" ${opts.en ? 'checked' : ''}> Hiện tiếng Anh</label>
        <label class="check"><input type="checkbox" id="l-vi" ${opts.vi ? 'checked' : ''}> Hiện tiếng Việt</label>
        <label class="check"><input type="checkbox" id="l-auto" ${opts.auto ? 'checked' : ''}> Tự chuyển câu khi nghe xong</label>
      </div>
      <div class="sentence-box" id="l-text"></div>
    </div>`;

  // Vẽ phần chữ; phần đang ẩn có nút bấm để xem tạm
  const paint = () => {
    const box = $('#l-text', el);
    box.innerHTML = `
      ${opts.en
        ? `<div class="sentence-en">${escapeHtml(seg.en)}</div>${seg.ipa ? `<div class="sentence-ipa">${escapeHtml(seg.ipa)}</div>` : ''}`
        : '<button class="hidden-text" data-peek="en"><i data-lucide="eye"></i> Xem tiếng Anh</button>'}
      <div style="margin-top:.5rem">
        ${opts.vi
          ? `<div class="sentence-vi">${seg.vi ? escapeHtml(seg.vi) : '<i class="muted">Chưa có nghĩa tiếng Việt</i>'}</div>`
          : '<button class="hidden-text" data-peek="vi"><i data-lucide="eye"></i> Xem tiếng Việt</button>'}
      </div>
      ${opts.en && (seg.pattern || seg.note) ? `<div class="sentence-meta">
        ${seg.pattern ? `<div><i data-lucide="blocks"></i> <b>Khung câu:</b> ${escapeHtml(seg.pattern)}</div>` : ''}
        ${seg.note ? `<div><i data-lucide="pin"></i> <b>Ghi chú:</b> ${escapeHtml(seg.note)}</div>` : ''}</div>` : ''}`;
    box.querySelectorAll('[data-peek]').forEach((b) => {
      b.onclick = () => {
        opts[b.dataset.peek] = true; // chỉ hiện tạm cho câu này
        paint();
      };
    });
  };
  paint();

  for (const [id, key, prop] of [['#l-en', 'listen.showEn', 'en'], ['#l-vi', 'listen.showVi', 'vi'], ['#l-auto', 'listen.autoNext', 'auto']]) {
    $(id, el).onchange = (e) => {
      opts[prop] = e.target.checked;
      setPref(key, e.target.checked);
      paint();
    };
  }

  const onDone = () => {
    ctx.log('listen', 2, true);
    if (opts.auto && ctx.index < ctx.segments.length - 1) ctx.next({ autoplay: true });
  };
  wireAudio(el, ctx, { onPlayDone: onDone });

  // Được chuyển tới từ câu trước khi bật "Tự chuyển câu"
  if (ctx.takeAutoplay()) ctx.play({ onDone });
}
