import { prisma } from '../db';

export type AIErrorOperation =
  | 'models'
  | 'settings-check'
  | 'picture-description'
  | 'picture-format'
  | 'picture-check'
  | 'word-fill'
  | 'category-redistribution'
  | 'required-case'
  | 'prompt-test';

export class AIServiceError extends Error {
  readonly code: string;
  readonly providerStatus?: number;
  readonly model?: string;
  durationMs?: number;

  constructor(code: string, options: { providerStatus?: number; model?: string; cause?: unknown } = {}) {
    super(code);
    this.name = 'AIServiceError';
    this.code = code;
    this.providerStatus = options.providerStatus;
    this.model = options.model;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

const redact = (value: string): string => value
  .replace(/(x-goog-api-key|api[_-]?key|key)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 1000);

export async function recordAIError(input: {
  operation: string;
  profileId?: string;
  error: unknown;
  durationMs?: number;
}): Promise<void> {
  return recordAIRequest({ ...input, success: false });
}

/** Records every provider call, including successful calls. */
export async function recordAIRequest(input: {
  operation: string;
  profileId?: string;
  model?: string;
  responseStatus?: number;
  durationMs?: number;
  error?: unknown;
  success: boolean;
}): Promise<void> {
  try {
    const error = input.error;
    const aiError = error instanceof AIServiceError ? error : null;
    const message = error instanceof Error ? error.message : String(error);
    let model = input.model ?? aiError?.model ?? (error as { model?: string } | null)?.model ?? null;
    if (!model && input.profileId) {
      const settings = await prisma.setting.findUnique({ where: { key: 'aiSettings' }, select: { value: true } }).catch(() => null);
      try {
        const profiles = settings ? (JSON.parse(settings.value) as { profiles?: Record<string, { model?: unknown }> }).profiles : undefined;
        const candidate = profiles?.[input.profileId]?.model;
        if (typeof candidate === 'string' && candidate) model = candidate;
      } catch { /* Keep the error log usable even if settings are malformed. */ }
    }
    await prisma.aiErrorLog.create({
      data: {
         operation: input.operation,
        profileId: input.profileId ?? null,
        model,
         errorCode: input.success ? 'AI_OK' : aiError?.code ?? (message || 'UNKNOWN_ERROR'),
         providerStatus: input.responseStatus ?? aiError?.providerStatus ?? null,
         message: redact(input.success ? 'Запрос выполнен' : message || 'Unknown error'),
        durationMs: input.durationMs === undefined ? (aiError?.durationMs ?? (error as { durationMs?: number } | null)?.durationMs ?? null) : Math.max(0, Math.round(input.durationMs)),
      },
    });
  } catch (loggingError) {
    // Never hide the original AI failure. This is especially important for
    // background jobs, where there is no request catch block left to report it.
    console.error('[ai] could not write AI error log:', loggingError);
  }
}

export type AIErrorLogStatus = 'all' | 'ok' | 'error';

export async function readAIErrorLogs(limit = 100, status: AIErrorLogStatus = 'all') {
  const where = status === 'ok'
    ? { errorCode: 'AI_OK' }
    : status === 'error'
      ? { errorCode: { not: 'AI_OK' } }
      : undefined;

  return prisma.aiErrorLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(500, Math.round(limit))),
    select: {
      id: true,
      operation: true,
      profileId: true,
      model: true,
      errorCode: true,
      providerStatus: true,
      message: true,
      durationMs: true,
      createdAt: true,
    },
  });
}

/** Counts are calculated over the whole table, not only the visible page. */
export async function countAIErrorLogs() {
  const [completed, errors] = await Promise.all([
    prisma.aiErrorLog.count({ where: { errorCode: 'AI_OK' } }),
    prisma.aiErrorLog.count({ where: { errorCode: { not: 'AI_OK' } } }),
  ]);
  return { completed, errors };
}

export async function clearAIErrorLogs(): Promise<void> {
  await prisma.aiErrorLog.deleteMany();
}
