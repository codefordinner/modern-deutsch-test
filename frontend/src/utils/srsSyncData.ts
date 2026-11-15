import type { ScoreTrainer, SRSRecord, SrsSyncData, SrsTrainer, SyncDaily, SyncScore } from '../types';

// Pure data side of the sync (no I/O). The logic mirrors
// backend/src/services/srsSync.ts — keep the two in step.
//
// Merge rules:
//  - SRS: for every card the record with the later `lastReviewed` wins. A reset of a
//    trainer is a `resetAt` timestamp: records whose last answer is not later than it are dropped.
//  - Score: per trainer the one with the later `updatedAt` wins (a reset is a zero score with a new
//    `updatedAt`); on a tie the one with more answers.
//  - Answers today: same day → the larger counter; different days → the later day.

export const SRS_TRAINERS: readonly SrsTrainer[] = ['words', 'verbs', 'articles'];
/** Keep in step with SCORED_TABS in config/tabs.ts. */
export const SCORE_TRAINERS: readonly ScoreTrainer[] = ['numbers', 'words', 'articles', 'verbs'];
export const MIN_SYNC_KEY_LENGTH = 6;
export const MAX_SYNC_KEY_LENGTH = 200;
const MAX_CARDS_PER_TRAINER = 200_000;
const MAX_COUNTER = 1_000_000_000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const emptyScore = (): SyncScore => ({ correct: 0, total: 0, streak: 0, bestStreak: 0, updatedAt: 0 });

export const emptySyncData = (): SrsSyncData => ({
  srs: { words: {}, verbs: {}, articles: {} },
  resetAt: { words: 0, verbs: 0, articles: 0 },
  settings: { dailyGoal: 20, wordsCategories: ['all'], articlesCategories: ['all'], updatedAt: 0 },
  scores: { numbers: emptyScore(), words: emptyScore(), articles: emptyScore(), verbs: emptyScore() },
  daily: { day: '', count: 0 },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

const counter = (value: unknown): number => Math.min(MAX_COUNTER, count(value));

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

function sanitizeScore(raw: unknown): SyncScore {
  if (!isRecord(raw)) return emptyScore();
  const total = counter(raw.total);
  const correct = Math.min(counter(raw.correct), total);
  const streak = counter(raw.streak);
  return { correct, total, streak, bestStreak: Math.max(counter(raw.bestStreak), streak), updatedAt: count(raw.updatedAt) };
}

function sanitizeDaily(raw: unknown): SyncDaily {
  if (!isRecord(raw) || typeof raw.day !== 'string' || !DAY_KEY.test(raw.day)) return { day: '', count: 0 };
  return { day: raw.day, count: counter(raw.count) };
}

/** Whatever came from storage or the server → well-formed sync data; junk is dropped. */
export function sanitizeSyncData(raw: unknown): SrsSyncData {
  const result = emptySyncData();
  if (!isRecord(raw)) return result;
  const srs = isRecord(raw.srs) ? raw.srs : {};
  const resetAt = isRecord(raw.resetAt) ? raw.resetAt : {};
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const scores = isRecord(raw.scores) ? raw.scores : {};
  const categories = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length <= 200).slice(0, 1000) : ['all'];
  result.settings = {
    dailyGoal: Math.min(1000, count(settings.dailyGoal)),
    wordsCategories: categories(settings.wordsCategories),
    articlesCategories: categories(settings.articlesCategories),
    updatedAt: count(settings.updatedAt),
  };
  for (const trainer of SCORE_TRAINERS) result.scores[trainer] = sanitizeScore(scores[trainer]);
  result.daily = sanitizeDaily(raw.daily);

  for (const trainer of SRS_TRAINERS) {
    const reset = resetAt[trainer];
    result.resetAt[trainer] = typeof reset === 'number' && Number.isFinite(reset) && reset > 0 ? Math.floor(reset) : 0;

    const source = srs[trainer];
    if (!isRecord(source)) continue;
    let accepted = 0;
    for (const [key, value] of Object.entries(source)) {
      if (accepted >= MAX_CARDS_PER_TRAINER) break;
      if (FORBIDDEN_KEYS.has(key) || key.length === 0 || key.length > 200) continue;
      const record = sanitizeRecord(value);
      if (!record) continue;
      result.srs[trainer][key] = record;
      accepted += 1;
    }
  }
  return result;
}

/** The score changed later wins; on a tie the one with more answers (so legacy scores don't wipe each other). */
function pickScore(a: SyncScore, b: SyncScore): SyncScore {
  if (a.updatedAt !== b.updatedAt) return { ...(a.updatedAt > b.updatedAt ? a : b) };
  return { ...(b.total > a.total ? b : a) };
}

/** Same day: the larger counter (it only ever grows); different days: the later day. */
function mergeDaily(a: SyncDaily, b: SyncDaily): SyncDaily {
  if (a.day === b.day) return { day: a.day, count: Math.max(a.count, b.count) };
  return { ...(a.day > b.day ? a : b) };
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
  merged.settings = a.settings.updatedAt >= b.settings.updatedAt ? a.settings : b.settings;
  for (const trainer of SCORE_TRAINERS) merged.scores[trainer] = pickScore(a.scores[trainer], b.scores[trainer]);
  merged.daily = mergeDaily(a.daily, b.daily);
  return merged;
}

/** A usable key: trimmed text of 6–200 characters; anything else → null. */
export function readSyncKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length >= MIN_SYNC_KEY_LENGTH && key.length <= MAX_SYNC_KEY_LENGTH ? key : null;
}
