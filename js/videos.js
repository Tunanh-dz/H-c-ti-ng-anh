// Danh sách video: thêm video bằng link YouTube, xóa, mở để luyện tập.
import { db } from './db.js';
import { $, escapeHtml, toast, run, spinner, friendlyError } from './ui.js';
import { parseYouTubeId, thumbnailUrl } from './utils/youtube.js';
import { openPractice, closePractice } from './practice.js';

// Bài học mẫu: chỉ lưu link và tiêu đề; câu được tạo từ bản chép lời người dùng dán vào.
export const SAMPLE = {
  youtube_id: 'V7Dvcy0gq-U',
  title: 'Nice to meet you! How to Introduce People in English',
};

let panel = null;
let openId = null; // video đang mở (giữ lại khi chuyển tab rồi quay về)

export function show(p, params = {}) {
  panel = p;
  if (params.addSample) {
    addSample();
    return;
  }
  if (params.videoId) openId = params.videoId;
  if (openId) openDetail(openId, params.mode);
  else renderList();
}

export function hide() {
  closePractice();
}

export function reset() {
  openId = null;
  closePractice();
}

// Lấy tiêu đề video từ YouTube (oEmbed). Không được thì trả về null.
async function fetchTitle(youtubeId) {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + youtubeId)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()).title || null;
  } catch {
    return null;
  }
}

async function renderList() {
  closePractice();
  panel.innerHTML = spinner();
  let videos;
  try {
    videos = await db.listVideos();
  } catch (error) {
    panel.innerHTML = `<div class="card"><h2>Không tải được danh sách video</h2>
      <p class="muted">${escapeHtml(friendlyError(error))}</p>
      <button class="btn btn-primary" id="v-retry">Thử lại</button></div>`;
    $('#v-retry', panel).onclick = renderList;
    return;
  }
  const hasSample = videos.some((v) => v.youtube_id === SAMPLE.youtube_id);

  panel.innerHTML = `
    <div class="section-head" style="margin-top:0">
      <div><h1><i data-lucide="clapperboard"></i> Video của bạn</h1><p class="muted">Dán link YouTube, thêm câu, rồi luyện nghe – viết – nói.</p></div>
    </div>

    <form class="card" id="add-video-form" novalidate>
      <div class="card-title"><h2><i data-lucide="plus"></i> Thêm video</h2></div>
      <div class="form-grid">
        <div>
          <label for="v-link">Link YouTube</label>
          <input id="v-link" inputmode="url" autocomplete="off" placeholder="https://www.youtube.com/watch?v=… hoặc https://youtu.be/…">
          <div class="field-error" id="v-link-error" hidden></div>
        </div>
        <div>
          <label for="v-title">Tiêu đề <span class="hint">(tự điền nếu để trống)</span></label>
          <input id="v-title" autocomplete="off" placeholder="Ví dụ: Giới thiệu bản thân">
        </div>
      </div>
      <button class="btn btn-primary" id="v-add" style="margin-top:.9rem">Thêm video</button>
    </form>

    ${hasSample ? '' : `
      <div class="card" style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
        <img src="${thumbnailUrl(SAMPLE.youtube_id)}" alt="" width="128" height="72" style="border-radius:12px;object-fit:cover">
        <div style="flex:1;min-width:200px">
          <span class="badge"><i data-lucide="sparkles"></i> Bài học mẫu</span>
          <div class="seg-en" style="margin-top:.3rem">${escapeHtml(SAMPLE.title)}</div>
          <div class="muted small">Thêm video này rồi dán bản chép lời từ YouTube để tạo câu tự động.</div>
        </div>
        <button class="btn btn-soft" id="v-sample">Thêm bài mẫu</button>
      </div>`}

    <div class="section-head"><h2>Danh sách (${videos.length})</h2></div>
    ${videos.length ? `<div class="video-grid">${videos.map(videoCard).join('')}</div>` : `
      <div class="empty"><div class="empty-icon"><i data-lucide="inbox"></i></div>
        <p><b>Chưa có video nào.</b></p><p>Dán link YouTube vào ô phía trên để bắt đầu.</p></div>`}
  `;

  const link = $('#v-link', panel);
  const title = $('#v-title', panel);
  const linkError = $('#v-link-error', panel);

  // Dán link xong thì tự lấy tiêu đề nếu ô tiêu đề đang trống
  link.addEventListener('change', async () => {
    const id = parseYouTubeId(link.value);
    linkError.hidden = Boolean(id) || !link.value.trim();
    if (!id) {
      linkError.textContent = 'Link chưa đúng. Hãy dán link YouTube dạng youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/… hoặc youtube.com/embed/…';
      return;
    }
    if (!title.value.trim()) {
      const t = await fetchTitle(id);
      if (t && !title.value.trim()) title.value = t;
    }
  });

  $('#add-video-form', panel).addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseYouTubeId(link.value);
    if (!id) {
      linkError.hidden = false;
      linkError.textContent = link.value.trim()
        ? 'Link chưa đúng. Hãy dán link YouTube dạng youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/… hoặc youtube.com/embed/…'
        : 'Hãy dán link video YouTube.';
      link.focus();
      return;
    }
    linkError.hidden = true;
    if (videos.some((v) => v.youtube_id === id)
      && !confirm('Video này đã có trong danh sách. Vẫn thêm một bản nữa?')) return;

    const button = $('#v-add', panel);
    const video = await run(button, async () => {
      const name = title.value.trim() || (await fetchTitle(id)) || 'Video ' + id;
      return db.addVideo({ youtube_id: id, title: name });
    }, 'Đang thêm…');
    if (video) {
      toast('Đã thêm video. Giờ hãy thêm câu cho video này.', 'success');
      openDetail(video.id, 'manage');
    }
  });

  const sampleBtn = $('#v-sample', panel);
  if (sampleBtn) sampleBtn.onclick = () => addSample(sampleBtn);

  panel.querySelectorAll('[data-open]').forEach((el) => {
    el.onclick = () => openDetail(el.dataset.open);
  });
  panel.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.onclick = async () => {
      const v = videos.find((x) => String(x.id) === btn.dataset.delete);
      const ok = confirm(`Xóa video "${v.title}" cùng ${v.total} câu và toàn bộ tiến độ của nó?\nKhông thể hoàn tác.`);
      if (!ok) return;
      const done = await run(btn, () => db.deleteVideo(v.id).then(() => true), 'Đang xóa…');
      if (done) {
        toast('Đã xóa video.', 'success');
        renderList();
      }
    };
  });
}

