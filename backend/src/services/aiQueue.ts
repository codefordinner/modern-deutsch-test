import { randomUUID } from 'node:crypto';
import { recordAIRequest } from './aiErrorLog';

export type AIQueueStatus = 'queued' | 'running' | 'completed' | 'failed';
export interface AIQueueItem {
  id: string;
  operation: string;
  profileId?: string;
  model?: string;
  status: AIQueueStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

type Task = { item: AIQueueItem; run: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (error: unknown) => void };
const tasks: Task[] = [];
const items = new Map<string, AIQueueItem>();
const listeners = new Set<(snapshot: AIQueueItem[]) => void>();
const MAX_HISTORY = 100;
let active = 0;
const configuredConcurrency = Number(process.env.AI_QUEUE_CONCURRENCY ?? 2);
const CONCURRENCY = Number.isFinite(configuredConcurrency) ? Math.max(1, Math.min(8, Math.floor(configuredConcurrency))) : 2;
const DEFAULT_REQUESTS_PER_MINUTE = 10;
let requestsPerMinute = DEFAULT_REQUESTS_PER_MINUTE;
const requestStarts: number[] = [];
const retryRuns = new Map<string, { operation: string; profileId?: string; model?: string; run: () => Promise<unknown> }>();
const retriedItems = new Set<string>();

function snapshot(): AIQueueItem[] { return [...items.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
function notify(): void {
  const value = snapshot();
  for (const listener of listeners) {
    try { listener(value); } catch { /* A disconnected SSE client must not affect queue processing. */ }
  }
}
function trim(): void {
  const finished = snapshot().filter((item) => item.status === 'completed' || item.status === 'failed');
  for (const item of finished.slice(0, Math.max(0, finished.length - MAX_HISTORY))) { items.delete(item.id); retryRuns.delete(item.id); retriedItems.delete(item.id); }
}

async function pump(): Promise<void> {
  while (active < CONCURRENCY && tasks.length > 0) {
    const task = tasks.shift();
    if (!task) return;
    active++;
    task.item.status = 'running';
    task.item.startedAt = new Date().toISOString();
    notify();
    const startedAtMs = Date.now();
    void waitForRequestSlot().then(() => task.run()).then((result) => {
      if (result instanceof Response && !result.ok) {
        task.item.status = 'failed';
        task.item.error = `HTTP_${result.status}`;
      } else {
        task.item.status = 'completed';
      }
      // Provider failures are converted to AIServiceError by the caller, which
      // records the final, user-meaningful error once. Recording the raw HTTP
      // response here as well created duplicate log rows for every failed call.
      if (!(result instanceof Response) || result.ok) {
        void recordAIRequest({ operation: task.item.operation, profileId: task.item.profileId, model: task.item.model, responseStatus: result instanceof Response ? result.status : undefined, durationMs: Date.now() - startedAtMs, success: true });
      }
      task.item.finishedAt = new Date().toISOString(); task.resolve(result);
    }).catch((error) => {
      task.item.status = 'failed'; task.item.finishedAt = new Date().toISOString();
      const durationMs = task.item.startedAt ? Date.now() - Date.parse(task.item.startedAt) : 0;
      if (error && typeof error === 'object') {
        const details = error as { durationMs?: number; model?: string };
        details.durationMs = durationMs;
        if (!details.model && task.item.model) details.model = task.item.model;
      }
      task.item.error = error instanceof Error ? error.message : 'AI_ERROR'; task.reject(error);
      }).finally(() => { active--; trim(); notify(); void pump(); });
  }
}

/** Updates the shared provider request limit without restarting the queue. */
export function configureAIRequestRateLimit(value: number): void {
  requestsPerMinute = Math.max(1, Math.min(60, Math.round(value)));
}

async function waitForRequestSlot(): Promise<void> {
  while (true) {
    const now = Date.now();
    while (requestStarts.length && requestStarts[0] <= now - 60_000) requestStarts.shift();
    if (requestStarts.length < requestsPerMinute) {
      requestStarts.push(now);
      return;
    }
    const waitMs = Math.max(50, requestStarts[0] + 60_000 - now);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export function enqueueAI<T>(operation: string, profileId: string | undefined, run: () => Promise<T>, model?: string): Promise<T> {
  const item: AIQueueItem = { id: randomUUID(), operation, ...(profileId ? { profileId } : {}), ...(model ? { model } : {}), status: 'queued', createdAt: new Date().toISOString() };
  items.set(item.id, item);
  retryRuns.set(item.id, { operation, profileId, model, run });
  notify();
  return new Promise<T>((resolve, reject) => { tasks.push({ item, run: run as () => Promise<unknown>, resolve: resolve as (value: unknown) => void, reject }); void pump(); });
}

/** Re-enqueues a failed request while its in-memory input/closure is still available. */
export function retryAI(id: string): AIQueueItem | null {
  const previous = items.get(id);
  const retry = retryRuns.get(id);
  if (!previous || previous.status !== 'failed' || !retry || retriedItems.has(id)) return null;
  retriedItems.add(id);
  const item: AIQueueItem = { id: randomUUID(), operation: retry.operation, ...(retry.profileId ? { profileId: retry.profileId } : {}), ...(retry.model ? { model: retry.model } : {}), status: 'queued', createdAt: new Date().toISOString() };
  items.set(item.id, item);
  retryRuns.set(item.id, retry);
  tasks.push({ item, run: retry.run, resolve: () => undefined, reject: () => undefined });
  notify();
  void pump();
  return item;
}

export function readAIQueue(): { items: AIQueueItem[]; active: number; waiting: number; concurrency: number } {
  return { items: snapshot(), active, waiting: tasks.length, concurrency: CONCURRENCY };
}
export function subscribeAIQueue(listener: (items: AIQueueItem[]) => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
