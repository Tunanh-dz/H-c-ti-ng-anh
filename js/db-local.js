// Chế độ dùng thử: cùng các hàm như Supabase trong db.js nhưng lưu vào
// localStorage của trình duyệt. Không đồng bộ giữa các thiết bị.
import { withCounts, isMastered } from './utils/srs.js';

const KEY = 'demoData.v1';
const OWNER = 'demo';
let memory = null; // dự phòng khi trình duyệt chặn localStorage

const empty = () => ({ seq: 1, videos: [], segments: [], progress: [], my_examples: [], study_log: [] });

function load() {
  if (memory) return memory;
  try {
    memory = JSON.parse(localStorage.getItem(KEY)) || empty();
  } catch {
    memory = empty();
  }
  return memory;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* chỉ giữ trong bộ nhớ */ }
}

const nextId = (d) => d.seq++;
const same = (a, b) => String(a) === String(b);
const now = () => new Date().toISOString();
const notAvailable = () => {
  throw new Error('Chức năng chia sẻ cần đăng nhập bằng email (không dùng được ở chế độ dùng thử).');
};

export const localBackend = {
  async listVideos() {
    const d = load();
    const videos = [...d.videos].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return withCounts(videos, d.segments, d.progress);
  },

  async getVideo(id) {
    return load().videos.find((v) => same(v.id, id)) || null;
  },

  async addVideo({ youtube_id, title }) {
    const d = load();
    const video = { id: nextId(d), owner_id: OWNER, youtube_id, title, created_at: now() };
    d.videos.push(video);
    save();
    return video;
  },

  // Xóa video kéo theo câu, tiến độ, câu tự viết (giống "on delete cascade").
  async deleteVideo(id) {
    const d = load();
    const segIds = new Set(d.segments.filter((s) => same(s.video_id, id)).map((s) => String(s.id)));
    d.videos = d.videos.filter((v) => !same(v.id, id));
    d.segments = d.segments.filter((s) => !segIds.has(String(s.id)));
    d.progress = d.progress.filter((p) => !segIds.has(String(p.segment_id)));
    d.my_examples = d.my_examples.filter((e) => !segIds.has(String(e.segment_id)));
    save();
  },

  async listSegments(videoId) {
    return load().segments
      .filter((s) => same(s.video_id, videoId))
      .sort((a, b) => a.start_sec - b.start_sec || a.id - b.id);
  },

  async addSegments(videoId, items, startPosition = 0) {
    const d = load();
    const created = items.map((it, i) => {
      const seg = {
        id: nextId(d), video_id: Number(videoId), owner_id: OWNER, position: startPosition + i,
        start_sec: it.start_sec, end_sec: it.end_sec, en: it.en,
        vi: it.vi ?? null, ipa: it.ipa ?? null, pattern: it.pattern ?? null, note: it.note ?? null,
      };
      d.segments.push(seg);
      d.progress.push({ segment_id: seg.id, box: 1, next_review_at: now() }); // như trigger
      return seg;
    });
    save();
    return created;
  },

  async updateSegment(id, patch) {
    const seg = load().segments.find((s) => same(s.id, id));
    if (seg) Object.assign(seg, patch);
    save();
  },

  async deleteSegment(id) {
    const d = load();
    d.segments = d.segments.filter((s) => !same(s.id, id));
    d.progress = d.progress.filter((p) => !same(p.segment_id, id));
    d.my_examples = d.my_examples.filter((e) => !same(e.segment_id, id));
    save();
  },

  async progressMap() {
    return new Map(load().progress.map((p) => [String(p.segment_id), p]));
  },

  async listDue(limit = 200) {
    const d = load();
    const t = new Date();
    return d.progress
      .filter((p) => !isMastered(p.box) && new Date(p.next_review_at) <= t)
      .sort((a, b) => a.next_review_at.localeCompare(b.next_review_at))
      .slice(0, limit)
      .map((p) => {
        const seg = d.segments.find((s) => same(s.id, p.segment_id));
        if (!seg) return null;
        const video = d.videos.find((v) => same(v.id, seg.video_id));
        return { ...seg, box: p.box, next_review_at: p.next_review_at, video };
      })
      .filter(Boolean);
  },

  async countDue() {
    return (await this.listDue(100000)).length;
  },

  async setProgress(segmentId, box, nextReviewAt) {
    const d = load();
    const p = d.progress.find((x) => same(x.segment_id, segmentId));
    if (p) Object.assign(p, { box, next_review_at: nextReviewAt });
    else d.progress.push({ segment_id: segmentId, box, next_review_at: nextReviewAt });
    save();
  },

  async listExamples(segmentId) {
    return load().my_examples
      .filter((e) => same(e.segment_id, segmentId))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async addExample(segmentId, text) {
    const d = load();
    const ex = { id: nextId(d), segment_id: segmentId, text, created_at: now() };
    d.my_examples.push(ex);
    save();
    return ex;
  },

  async deleteExample(id) {
    const d = load();
    d.my_examples = d.my_examples.filter((e) => !same(e.id, id));
    save();
  },

  async logStudy(kind, segmentId, xp) {
    load().study_log.push({ kind, segment_id: segmentId ?? null, xp, created_at: now() });
    save();
  },

  async listLogs(days = 365) {
    const since = Date.now() - days * 86400000;
    return load().study_log.filter((l) => new Date(l.created_at).getTime() >= since);
  },

  listShares: async () => [],
  addShare: async () => notAvailable(),
  removeShare: async () => notAvailable(),
  listSharedWithMe: async () => [],
};

// Xóa toàn bộ dữ liệu dùng thử.
export function clearLocalData() {
  memory = empty();
  try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ }
}
