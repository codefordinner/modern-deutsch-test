export const SRS_TRAINERS = Object.freeze(['words', 'verbs', 'articles']);
export const SCORE_TRAINERS = Object.freeze(['numbers', 'words', 'articles', 'verbs']);
export const DEFAULT_SRS_WEIGHTS = Object.freeze([60, 15, 10, 5, 10]);
export const SRS_BOX_COUNT = 5;
export const MAX_BOX_WEIGHT = 1000;
export const MIN_SYNC_KEY_LENGTH = 6;
export const MAX_SYNC_KEY_LENGTH = 200;

export function sanitizeWeights(raw) {
  if (!Array.isArray(raw) || raw.length !== SRS_BOX_COUNT) return null;
  if (!raw.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_BOX_WEIGHT)) return null;
  return raw.some((value) => value > 0) ? [...raw] : null;
}

export function emptySyncData() {
  const emptyScore = () => ({ correct: 0, total: 0, streak: 0, bestStreak: 0, updatedAt: 0 });
  return {
    srs: { words: {}, verbs: {}, articles: {} },
    resetAt: { words: 0, verbs: 0, articles: 0 },
    settings: { dailyGoal: 20, wordsCategories: ['all'], articlesCategories: ['all'], updatedAt: 0 },
    scores: { numbers: emptyScore(), words: emptyScore(), articles: emptyScore(), verbs: emptyScore() },
    daily: { day: '', count: 0 },
  };
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
const counter = (value) => Math.min(1_000_000_000, count(value));
const categoryList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length <= 200).slice(0, 1000) : ['all'];
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeRecord(raw) {
  if (!isRecord(raw) || typeof raw.box !== 'number' || !Number.isFinite(raw.box) || typeof raw.lastReviewed !== 'string' || Number.isNaN(Date.parse(raw.lastReviewed))) return null;
  const record = {
    box: Math.min(5, Math.max(1, Math.round(raw.box))),
    streak: count(raw.streak),
    mistakes: count(raw.mistakes),
    lastReviewed: raw.lastReviewed,
    nextReview: typeof raw.nextReview === 'string' && !Number.isNaN(Date.parse(raw.nextReview)) ? raw.nextReview : raw.lastReviewed,
  };
  if (typeof raw.promotedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.promotedOn)) record.promotedOn = raw.promotedOn;
  return record;
}

function sanitizeScore(raw) {
  if (!isRecord(raw)) return { correct: 0, total: 0, streak: 0, bestStreak: 0, updatedAt: 0 };
  const total = counter(raw.total);
  const streak = counter(raw.streak);
  return { correct: Math.min(counter(raw.correct), total), total, streak, bestStreak: Math.max(counter(raw.bestStreak), streak), updatedAt: count(raw.updatedAt) };
}

function sanitizeDaily(raw) {
  return isRecord(raw) && typeof raw.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.day)
    ? { day: raw.day, count: counter(raw.count) }
    : { day: '', count: 0 };
}

export function sanitizeSyncData(raw) {
  const result = emptySyncData();
  if (!isRecord(raw)) return result;
  const srs = isRecord(raw.srs) ? raw.srs : {};
  const resetAt = isRecord(raw.resetAt) ? raw.resetAt : {};
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const scores = isRecord(raw.scores) ? raw.scores : {};
  result.settings = {
    dailyGoal: Math.min(1000, count(settings.dailyGoal)),
    wordsCategories: categoryList(settings.wordsCategories),
    articlesCategories: categoryList(settings.articlesCategories),
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
      if (accepted >= 200_000 || forbiddenKeys.has(key) || key.length === 0 || key.length > 200) continue;
      const record = sanitizeRecord(value);
      if (record) { result.srs[trainer][key] = record; accepted += 1; }
    }
  }
  return result;
}

const pickScore = (a, b) => a.updatedAt !== b.updatedAt ? { ...(a.updatedAt > b.updatedAt ? a : b) } : { ...(b.total > a.total ? b : a) };
const mergeDaily = (a, b) => a.day === b.day ? { day: a.day, count: Math.max(a.count, b.count) } : { ...(a.day > b.day ? a : b) };

export function mergeSyncData(a, b) {
  const merged = emptySyncData();
  for (const trainer of SRS_TRAINERS) {
    const resetAt = Math.max(a.resetAt[trainer], b.resetAt[trainer]);
    merged.resetAt[trainer] = resetAt;
    for (const source of [a.srs[trainer], b.srs[trainer]]) for (const [key, record] of Object.entries(source)) {
      const time = Date.parse(record.lastReviewed);
      if (resetAt > 0 && time <= resetAt) continue;
      const current = merged.srs[trainer][key];
      if (!current || time > Date.parse(current.lastReviewed)) merged.srs[trainer][key] = record;
    }
  }
  merged.settings = a.settings.updatedAt >= b.settings.updatedAt ? a.settings : b.settings;
  for (const trainer of SCORE_TRAINERS) merged.scores[trainer] = pickScore(a.scores[trainer], b.scores[trainer]);
  merged.daily = mergeDaily(a.daily, b.daily);
  return merged;
}

export function readSyncKey(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length >= MIN_SYNC_KEY_LENGTH && key.length <= MAX_SYNC_KEY_LENGTH ? key : null;
}
