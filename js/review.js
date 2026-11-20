// Ôn tập theo lịch (hộp Leitner): thẻ hiện nghĩa tiếng Việt, người dùng tự đánh giá Nhớ / Quên.
import { db } from './db.js';
import { $, escapeHtml, nav, toast, spinner, friendlyError } from './ui.js';
import { nextReview, INTERVAL_DAYS, MASTERED_BOX } from './utils/srs.js';
import { speak, canSpeak, stopSpeaking } from './speech.js';

let panel = null;
let queue = [];
let pos = 0;
let revealed = false;
let busy = false;
let tally = { remembered: 0, forgot: 0, mastered: 0 };

export async function show(p) {
  panel = p;
  document.addEventListener('keydown', onKey);
  panel.innerHTML = spinner();
  try {
    queue = await db.listDue();
  } catch (error) {
    panel.innerHTML = `<div class="card"><h2>Không tải được câu cần ôn</h2>
      <p class="muted">${escapeHtml(friendlyError(error))}</p>
      <button class="btn btn-primary" id="r-retry">Thử lại</button></div>`;
    $('#r-retry', panel).onclick = () => show(panel);
    return;
  }
  pos = 0;
  revealed = false;
  tally = { remembered: 0, forgot: 0, mastered: 0 };
  renderCard();
}

export function hide() {
  document.removeEventListener('keydown', onKey);
  stopSpeaking();
}

// Phím tắt trên máy tính: Space = xem đáp án, 1 = Quên, 2 = Nhớ
function onKey(e) {
  if (!panel || panel.hidden || pos >= queue.length) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.key === ' ' && !revealed) {
    e.preventDefault();
    reveal();
  } else if (revealed && e.key === '1') answer(false);
  else if (revealed && e.key === '2') answer(true);
}

const daysText = (box) => (box >= MASTERED_BOX ? 'đã thuộc' : `ôn lại sau ${INTERVAL_DAYS[box]} ngày`);

function renderCard() {
  const head = `
    <div class="section-head" style="margin-top:0">
      <div><h1><i data-lucide="repeat"></i> Ôn tập</h1><p class="muted">Nhớ lại câu tiếng Anh từ nghĩa tiếng Việt. Nhớ thì lên hộp, quên thì về hộp 1.</p></div>
    </div>`;

  if (!queue.length) {
    panel.innerHTML = `${head}
      <div class="empty"><div class="empty-icon"><i data-lucide="party-popper"></i></div>
        <p><b>Không có câu nào đến hạn ôn.</b></p>
        <p>Câu mới sẽ đến hạn ngay khi bạn thêm vào video. Lịch ôn: hộp 1 → 1 ngày, hộp 2 → 3 ngày, hộp 3 → 7 ngày, hộp 4 → 30 ngày, vượt hộp 4 là đã thuộc.</p>
        <button class="btn btn-primary" id="r-videos" style="margin-top:.75rem"><i data-lucide="clapperboard"></i> Học video</button></div>`;
    $('#r-videos', panel).onclick = () => nav.go('videos');
    return;
  }

  if (pos >= queue.length) {
    panel.innerHTML = `${head}
      <div class="flash-wrap"><div class="flashcard">
        <div class="empty-icon"><i data-lucide="flag"></i></div>
        <h2>Xong lượt ôn hôm nay!</h2>
        <p><i data-lucide="smile"></i> Nhớ: <b>${tally.remembered}</b> · <i data-lucide="frown"></i> Quên: <b>${tally.forgot}</b>${tally.mastered ? ` · <i data-lucide="trophy"></i> Đã thuộc thêm: <b>${tally.mastered}</b>` : ''}</p>
        <div class="row" style="justify-content:center;margin-top:.5rem">
          <button class="btn btn-primary" id="r-again">Kiểm tra câu đến hạn</button>
          <button class="btn btn-ghost" id="r-home"><i data-lucide="house"></i> Trang chủ</button>
        </div>
      </div></div>`;
    $('#r-again', panel).onclick = () => show(panel);
    $('#r-home', panel).onclick = () => nav.go('home');
    return;
  }

  const seg = queue[pos];
  const pct = Math.round((pos / queue.length) * 100);
  const remember = nextReview(seg.box, true);
  panel.innerHTML = `${head}
    <div class="flash-wrap">
      <div class="row-between small muted" style="margin-bottom:.4rem">
        <span>Thẻ ${pos + 1}/${queue.length}</span>
        <span>${escapeHtml(seg.video?.title || '')}</span>
      </div>
      <div class="progress thin" style="margin-bottom:1rem"><span style="width:${pct}%"></span></div>
      <div class="flashcard">
        <span class="badge"><i data-lucide="package"></i> Hộp ${seg.box}</span>
        <div class="flash-front">${seg.vi ? escapeHtml(seg.vi) : '<span class="muted">(Câu chưa có nghĩa tiếng Việt — hãy nghe và nhớ lại câu)</span>'}</div>
        <p class="muted small">Câu tiếng Anh là gì?</p>
        ${revealed ? `
          <div class="flash-back">
            <div class="sentence-en">${escapeHtml(seg.en)}</div>
            ${seg.ipa ? `<div class="sentence-ipa">${escapeHtml(seg.ipa)}</div>` : ''}
            ${seg.pattern ? `<div class="small muted" style="margin-top:.35rem"><i data-lucide="blocks"></i> ${escapeHtml(seg.pattern)}</div>` : ''}
            ${canSpeak ? '<button class="btn btn-ghost btn-small" id="r-say" style="margin-top:.6rem"><i data-lucide="volume-2"></i> Nghe</button>' : ''}
          </div>`
        : (!seg.vi && canSpeak ? '<button class="btn btn-soft" id="r-say"><i data-lucide="volume-2"></i> Nghe câu</button>' : '')}
      </div>
      ${revealed ? `
        <div class="flash-actions">
          <button class="btn btn-bad btn-lg" id="r-forgot"><i data-lucide="frown"></i> Quên<br><span class="kbd">về hộp 1 · ôn sau 1 ngày</span></button>
          <button class="btn btn-ok btn-lg" id="r-remember"><i data-lucide="smile"></i> Nhớ<br><span class="kbd">${daysText(remember.box)}</span></button>
        </div>`
      : '<button class="btn btn-primary btn-lg btn-block" id="r-reveal" style="margin-top:1rem"><i data-lucide="eye"></i> Xem đáp án <span class="kbd">(Space)</span></button>'}
    </div>`;

  $('#r-say', panel)?.addEventListener('click', () => speak(seg.en));
  $('#r-reveal', panel)?.addEventListener('click', reveal);
  $('#r-forgot', panel)?.addEventListener('click', () => answer(false));
  $('#r-remember', panel)?.addEventListener('click', () => answer(true));
}

function reveal() {
  revealed = true;
  renderCard();
  if (canSpeak) speak(queue[pos].en);
}

async function answer(remembered) {
  if (busy) return;
  busy = true;
  const seg = queue[pos];
  const r = nextReview(seg.box, remembered);
  try {
    await db.setProgress(seg.id, r.box, r.next_review_at);
    db.logStudy('review', seg.id, remembered ? 5 : 2).catch(() => {});
    if (remembered) tally.remembered++;
    else tally.forgot++;
    if (r.mastered) {
      tally.mastered++;
      toast('Bạn đã thuộc câu này!', 'success');
    }
    pos++;
    revealed = false;
    stopSpeaking();
    renderCard();
    nav.refreshDue();
  } catch (error) {
    toast(friendlyError(error), 'error');
  } finally {
    busy = false;
  }
}
