export function speakGerman(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    // Cancel any previous speech
    window.speechSynthesis.cancel();

    // Clean up text if needed (e.g. remove punctuation or brackets)
    const cleanText = text.replace(/[\(\)\[\]\/]/g, ' ').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9; // slightly slower for language learners

    // Try to find German voice
    const voices = window.speechSynthesis.getVoices();
    const deVoice = voices.find((v) => v.lang === 'de-DE' || v.lang.startsWith('de'));
    if (deVoice) {
      utterance.voice = deVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
}
