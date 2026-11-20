// Quản lý câu trong một video: thêm từng câu, nhập hàng loạt, nhập từ bản chép lời
// YouTube, sửa và xóa. Hiển thị như một "chế độ" trong trang học video (practice.js).
import { db } from './db.js';
import { $, escapeHtml, toast, run, nav } from './ui.js';
import { parseTime, formatTime } from './utils/youtube.js';
import { parseBulk, parseTranscript, validateSegment } from './utils/bulk.js';

const SAMPLE_BULK = [
  '00:20-00:36 | Thank you for the invitation. | Cảm ơn anh vì lời mời. | /θæŋk ju fər ði ˌɪnvɪˈteɪʃən/ | Thank you for + N / V-ing',
  "00:36-00:40 | That's very nice of you. | Anh tốt quá. | /ðæts ˈveri naɪs əv ju/ | (It's) nice of you (to V)",
  "00:40-00:47 | We'd love to come. | Chúng tôi rất muốn đến. | /wid lʌv tə kʌm/ | would love to V",
].join('\n');

const emptyToNull = (v) => (String(v ?? '').trim() ? String(v).trim() : null);

// Các ô nhập của một câu (dùng chung cho form thêm và form sửa)
function segmentFields(prefix, s = {}) {
  const v = (x) => escapeHtml(x ?? '');
  return `
    <div class="form-grid">
      <div>
        <label for="${prefix}-start">Bắt đầu <span class="hint">(mm:ss)</span></label>
        <div class="time-field">
          <input id="${prefix}-start" inputmode="decimal" placeholder="00:20" value="${s.start_sec != null ? formatTime(s.start_sec) : ''}">
          <button type="button" class="btn btn-ghost" data-now="${prefix}-start" title="Lấy thời điểm đang phát của video"><i data-lucide="timer"></i></button>
        </div>
      </div>
      <div>
        <label for="${prefix}-end">Kết thúc <span class="hint">(mm:ss)</span></label>
        <div class="time-field">
          <input id="${prefix}-end" inputmode="decimal" placeholder="00:35" value="${s.end_sec != null ? formatTime(s.end_sec) : ''}">
          <button type="button" class="btn btn-ghost" data-now="${prefix}-end" title="Lấy thời điểm đang phát của video"><i data-lucide="timer"></i></button>
        </div>
      </div>
      <div class="full">
        <label for="${prefix}-en">Câu tiếng Anh <span class="hint">(bắt buộc)</span></label>
        <textarea id="${prefix}-en" rows="2" placeholder="Thank you for the invitation.">${v(s.en)}</textarea>
      </div>
      <div class="full">
        <label for="${prefix}-vi">Nghĩa tiếng Việt</label>
        <input id="${prefix}-vi" placeholder="Cảm ơn anh vì lời mời." value="${v(s.vi)}">
      </div>
      <div>
        <label for="${prefix}-ipa">Phiên âm</label>
        <input id="${prefix}-ipa" placeholder="/θæŋk ju/" value="${v(s.ipa)}">
      </div>
      <div>
        <label for="${prefix}-pattern">Khung câu</label>
        <input id="${prefix}-pattern" placeholder="Thank you for + N / V-ing" value="${v(s.pattern)}">
      </div>
      <div class="full">
        <label for="${prefix}-note">Ghi chú</label>
        <input id="${prefix}-note" placeholder="Ghi chú ngữ pháp, từ vựng…" value="${v(s.note)}">
      </div>
    </div>`;
}

function readFields(root, prefix) {
  const val = (name) => $(`#${prefix}-${name}`, root).value;
  return {
    start_sec: parseTime(val('start')),
    end_sec: parseTime(val('end')),
    en: val('en').trim(),
    vi: emptyToNull(val('vi')),
    ipa: emptyToNull(val('ipa')),
    pattern: emptyToNull(val('pattern')),
    note: emptyToNull(val('note')),
  };
}

// Nút đồng hồ: điền thời điểm hiện tại của video vào ô thời gian
function wireNowButtons(root, ctx) {
  root.querySelectorAll('[data-now]').forEach((b) => {
    b.onclick = () => {
      $(`#${b.dataset.now}`, root).value = formatTime(Math.round(ctx.player.currentTime() * 10) / 10);
    };
  });
}

