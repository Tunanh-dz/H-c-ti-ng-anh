// Bọc YouTube IFrame API: phát một câu từ start_sec đến end_sec, lặp N lần,
// tự dừng ở end_sec, đổi tốc độ. Video được phát nhúng từ YouTube, không tải về.

let apiPromise = null;

// Tải script YouTube IFrame API một lần duy nhất.
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => {
        apiPromise = null;
        reject(new Error('Không tải được trình phát YouTube. Hãy kiểm tra mạng.'));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

const TICK_MS = 200;   // kiểm tra thời gian mỗi 200 ms
const SEEK_GRACE = 450; // sau khi tua, chờ một chút vì getCurrentTime() có thể còn trả về thời điểm cũ

// Mã lỗi của YouTube → thông báo tiếng Việt
const ERRORS = {
  2: 'Mã video không hợp lệ.',
  5: 'Trình duyệt không phát được video này.',
  100: 'Video không tồn tại hoặc đã bị xóa/đặt riêng tư.',
  101: 'Chủ video không cho phép phát nhúng trên trang khác.',
  150: 'Chủ video không cho phép phát nhúng trên trang khác.',
};

export class SegmentPlayer {
  constructor(elementId, { onError } = {}) {
    this.elementId = elementId;
    this.onError = onError;
    this.yt = null;
    this.rate = 1;
    this.timer = null;
    this.ready = null;
  }

  // Tạo trình phát cho video. Trả về Promise hoàn tất khi sẵn sàng.
  init(videoId) {
    this.ready = loadYouTubeApi().then((YT) => new Promise((resolve) => {
      // Người dùng đã rời trang trước khi API tải xong: không tạo trình phát nữa
      if (this.destroyed || !document.getElementById(this.elementId)) {
        resolve(this);
        return;
      }
      this.yt = new YT.Player(this.elementId, {
        videoId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => resolve(this),
          onError: (e) => this.onError?.(ERRORS[e.data] || `Lỗi trình phát YouTube (mã ${e.data}).`),
        },
      });
    }));
    return this.ready;
  }

  // Phát một câu, lặp `repeat` lần, gọi onDone khi xong.
  async playSegment(seg, { repeat = 1, onDone } = {}) {
    this.stop(); // dừng câu cũ trước
    await this.ready;
    if (!this.yt || this.destroyed) return;
    this.seg = { start: Number(seg.start_sec), end: Number(seg.end_sec) };
    this.left = Math.max(1, Number(repeat) || 1);
    this.onDone = onDone;
    this.yt.setPlaybackRate(this.rate);
    this.seekToStart();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  seekToStart() {
    this.seekedAt = Date.now();
    this.yt.seekTo(this.seg.start, true);
    this.yt.playVideo();
  }

  tick() {
    if (!this.seg || Date.now() - this.seekedAt < SEEK_GRACE) return;
    const t = this.yt.getCurrentTime();
    const ended = this.yt.getPlayerState() === 0; // 0 = hết video
    if (t < this.seg.end && !ended) return;

    this.left -= 1;
    if (this.left > 0) {
      this.seekToStart();
    } else {
      this.yt.pauseVideo();
      const done = this.onDone;
      this.clearTimer();
      done?.();
    }
  }

  clearTimer() {
    clearInterval(this.timer);
    this.timer = null;
    this.seg = null;
    this.onDone = null;
  }

  stop() {
    const wasPlaying = Boolean(this.timer);
    this.clearTimer();
    if (wasPlaying) {
      try { this.yt?.pauseVideo(); } catch { /* trình phát chưa sẵn sàng */ }
    }
  }

  get isPlaying() {
    return Boolean(this.timer);
  }

  setRate(rate) {
    this.rate = rate;
    try { this.yt?.setPlaybackRate(rate); } catch { /* bỏ qua */ }
  }

  // Thời điểm hiện tại của video (giây), dùng khi nhập mốc thời gian.
  currentTime() {
    try { return this.yt?.getCurrentTime() ?? 0; } catch { return 0; }
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    try { this.yt?.destroy(); } catch { /* bỏ qua */ }
    this.yt = null;
  }
}
