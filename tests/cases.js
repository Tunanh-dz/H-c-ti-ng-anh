// Các ca kiểm thử cho hàm thuần. Dùng chung cho:
//   - node --test tests/        (cần Node.js 22 trở lên)
//   - mở http://localhost:5500/tests/ trong trình duyệt (không cần cài gì)
import { parseYouTubeId, parseTime, formatTime } from '../js/utils/youtube.js';
import { normalizeText, compareWords, tokenize, pickClozeIndices, sameWord } from '../js/utils/normalize.js';
import { nextReview, computeStreak, dayKey, summarizeLogs, isDue } from '../js/utils/srs.js';
import { parseBulk, parseBulkLine, parseTranscript } from '../js/utils/bulk.js';

function eq(actual, expected, label = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label} mong đợi ${e}, nhận được ${a}`);
}
function ok(value, label = 'Điều kiện sai') {
  if (!value) throw new Error(label);
}

export const cases = [
  ['youtube: các dạng link', () => {
    const id = 'V7Dvcy0gq-U';
    eq(parseYouTubeId(`https://www.youtube.com/watch?v=${id}`), id);
    eq(parseYouTubeId(`https://youtu.be/${id}?si=88GA_XsMvT1NOXyW`), id);
    eq(parseYouTubeId(`https://youtube.com/shorts/${id}`), id);
    eq(parseYouTubeId(`https://www.youtube.com/embed/${id}?start=3`), id);
    eq(parseYouTubeId(`m.youtube.com/watch?v=${id}&t=20s`), id);
    eq(parseYouTubeId(id), id);
  }],
  ['youtube: link sai trả về null', () => {
    eq(parseYouTubeId(''), null);
    eq(parseYouTubeId('https://vimeo.com/12345'), null);
    eq(parseYouTubeId('https://www.youtube.com/watch?v=abc'), null);
    eq(parseYouTubeId('xin chào'), null);
  }],
  ['thời gian: mm:ss ↔ giây', () => {
    eq(parseTime('00:20'), 20);
    eq(parseTime('1:05'), 65);
    eq(parseTime('1:02:03'), 3723);
    eq(parseTime('0:07.5'), 7.5);
    eq(parseTime('75'), 75);
    ok(Number.isNaN(parseTime('1:75')), '1:75 phải sai');
    ok(Number.isNaN(parseTime('abc')), 'abc phải sai');
    eq(formatTime(65), '1:05');
    eq(formatTime(7.5), '0:07.5');
    eq(formatTime(3723), '1:02:03');
  }],
  ['chuẩn hóa văn bản', () => {
    eq(normalizeText('  We’d  LOVE to come!! '), "we'd love to come");
    eq(normalizeText('"Hello," she said.'), 'hello she said');
    eq(normalizeText("'quoted' words"), 'quoted words');
    ok(sameWord('That’s', "that's"));
  }],
  ['so sánh từng từ', () => {
    const exact = compareWords('Thank you for the invitation.', 'thank you for the invitation');
    eq(exact.score, 100);
    const missing = compareWords('We would love to come', 'We love to come');
    eq(missing.ops.map((o) => o.type), ['ok', 'missing', 'ok', 'ok', 'ok']);
    eq(missing.score, 80);
    const wrong = compareWords('nice of you', 'nice off you');
    eq(wrong.ops.map((o) => o.type), ['ok', 'wrong', 'missing', 'ok']);
    eq(compareWords('hello', '').score, 0);
  }],
  ['điền từ: không che dấu câu, khoảng 20%', () => {
    const tokens = tokenize("That's very nice of you.");
    eq(tokens.filter((t) => t.isWord).map((t) => t.text), ["That's", 'very', 'nice', 'of', 'you']);
    const hidden = pickClozeIndices(tokens, 0.2, () => 0);
    eq(hidden.size, 1);
    for (const i of hidden) ok(tokens[i].isWord, 'Chỉ được che từ');
    eq(pickClozeIndices(tokenize('...'), 0.2).size, 0);
  }],
  ['SRS: lên hộp, quên về hộp 1, đã thuộc', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const r1 = nextReview(1, true, now);
    eq(r1.box, 2);
    eq(r1.next_review_at, '2026-01-04T00:00:00.000Z'); // hộp 2: 3 ngày
    eq(nextReview(3, true, now).next_review_at, '2026-01-31T00:00:00.000Z'); // hộp 4: 30 ngày
    const forgot = nextReview(4, false, now);
    eq(forgot.box, 1);
    eq(forgot.next_review_at, '2026-01-02T00:00:00.000Z'); // hộp 1: 1 ngày
    eq(nextReview(4, true, now).mastered, true);
    ok(!isDue({ box: 5, next_review_at: '2000-01-01' }), 'Câu đã thuộc không đến hạn');
    ok(isDue({ box: 2, next_review_at: '2000-01-01' }), 'Câu quá hạn phải đến hạn');
  }],
  ['chuỗi ngày học', () => {
    const today = new Date(2026, 10, 20);
    eq(computeStreak([dayKey(new Date(2026, 10, 18)), dayKey(new Date(2026, 10, 19)), dayKey(today)], today), 3);
    eq(computeStreak([dayKey(new Date(2026, 10, 19))], today), 1); // hôm nay chưa học vẫn giữ chuỗi
    eq(computeStreak([dayKey(new Date(2026, 10, 17))], today), 0);
    const s = summarizeLogs([
      { created_at: today, xp: 5, segment_id: 1 },
      { created_at: today, xp: 3, segment_id: 1 },
      { created_at: today, xp: 2, segment_id: 2 },
    ], today);
    eq([s.todayXp, s.todaySentences, s.streak], [10, 2, 1]);
  }],
  ['nhập hàng loạt', () => {
    const r = parseBulkLine("00:20-00:36 | Thank you for the invitation. | Cảm ơn anh vì lời mời. | /θæŋk/ | Thank you for + N");
    ok(r.ok);
    eq([r.item.start_sec, r.item.end_sec, r.item.pattern], [20, 36, 'Thank you for + N']);
    const { items, errors } = parseBulk([
      '00:36-00:40 | That\'s very nice of you. | Anh tốt quá.',
      '',
      '00:40 | We\'d love to come. | Chúng tôi rất muốn đến.',
      '00:50-00:45 | Sai thứ tự | Sai',
      '00:50-00:55 | Thiếu nghĩa',
    ].join('\n'));
    eq(items.length, 1);
    eq(errors.map((e) => e.lineNo), [3, 4, 5]);
  }],
  ['bản chép lời YouTube', () => {
    const text = [
      '0:00', '0 seconds', 'Hi everyone,', '0:02', "today we're learning", '0:04', 'introductions.',
      '0:07', '[Music]', '0:09 Nice to meet you!',
    ].join('\n');
    const merged = parseTranscript(text);
    eq(merged.map((c) => c.en), ["Hi everyone, today we're learning introductions.", 'Nice to meet you!']);
    eq([merged[0].start_sec, merged[0].end_sec], [0, 7]);
    eq(parseTranscript(text, { merge: false }).length, 4);
  }],
  ['bản chép lời YouTube dạng mới (dính liền, giao diện tiếng Việt)', () => {
    // Mốc thời gian + nhãn "x phút, y giây" + lời thoại nằm liền nhau trên một dòng
    const text = [
      'Phân cảnh 1: Intro',
      '0:000 giây[Music]',
      '0:055 giâyhi everyone my name is Anna',
      '0:1212 giâyand this is my friend Tom.',
      'Phân cảnh 6: Conclusion',
      '6:176 phút, 17 giây[Music]',
      '6:306 phút, 30 giâythanks for watching if you like this video please',
      'subscribe to our YouTube channel',
      '',
      'Đồng bộ hóa với thời gian của video',
    ].join('\n');
    const cues = parseTranscript(text, { merge: false });
    eq(cues.map((c) => [c.start_sec, c.en]), [
      [5, 'hi everyone my name is Anna'],
      [12, 'and this is my friend Tom.'],
      [390, 'thanks for watching if you like this video please subscribe to our YouTube channel'],
    ]);
    eq(cues[1].end_sec, 377); // kết thúc khi đoạn [Music] lúc 6:17 bắt đầu
  }],
  ['bản chép lời YouTube dạng mới (tiếng Anh, có giờ)', () => {
    const text = [
      '0:033 secondsHello there.',
      '1:051 minute, 5 seconds500 people came.',
      '1:02:031 hour, 2 minutes, 3 secondsThe end.',
      'Sync to video time',
    ].join('\n');
    eq(parseTranscript(text, { merge: false }).map((c) => [c.start_sec, c.en]), [
      [3, 'Hello there.'], [65, '500 people came.'], [3723, 'The end.'],
    ]);
  }],
];
