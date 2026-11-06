import crypto from 'crypto';
import { prisma } from '../db';

export const MAX_AUDIO_TEXT_LENGTH = 10_000;
const DEFAULT_PIPER_URL = 'http://piper-tts:5000';
const VOICE = process.env.PIPER_VOICE || 'de_DE-thorsten-medium';
const inFlight = new Map<string, Promise<Buffer>>();

export type AudioKind = 'word' | 'sentence';

const normalizeText = (text: string): string => text.normalize('NFC').trim();

export function audioCacheKey(text: string, kind: AudioKind): string {
  return crypto.createHash('sha256').update(`${kind}\0${VOICE}\0${normalizeText(text)}`).digest('hex');
}

async function generateAudio(text: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.PIPER_TIMEOUT_MS || 30_000));
  try {
    const response = await fetch(`${(process.env.PIPER_URL || DEFAULT_PIPER_URL).replace(/\/$/, '')}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: VOICE }),
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
  const normalized = normalizeText(text);
  if (!normalized || normalized.length > MAX_AUDIO_TEXT_LENGTH) throw new Error('Invalid audio text');
  const cacheKey = audioCacheKey(normalized, kind);
  const cached = await prisma.audioCache.findUnique({ where: { cacheKey } });
  if (cached) return Buffer.from(cached.audio);

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;
  const pending = generateAudio(normalized).then(async (audio) => {
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
  for (const word of words) {
    await getOrCreateAudio(word.de, 'word');
    generated++;
  }
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
