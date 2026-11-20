// Chia sẻ tiến độ: tab "Chia sẻ" (mình chia sẻ cho ai) và tab "Được chia sẻ"
// (xem chỉ đọc tiến độ của người khác). Quyền đọc được kiểm soát bằng RLS trong schema.sql.
import { db, session } from './db.js';
import { $, escapeHtml, toast, run, spinner, friendlyError } from './ui.js';
import { thumbnailUrl, formatTime } from './utils/youtube.js';
import { isMastered } from './utils/srs.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function needLogin(panel, title) {
  panel.innerHTML = `
    <div class="section-head" style="margin-top:0"><h1>${title}</h1></div>
    <div class="empty"><div class="empty-icon"><i data-lucide="lock"></i></div>
      <p><b>Chức năng này cần đăng nhập bằng email.</b></p>
      <p>Ở chế độ dùng thử, dữ liệu chỉ nằm trên trình duyệt nên không chia sẻ được. Bấm nút thoát ở góc trên bên phải rồi đăng nhập bằng email.</p></div>`;
}

const fmtDate = (d) => new Date(d).toLocaleDateString('vi-VN');

// ---------------------------------------------------------------------
// Tab "Chia sẻ"
// ---------------------------------------------------------------------
export async function showShare(panel) {
  if (session.isLocal) return needLogin(panel, '<i data-lucide="share-2"></i> Chia sẻ tiến độ');

  panel.innerHTML = `
    <div class="section-head" style="margin-top:0">
      <div><h1><i data-lucide="share-2"></i> Chia sẻ tiến độ</h1>
      <p class="muted">Người được chia sẻ xem được danh sách video, các câu và tiến độ của bạn (chỉ xem, không sửa được). Câu bạn tự viết không được chia sẻ.</p></div>
    </div>
    <form class="card" id="sh-form" novalidate>
      <label for="sh-email" style="margin-top:0">Email người xem</label>
      <div class="row" style="flex-wrap:nowrap">
        <input id="sh-email" type="email" inputmode="email" autocomplete="off" placeholder="banbe@gmail.com">
        <button class="btn btn-primary" id="sh-add" style="flex:none">Chia sẻ</button>
      </div>
      <p class="muted small">Người đó cần đăng nhập vào trang này bằng đúng email trên rồi mở tab "Được chia sẻ".</p>
    </form>
    <div class="card"><h2>Đang chia sẻ với</h2><div id="sh-list">${spinner()}</div></div>`;

  const list = $('#sh-list', panel);
  const load = async () => {
    try {
      const rows = await db.listShares();
      list.innerHTML = rows.length
        ? `<ul class="list">${rows.map((r) => `
            <li class="list-item" style="flex-direction:row;align-items:center">
              <div class="list-main"><b>${escapeHtml(r.viewer_email)}</b><div class="muted small">từ ${fmtDate(r.created_at)}</div></div>
              <button class="btn btn-danger btn-small" data-revoke="${r.id}" data-email="${escapeHtml(r.viewer_email)}">Thu hồi</button>
            </li>`).join('')}</ul>`
        : '<p class="muted">Bạn chưa chia sẻ với ai.</p>';
      list.querySelectorAll('[data-revoke]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm(`Thu hồi quyền xem của ${b.dataset.email}?`)) return;
          const ok = await run(b, () => db.removeShare(b.dataset.revoke).then(() => true), '…');
          if (ok) {
            toast('Đã thu hồi quyền xem.', 'success');
            load();
          }
        };
      });
    } catch (error) {
      list.innerHTML = `<p class="field-error">${escapeHtml(friendlyError(error))}</p>`;
    }
  };
  load();

  $('#sh-form', panel).addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#sh-email', panel);
    const email = input.value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toast('Email chưa đúng định dạng, ví dụ: banbe@gmail.com', 'error');
      input.focus();
      return;
    }
    if (email === session.user.email) {
      toast('Đây là email của chính bạn.', 'error');
      return;
    }
    const ok = await run($('#sh-add', panel), async () => {
      try {
        await db.addShare(email);
        return true;
      } catch (error) {
        if (error?.code === '23505') throw new Error(`Bạn đã chia sẻ với ${email} rồi.`);
        throw error;
      }
    }, 'Đang lưu…');
    if (ok) {
      toast(`Đã chia sẻ tiến độ với ${email}.`, 'success');
      input.value = '';
      load();
    }
  });
  return undefined;
}

// ---------------------------------------------------------------------
// Tab "Được chia sẻ"
// ---------------------------------------------------------------------
let sharedPanel = null;

export function hideShared() {
  sharedPanel = null;
}

