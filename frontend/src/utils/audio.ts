import { getSpeechAudio } from '../api/audio';
import { getUISettings } from './uiSettings';

let currentAudio: HTMLAudioElement | null = null;
let requestId = 0;

export async function speakGerman(text: string, kind: 'word' | 'sentence' = 'word'): Promise<void> {
  const cleanText = text.replace(new RegExp('[()[\\]/]', 'g'), ' ').normalize('NFC').trim();
  if (!cleanText || typeof window === 'undefined') return;
  const id = ++requestId;
  try {
    currentAudio?.pause();
    // The server keeps the durable cache. Avoid a second, unbounded browser
    // cache so clearing/regenerating audio in the admin panel takes effect on
    // the next click in an already-open tab too.
    const blob = await getSpeechAudio(cleanText, kind);
    if (id !== requestId) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = getUISettings().audioVolume;
    currentAudio = audio;
    try { await audio.play(); } finally { URL.revokeObjectURL(url); }
  } catch (error) { console.warn('Speech playback error:', error); }
}
