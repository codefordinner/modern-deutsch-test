import { getSpeechAudio } from '../api/client';

const urlCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;
let requestId = 0;

export async function speakGerman(text: string, kind: 'word' | 'sentence' = 'word'): Promise<void> {
  const cleanText = text.replace(/[\(\)\[\]\/]/g, ' ').trim();
  if (!cleanText || typeof window === 'undefined') return;
  const id = ++requestId;
  try {
    currentAudio?.pause();
    const key = `${kind}:${cleanText}`;
    let url = urlCache.get(key);
    if (!url) {
      const blob = await getSpeechAudio(cleanText, kind);
      if (id !== requestId) return;
      url = URL.createObjectURL(blob);
      urlCache.set(key, url);
    }
    if (id !== requestId) return;
    const audio = new Audio(url);
    currentAudio = audio;
    await audio.play();
  } catch (error) { console.warn('Speech playback error:', error); }
}
