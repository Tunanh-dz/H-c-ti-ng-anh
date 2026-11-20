// Lớp truy cập dữ liệu. Giao diện chỉ gọi db.xxx(), không cần biết dữ liệu
// nằm trên Supabase (đã đăng nhập) hay trong trình duyệt (chế độ dùng thử).
import { supabase } from './supabase.js';
import { localBackend } from './db-local.js';
import { withCounts } from './utils/srs.js';

// Thông tin phiên hiện tại: user = { id, email }, isLocal = đang dùng thử
export const session = { user: null, isLocal: false };

let backend = null;

export function useSupabase(user) {
  const email = (user.email || '').toLowerCase();
  const name = (user.user_metadata?.display_name || '').trim() || email.split('@')[0];
  session.user = { id: user.id, email, name };
  session.isLocal = false;
  backend = supabaseBackend;
}

export function useLocal() {
  session.user = { id: 'demo', email: null, name: null };
  session.isLocal = true;
  backend = localBackend;
}

const METHODS = [
  'listVideos', 'getVideo', 'addVideo', 'deleteVideo',
  'listSegments', 'addSegments', 'updateSegment', 'deleteSegment',
  'progressMap', 'listDue', 'countDue', 'setProgress',
  'listExamples', 'addExample', 'deleteExample',
  'logStudy', 'listLogs',
  'listShares', 'addShare', 'removeShare', 'listSharedWithMe',
];
export const db = Object.fromEntries(METHODS.map((m) => [m, (...args) => backend[m](...args)]));

// ---------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------

const uid = () => session.user.id;

// Supabase trả về { data, error }; có lỗi thì ném ra để giao diện báo.
function check({ data, error }) {
  if (error) throw error;
  return data;
}

// Cột numeric đôi khi trả về dạng chuỗi: đổi về số cho chắc.
const fixNums = (s) => ({ ...s, start_sec: Number(s.start_sec), end_sec: Number(s.end_sec) });

const SEGMENT_COLS = 'id,video_id,owner_id,position,start_sec,end_sec,en,vi,ipa,pattern,note';

const supabaseBackend = {
  // ownerId khác mình = xem tiến độ được chia sẻ (RLS chỉ cho đọc).
  async listVideos(ownerId = uid()) {
    const [v, s, p] = await Promise.all([
      supabase.from('videos').select('id,owner_id,youtube_id,title,created_at')
        .eq('owner_id', ownerId).order('created_at', { ascending: false }),
      supabase.from('segments').select('id,video_id').eq('owner_id', ownerId),
      supabase.from('progress').select('segment_id,box').eq('user_id', ownerId),
    ]);
    return withCounts(check(v), check(s), check(p));
  },

  async getVideo(id) {
    return check(await supabase.from('videos').select('*').eq('id', id).maybeSingle());
  },

  async addVideo({ youtube_id, title }) {
    return check(await supabase.from('videos')
      .insert({ owner_id: uid(), youtube_id, title }).select().single());
  },

  async deleteVideo(id) {
    check(await supabase.from('videos').delete().eq('id', id));
  },

  async listSegments(videoId) {
    const rows = check(await supabase.from('segments').select(SEGMENT_COLS)
      .eq('video_id', videoId).order('start_sec').order('id'));
    return rows.map(fixNums);
  },

  // Thêm nhiều câu một lần. Trigger trong schema.sql tự tạo dòng progress (hộp 1).
  async addSegments(videoId, items, startPosition = 0) {
    const rows = items.map((it, i) => ({
      video_id: videoId,
      owner_id: uid(),
      position: startPosition + i,
      start_sec: it.start_sec,
      end_sec: it.end_sec,
      en: it.en,
      vi: it.vi ?? null,
      ipa: it.ipa ?? null,
      pattern: it.pattern ?? null,
      note: it.note ?? null,
    }));
    return check(await supabase.from('segments').insert(rows).select(SEGMENT_COLS)).map(fixNums);
  },

  async updateSegment(id, patch) {
    check(await supabase.from('segments').update(patch).eq('id', id));
  },

  async deleteSegment(id) {
    check(await supabase.from('segments').delete().eq('id', id));
  },

  // Map segment_id → { box, next_review_at }
  async progressMap(ownerId = uid()) {
    const rows = check(await supabase.from('progress')
      .select('segment_id,box,next_review_at').eq('user_id', ownerId));
    return new Map(rows.map((r) => [String(r.segment_id), r]));
  },

  // Các câu đến hạn ôn (chưa thuộc, next_review_at <= bây giờ), kèm thông tin video.
  async listDue(limit = 200) {
    const rows = check(await supabase.from('progress')
      .select(`box,next_review_at,segments(${SEGMENT_COLS},videos(id,title,youtube_id))`)
      .eq('user_id', uid())
      .lte('box', 4)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at')
      .limit(limit));
    return rows
      .filter((r) => r.segments)
      .map((r) => ({ ...fixNums(r.segments), box: r.box, next_review_at: r.next_review_at, video: r.segments.videos }));
  },

  async countDue() {
    const { count, error } = await supabase.from('progress')
      .select('segment_id', { count: 'exact', head: true })
      .eq('user_id', uid())
      .lte('box', 4)
      .lte('next_review_at', new Date().toISOString());
    if (error) throw error;
    return count || 0;
  },

  async setProgress(segmentId, box, nextReviewAt) {
    check(await supabase.from('progress').upsert({
      user_id: uid(), segment_id: segmentId, box, next_review_at: nextReviewAt,
    }));
  },

  async listExamples(segmentId) {
    return check(await supabase.from('my_examples').select('id,segment_id,text,created_at')
      .eq('segment_id', segmentId).eq('owner_id', uid()).order('created_at', { ascending: false }));
  },

  async addExample(segmentId, text) {
    return check(await supabase.from('my_examples')
      .insert({ owner_id: uid(), segment_id: segmentId, text }).select().single());
  },

  async deleteExample(id) {
    check(await supabase.from('my_examples').delete().eq('id', id));
  },

  async logStudy(kind, segmentId, xp) {
    check(await supabase.from('study_log')
      .insert({ user_id: uid(), kind, segment_id: segmentId ?? null, xp }));
  },

  async listLogs(days = 365) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    return check(await supabase.from('study_log').select('kind,segment_id,xp,created_at')
      .eq('user_id', uid()).gte('created_at', since).order('created_at').limit(5000));
  },

  async listShares() {
    return check(await supabase.from('shares').select('id,viewer_email,created_at')
      .eq('owner_id', uid()).order('created_at', { ascending: false }));
  },

  async addShare(viewerEmail) {
    return check(await supabase.from('shares').insert({
      owner_id: uid(),
      owner_email: session.user.email,
      viewer_email: viewerEmail.toLowerCase(),
    }).select().single());
  },

  async removeShare(id) {
    check(await supabase.from('shares').delete().eq('id', id));
  },

  async listSharedWithMe() {
    return check(await supabase.from('shares').select('id,owner_id,owner_email,created_at')
      .eq('viewer_email', session.user.email).order('created_at', { ascending: false }));
  },
};
