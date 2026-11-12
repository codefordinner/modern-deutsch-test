import { randomUUID } from 'node:crypto';

export type AIBulkJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export interface AIBulkJob { id: string; status: AIBulkJobStatus; total: number; completed: number; count?: number; error?: string; createdAt: string; finishedAt?: string }
const jobs = new Map<string, AIBulkJob>();
const MAX_JOBS = 100;

function trim(): void {
  const finished = [...jobs.values()].filter((job) => job.status === 'completed' || job.status === 'failed').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const job of finished.slice(0, Math.max(0, finished.length - MAX_JOBS))) jobs.delete(job.id);
}

export function startAIBulkJob(
  total: number,
  run: (job: AIBulkJob) => Promise<number>,
  onError?: (error: unknown) => Promise<void> | void,
): AIBulkJob {
  const job: AIBulkJob = { id: randomUUID(), status: 'queued', total, completed: 0, createdAt: new Date().toISOString() };
  jobs.set(job.id, job);
  void Promise.resolve().then(async () => {
    job.status = 'running';
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
    job.finishedAt = new Date().toISOString(); trim();
  });
  return job;
}

export function readAIBulkJob(id: string): AIBulkJob | null { return jobs.get(id) ?? null; }
