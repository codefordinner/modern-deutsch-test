import { syncSrs } from '../api/srs';
import { getErrorMessage } from '../api/request';
import type { SrsSyncData, SrsTrainer } from '../types';
import { emptySyncData, mergeSyncData, readSyncKey, sanitizeSyncData, SRS_TRAINERS } from './srsSyncData';
import { getUISettings } from './uiSettings';
import { applySyncedDailyGoal, applySyncedDailyProgress, getDailyProgress, getStudyPrefs } from './studyPrefs';

// Syncing progress between devices that share a sync key (Settings → "Ключ синхронизации").
// The pure merge logic lives in srsSyncData.ts; this file does the I/O: reading / writing
// localStorage, talking to the server and keeping a small status store for the UI.
//
// What is synced: SRS boxes, the score of every trainer (app_scores), "answers today", the daily
// goal and the selected categories.
//
// Flow: every answer / reset schedules a debounced push; the app also pulls on start, when the
// key changes and when the tab becomes visible again (and flushes a pending push when it is hidden).
// One round trip = send local, get merged.

/** Fired on `window` after progress from the server was written into localStorage. */
export const SRS_SYNCED_EVENT = 'srs-synced';

/** localStorage: `{ words: ms, verbs: ms, articles: ms }` — when each trainer was last reset here or elsewhere. */
export const RESET_AT_KEY = 'app_srs_reset_at';

const SCORES_KEY = 'app_scores';
const PUSH_DELAY_MS = 2500;
/** How many extra round trips a single syncNow may make on its own to catch up (protects against loops). */
const MAX_SELF_ROUNDS = 3;

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
  const wordsSettings = readJSON('words_settings');
  const articlesCategories = readJSON('articles_category');
  // Normalise through the merge so records older than a reset are dropped here too.
  return mergeSyncData(sanitizeSyncData({
    srs,
    resetAt: readJSON(RESET_AT_KEY),
    scores: readJSON(SCORES_KEY),
    daily: getDailyProgress(),
    settings: {
      // The in-memory prefs are already sanitised and default to 20; the raw storage value may be missing.
      dailyGoal: getStudyPrefs().dailyGoal,
      wordsCategories: (wordsSettings as { selectedCats?: unknown } | null)?.selectedCats,
      articlesCategories,
      updatedAt: readJSON('app_sync_settings_updated_at'),
    },
  }), emptySyncData());
}

/** Writes the merged data into localStorage; returns whether any progress or score actually changed. */
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

  if (JSON.stringify(data.scores) !== JSON.stringify(previous.scores)) {
    try {
      const stored = readJSON(SCORES_KEY);
      const base = typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? stored : {};
      localStorage.setItem(SCORES_KEY, JSON.stringify({ ...base, ...data.scores }));
      changed = true;
    } catch {
      // ignore: the score just stays on the server
    }
  }

  if (data.daily.day !== previous.daily.day || data.daily.count !== previous.daily.count) {
    applySyncedDailyProgress(data.daily.day, data.daily.count);
  }

  try {
    localStorage.setItem(RESET_AT_KEY, JSON.stringify(data.resetAt));
    if (data.settings.updatedAt !== previous.settings.updatedAt) {
      localStorage.setItem('words_settings', JSON.stringify({ ...(readJSON('words_settings') as object ?? {}), selectedCats: data.settings.wordsCategories }));
      localStorage.setItem('articles_category', JSON.stringify(data.settings.articlesCategories));
      localStorage.setItem('app_sync_settings_updated_at', JSON.stringify(data.settings.updatedAt));
      // Writes app_study_prefs itself (keeping this device's dueOnly) and notifies subscribers.
      applySyncedDailyGoal(data.settings.dailyGoal);
      window.dispatchEvent(new CustomEvent('app-storage-updated', {
        detail: { keys: ['words_settings', 'articles_category', 'app_study_prefs'] },
      }));
      changed = true;
    }
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
  let selfRounds = 0;
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
        // The server does not know something we have (new answers meanwhile) → one more round,
        // but never more than MAX_SELF_ROUNDS on our own, so a disagreement can't become an endless loop.
        if (!sameData(merged, fromServer) && ++selfRounds <= MAX_SELF_ROUNDS) rerun = true;
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

/** Sends a push that is still waiting for its debounce right away (the tab is being hidden or closed). */
export function flushPendingSync(): void {
  if (timer !== undefined) void syncNow();
}

/** Marks learner settings as changed, then schedules the normal debounced exchange. */
export function markSyncSettingsChanged(): void {
  try {
    localStorage.setItem('app_sync_settings_updated_at', JSON.stringify(Date.now()));
  } catch {
    // ignore unavailable storage
  }
  scheduleSync();
}
