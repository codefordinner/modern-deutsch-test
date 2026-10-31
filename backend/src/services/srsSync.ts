import crypto from 'crypto';

/**
 * Синхронизация прогресса SRS между устройствами по общему ключу.
 *
 * Сервер хранит снимок прогресса под хэшем ключа (сам ключ не сохраняется) и при каждом
 * обмене сливает его с присланным: для каждой карточки побеждает запись с более поздним
 * `lastReviewed`. Сброс прогресса передаётся отметкой `resetAt` (мс): записи, последний
 * ответ по которым был не позже этой отметки, отбрасываются.
 *
 * Держите логику слияния в синхронизации с frontend/src/utils/srsSyncData.ts.
 */

export const SYNC_TRAINERS = ['words', 'verbs', 'articles'] as const;
export type SyncTrainer = (typeof SYNC_TRAINERS)[number];

export interface SyncRecord {
  box: number;
  streak: number;
  mistakes: number;
  lastReviewed: string;
  nextReview: string;
  promotedOn?: string;
}
export type SyncMap = Record<string, SyncRecord>;

export interface SyncData {
  srs: Record<SyncTrainer, SyncMap>;
  resetAt: Record<SyncTrainer, number>;
}

export const MIN_SYNC_KEY_LENGTH = 6;
export const MAX_SYNC_KEY_LENGTH = 200;
const MAX_CARDS_PER_TRAINER = 200_000;
const MAX_CARD_KEY_LENGTH = 200;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const emptySyncData = (): SyncData => ({
  srs: { words: {}, verbs: {}, articles: {} },
  resetAt: { words: 0, verbs: 0, articles: 0 },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

function sanitizeRecord(raw: unknown): SyncRecord | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.box !== 'number' || !Number.isFinite(raw.box)) return null;
  if (typeof raw.lastReviewed !== 'string' || Number.isNaN(Date.parse(raw.lastReviewed))) return null;

  const record: SyncRecord = {
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

/** Whatever arrived (request body / stored JSON) → a well-formed SyncData; junk is dropped. */
export function sanitizeSyncData(raw: unknown): SyncData {
  const result = emptySyncData();
  if (!isRecord(raw)) return result;
  const srs = isRecord(raw.srs) ? raw.srs : {};
  const resetAt = isRecord(raw.resetAt) ? raw.resetAt : {};

  for (const trainer of SYNC_TRAINERS) {
    const reset = resetAt[trainer];
    result.resetAt[trainer] = typeof reset === 'number' && Number.isFinite(reset) && reset > 0 ? Math.floor(reset) : 0;

    const source = srs[trainer];
    if (!isRecord(source)) continue;
    let accepted = 0;
    for (const [key, value] of Object.entries(source)) {
      if (accepted >= MAX_CARDS_PER_TRAINER) break;
      if (FORBIDDEN_KEYS.has(key) || key.length === 0 || key.length > MAX_CARD_KEY_LENGTH) continue;
      const record = sanitizeRecord(value);
      if (!record) continue;
      result.srs[trainer][key] = record;
      accepted += 1;
    }
  }
  return result;
}

/** Union of two snapshots: the newer answer wins per card; a reset wipes older answers. */
export function mergeSyncData(a: SyncData, b: SyncData): SyncData {
  const merged = emptySyncData();
  for (const trainer of SYNC_TRAINERS) {
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

/** The key itself is never stored — only its hash identifies the profile. */
export const hashSyncKey = (key: string): string =>
  crypto.createHash('sha256').update(`deutsch-sync:${key}`).digest('hex');

/** A usable key: trimmed text of 6–200 characters; anything else → null. */
export function readSyncKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length >= MIN_SYNC_KEY_LENGTH && key.length <= MAX_SYNC_KEY_LENGTH ? key : null;
}