export function render(el, ctx) {
  const n = ctx.segments.length;
  el.innerHTML = `
    <details class="panel-box" id="m-single" ${n ? '' : ''}>
      <summary><i data-lucide="plus"></i> Thêm một câu</summary>
      <form class="box-body" id="m-add-form" novalidate>
        <p class="muted small">Mẹo: cho video chạy, bấm nút đồng hồ để lấy đúng thời điểm bắt đầu / kết thúc.</p>
        ${segmentFields('m-add')}
        <div class="field-error" id="m-add-error" hidden></div>
        <button class="btn btn-primary" id="m-add-btn" style="margin-top:.9rem">Lưu câu</button>
      </form>
    </details>

    <details class="panel-box" id="m-bulk">
      <summary><i data-lucide="list-checks"></i> Nhập hàng loạt</summary>
      <div class="box-body">
        <p class="muted small">Mỗi dòng một câu:<br>
          <code>00:20-00:35 | câu tiếng Anh | nghĩa tiếng Việt | /phiên âm/ | khung câu</code><br>
          Bắt buộc 3 phần đầu. Phiên âm, khung câu (và ghi chú ở phần thứ 6) có thể bỏ trống.</p>
        <textarea id="m-bulk-text" class="mono" rows="6" placeholder="${escapeHtml(SAMPLE_BULK)}"></textarea>
        <ul class="error-list" id="m-bulk-errors" hidden></ul>
        <div class="row" style="margin-top:.75rem">
          <button class="btn btn-primary" id="m-bulk-save">Kiểm tra & lưu</button>
          <button class="btn btn-ghost" id="m-bulk-sample">Điền dữ liệu mẫu</button>
        </div>
      </div>
    </details>

    <details class="panel-box" id="m-transcript" ${n ? '' : 'open'}>
      <summary><i data-lucide="scroll-text"></i> Nhập từ bản chép lời YouTube</summary>
      <div class="box-body">
        <ol class="small" style="padding-left:1.2rem;margin:.25rem 0 .75rem">
          <li>Mở video trên YouTube (nên dùng máy tính): <a href="https://www.youtube.com/watch?v=${ctx.video.youtube_id}" target="_blank" rel="noopener">mở video <i data-lucide="external-link"></i></a></li>
          <li>Bấm <b>…Thêm</b> ở phần mô tả dưới video → <b>Hiện bản chép lời</b>.</li>
          <li>Bôi đen toàn bộ bản chép lời (kéo chuột từ dòng đầu đến dòng cuối) → <b>Ctrl + C</b>.</li>
          <li>Dán vào ô bên dưới (<b>Ctrl + V</b>) → <b>Xem trước</b> → <b>Lưu</b>.</li>
        </ol>
        <textarea id="m-tr-text" class="mono" rows="6" placeholder="0:00&#10;Hi everyone, welcome back&#10;0:03&#10;to the channel."></textarea>
        <label class="check"><input type="checkbox" id="m-tr-merge" checked> Gộp các dòng thành câu hoàn chỉnh (theo dấu . ? !)</label>
        <div class="row" style="margin-top:.5rem">
          <button class="btn btn-soft" id="m-tr-preview"><i data-lucide="eye"></i> Xem trước</button>
        </div>
        <div id="m-tr-result"></div>
      </div>
    </details>

    <div class="card" style="margin-top:.25rem">
      <div class="row-between"><h2>Danh sách câu (${n})</h2>
        ${n ? '<span class="muted small">Sắp xếp theo thời gian bắt đầu</span>' : ''}</div>
      ${n ? `<ul class="list" id="m-list">${ctx.segments.map((s, i) => segmentRow(s, i, ctx.index)).join('')}</ul>`
        : '<p class="muted">Chưa có câu nào. Hãy thêm bằng một trong các cách ở trên.</p>'}
    </div>`;

  wireNowButtons(el, ctx);
  wireAdd(el, ctx);
  wireBulk(el, ctx);
  wireTranscript(el, ctx);
  wireList(el, ctx);
}

