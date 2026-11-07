import crypto from 'crypto';
import { prisma } from '../db';
import { readAudioSettings, type AudioSettings } from './audioSettings';

export const MAX_AUDIO_TEXT_LENGTH = 10_000;
const DEFAULT_PIPER_URL = 'http://piper-tts:5000';
const inFlight = new Map<string, Promise<Buffer>>();
const AUDIO_DB_RETRIES = 6;
const AUDIO_DB_RETRY_DELAY_MS = 250;
const WORD_ATTEMPTS = 2;
/** Сколько слов Piper синтезирует одновременно при массовой генерации (CPU-bound, 2 обычно достаточно). */
const REGEN_CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.AUDIO_REGEN_CONCURRENCY) || 2));

// SQLite allows only one writer at a time. Piper generation can stay parallel,
// but writing several (potentially large) WAV blobs and job updates in parallel
// makes the Prisma SQLite connector wait for its busy timeout.
let audioDbWriteQueue: Promise<void> = Promise.resolve();

async function withAudioDbWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = audioDbWriteQueue;
  let release!: () => void;
  audioDbWriteQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryable = /timed out|database is locked|SQLITE_BUSY|transaction.?timeout/i.test(message);
        if (!retryable || attempt >= AUDIO_DB_RETRIES) throw error;
        await new Promise((resolve) => setTimeout(resolve, AUDIO_DB_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  } finally {
    release();
  }
}

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

/** Cheap existence check: does not load the WAV blob. */
async function audioExists(cacheKey: string): Promise<boolean> {
  return (await prisma.audioCache.findUnique({ where: { cacheKey }, select: { id: true } })) !== null;
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
    await withAudioDbWriteLock(() => prisma.audioCache.upsert({
        where: { cacheKey },
        create: { cacheKey, kind, text: normalized, audio, mimeType: 'audio/wav' },
        update: { audio, text: normalized, kind, mimeType: 'audio/wav' },
      }));
    return audio;
  }).finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, pending);
  return pending;
}

let activeRegeneration: Promise<void> | null = null;

/**
 * Clears the whole audio cache and the finished regeneration jobs, so the admin panel
 * doesn't keep showing an old "failed" status. A job that is really running in this
 * process is left alone.
 */
export async function clearAudioCache(): Promise<number> {
  const result = await withAudioDbWriteLock(() => prisma.audioCache.deleteMany());
  await withAudioDbWriteLock(() =>
    prisma.audioRegenerationJob.deleteMany({ where: activeRegeneration ? { status: { not: 'running' } } : {} })
  );
  return result.count;
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

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 300);

async function generateWordWithRetry(text: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= WORD_ATTEMPTS; attempt++) {
    try {
      await getOrCreateAudio(text, 'word');
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * `fresh` = a new job: the old word audio is dropped first. A resumed job (after a restart)
 * keeps what is already generated and only fills in the missing words.
 * A single word that fails does NOT abort the job: it is counted and reported at the end.
 */
async function runRegeneration(jobId: string, fresh: boolean): Promise<void> {
  const words = await prisma.word.findMany({ select: { de: true } });
  const texts = [...new Set(words.map((w) => normalizeAudioText(w.de)).filter(Boolean))];
  const { settings } = await readAudioSettings();

  if (fresh) await withAudioDbWriteLock(() => prisma.audioCache.deleteMany({ where: { kind: 'word' } }));
  const startedAt = Date.now();
  await withAudioDbWriteLock(() => prisma.audioRegenerationJob.update({ where: { id: jobId }, data: { total: texts.length, generated: 0, durationMs: 0, status: 'running', error: null } }));

  let next = 0;
  let generated = 0;
  let failed = 0;
  let firstError = '';
  let lastPersisted = 0;
  // Progress is best effort: a failed progress write must never abort the job.
  const persistProgress = async (force = false) => {
    if (!force && generated - lastPersisted < 10) return;
    lastPersisted = generated;
    try {
      await withAudioDbWriteLock(() => prisma.audioRegenerationJob.update({
        where: { id: jobId },
        data: { generated, durationMs: Math.max(0, Date.now() - startedAt) },
      }));
    } catch (error) {
      console.warn('[audio] progress update failed:', errorText(error));
    }
  };
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= texts.length) return;
      const text = texts[index];
      try {
        if (!(await audioExists(audioCacheKey(text, 'word', settings)))) await generateWordWithRetry(text);
      } catch (error) {
        failed++;
        if (!firstError) firstError = `«${text}»: ${errorText(error)}`;
        console.error('[audio] word failed:', text, errorText(error));
      }
      generated++;
      await persistProgress();
    }
  };
  await Promise.all(Array.from({ length: Math.min(REGEN_CONCURRENCY, texts.length || 1) }, worker));

  await withAudioDbWriteLock(() => prisma.audioRegenerationJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      total: texts.length,
      generated,
      durationMs: Math.max(0, Date.now() - startedAt),
      error: failed > 0 ? `Не удалось озвучить слов: ${failed}. Первая ошибка: ${firstError}` : null,
    },
  }));
}

export async function getAudioRegenerationJob(): Promise<AudioRegenerationJob | null> {
  const job = await prisma.audioRegenerationJob.findFirst({ orderBy: { createdAt: 'desc' } });
  return job ? serializeRegenerationJob(job) : null;
}

function launch(jobId: string, fresh: boolean): void {
  activeRegeneration = runRegeneration(jobId, fresh).catch(async (error) => {
    console.error('[audio] regeneration failed:', error);
    await withAudioDbWriteLock(() =>
      prisma.audioRegenerationJob.update({ where: { id: jobId }, data: { status: 'failed', error: errorText(error) || 'Неизвестная ошибка генерации' } })
    ).catch(() => {});
  }).finally(() => { activeRegeneration = null; });
}

export async function startAudioRegeneration(): Promise<AudioRegenerationJob> {
  const existing = await prisma.audioRegenerationJob.findFirst({ where: { status: 'running' }, orderBy: { createdAt: 'desc' } });
  if (existing) {
    if (!activeRegeneration) launch(existing.id, false);
    return serializeRegenerationJob(existing);
  }

  const job = await prisma.audioRegenerationJob.create({ data: { status: 'running' } });
  launch(job.id, true);
  return serializeRegenerationJob(job);
}

/** Resume a job after a backend restart; already generated words are kept. */
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
