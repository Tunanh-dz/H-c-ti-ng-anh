// Chế độ Luyện nói (shadowing): ghi âm giọng mình, nghe lại và so với câu gốc.
// Bản ghi chỉ nằm tạm trong trang, không lưu và không tải lên đâu cả.
import { $, escapeHtml, toast } from '../ui.js';
import { header, audioButtons, wireAudio } from './common.js';

const supported = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export function render(el, ctx) {
  const seg = ctx.current;
  el.innerHTML = `
    <div class="card">
      ${header('<i data-lucide="mic"></i> Luyện nói', ctx, 'Nghe câu gốc, bấm ghi âm và đọc theo, rồi nghe lại để so sánh. Bản ghi không được lưu.')}
      <div class="sentence-box">
        <div class="sentence-en">${escapeHtml(seg.en)}</div>
        ${seg.ipa ? `<div class="sentence-ipa">${escapeHtml(seg.ipa)}</div>` : ''}
        ${seg.vi ? `<div class="sentence-vi muted">${escapeHtml(seg.vi)}</div>` : ''}
      </div>
      <div class="mode-actions">${audioButtons({ next: false, playLabel: '<i data-lucide="play"></i> Nghe câu gốc' })}</div>
      ${supported ? `
        <div class="mode-actions">
          <button class="btn btn-primary btn-lg rec-btn" id="s-rec"><i data-lucide="mic"></i> Bắt đầu ghi âm</button>
          <button class="btn btn-soft" id="s-compare" disabled><i data-lucide="arrow-left-right"></i> So sánh: gốc → giọng bạn</button>
        </div>
        <div id="s-player"></div>`
      : '<p class="banner"><i data-lucide="triangle-alert"></i> Trình duyệt này không hỗ trợ ghi âm. Hãy thử Chrome, Edge hoặc Safari mới nhất (trang phải mở bằng https hoặc localhost).</p>'}
      <div class="mode-actions"><button class="btn btn-ghost" data-act="next">Câu tiếp <i data-lucide="skip-forward"></i></button></div>
    </div>`;
  wireAudio(el, ctx);
  if (!supported) return undefined;

  let stream = null;
  let recorder = null;
  let audioUrl = null;
  const recBtn = $('#s-rec', el);
  const compareBtn = $('#s-compare', el);
  const playerBox = $('#s-player', el);

  const releaseMic = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  const start = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast('Không dùng được micro. Hãy cho phép trang truy cập micro trong cài đặt trình duyệt.', 'error');
      return;
    }
    ctx.stop();
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      releaseMic();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      playerBox.innerHTML = `<div class="muted small" style="margin-top:.5rem">Giọng của bạn:</div><audio controls src="${audioUrl}"></audio>`;
      compareBtn.disabled = false;
      ctx.log('speak', 3, true);
    };
    recorder.start();
    recBtn.classList.add('recording');
    recBtn.innerHTML = '<i data-lucide="square"></i> Dừng ghi';
  };

  const stop = () => {
    if (recorder?.state === 'recording') recorder.stop();
    recBtn.classList.remove('recording');
    recBtn.innerHTML = '<i data-lucide="mic"></i> Ghi âm lại';
  };

  recBtn.onclick = () => (recorder?.state === 'recording' ? stop() : start());

  // Phát câu gốc một lần, xong thì phát bản ghi của người dùng
  compareBtn.onclick = () => {
    ctx.play({
      repeat: 1,
      onDone: () => playerBox.querySelector('audio')?.play(),
    });
  };

  // Dọn dẹp khi đổi câu / rời trang: tắt micro, giải phóng bản ghi
  return () => {
    if (recorder?.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    releaseMic();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  };
}
