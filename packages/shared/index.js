export const SRS_TRAINERS = Object.freeze(['words', 'verbs', 'articles']);
export const SCORE_TRAINERS = Object.freeze(['numbers', 'words', 'articles', 'verbs']);
export const DEFAULT_SRS_WEIGHTS = Object.freeze([60, 15, 10, 5, 10]);
export const SRS_BOX_COUNT = 5;
export const MAX_BOX_WEIGHT = 1000;
export const PARTS_OF_SPEECH = Object.freeze(['noun', 'verb', 'adjective', 'adverb', 'other']);
export const REQUIRED_CASES = Object.freeze(['nominativ', 'akkusativ', 'dativ', 'genitiv']);
export const ADMIN_TABS = Object.freeze(['words', 'categories', 'import', 'duplicates', 'srs', 'audio', 'pictures', 'ai-settings', 'ai-logs', 'analytics', 'users']);
export const WORD_TEXT_FIELDS = Object.freeze(['hint', 'plural', 'feminine', 'praeteritum', 'partizip2', 'hilfsverb', 'praesensIch', 'praesensDu', 'praesensErSieEs', 'praesensWir', 'praesensIhr', 'praesensSie', 'requiredCase']);

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
    settings: {
      dailyGoal: 20, wordsCategories: ['all'], articlesCategories: ['all'], updatedAt: 0, trainerPrefsUpdatedAt: 0,
      trainerPrefs: {
        words: { directionMode: 'ru_to_de', requireArticle: true, enableBase: true, enablePlural: true, enableFeminine: true },
        numbers: { directionMode: 'num_to_de', range: { min: 0, max: 100 } },
        verbs: { mode: 'stammformen', praesensSubMode: 'both' },
        time: { displayMode: 'analog', stepMode: 'any' },
        srs: { words: true, verbs: true, articles: true, dueOnly: false },
      },
    },
    scores: { numbers: emptyScore(), words: emptyScore(), articles: emptyScore(), verbs: emptyScore() },
    daily: { day: '', count: 0 },
    onboardingSeen: false,
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
    trainerPrefs: sanitizeTrainerPrefs(settings.trainerPrefs),
    // Snapshots that predate trainerPrefs have no reliable trainer-preference timestamp.
    trainerPrefsUpdatedAt: settings.trainerPrefsUpdatedAt === undefined
      ? (isRecord(settings.trainerPrefs) ? count(settings.updatedAt) : 0)
      : count(settings.trainerPrefsUpdatedAt),
  };
  for (const trainer of SCORE_TRAINERS) result.scores[trainer] = sanitizeScore(scores[trainer]);
  result.daily = sanitizeDaily(raw.daily);
  result.onboardingSeen = raw.onboardingSeen === true;
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

function sanitizeTrainerPrefs(raw) {
  const value = isRecord(raw) ? raw : {};
  const words = isRecord(value.words) ? value.words : {};
  const numbers = isRecord(value.numbers) ? value.numbers : {};
  const range = isRecord(numbers.range) ? numbers.range : {};
  const verbs = isRecord(value.verbs) ? value.verbs : {};
  const time = isRecord(value.time) ? value.time : {};
  const srs = isRecord(value.srs) ? value.srs : {};
  const min = Number(range.min);
  const max = Number(range.max);
  const validRange = Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max > min && max <= 999_999_999;
  const select = (rawValue, allowed, fallback) => allowed.includes(rawValue) ? rawValue : fallback;
  const bool = (rawValue, fallback) => typeof rawValue === 'boolean' ? rawValue : fallback;
  return {
    words: {
      directionMode: select(words.directionMode, ['ru_to_de', 'de_to_ru', 'mixed'], 'ru_to_de'),
      requireArticle: bool(words.requireArticle, true),
      enableBase: bool(words.enableBase, true),
      enablePlural: bool(words.enablePlural, true),
      enableFeminine: bool(words.enableFeminine, true),
    },
    numbers: {
      directionMode: select(numbers.directionMode, ['de_to_num', 'num_to_de', 'mixed'], 'num_to_de'),
      range: validRange ? { min, max } : { min: 0, max: 100 },
    },
    verbs: {
      mode: select(verbs.mode, ['praesens', 'stammformen', 'multiple_choice', 'required_case'], 'stammformen'),
      praesensSubMode: select(verbs.praesensSubMode, ['praesens', 'form_to_infinitive', 'both'], 'both'),
    },
    time: {
      displayMode: select(time.displayMode, ['analog', 'digital', 'both'], 'analog'),
      stepMode: select(time.stepMode, ['any', '5min'], 'any'),
    },
    srs: {
      words: bool(srs.words, true),
      verbs: bool(srs.verbs, true),
      articles: bool(srs.articles, true),
      dueOnly: bool(srs.dueOnly, false),
    },
  };
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
  const latestSettings = a.settings.updatedAt >= b.settings.updatedAt ? a.settings : b.settings;
  const latestTrainerPrefs = a.settings.trainerPrefsUpdatedAt >= b.settings.trainerPrefsUpdatedAt ? a.settings : b.settings;
  merged.settings = {
    ...latestSettings,
    trainerPrefs: latestTrainerPrefs.trainerPrefs,
    trainerPrefsUpdatedAt: Math.max(a.settings.trainerPrefsUpdatedAt, b.settings.trainerPrefsUpdatedAt),
  };
  for (const trainer of SCORE_TRAINERS) merged.scores[trainer] = pickScore(a.scores[trainer], b.scores[trainer]);
  merged.daily = mergeDaily(a.daily, b.daily);
  merged.onboardingSeen = a.onboardingSeen || b.onboardingSeen;
  return merged;
}
