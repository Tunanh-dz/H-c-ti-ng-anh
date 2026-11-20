// Phần dùng chung giữa các chế độ luyện tập.
import { escapeHtml } from '../ui.js';
import { speak, canSpeak } from '../speech.js';
import { compareWords, diffToHtml } from '../utils/normalize.js';

export function header(title, ctx, hint) {
  return `
    <div class="row-between">
      <h2 style="margin:0">${title}</h2>
      <span class="badge">Câu ${ctx.index + 1}/${ctx.segments.length}</span>
    </div>
    ${hint ? `<p class="muted small">${hint}</p>` : ''}`;
}

// Nút phát câu trong video và nút đọc bằng giọng máy
export function audioButtons({ next = true, tts = true, playLabel = '<i data-lucide="play"></i> Phát câu' } = {}) {
  return `
    <button class="btn btn-primary" data-act="play">${playLabel}</button>
    ${tts && canSpeak ? '<button class="btn btn-soft" data-act="tts" title="Đọc bằng giọng máy"><i data-lucide="volume-2"></i> Giọng máy</button>' : ''}
    ${next ? '<button class="btn btn-ghost" data-act="next">Câu tiếp <i data-lucide="skip-forward"></i></button>' : ''}`;
}

export function wireAudio(el, ctx, { onPlayDone } = {}) {
  el.querySelectorAll('[data-act="play"]').forEach((b) => {
    b.onclick = () => ctx.play({ onDone: onPlayDone });
  });
  el.querySelectorAll('[data-act="tts"]').forEach((b) => {
    b.onclick = () => speak(ctx.current.en, ctx.settings.rate);
  });
  el.querySelectorAll('[data-act="next"]').forEach((b) => {
    b.onclick = () => ctx.next();
  });
}

// Thông tin đầy đủ của câu (đáp án)
export function answerHtml(seg) {
  return `
    <div class="sentence-en">${escapeHtml(seg.en)}</div>
    ${seg.ipa ? `<div class="sentence-ipa">${escapeHtml(seg.ipa)}</div>` : ''}
    ${seg.vi ? `<div class="sentence-vi">${escapeHtml(seg.vi)}</div>` : ''}
    ${seg.pattern || seg.note ? `<div class="sentence-meta">
      ${seg.pattern ? `<div><i data-lucide="blocks"></i> <b>Khung câu:</b> ${escapeHtml(seg.pattern)}</div>` : ''}
      ${seg.note ? `<div><i data-lucide="pin"></i> <b>Ghi chú:</b> ${escapeHtml(seg.note)}</div>` : ''}
    </div>` : ''}`;
}

export const scoreClass = (score) => (score >= 85 ? 'good' : score >= 50 ? 'mid' : 'low');

export function scoreMessage(score) {
  if (score === 100) return 'Hoàn hảo!';
  if (score >= 85) return 'Rất tốt!';
  if (score >= 50) return 'Khá rồi, cố thêm chút nữa!';
  return 'Nghe lại và thử lần nữa nhé.';
}

// So sánh câu người dùng gõ với đáp án, hiện điểm + tô màu từng từ + đáp án.
// Trả về điểm (0–100) và ghi XP.
export function showCheckResult(box, ctx, actual, kind) {
  const seg = ctx.current;
  const { ops, score } = compareWords(seg.en, actual);
  const xp = Math.round(score / 10);
  ctx.log(kind, xp);
  box.innerHTML = `
    <div class="result">
      <div class="score">
        <span class="score-num ${scoreClass(score)}">${score}%</span>
        <div><b>${scoreMessage(score)}</b><div class="muted small">+${xp} XP</div></div>
      </div>
      <div class="diff">${diffToHtml(ops)}</div>
      <div class="legend">
        <span><span class="w w-ok">xanh</span> đúng</span>
        <span><span class="w w-wrong">đỏ</span> sai / thừa</span>
        <span><span class="w w-missing">gạch chân</span> bị thiếu</span>
      </div>
      <div class="answer"><div class="muted small" style="margin-bottom:.25rem">Đáp án đúng:</div>${answerHtml(seg)}</div>
    </div>`;
  return score;
}
