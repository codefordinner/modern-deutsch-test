import { randomUUID } from 'node:crypto';

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

function snapshot(): AIQueueItem[] { return [...items.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
function notify(): void {
  const value = snapshot();
  for (const listener of listeners) {
    try { listener(value); } catch { /* A disconnected SSE client must not affect queue processing. */ }
  }
}
function trim(): void {
  const finished = snapshot().filter((item) => item.status === 'completed' || item.status === 'failed');
  for (const item of finished.slice(0, Math.max(0, finished.length - MAX_HISTORY))) items.delete(item.id);
}

async function pump(): Promise<void> {
  while (active < CONCURRENCY && tasks.length > 0) {
    const task = tasks.shift();
    if (!task) return;
    active++;
    task.item.status = 'running';
    task.item.startedAt = new Date().toISOString();
    notify();
    void task.run().then((result) => {
      if (result instanceof Response && !result.ok) {
        task.item.status = 'failed';
        task.item.error = `HTTP_${result.status}`;
      } else {
        task.item.status = 'completed';
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

export function enqueueAI<T>(operation: string, profileId: string | undefined, run: () => Promise<T>, model?: string): Promise<T> {
  const item: AIQueueItem = { id: randomUUID(), operation, ...(profileId ? { profileId } : {}), ...(model ? { model } : {}), status: 'queued', createdAt: new Date().toISOString() };
  items.set(item.id, item);
  notify();
  return new Promise<T>((resolve, reject) => { tasks.push({ item, run: run as () => Promise<unknown>, resolve: resolve as (value: unknown) => void, reject }); void pump(); });
}

export function readAIQueue(): { items: AIQueueItem[]; active: number; waiting: number; concurrency: number } {
  return { items: snapshot(), active, waiting: tasks.length, concurrency: CONCURRENCY };
}
export function subscribeAIQueue(listener: (items: AIQueueItem[]) => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
