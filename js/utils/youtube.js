// Hàm thuần liên quan đến YouTube và thời gian. Không đụng tới DOM hay mạng.

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

// Tách video ID (11 ký tự) từ link YouTube. Trả về null nếu không hợp lệ.
// Hỗ trợ: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/
export function parseYouTubeId(input) {
  const text = String(input ?? '').trim();
  if (!text) return null;
  if (ID_RE.test(text)) return text; // người dùng dán thẳng ID

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  return id && ID_RE.test(id) ? id : null;
}

// Đổi "mm:ss", "h:mm:ss", "1:02.5" hoặc "75" sang số giây. Sai định dạng trả về NaN.
export function parseTime(input) {
  const s = String(input ?? '').trim().replace(',', '.');
  if (!s) return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);

  const m = s.match(/^(?:(\d+):)?(\d{1,3}):(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return NaN;
  const [, h, mm, ss] = m;
  if (Number(ss) >= 60) return NaN;
  if (h !== undefined && Number(mm) >= 60) return NaN;
  return Number(h || 0) * 3600 + Number(mm) * 60 + Number(ss);
}

// Đổi số giây sang "m:ss" (hoặc "h:mm:ss"). Giữ 1 chữ số thập phân nếu có.
export function formatTime(sec) {
  const total = Math.max(0, Math.round(Number(sec) * 10) / 10);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  let s = (total % 60).toFixed(1).replace(/\.0$/, '');
  if (Number(s) < 10) s = '0' + s;
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// Ảnh thu nhỏ do YouTube cung cấp (chỉ hiển thị, không tải về lưu).
export function thumbnailUrl(youtubeId) {
  return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
}

export function watchUrl(youtubeId, startSec = 0) {
  const t = Math.floor(startSec);
  return `https://www.youtube.com/watch?v=${youtubeId}${t ? `&t=${t}s` : ''}`;
}
