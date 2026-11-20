// Đọc câu tiếng Anh bằng giọng máy có sẵn của trình duyệt (Web Speech API).
import { toast } from './ui.js';

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voice = null;

// Ưu tiên giọng tiếng Anh Mỹ chất lượng tốt nếu máy có.
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice =
    voices.find((v) => /^en[-_]US/i.test(v.lang) && /google|natural|online|samantha|aria|jenny/i.test(v.name)) ||
    voices.find((v) => /^en[-_]US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null;
}

if (canSpeak) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text, rate = 1) {
  if (!canSpeak) {
    toast('Trình duyệt này không hỗ trợ đọc bằng giọng máy.', 'error');
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang || 'en-US';
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak) speechSynthesis.cancel();
}
