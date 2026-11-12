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
  operation: AIErrorOperation;
  profileId?: string;
  error: unknown;
  durationMs?: number;
}): Promise<void> {
  const error = input.error;
  const aiError = error instanceof AIServiceError ? error : null;
  const message = error instanceof Error ? error.message : String(error);
  await prisma.aiErrorLog.create({
    data: {
      operation: input.operation,
      profileId: input.profileId ?? null,
      model: aiError?.model ?? null,
      errorCode: aiError?.code ?? (message || 'UNKNOWN_ERROR'),
      providerStatus: aiError?.providerStatus ?? null,
      message: redact(message || 'Unknown error'),
      durationMs: input.durationMs === undefined ? null : Math.max(0, Math.round(input.durationMs)),
    },
  });
}

export async function readAIErrorLogs(limit = 100) {
  return prisma.aiErrorLog.findMany({
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

export async function clearAIErrorLogs(): Promise<void> {
  await prisma.aiErrorLog.deleteMany();
}
