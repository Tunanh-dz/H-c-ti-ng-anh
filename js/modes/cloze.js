// Chế độ Điền từ: che ngẫu nhiên khoảng 20% số từ (không che dấu câu), người dùng điền lại.
import { $, escapeHtml } from '../ui.js';
import { header, audioButtons, wireAudio, answerHtml, scoreClass, scoreMessage } from './common.js';
import { tokenize, pickClozeIndices, sameWord } from '../utils/normalize.js';

export function render(el, ctx) {
  const seg = ctx.current;
  const tokens = tokenize(seg.en);

  el.innerHTML = `
    <div class="card">
      ${header('<i data-lucide="puzzle"></i> Điền từ', ctx, 'Nghe câu và điền các từ còn thiếu. Nhấn Enter để sang ô kế tiếp.')}
      <div class="mode-actions">${audioButtons({ next: false })}</div>
      <div class="sentence-box"><div class="cloze" id="c-sentence"></div>
        ${seg.vi ? `<div class="sentence-vi muted">${escapeHtml(seg.vi)}</div>` : ''}</div>
      <div class="mode-actions">
        <button class="btn btn-primary" id="c-check"><i data-lucide="check"></i> Kiểm tra</button>
        <button class="btn btn-soft" id="c-shuffle"><i data-lucide="dices"></i> Đổi chỗ trống</button>
        <button class="btn btn-ghost" data-act="next">Câu tiếp <i data-lucide="skip-forward"></i></button>
      </div>
      <div id="c-result"></div>
    </div>`;
  wireAudio(el, ctx);

  let hidden;
  const build = () => {
    hidden = pickClozeIndices(tokens, 0.2);
    $('#c-sentence', el).innerHTML = tokens.map((t, i) => {
      if (!hidden.has(i)) return escapeHtml(t.text);
      const size = Math.max(3, t.text.length + 1);
      return `<input data-i="${i}" size="${size}" style="width:${size + 1}ch" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="Từ còn thiếu">`;
    }).join('');
    $('#c-result', el).innerHTML = '';
    const inputs = [...el.querySelectorAll('#c-sentence input')];
    inputs.forEach((inp, k) => {
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (k < inputs.length - 1) inputs[k + 1].focus();
        else check();
      });
    });
  };

  const check = () => {
    const inputs = [...el.querySelectorAll('#c-sentence input')];
    let correct = 0;
    inputs.forEach((inp) => {
      const word = tokens[Number(inp.dataset.i)].text;
      const ok = sameWord(inp.value, word);
      if (ok) correct++;
      inp.classList.toggle('ok', ok);
      inp.classList.toggle('bad', !ok);
      // Hiện từ đúng phía trước ô sai
      inp.previousElementSibling?.classList.contains('fix') && inp.previousElementSibling.remove();
      if (!ok) inp.insertAdjacentHTML('beforebegin', `<span class="fix">${escapeHtml(word)}</span>`);
    });
    const score = inputs.length ? Math.round((100 * correct) / inputs.length) : 100;
    const xp = Math.round(score / 10);
    ctx.log('cloze', xp);
    $('#c-result', el).innerHTML = `
      <div class="result">
        <div class="score"><span class="score-num ${scoreClass(score)}">${score}%</span>
          <div><b>${scoreMessage(score)}</b><div class="muted small">Đúng ${correct}/${inputs.length} ô · +${xp} XP</div></div></div>
        <div class="answer">${answerHtml(seg)}</div>
      </div>`;
  };

  $('#c-check', el).onclick = check;
  $('#c-shuffle', el).onclick = build;
  build();
}