function segmentRow(s, i, currentIndex) {
  return `
    <li class="list-item ${i === currentIndex ? 'current' : ''}" data-row="${s.id}">
      <div class="list-main">
        <div class="seg-time">#${i + 1} · ${formatTime(s.start_sec)} – ${formatTime(s.end_sec)}</div>
        <div class="seg-en">${escapeHtml(s.en)}</div>
        <div class="seg-vi">${s.vi ? escapeHtml(s.vi) : '<i>Chưa có nghĩa tiếng Việt</i>'}</div>
        ${s.pattern ? `<div class="small muted"><i data-lucide="blocks"></i> ${escapeHtml(s.pattern)}</div>` : ''}
      </div>
      <div class="list-actions">
        <button class="btn btn-soft btn-small" data-play="${i}" aria-label="Phát câu"><i data-lucide="play"></i></button>
        <button class="btn btn-ghost btn-small" data-learn="${i}">Học</button>
        <button class="btn btn-ghost btn-small" data-edit="${s.id}"><i data-lucide="pencil"></i> Sửa</button>
        <button class="btn btn-danger btn-small" data-del="${s.id}" aria-label="Xóa câu"><i data-lucide="trash-2"></i></button>
      </div>
    </li>`;
}

// Sau khi thay đổi dữ liệu: tải lại danh sách và vẽ lại, giữ phần đang mở
async function refresh(el, ctx, keepId, openBox) {
  await ctx.reload(keepId);
  nav.refreshDue(); // câu mới đến hạn ôn ngay → cập nhật số trên tab "Ôn tập"
  render(el, ctx);
  if (openBox) {
    el.querySelectorAll('details.panel-box').forEach((d) => { d.open = d.id === openBox; });
  }
}

function wireAdd(el, ctx) {
  const form = $('#m-add-form', el);
  const errorBox = $('#m-add-error', el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = readFields(el, 'm-add');
    const error = validateSegment(item);
    errorBox.hidden = !error;
    if (error) {
      errorBox.textContent = error;
      return;
    }
    const created = await run($('#m-add-btn', el), () => db.addSegments(ctx.video.id, [item], ctx.segments.length), 'Đang lưu…');
    if (!created) return;
    toast('Đã lưu câu.', 'success');
    await refresh(el, ctx, created[0].id, 'm-single');
    // Tiện nhập câu kế tiếp: thời gian bắt đầu = kết thúc của câu vừa lưu
    $('#m-add-start', el).value = formatTime(item.end_sec);
    $('#m-add-en', el).focus();
  });
}

function wireBulk(el, ctx) {
  const text = $('#m-bulk-text', el);
  const errors = $('#m-bulk-errors', el);
  $('#m-bulk-sample', el).onclick = () => { text.value = SAMPLE_BULK; };
  $('#m-bulk-save', el).onclick = async (e) => {
    const { items, errors: errs } = parseBulk(text.value);
    errors.hidden = !errs.length;
    if (errs.length) {
      errors.innerHTML = errs.map((x) => `<li><b>Dòng ${x.lineNo}:</b> ${escapeHtml(x.error)}<br><span class="muted">${escapeHtml(x.text)}</span></li>`).join('');
      toast(`Có ${errs.length} dòng bị lỗi. Hãy sửa rồi bấm lưu lại (chưa lưu dòng nào).`, 'error');
      return;
    }
    if (!items.length) {
      toast('Ô nhập đang trống.', 'error');
      return;
    }
    const created = await run(e.currentTarget, () => db.addSegments(ctx.video.id, items, ctx.segments.length), 'Đang lưu…');
    if (!created) return;
    toast(`Đã lưu ${created.length} câu.`, 'success');
    await refresh(el, ctx, created[0].id, null);
  };
}