function videoCard(v) {
  const pct = v.total ? Math.round((v.mastered / v.total) * 100) : 0;
  return `
    <article class="video-card">
      <button class="video-thumb" data-open="${v.id}" aria-label="Mở video ${escapeHtml(v.title)}">
        <img src="${thumbnailUrl(v.youtube_id)}" alt="" loading="lazy">
        <span class="play-badge"><i data-lucide="play"></i></span>
      </button>
      <div class="video-body">
        <div class="video-title" data-open="${v.id}">${escapeHtml(v.title)}</div>
        <div class="video-meta">${v.total} câu · ${v.mastered} đã thuộc</div>
        <div class="progress thin"><span style="width:${pct}%"></span></div>
        <div class="video-actions">
          <button class="btn btn-primary btn-small" data-open="${v.id}"><i data-lucide="play"></i> Học</button>
          <button class="btn btn-danger btn-small" data-delete="${v.id}" style="flex:none" aria-label="Xóa video"><i data-lucide="trash-2"></i> Xóa</button>
        </div>
      </div>
    </article>`;
}

async function addSample(button) {
  const video = await run(button, async () => {
    const list = await db.listVideos();
    return list.find((v) => v.youtube_id === SAMPLE.youtube_id) || db.addVideo(SAMPLE);
  }, 'Đang thêm…');
  if (!video) {
    renderList();
    return;
  }
  toast('Đã có bài học mẫu. Hãy dán bản chép lời từ YouTube để tạo câu.', 'success');
  openDetail(video.id, 'manage');
}

async function openDetail(id, mode) {
  openId = id;
  panel.innerHTML = spinner();
  try {
    const video = await db.getVideo(id);
    if (!video) {
      toast('Không tìm thấy video (có thể đã bị xóa).', 'error');
      openId = null;
      renderList();
      return;
    }
    await openPractice(panel, video, {
      mode,
      onBack: () => {
        openId = null;
        renderList();
      },
    });
  } catch (error) {
    toast(friendlyError(error), 'error');
    openId = null;
    renderList();
  }
}
