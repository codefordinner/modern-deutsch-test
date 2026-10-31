import { syncSrs, getErrorMessage } from '../api/client';
import type { SrsSyncData, SrsTrainer } from '../types';
import { emptySyncData, mergeSyncData, readSyncKey, sanitizeSyncData, SRS_TRAINERS } from './srsSyncData';
import { getUISettings } from './uiSettings';

// Syncing SRS progress between devices that share a sync key (Settings → "Ключ синхронизации").
// The pure merge logic lives in srsSyncData.ts; this file does the I/O: reading / writing
// localStorage, talking to the server and keeping a small status store for the UI.
//
// Flow: every answer / reset schedules a debounced push; the app also pulls on start, when the
// key changes and when the tab becomes visible again. One round trip = send local, get merged.

/** Fired on `window` after progress from the server was written into localStorage. */
export const SRS_SYNCED_EVENT = 'srs-synced';

/** localStorage: `{ words: ms, verbs: ms, articles: ms }` — when each trainer was last reset here or elsewhere. */
export const RESET_AT_KEY = 'app_srs_reset_at';

const PUSH_DELAY_MS = 2500;

const stateKeyOf = (trainer: SrsTrainer) => `${trainer}_srs_state`;

/** 'words' → 'words'; anything that is not a synced trainer → null. */
export function toSrsTrainer(storagePrefix: string): SrsTrainer | null {
  return (SRS_TRAINERS as readonly string[]).includes(storagePrefix) ? (storagePrefix as SrsTrainer) : null;
}

function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function readLocal(): SrsSyncData {
  const srs: Record<string, unknown> = {};
  for (const trainer of SRS_TRAINERS) srs[trainer] = readJSON(stateKeyOf(trainer));
  // Normalise through the merge so records older than a reset are dropped here too.
  return mergeSyncData(sanitizeSyncData({ srs, resetAt: readJSON(RESET_AT_KEY) }), emptySyncData());
}

/** Writes the merged data into localStorage; returns whether any trainer's progress actually changed. */
function writeLocal(data: SrsSyncData, previous: SrsSyncData): boolean {
  let changed = false;
  for (const trainer of SRS_TRAINERS) {
    if (JSON.stringify(data.srs[trainer]) === JSON.stringify(previous.srs[trainer])) continue;
    changed = true;
    try {
      if (Object.keys(data.srs[trainer]).length === 0) localStorage.removeItem(stateKeyOf(trainer));
      else localStorage.setItem(stateKeyOf(trainer), JSON.stringify(data.srs[trainer]));
    } catch {
      // Storage unavailable: the progress just stays on the server until the next time.
    }
  }
  try {
    localStorage.setItem(RESET_AT_KEY, JSON.stringify(data.resetAt));
  } catch {
    // ignore
  }
  return changed;
}

const sameData = (a: SrsSyncData, b: SrsSyncData) => JSON.stringify(a) === JSON.stringify(b);

/** Remembers a reset of a trainer so that it is not undone by the next sync. */
export function markSrsReset(trainer: SrsTrainer): void {
  const resetAt = sanitizeSyncData({ resetAt: readJSON(RESET_AT_KEY) }).resetAt;
  resetAt[trainer] = Date.now();
  try {
    localStorage.setItem(RESET_AT_KEY, JSON.stringify(resetAt));
  } catch {
    // ignore
  }
}

// ---- Status store (for the settings modal) ----

export type SyncStatus =
  | { state: 'off' }
  | { state: 'syncing'; lastSyncedAt: number | null }
  | { state: 'ok'; lastSyncedAt: number }
  | { state: 'error'; message: string; lastSyncedAt: number | null };

let status: SyncStatus = { state: 'off' };
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

export const getSyncStatus = (): SyncStatus => status;
export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const lastSyncedOf = (s: SyncStatus): number | null => (s.state === 'off' ? null : s.lastSyncedAt);

// ---- Sync loop ----

let running = false;
let rerun = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** One or more round trips with the server; safe to call at any time (calls made meanwhile are coalesced). */
export async function syncNow(): Promise<void> {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  try {
    do {
      rerun = false;
      const key = readSyncKey(getUISettings().syncKey);
      if (!key) {
        setStatus({ state: 'off' });
        break;
      }

      setStatus({ state: 'syncing', lastSyncedAt: lastSyncedOf(status) });
      const sent = readLocal();
      try {
        const fromServer = sanitizeSyncData(await syncSrs(key, sent));

        // Answers given while the request was in flight must survive: merge with the CURRENT local data.
        const current = readLocal();
        const merged = mergeSyncData(fromServer, current);
        if (writeLocal(merged, current)) window.dispatchEvent(new Event(SRS_SYNCED_EVENT));
        // The server does not know something we have (new answers meanwhile) → one more round.
        if (!sameData(merged, fromServer)) rerun = true;
        // The key was changed meanwhile: the result belongs to the old key, run again for the new one.
        if (readSyncKey(getUISettings().syncKey) !== key) rerun = true;
        setStatus({ state: 'ok', lastSyncedAt: Date.now() });
      } catch (error) {
        setStatus({
          state: 'error',
          message: getErrorMessage(error, 'Не удалось синхронизировать прогресс'),
          lastSyncedAt: lastSyncedOf(status),
        });
        break; // retry on the next trigger instead of hammering a failing server
      }
    } while (rerun);
  } finally {
    running = false;
  }
}

/** Pushes local changes soon (debounced). A no-op without a sync key. */
export function scheduleSync(): void {
  if (!readSyncKey(getUISettings().syncKey)) return;
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void syncNow();
  }, PUSH_DELAY_MS);
}