function wireTranscript(el, ctx) {
  const result = $('#m-tr-result', el);
  $('#m-tr-preview', el).onclick = () => {
    const items = parseTranscript($('#m-tr-text', el).value, { merge: $('#m-tr-merge', el).checked });
    if (!items.length) {
      result.innerHTML = `<p class="field-error">Không tìm thấy dòng nào có mốc thời gian. Hãy chắc rằng bạn đã sao chép cả các con số thời gian (ví dụ 0:03) trong bản chép lời.</p>`;
      return;
    }
    const existing = ctx.segments.length
      ? `<p class="banner small"><i data-lucide="triangle-alert"></i> Video đã có ${ctx.segments.length} câu. Các câu mới sẽ được thêm vào cùng danh sách.</p>` : '';
    result.innerHTML = `
      ${existing}
      <p style="margin-top:.75rem"><b>Tìm thấy ${items.length} câu.</b> <span class="muted small">Nghĩa tiếng Việt để trống, bạn có thể bổ sung sau bằng nút Sửa.</span></p>
      <div style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:12px;padding:0 .5rem">
        <table class="preview-table">${items.map((it) => `
          <tr><td class="seg-time" style="white-space:nowrap">${formatTime(it.start_sec)}–${formatTime(it.end_sec)}</td>
          <td>${escapeHtml(it.en)}</td></tr>`).join('')}</table>
      </div>
      <button class="btn btn-primary" id="m-tr-save" style="margin-top:.75rem"><i data-lucide="save"></i> Lưu ${items.length} câu</button>`;
    $('#m-tr-save', result).onclick = async (e) => {
      const created = await run(e.currentTarget, () => db.addSegments(ctx.video.id, items, ctx.segments.length), 'Đang lưu…');
      if (!created) return;
      toast(`Đã lưu ${created.length} câu từ bản chép lời. Bắt đầu luyện thôi!`, 'success');
      await refresh(el, ctx, created[0].id, null);
    };
  };
}

function wireList(el, ctx) {
  el.querySelectorAll('[data-play]').forEach((b) => {
    b.onclick = () => ctx.play({ seg: ctx.segments[Number(b.dataset.play)], repeat: 1 });
  });
  el.querySelectorAll('[data-learn]').forEach((b) => {
    b.onclick = () => {
      ctx.index = Number(b.dataset.learn);
      ctx.setMode('listen');
      ctx.goTo(Number(b.dataset.learn));
    };
  });
  el.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      const seg = ctx.segments.find((s) => String(s.id) === b.dataset.del);
      if (!confirm(`Xóa câu "${seg.en}"?\nTiến độ ôn tập và câu bạn tự viết cho câu này cũng bị xóa.`)) return;
      const ok = await run(b, () => db.deleteSegment(seg.id).then(() => true), '…');
      if (!ok) return;
      toast('Đã xóa câu.', 'success');
      await refresh(el, ctx, null, null);
    };
  });
  el.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => openEditor(el, ctx, b.dataset.edit);
  });
}

// Sửa câu ngay trong danh sách
function openEditor(el, ctx, id) {
  const seg = ctx.segments.find((s) => String(s.id) === String(id));
  const row = el.querySelector(`[data-row="${id}"]`);
  const prefix = `m-edit-${id}`;
  row.innerHTML = `
    <form class="list-main" novalidate>
      ${segmentFields(prefix, seg)}
      <div class="field-error" hidden></div>
      <div class="row" style="margin-top:.75rem">
        <button class="btn btn-primary btn-small"><i data-lucide="save"></i> Lưu thay đổi</button>
        <button type="button" class="btn btn-ghost btn-small" data-cancel>Hủy</button>
      </div>
    </form>`;
  wireNowButtons(row, ctx);
  $(`#${prefix}-en`, row).focus();
  row.querySelector('[data-cancel]').onclick = () => render(el, ctx);
  row.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const patch = readFields(row, prefix);
    const error = validateSegment(patch);
    const errorBox = row.querySelector('.field-error');
    errorBox.hidden = !error;
    if (error) {
      errorBox.textContent = error;
      return;
    }
    const ok = await run(e.submitter, () => db.updateSegment(seg.id, patch).then(() => true), 'Đang lưu…');
    if (!ok) return;
    toast('Đã cập nhật câu.', 'success');
    await refresh(el, ctx, seg.id, null);
  });
}
