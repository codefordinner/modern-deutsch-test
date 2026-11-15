import { randomUUID } from 'node:crypto';
import { prisma } from '../db';

export type AIBulkJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export interface AIBulkJob { id: string; status: AIBulkJobStatus; total: number; completed: number; count?: number; result?: unknown; error?: string; createdAt: string; finishedAt?: string }
const jobs = new Map<string, AIBulkJob>();
const MAX_JOBS = 100;
const processStartedAt = new Date();

function trim(): void {
  const finished = [...jobs.values()].filter((job) => job.status === 'completed' || job.status === 'failed').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const expired = finished.slice(0, Math.max(0, finished.length - MAX_JOBS));
  for (const job of expired) jobs.delete(job.id);
  if (expired.length > 0) void prisma.aiBulkJob.deleteMany({ where: { id: { in: expired.map((job) => job.id) } } })
    .catch((error) => console.error('[ai] failed to prune bulk jobs:', error));
}

export function startAIBulkJob(
  total: number,
  run: (job: AIBulkJob) => Promise<number>,
  onError?: (error: unknown) => Promise<void> | void,
): AIBulkJob {
  const job: AIBulkJob = { id: randomUUID(), status: 'queued', total, completed: 0, createdAt: new Date().toISOString() };
  jobs.set(job.id, job);
  void Promise.resolve().then(async () => {
    await prisma.aiBulkJob.create({ data: { id: job.id, status: job.status, total: job.total, completed: 0, createdAt: new Date(job.createdAt) } });
    job.status = 'running';
    await persist(job);
    try { job.count = await run(job); job.status = 'completed'; }
    catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'AI_ERROR';
      // The HTTP request has already returned 202 by this point. Keep error
      // reporting attached to the job itself instead of relying on a route
      // catch block that can no longer observe this failure.
      try { await onError?.(error); } catch (loggingError) {
        console.error('[ai] failed to record background job error:', loggingError);
      }
    }
    job.finishedAt = new Date().toISOString();
    await persist(job);
    trim();
  }).catch(async (error) => {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'AI_ERROR';
    job.finishedAt = new Date().toISOString();
    try { await prisma.aiBulkJob.upsert({ where: { id: job.id }, create: { id: job.id, status: job.status, total, completed: 0, error: job.error, createdAt: new Date(job.createdAt), finishedAt: new Date(job.finishedAt) }, update: { status: job.status, error: job.error, finishedAt: new Date(job.finishedAt) } }); }
    catch (persistError) { console.error('[ai] failed to persist bulk job error:', persistError); }
  });
  return job;
}

async function persist(job: AIBulkJob): Promise<void> {
  await prisma.aiBulkJob.update({
    where: { id: job.id },
    data: {
      status: job.status,
      completed: job.completed,
      count: job.count ?? null,
      result: job.result === undefined ? null : JSON.stringify(job.result),
      error: job.error ?? null,
      finishedAt: job.finishedAt ? new Date(job.finishedAt) : null,
    },
  });
}

export async function readAIBulkJob(id: string): Promise<AIBulkJob | null> {
  const cached = jobs.get(id);
  if (cached) return cached;
  const row = await prisma.aiBulkJob.findUnique({ where: { id } });
  if (!row) return null;
  let result: unknown;
  try { result = row.result ? JSON.parse(row.result) : undefined; } catch { result = undefined; }
  const job: AIBulkJob = {
    id: row.id,
    status: row.status as AIBulkJobStatus,
    total: row.total,
    completed: row.completed,
    ...(row.count === null ? {} : { count: row.count }),
    ...(result === undefined ? {} : { result }),
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.createdAt.toISOString(),
    ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
  };
  return job;
}

export async function listAIBulkJobs(limit = 100): Promise<AIBulkJob[]> {
  const rows = await prisma.aiBulkJob.findMany({ orderBy: { createdAt: 'desc' }, take: Math.max(1, Math.min(200, limit)) });
  return rows.map((row) => {
    return {
      id: row.id,
      status: row.status as AIBulkJobStatus,
      total: row.total,
      completed: row.completed,
      ...(row.count === null ? {} : { count: row.count }),
      ...(row.error ? { error: row.error } : {}),
      createdAt: row.createdAt.toISOString(),
      ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
    };
  });
}

/** Preserve active jobs across restarts as visible interrupted records. */
export async function recoverAIBulkJobs(): Promise<void> {
  const now = new Date();
  await prisma.aiBulkJob.updateMany({
    where: { status: { in: ['queued', 'running'] }, createdAt: { lt: processStartedAt } },
    data: { status: 'failed', error: 'AI_JOB_INTERRUPTED', finishedAt: now },
  });
  const oldJobs = await prisma.aiBulkJob.findMany({ orderBy: { createdAt: 'desc' }, skip: MAX_JOBS, select: { id: true } });
  if (oldJobs.length > 0) await prisma.aiBulkJob.deleteMany({ where: { id: { in: oldJobs.map((job) => job.id) } } });
}
