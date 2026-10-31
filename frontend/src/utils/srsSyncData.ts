import type { SRSRecord, SrsSyncData, SrsTrainer } from '../types';

// Pure data side of the SRS sync (no I/O). The logic mirrors
// backend/src/services/srsSync.ts — keep the two in step.
//
// Merge rule: for every card the record with the later `lastReviewed` wins. A reset of a
// trainer is a `resetAt` timestamp: records whose last answer is not later than it are dropped.

export const SRS_TRAINERS: readonly SrsTrainer[] = ['words', 'verbs', 'articles'];
export const MIN_SYNC_KEY_LENGTH = 6;
export const MAX_SYNC_KEY_LENGTH = 200;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const emptySyncData = (): SrsSyncData => ({
  srs: { words: {}, verbs: {}, articles: {} },
  resetAt: { words: 0, verbs: 0, articles: 0 },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

function sanitizeRecord(raw: unknown): SRSRecord | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.box !== 'number' || !Number.isFinite(raw.box)) return null;
  if (typeof raw.lastReviewed !== 'string' || Number.isNaN(Date.parse(raw.lastReviewed))) return null;

  const record: SRSRecord = {
    box: Math.min(5, Math.max(1, Math.round(raw.box))),
    streak: count(raw.streak),
    mistakes: count(raw.mistakes),
    lastReviewed: raw.lastReviewed,
    nextReview:
      typeof raw.nextReview === 'string' && !Number.isNaN(Date.parse(raw.nextReview)) ? raw.nextReview : raw.lastReviewed,
  };
  if (typeof raw.promotedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.promotedOn)) record.promotedOn = raw.promotedOn;
  return record;
}

/** Whatever came from storage or the server → well-formed sync data; junk is dropped. */
export function sanitizeSyncData(raw: unknown): SrsSyncData {
  const result = emptySyncData();
  if (!isRecord(raw)) return result;
  const srs = isRecord(raw.srs) ? raw.srs : {};
  const resetAt = isRecord(raw.resetAt) ? raw.resetAt : {};

  for (const trainer of SRS_TRAINERS) {
    const reset = resetAt[trainer];
    result.resetAt[trainer] = typeof reset === 'number' && Number.isFinite(reset) && reset > 0 ? Math.floor(reset) : 0;

    const source = srs[trainer];
    if (!isRecord(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (FORBIDDEN_KEYS.has(key) || key.length === 0 || key.length > 200) continue;
      const record = sanitizeRecord(value);
      if (record) result.srs[trainer][key] = record;
    }
  }
  return result;
}

/** Union of two snapshots: the newer answer wins per card; a reset wipes older answers. */
export function mergeSyncData(a: SrsSyncData, b: SrsSyncData): SrsSyncData {
  const merged = emptySyncData();
  for (const trainer of SRS_TRAINERS) {
    const resetAt = Math.max(a.resetAt[trainer], b.resetAt[trainer]);
    merged.resetAt[trainer] = resetAt;

    for (const source of [a.srs[trainer], b.srs[trainer]]) {
      for (const [key, record] of Object.entries(source)) {
        const time = Date.parse(record.lastReviewed);
        if (resetAt > 0 && time <= resetAt) continue;
        const current = merged.srs[trainer][key];
        if (!current || time > Date.parse(current.lastReviewed)) merged.srs[trainer][key] = record;
      }
    }
  }
  return merged;
}

/** A usable key: trimmed text of 6–200 characters; anything else → null. */
export function readSyncKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length >= MIN_SYNC_KEY_LENGTH && key.length <= MAX_SYNC_KEY_LENGTH ? key : null;
}
