// speech.js
// Thin wrapper around the browser's built-in SpeechSynthesis API so the
// Chinese word on screen can be read aloud automatically every time a new
// card appears. No external service, no API key — this only works if the
// browser ships a zh-CN voice (all major desktop/mobile browsers do).

export function speak(text, lang = 'zh-CN') {
  if (!text) return;
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // stop any word still being read
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.85;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    // Speech isn't essential to the app — fail silently.
    console.warn('speech synthesis failed', err);
  }
}