export async function showShared(panel) {
  sharedPanel = panel;
  if (session.isLocal) return needLogin(panel, '<i data-lucide="eye"></i> Được chia sẻ');
  panel.innerHTML = spinner();

  let owners;
  try {
    const rows = await db.listSharedWithMe();
    // Với mỗi người chia sẻ, đếm tổng số câu và số câu đã thuộc
    owners = await Promise.all(rows.map(async (r) => {
      const videos = await db.listVideos(r.owner_id);
      return {
        ...r,
        videos,
        total: videos.reduce((n, v) => n + v.total, 0),
        mastered: videos.reduce((n, v) => n + v.mastered, 0),
      };
    }));
  } catch (error) {
    panel.innerHTML = `<div class="card"><h2>Không tải được dữ liệu</h2><p class="muted">${escapeHtml(friendlyError(error))}</p>
      <button class="btn btn-primary" id="sd-retry">Thử lại</button></div>`;
    $('#sd-retry', panel).onclick = () => showShared(panel);
    return undefined;
  }
  if (sharedPanel !== panel) return undefined; // người dùng đã chuyển tab

  panel.innerHTML = `
    <div class="section-head" style="margin-top:0">
      <div><h1><i data-lucide="eye"></i> Được chia sẻ với bạn</h1><p class="muted">Tiến độ học của những người đã chia sẻ với email ${escapeHtml(session.user.email)} (chỉ xem).</p></div>
    </div>
    ${owners.length ? `<div class="video-grid">${owners.map((o) => {
      const pct = o.total ? Math.round((o.mastered / o.total) * 100) : 0;
      return `
        <article class="card" style="margin:0">
          <div class="row" style="flex-wrap:nowrap">
            <span class="brand-logo" aria-hidden="true">${escapeHtml(o.owner_email[0].toUpperCase())}</span>
            <div style="min-width:0"><b style="word-break:break-all">${escapeHtml(o.owner_email)}</b>
              <div class="muted small">${o.videos.length} video · chia sẻ từ ${fmtDate(o.created_at)}</div></div>
          </div>
          <p style="margin-top:.75rem"><b>${o.mastered}</b> / ${o.total} câu đã thuộc</p>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <button class="btn btn-soft btn-block" data-owner="${o.owner_id}" style="margin-top:.9rem">Xem chi tiết</button>
        </article>`;
    }).join('')}</div>`
    : `<div class="empty"><div class="empty-icon"><i data-lucide="inbox"></i></div><p><b>Chưa có ai chia sẻ với bạn.</b></p>
        <p>Khi ai đó nhập email của bạn trong tab "Chia sẻ", tiến độ của họ sẽ hiện ở đây.</p></div>`}`;

  panel.querySelectorAll('[data-owner]').forEach((b) => {
    b.onclick = () => showOwner(panel, owners.find((o) => o.owner_id === b.dataset.owner));
  });
  return undefined;
}

function showOwner(panel, owner) {
  panel.innerHTML = `
    <div class="detail-head">
      <button class="icon-btn" id="sd-back" aria-label="Quay lại"><i data-lucide="arrow-left"></i></button>
      <h1>${escapeHtml(owner.owner_email)}</h1><span class="badge">Chỉ xem</span>
    </div>
    <p><b>${owner.mastered}</b> / ${owner.total} câu đã thuộc</p>
    ${owner.videos.length ? `<div class="video-grid" style="margin-top:1rem">${owner.videos.map((v) => {
      const pct = v.total ? Math.round((v.mastered / v.total) * 100) : 0;
      return `
        <article class="video-card">
          <button class="video-thumb" data-video="${v.id}"><img src="${thumbnailUrl(v.youtube_id)}" alt="" loading="lazy"></button>
          <div class="video-body">
            <div class="video-title" data-video="${v.id}">${escapeHtml(v.title)}</div>
            <div class="video-meta">${v.total} câu · ${v.mastered} đã thuộc</div>
            <div class="progress thin"><span style="width:${pct}%"></span></div>
            <button class="btn btn-soft btn-small" data-video="${v.id}">Xem các câu</button>
          </div>
        </article>`;
    }).join('')}</div>` : '<div class="empty"><p>Người này chưa có video nào.</p></div>'}`;
  $('#sd-back', panel).onclick = () => showShared(panel);
  panel.querySelectorAll('[data-video]').forEach((b) => {
    b.onclick = () => showOwnerVideo(panel, owner, owner.videos.find((v) => String(v.id) === b.dataset.video));
  });
}

async function showOwnerVideo(panel, owner, video) {
  panel.innerHTML = spinner();
  let segments;
  let progress;
  try {
    [segments, progress] = await Promise.all([db.listSegments(video.id), db.progressMap(owner.owner_id)]);
  } catch (error) {
    toast(friendlyError(error), 'error');
    showOwner(panel, owner);
    return;
  }
  panel.innerHTML = `
    <div class="detail-head">
      <button class="icon-btn" id="sd-back" aria-label="Quay lại"><i data-lucide="arrow-left"></i></button>
      <h1>${escapeHtml(video.title)}</h1><span class="badge">Chỉ xem</span>
    </div>
    <div class="card">
      <p class="muted small">Tiến độ của ${escapeHtml(owner.owner_email)} · ${video.mastered}/${video.total} câu đã thuộc</p>
      ${segments.length ? `<ul class="list">${segments.map((s, i) => {
        const p = progress.get(String(s.id));
        const badge = !p ? '<span class="badge">Chưa học</span>'
          : isMastered(p.box) ? '<span class="badge badge-ok"><i data-lucide="trophy"></i> Đã thuộc</span>'
            : `<span class="badge badge-warn"><i data-lucide="package"></i> Hộp ${p.box}</span>`;
        return `
          <li class="list-item" style="flex-direction:row">
            <div class="list-main">
              <div class="seg-time">#${i + 1} · ${formatTime(s.start_sec)} – ${formatTime(s.end_sec)}</div>
              <div class="seg-en">${escapeHtml(s.en)}</div>
              ${s.vi ? `<div class="seg-vi">${escapeHtml(s.vi)}</div>` : ''}
            </div>
            <div>${badge}</div>
          </li>`;
      }).join('')}</ul>` : '<p class="muted">Video chưa có câu nào.</p>'}
    </div>`;
  $('#sd-back', panel).onclick = () => showOwner(panel, owner);
}
