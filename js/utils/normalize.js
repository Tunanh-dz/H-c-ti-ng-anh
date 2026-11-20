// Hàm thuần: chuẩn hóa văn bản, so sánh từng từ, chọn từ để che (điền từ).

// Chuẩn hóa để so sánh: chữ thường, nháy cong → nháy thẳng, bỏ dấu câu
// (giữ dấu nháy nằm giữa từ như "we'd"), gộp khoảng trắng.
export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[‘’‛′`´]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/(^|\s)'+|'+(?=\s|$)/g, '$1') // nháy đứng đầu/cuối từ là dấu câu → bỏ
    .replace(/\s+/g, ' ')
    .trim();
}

export function toWords(text) {
  const n = normalizeText(text);
  return n ? n.split(' ') : [];
}

// So sánh câu đúng (expected) với câu người dùng gõ (actual) bằng LCS theo từ.
// Kết quả ops là dãy { type: 'ok' | 'wrong' | 'missing', word }:
//   ok      – từ đúng
//   wrong   – từ người dùng gõ nhưng không có trong đáp án (sai/thừa)
//   missing – từ có trong đáp án nhưng người dùng bỏ sót
export function compareWords(expected, actual) {
  const e = toWords(expected);
  const a = toWords(actual);
  const n = e.length;
  const m = a.length;

  // dp[i][j] = độ dài LCS của e[i..] và a[j..]
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = e[i] === a[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (e[i] === a[j]) {
      ops.push({ type: 'ok', word: e[i] });
      i++; j++;
    } else if (dp[i][j + 1] >= dp[i + 1][j]) {
      ops.push({ type: 'wrong', word: a[j] });
      j++;
    } else {
      ops.push({ type: 'missing', word: e[i] });
      i++;
    }
  }
  while (j < m) ops.push({ type: 'wrong', word: a[j++] });
  while (i < n) ops.push({ type: 'missing', word: e[i++] });

  const matched = dp[0][0];
  // Chia cho độ dài lớn hơn để gõ thừa nhiều từ cũng bị trừ điểm
  const denom = Math.max(n, m);
  const score = denom === 0 ? 100 : Math.round((100 * matched) / denom);
  return { ops, score, matched, total: n };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Tô màu kết quả: đúng xanh, sai đỏ, thiếu gạch chân (class định nghĩa trong style.css).
export function diffToHtml(ops) {
  if (!ops.length) return '<span class="muted">(chưa gõ gì)</span>';
  return ops.map(({ type, word }) => {
    const title = { ok: 'Đúng', wrong: 'Sai hoặc thừa', missing: 'Bị thiếu' }[type];
    return `<span class="w w-${type}" title="${title}">${esc(word)}</span>`;
  }).join(' ');
}

// ---------- Điền từ ----------

// Tách câu thành các phần: từ (isWord = true) và phần còn lại (dấu câu, khoảng trắng).
// Giữ nguyên chữ gốc để hiển thị lại đúng câu.
export function tokenize(sentence) {
  const parts = String(sentence ?? '').split(/([\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*)/u);
  return parts
    .filter((p) => p !== '')
    .map((text) => ({ text, isWord: /^[\p{L}\p{N}]/u.test(text) }));
}

// Chọn ngẫu nhiên khoảng ratio (20%) số từ để che, ít nhất 1 từ.
// rng cho phép truyền hàm ngẫu nhiên cố định khi kiểm thử.
export function pickClozeIndices(tokens, ratio = 0.2, rng = Math.random) {
  const wordIdx = tokens.map((t, i) => (t.isWord ? i : -1)).filter((i) => i >= 0);
  if (!wordIdx.length) return new Set();
  const count = Math.min(wordIdx.length, Math.max(1, Math.round(wordIdx.length * ratio)));
  // Xáo trộn Fisher–Yates rồi lấy count phần tử đầu
  const pool = [...wordIdx];
  for (let k = pool.length - 1; k > 0; k--) {
    const r = Math.floor(rng() * (k + 1));
    [pool[k], pool[r]] = [pool[r], pool[k]];
  }
  return new Set(pool.slice(0, count));
}

export function sameWord(a, b) {
  return normalizeText(a) === normalizeText(b);
}
