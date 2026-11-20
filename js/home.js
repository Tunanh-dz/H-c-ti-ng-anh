// Trang chủ: số câu đến hạn, chuỗi ngày học, XP, mục tiêu mỗi ngày, biểu đồ 7 ngày.
import { db, session } from './db.js';
import { $, escapeHtml, nav, spinner, friendlyError, getPref, setPref } from './ui.js';
import { summarizeLogs, lastNDays } from './utils/srs.js';
import { thumbnailUrl } from './utils/youtube.js';

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const GOALS = [5, 10, 15, 20, 30, 50];

export async function show(panel) {
  panel.innerHTML = spinner();
  let due, logs, videos;
  try {
    [due, logs, videos] = await Promise.all([db.countDue(), db.listLogs(365), db.listVideos()]);
  } catch (error) {
    panel.innerHTML = `
      <div class="card">
        <h2>Không tải được dữ liệu</h2>
        <p class="muted">${escapeHtml(friendlyError(error))}</p>
        <button class="btn btn-primary" id="home-retry">Thử lại</button>
      </div>`;
    $('#home-retry', panel).onclick = () => show(panel);
    return;
  }

  const stats = summarizeLogs(logs);
  const goal = getPref('dailyGoal', 10);
  const goalPct = Math.min(100, Math.round((stats.todaySentences / goal) * 100));
  const total = videos.reduce((n, v) => n + v.total, 0);
  const mastered = videos.reduce((n, v) => n + v.mastered, 0);

  const days = lastNDays(7);
  const maxXp = Math.max(10, ...days.map((d) => stats.xpByDay[d] || 0));
  const bars = days.map((d, i) => {
    const xp = stats.xpByDay[d] || 0;
    const [y, m, dd] = d.split('-').map(Number);
    const label = i === days.length - 1 ? 'Nay' : WEEKDAY[new Date(y, m - 1, dd).getDay()];
    return `
      <div class="chart-col" title="${xp} XP">
        <span class="chart-val">${xp || ''}</span>
        <div class="chart-bar ${i === days.length - 1 ? 'today' : ''}" style="height:${Math.round((xp / maxXp) * 100)}%"></div>
        <span class="chart-day">${label}</span>
      </div>`;
  }).join('');

  const heroText = due > 0
    ? `Hôm nay có <b>${due} câu</b> đến hạn ôn tập. Ôn ngay để không quên nhé!`
    : (total ? 'Không có câu nào đến hạn. Học thêm câu mới trong video nhé!' : 'Bắt đầu bằng cách thêm một video YouTube bạn thích.');

  panel.innerHTML = `
    <section class="card hero">
      <h1>Chào ${session.user.name ? escapeHtml(session.user.name) : 'bạn'}!</h1>
      <p>${heroText}</p>
      <div class="row" style="margin-top:.9rem">
        ${due > 0 ? `<button class="btn btn-white btn-lg" data-go="review"><i data-lucide="repeat"></i> Ôn tập ngay (${due})</button>` : ''}
        <button class="btn ${due > 0 ? 'btn-ghost' : 'btn-white btn-lg'}" data-go="videos" style="${due > 0 ? 'color:#fff;border-color:rgba(255,255,255,.5)' : ''}"><i data-lucide="clapperboard"></i> Học video</button>
      </div>
    </section>

    <section class="stats">
      <div class="stat"><div class="stat-icon"><i data-lucide="flame"></i></div><div class="stat-value">${stats.streak}</div><div class="stat-label">ngày học liên tiếp</div></div>
      <div class="stat"><div class="stat-icon"><i data-lucide="star"></i></div><div class="stat-value">${stats.todayXp}</div><div class="stat-label">XP hôm nay</div></div>
      <div class="stat"><div class="stat-icon"><i data-lucide="trophy"></i></div><div class="stat-value">${stats.totalXp}</div><div class="stat-label">tổng XP</div></div>
      <div class="stat"><div class="stat-icon"><i data-lucide="circle-check"></i></div><div class="stat-value">${mastered}<span class="muted" style="font-size:1rem">/${total}</span></div><div class="stat-label">câu đã thuộc</div></div>
    </section>

    <div class="home-grid">
      <section class="card">
        <div class="row-between">
          <h2><i data-lucide="target"></i> Mục tiêu hôm nay</h2>
          <label class="row small" style="margin:0;font-weight:500">
            <select id="goal-select" style="width:auto;min-height:36px;padding:.2rem .5rem" aria-label="Mục tiêu số câu mỗi ngày">
              ${GOALS.map((g) => `<option value="${g}" ${g === goal ? 'selected' : ''}>${g} câu</option>`).join('')}
            </select>
          </label>
        </div>
        <p style="font-size:1.1rem"><b>${stats.todaySentences}</b> / ${goal} câu đã luyện</p>
        <div class="progress"><span style="width:${goalPct}%"></span></div>
        <p class="muted small" style="margin-top:.6rem">
          ${goalPct >= 100 ? '<i data-lucide="party-popper"></i> Tuyệt vời! Bạn đã hoàn thành mục tiêu hôm nay.' : 'Mỗi câu bạn luyện (nghe, chép, điền, nói, ôn…) được tính một lần trong ngày.'}
        </p>
      </section>
      <section class="card">
        <h2><i data-lucide="chart-column"></i> 7 ngày gần đây <span class="muted small">(XP)</span></h2>
        <div class="chart">${bars}</div>
      </section>
    </div>

    <div class="section-head"><h2><i data-lucide="circle-play"></i> Tiếp tục học</h2>${videos.length ? '<button class="btn btn-ghost btn-small" data-go="videos">Tất cả video</button>' : ''}</div>
    ${videos.length ? `
      <div class="card"><ul class="list">
        ${videos.slice(0, 3).map((v) => `
          <li class="list-item" style="align-items:center;flex-direction:row">
            <img src="${thumbnailUrl(v.youtube_id)}" alt="" width="96" height="54" style="border-radius:10px;object-fit:cover;flex:none">
            <div class="list-main">
              <div class="seg-en">${escapeHtml(v.title)}</div>
              <div class="seg-vi">${v.total} câu · ${v.mastered} đã thuộc</div>
              <div class="progress thin" style="margin-top:.35rem"><span style="width:${v.total ? Math.round((v.mastered / v.total) * 100) : 0}%"></span></div>
            </div>
            <button class="btn btn-soft btn-small" data-open="${v.id}">Học</button>
          </li>`).join('')}
      </ul></div>`
    : `
      <div class="empty">
        <div class="empty-icon"><i data-lucide="sparkles"></i></div>
        <p><b>Chưa có video nào.</b></p>
        <p>Thử ngay với bài học mẫu "Nice to meet you!" hoặc thêm video của riêng bạn.</p>
        <div class="row" style="justify-content:center;margin-top:.75rem">
          <button class="btn btn-primary" id="home-sample"><i data-lucide="sparkles"></i> Thêm bài học mẫu</button>
          <button class="btn btn-ghost" data-go="videos"><i data-lucide="plus"></i> Thêm video</button>
        </div>
      </div>`}
  `;

  panel.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => nav.go(b.dataset.go); });
  panel.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => nav.go('videos', { videoId: b.dataset.open }); });
  const sample = $('#home-sample', panel);
  if (sample) sample.onclick = () => nav.go('videos', { addSample: true });
  $('#goal-select', panel).onchange = (e) => {
    setPref('dailyGoal', Number(e.target.value));
    show(panel);
  };
}
