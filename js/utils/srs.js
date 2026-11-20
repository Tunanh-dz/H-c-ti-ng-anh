// Hàm thuần: lịch ôn Leitner, chuỗi ngày học, thống kê theo ngày.

// Số ngày chờ trước lần ôn tiếp theo, theo hộp mà câu vừa được chuyển vào.
export const INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7, 4: 30 };
export const MASTERED_BOX = 5; // vượt hộp 4 = đã thuộc
const DAY_MS = 24 * 60 * 60 * 1000;

export const isMastered = (box) => Number(box) >= MASTERED_BOX;

// Gắn số câu (total) và số câu đã thuộc (mastered) cho từng video.
export function withCounts(videos, segments, progress) {
  const boxBySeg = new Map(progress.map((p) => [String(p.segment_id), p.box]));
  return videos.map((v) => {
    const segs = segments.filter((s) => String(s.video_id) === String(v.id));
    const mastered = segs.filter((s) => isMastered(boxBySeg.get(String(s.id)))).length;
    return { ...v, total: segs.length, mastered };
  });
}

// Tính hộp mới và ngày ôn tiếp theo.
// remembered = true  → lên một hộp (hộp 4 lên nữa là đã thuộc)
// remembered = false → về hộp 1
export function nextReview(box, remembered, now = new Date()) {
  const current = Math.min(Math.max(Math.trunc(Number(box)) || 1, 1), MASTERED_BOX);
  const newBox = remembered ? Math.min(current + 1, MASTERED_BOX) : 1;
  // Câu đã thuộc không còn xuất hiện trong lượt ôn (truy vấn lọc box <= 4),
  // đặt hẹn xa để an toàn.
  const days = newBox >= MASTERED_BOX ? 365 : INTERVAL_DAYS[newBox];
  return {
    box: newBox,
    next_review_at: new Date(now.getTime() + days * DAY_MS).toISOString(),
    mastered: newBox >= MASTERED_BOX,
  };
}

export function isDue(progress, now = new Date()) {
  return !isMastered(progress.box) && new Date(progress.next_review_at) <= now;
}

// Khóa ngày theo giờ địa phương, dạng "2026-11-20".
export function dayKey(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// n ngày gần nhất tính tới hôm nay (cũ → mới).
export function lastNDays(n, today = new Date()) {
  return Array.from({ length: n }, (_, i) => dayKey(addDays(today, i - (n - 1))));
}

// Chuỗi ngày học liên tiếp. Nếu hôm nay chưa học, chuỗi vẫn tính đến hôm qua
// (chưa bị mất cho tới hết ngày hôm nay).
export function computeStreak(studiedDays, today = new Date()) {
  const set = new Set(studiedDays);
  let cursor = set.has(dayKey(today)) ? new Date(today) : addDays(today, -1);
  let streak = 0;
  while (set.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// Gom nhật ký học: XP theo ngày, số câu khác nhau đã luyện hôm nay, tổng XP.
export function summarizeLogs(logs, today = new Date()) {
  const xpByDay = {};
  const todaySegments = new Set();
  let totalXp = 0;
  const todayKey = dayKey(today);
  for (const log of logs) {
    const key = dayKey(log.created_at);
    xpByDay[key] = (xpByDay[key] || 0) + (log.xp || 0);
    totalXp += log.xp || 0;
    if (key === todayKey && log.segment_id != null) todaySegments.add(String(log.segment_id));
  }
  return {
    xpByDay,
    totalXp,
    todayXp: xpByDay[todayKey] || 0,
    todaySentences: todaySegments.size,
    streak: computeStreak(Object.keys(xpByDay), today),
  };
}
