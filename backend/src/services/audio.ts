import crypto from 'crypto';
import { prisma } from '../db';
import { readAudioSettings, type AudioSettings } from './audioSettings';

export const MAX_AUDIO_TEXT_LENGTH = 10_000;
const DEFAULT_PIPER_URL = 'http://piper-tts:5000';
const inFlight = new Map<string, Promise<Buffer>>();

export type AudioKind = 'word' | 'sentence';

export const normalizeAudioText = (text: string): string => text.replace(/[()\[\]\/]/g, ' ').normalize('NFC').trim();

export function audioCacheKey(text: string, kind: AudioKind, settings: AudioSettings): string {
  return crypto.createHash('sha256').update(`${kind}\0${JSON.stringify(settings)}\0${normalizeAudioText(text)}`).digest('hex');
}

export async function generateAudioPreview(text: string, settings: AudioSettings): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.PIPER_TIMEOUT_MS || 30_000));
  try {
    const response = await fetch(`${(process.env.PIPER_URL || DEFAULT_PIPER_URL).replace(/\/$/, '')}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: settings.voice,
        length_scale: settings.lengthScale,
        noise_scale: settings.noiseScale,
        noise_w_scale: settings.noiseWScale,
        sentence_silence: settings.sentenceSilence,
      }),
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
  const { settings } = await readAudioSettings();
  const cacheKey = audioCacheKey(normalized, kind, settings);
  const cached = await prisma.audioCache.findUnique({ where: { cacheKey } });
  if (cached) return Buffer.from(cached.audio);

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;
  const pending = generateAudioPreview(normalized, settings).then(async (audio) => {
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

export type AudioRegenerationStatus = 'running' | 'completed' | 'failed';
export interface AudioRegenerationJob {
  id: string;
  status: AudioRegenerationStatus;
  total: number;
  generated: number;
  durationMs: number;
  averageMs: number | null;
  remaining: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

let activeRegeneration: Promise<void> | null = null;

const serializeRegenerationJob = (job: {
  id: string; status: string; total: number; generated: number; durationMs: number; error: string | null; createdAt: Date; updatedAt: Date;
}): AudioRegenerationJob => ({
  id: job.id,
  status: job.status as AudioRegenerationStatus,
  total: job.total,
  generated: job.generated,
  durationMs: job.durationMs,
  averageMs: job.generated > 0 ? Math.round(job.durationMs / job.generated) : null,
  remaining: Math.max(0, job.total - job.generated),
  error: job.error,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
});

async function runRegeneration(jobId: string): Promise<void> {
  const words = await prisma.word.findMany({ select: { de: true } });
  await prisma.audioCache.deleteMany({ where: { kind: 'word' } });
  const startedAt = Date.now();
  await prisma.audioRegenerationJob.update({ where: { id: jobId }, data: { total: words.length, generated: 0, durationMs: 0, status: 'running', error: null } });

  let next = 0;
  let generated = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= words.length) return;
      await getOrCreateAudio(words[index].de, 'word');
      generated++;
      // Persist every item. This is intentionally simple and makes a refresh show
      // useful progress even when Piper generation is slow.
      await prisma.audioRegenerationJob.update({
        where: { id: jobId },
        data: { generated: { increment: 1 }, durationMs: Math.max(0, Date.now() - startedAt) },
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, words.length || 1) }, worker));
  await prisma.audioRegenerationJob.update({ where: { id: jobId }, data: { status: 'completed', total: words.length } });
}

export async function getAudioRegenerationJob(): Promise<AudioRegenerationJob | null> {
  const job = await prisma.audioRegenerationJob.findFirst({ orderBy: { createdAt: 'desc' } });
  return job ? serializeRegenerationJob(job) : null;
}

export async function startAudioRegeneration(): Promise<AudioRegenerationJob> {
  const existing = await prisma.audioRegenerationJob.findFirst({ where: { status: 'running' }, orderBy: { createdAt: 'desc' } });
  if (existing) {
    if (!activeRegeneration) activeRegeneration = runRegeneration(existing.id).catch(async (error) => {
      await prisma.audioRegenerationJob.update({ where: { id: existing.id }, data: { status: 'failed', error: 'Генерация была прервана и не завершилась автоматически' } }).catch(() => {});
    }).finally(() => { activeRegeneration = null; });
    return serializeRegenerationJob(existing);
  }

  const job = await prisma.audioRegenerationJob.create({ data: { status: 'running' } });
  activeRegeneration = runRegeneration(job.id).catch(async (error) => {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Неизвестная ошибка генерации';
    await prisma.audioRegenerationJob.update({ where: { id: job.id }, data: { status: 'failed', error: message } }).catch(() => {});
  }).finally(() => { activeRegeneration = null; });
  return serializeRegenerationJob(job);
}

/** Resume a job after a backend restart; generated files are rebuilt safely. */
export async function resumeAudioRegeneration(): Promise<void> {
  const running = await prisma.audioRegenerationJob.findFirst({ where: { status: 'running' }, orderBy: { createdAt: 'desc' } });
  if (running) await startAudioRegeneration();
}

export async function audioCacheStats() {
  const [total, words, sentences] = await Promise.all([
    prisma.audioCache.count(),
    prisma.audioCache.count({ where: { kind: 'word' } }),
    prisma.audioCache.count({ where: { kind: 'sentence' } }),
  ]);
  return { total, words, sentences };
}
