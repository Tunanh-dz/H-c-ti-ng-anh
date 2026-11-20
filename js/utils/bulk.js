// Hàm thuần: phân tích dữ liệu câu dán vào (nhập hàng loạt, bản chép lời YouTube).
import { parseTime, formatTime } from './youtube.js';

// Kiểm tra một câu đã đủ thông tin chưa. Trả về chuỗi lỗi tiếng Việt, hoặc null nếu hợp lệ.
export function validateSegment({ start_sec, end_sec, en }) {
  if (!Number.isFinite(start_sec)) return 'Thời gian bắt đầu không đúng (dạng mm:ss, ví dụ 01:05).';
  if (!Number.isFinite(end_sec)) return 'Thời gian kết thúc không đúng (dạng mm:ss, ví dụ 01:09).';
  if (end_sec <= start_sec) return 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.';
  if (!String(en ?? '').trim()) return 'Thiếu câu tiếng Anh.';
  return null;
}

const emptyToNull = (v) => {
  const t = String(v ?? '').trim();
  return t ? t : null;
};

// Một dòng: "00:20-00:35 | câu tiếng Anh | nghĩa tiếng Việt | /IPA/ | khung câu | ghi chú"
// Bắt buộc 3 phần đầu.
export function parseBulkLine(line) {
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length < 3) {
    return { ok: false, error: 'Cần ít nhất 3 phần ngăn cách bằng dấu |: thời gian | tiếng Anh | tiếng Việt.' };
  }
  const range = parts[0].match(/^(\S+)\s*[-–—]\s*(\S+)$/);
  if (!range) {
    return { ok: false, error: 'Phần thời gian phải có dạng 00:20-00:35.' };
  }
  const item = {
    start_sec: parseTime(range[1]),
    end_sec: parseTime(range[2]),
    en: parts[1],
    vi: emptyToNull(parts[2]),
    ipa: emptyToNull(parts[3]),
    pattern: emptyToNull(parts[4]),
    note: emptyToNull(parts.slice(5).join(' | ')),
  };
  if (!item.vi) return { ok: false, error: 'Thiếu nghĩa tiếng Việt (phần thứ 3).' };
  const error = validateSegment(item);
  return error ? { ok: false, error } : { ok: true, item };
}

// Phân tích cả ô nhập. Bỏ qua dòng trống và dòng bắt đầu bằng #.
// Trả về { items, errors: [{ lineNo, text, error }] }
export function parseBulk(text) {
  const items = [];
  const errors = [];
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const r = parseBulkLine(line);
    if (r.ok) items.push(r.item);
    else errors.push({ lineNo: i + 1, text: line, error: r.error });
  });
  return { items, errors };
}

// ---------- Bản chép lời YouTube ----------
// Khi bấm "Hiện bản chép lời" trên YouTube rồi sao chép, tùy phiên bản YouTube mà văn bản có dạng:
//   a) Mốc thời gian một dòng, lời thoại dòng sau:   "0:03" / "hello everyone"
//   b) Cùng một dòng:                                "0:03 hello everyone"
//   c) Dính liền với nhãn đọc màn hình (bản mới):    "0:033 giâyhello everyone"
//                                                    "6:176 phút, 17 giây[Music]"
// Ngoài ra có các dòng thừa như "Phân cảnh 6: Conclusion", "Đồng bộ hóa với thời gian của video".

// Mốc thời gian ở đầu dòng (giây luôn đủ 2 chữ số), phần còn lại là nhãn + lời thoại
const TIME_START = /^((?:\d{1,2}:)?\d{1,3}:\d{2})(.*)$/;
const UNITS = 'giờ|phút|giây|hours?|minutes?|seconds?';
// Nhãn đọc màn hình ở đầu phần lời thoại, ví dụ "6 phút, 17 giây", "1 minute, 5 seconds"
const LABEL_PREFIX = new RegExp(`^\\s*(?:\\d+\\s*(?:${UNITS})\\s*,?\\s*)+`, 'i');
// Dòng chỉ chứa nhãn (dạng a), ví dụ "3 seconds", "2 giây"
const LABEL_LINE = new RegExp(`^(?:\\d+\\s*(?:${UNITS})\\s*,?\\s*)+$`, 'i');
// Tiêu đề chương và chữ của giao diện YouTube, không phải lời thoại
const SKIP_LINE = /^(?:(?:phân cảnh|chương|chapter)\s*\d+\s*:|đồng bộ|sync to video|bản chép lời$|transcript$)/i;

export function parseTranscript(text, { merge = true, lastDuration = 4, maxMergeSec = 15 } = {}) {
  const cues = [];
  let current = null;

  for (const raw of String(text ?? '').normalize('NFC').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || LABEL_LINE.test(line) || SKIP_LINE.test(line)) continue;
    const m = line.match(TIME_START);
    if (m) {
      current = { start_sec: parseTime(m[1]), text: m[2].replace(LABEL_PREFIX, '').trim() };
      cues.push(current);
    } else if (current) {
      current.text = (current.text + ' ' + line).trim();
    }
  }

  // Thời gian kết thúc = thời điểm bắt đầu của dòng kế tiếp (tính trước khi bỏ dòng
  // [Music] để câu không bị kéo dài qua đoạn nhạc). Sau đó bỏ chú thích kiểu [Music], (applause).
  const timed = cues
    .filter((c) => Number.isFinite(c.start_sec))
    .map((c, i, all) => ({
      start_sec: c.start_sec,
      end_sec: i + 1 < all.length ? all[i + 1].start_sec : c.start_sec + lastDuration,
      en: c.text.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(),
    }))
    .filter((c) => c.en && c.end_sec > c.start_sec);

  return merge ? mergeIntoSentences(timed, maxMergeSec) : timed;
}

// Gộp các dòng phụ đề ngắn thành câu hoàn chỉnh (kết thúc bằng . ? !),
// nhưng không gộp quá maxSec giây để tránh câu quá dài khi phụ đề không có dấu câu.
export function mergeIntoSentences(cues, maxSec = 15) {
  const out = [];
  let buf = null;
  for (const c of cues) {
    if (!buf) buf = { ...c };
    else {
      buf.en = `${buf.en} ${c.en}`;
      buf.end_sec = c.end_sec;
    }
    const endsSentence = /[.?!…]["')\]]?$/.test(buf.en);
    if (endsSentence || buf.end_sec - buf.start_sec >= maxSec) {
      out.push(buf);
      buf = null;
    }
  }
  if (buf) out.push(buf);
  return out;
}

// Đổi danh sách câu thành văn bản nhập hàng loạt (dùng để xuất / sửa lại).
export function toBulkText(segments) {
  return segments.map((s) =>
    [
      `${formatTime(s.start_sec)}-${formatTime(s.end_sec)}`,
      s.en, s.vi || '', s.ipa || '', s.pattern || '', s.note || '',
    ].join(' | ').replace(/(\s\|\s)+$/, ''),
  ).join('\n');
}
