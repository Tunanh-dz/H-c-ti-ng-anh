// Icon SVG từ bộ Lucide (giấy phép ISC). Trong HTML chỉ cần viết <i data-lucide="tên-icon"></i>,
// file này tự đổi thành SVG — kể cả phần giao diện được vẽ lại sau này.
// Danh sách tên icon: https://lucide.dev/icons

const LUCIDE_URL = 'https://esm.sh/lucide@0.460.0';

// "share-2" → "Share2", "circle-check" → "CircleCheck" (tên trong thư viện)
const toPascal = (name) => name.replace(/(^|-)(\w)/g, (_m, _dash, c) => c.toUpperCase());

export async function initIcons() {
  let lucide;
  try {
    // Tải riêng: nếu không tải được thì trang vẫn chạy, chỉ thiếu icon
    lucide = await import(LUCIDE_URL);
  } catch (error) {
    console.warn('Không tải được bộ icon', error);
    return;
  }

  const render = () => {
    document.querySelectorAll('i[data-lucide]').forEach((el) => {
      const node = lucide.icons[toPascal(el.dataset.lucide)];
      if (!node) return;
      const svg = lucide.createElement(node);
      svg.classList.add('icon');
      svg.setAttribute('aria-hidden', 'true');
      el.replaceWith(svg);
    });
  };

  render();
  // Mỗi khi giao diện thêm phần tử mới thì đổi icon ngay (trước khi trình duyệt vẽ)
  new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
}
