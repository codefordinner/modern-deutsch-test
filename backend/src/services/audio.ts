import crypto from 'crypto';
import { prisma } from '../db';
import { readAudioVoice, type AudioVoice } from './audioSettings';

export const MAX_AUDIO_TEXT_LENGTH = 10_000;
const DEFAULT_PIPER_URL = 'http://piper-tts:5000';
const inFlight = new Map<string, Promise<Buffer>>();

export type AudioKind = 'word' | 'sentence';

export const normalizeAudioText = (text: string): string => text.replace(/[()\[\]\/]/g, ' ').normalize('NFC').trim();

export function audioCacheKey(text: string, kind: AudioKind, voice: AudioVoice): string {
  return crypto.createHash('sha256').update(`${kind}\0${voice}\0${normalizeAudioText(text)}`).digest('hex');
}

async function generateAudio(text: string, voice: AudioVoice): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.PIPER_TIMEOUT_MS || 30_000));
  try {
    const response = await fetch(`${(process.env.PIPER_URL || DEFAULT_PIPER_URL).replace(/\/$/, '')}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Piper returned HTTP ${response.status}`);
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 12 || audio.subarray(0, 4).toString() !== 'RIFF') throw new Error('Piper returned invalid WAV');
    return audio;
  } finally {
    clearTimeout(timer);
  }
}

export async function getOrCreateAudio(text: string, kind: AudioKind = 'word'): Promise<Buffer> {
  const normalized = normalizeAudioText(text);
  if (!normalized || normalized.length > MAX_AUDIO_TEXT_LENGTH) throw new Error('Invalid audio text');
  const { voice } = await readAudioVoice();
  const cacheKey = audioCacheKey(normalized, kind, voice);
  const cached = await prisma.audioCache.findUnique({ where: { cacheKey } });
  if (cached) return Buffer.from(cached.audio);

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;
  const pending = generateAudio(normalized, voice).then(async (audio) => {
    await prisma.audioCache.upsert({
      where: { cacheKey },
      create: { cacheKey, kind, text: normalized, audio, mimeType: 'audio/wav' },
      update: { audio, text: normalized, kind, mimeType: 'audio/wav' },
    });
    return audio;
  }).finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, pending);
  return pending;
}

export async function clearAudioCache(): Promise<number> {
  const result = await prisma.audioCache.deleteMany();
  return result.count;
}

export async function regenerateWordAudio(): Promise<{ total: number; generated: number }> {
  const words = await prisma.word.findMany({ select: { de: true } });
  // This is an explicit admin refresh: do not reuse old word audio after the
  // voice/configuration has changed. Sentence audio remains untouched.
  await prisma.audioCache.deleteMany({ where: { kind: 'word' } });
  let generated = 0;
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= words.length) return;
      await getOrCreateAudio(words[index].de, 'word');
      generated++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, words.length) }, worker));
  return { total: words.length, generated };
}

export async function audioCacheStats() {
  const [total, words, sentences] = await Promise.all([
    prisma.audioCache.count(),
    prisma.audioCache.count({ where: { kind: 'word' } }),
    prisma.audioCache.count({ where: { kind: 'sentence' } }),
  ]);
  return { total, words, sentences };
}
