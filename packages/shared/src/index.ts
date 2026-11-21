export const SRS_TRAINERS = Object.freeze([
  "words",
  "verbs",
  "articles",
] as const);
export const SCORE_TRAINERS = Object.freeze([
  "numbers",
  "words",
  "articles",
  "verbs",
] as const);
export const DEFAULT_SRS_WEIGHTS = Object.freeze([60, 15, 10, 5, 10] as const);
export const SRS_BOX_COUNT = 5;
export const MAX_BOX_WEIGHT = 1000;
export const PARTS_OF_SPEECH = Object.freeze([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "other",
] as const);
export type SharedPartOfSpeech = (typeof PARTS_OF_SPEECH)[number];
export const REQUIRED_CASES = Object.freeze([
  "nominativ",
  "akkusativ",
  "dativ",
  "genitiv",
] as const);
export type SharedRequiredCase = (typeof REQUIRED_CASES)[number];
export const ADMIN_TABS = Object.freeze([
  "words",
  "categories",
  "import",
  "duplicates",
  "srs",
  "audio",
  "pictures",
  "ai-settings",
  "ai-logs",
  "analytics",
  "users",
] as const);
export type SharedAdminTab = (typeof ADMIN_TABS)[number];
export const WORD_TEXT_FIELDS = Object.freeze([
  "hint",
  "plural",
  "feminine",
  "praeteritum",
  "partizip2",
  "hilfsverb",
  "praesensIch",
  "praesensDu",
  "praesensErSieEs",
  "praesensWir",
  "praesensIhr",
  "praesensSie",
  "requiredCase",
] as const);

export interface SharedCategory {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  isBuiltin: boolean;
  _count?: { words: number };
}
export interface SharedWord {
  id: string;
  de: string;
  ru: string;
  hint?: string | null;
  partOfSpeech?: SharedPartOfSpeech | null;
  plural?: string | null;
  feminine?: string | null;
  praeteritum?: string | null;
  partizip2?: string | null;
  hilfsverb?: "haben" | "sein" | null;
  praesensIch?: string | null;
  praesensDu?: string | null;
  praesensErSieEs?: string | null;
  praesensWir?: string | null;
  praesensIhr?: string | null;
  praesensSie?: string | null;
  requiredCase?: SharedRequiredCase | null;
  categoryId: string;
  category?: SharedCategory;
  categories?: SharedCategory[];
  categoryIds?: string[];
}
export interface SharedScore {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
  updatedAt: number;
}
export interface SharedRecord {
  box: number;
  streak: number;
  mistakes: number;
  lastReviewed: string;
  nextReview: string;
  promotedOn?: string;
}
type SrsTrainer = (typeof SRS_TRAINERS)[number];
type ScoreTrainer = (typeof SCORE_TRAINERS)[number];
interface SharedTrainerPrefs {
  words: {
    directionMode: "ru_to_de" | "de_to_ru" | "mixed";
    requireArticle: boolean;
    enableBase: boolean;
    enablePlural: boolean;
    enableFeminine: boolean;
  };
  numbers: {
    directionMode: "de_to_num" | "num_to_de" | "mixed";
    range: { min: number; max: number };
  };
  verbs: {
    mode: "praesens" | "stammformen" | "multiple_choice" | "required_case";
    praesensSubMode: "praesens" | "form_to_infinitive" | "both";
  };
  time: {
    displayMode: "analog" | "digital" | "both";
    stepMode: "any" | "5min";
  };
  srs: Record<SrsTrainer, boolean> & { dueOnly: boolean };
}
export interface SharedSyncData {
  srs: Record<SrsTrainer, Record<string, SharedRecord>>;
  resetAt: Record<SrsTrainer, number>;
  settings: {
    dailyGoal: number;
    wordsCategories: string[];
    articlesCategories: string[];
    updatedAt: number;
    trainerPrefsUpdatedAt: number;
    trainerPrefs: SharedTrainerPrefs;
  };
  scores: Record<ScoreTrainer, SharedScore>;
  daily: { day: string; count: number };
  onboardingSeen: boolean;
}

export function sanitizeWeights(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== SRS_BOX_COUNT) return null;
  if (
    !raw.every(
      (value) =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= MAX_BOX_WEIGHT,
    )
  )
    return null;
  return raw.some((value) => value > 0) ? [...raw] : null;
}

export function emptySyncData(): SharedSyncData {
  const emptyScore = (): SharedScore => ({
    correct: 0,
    total: 0,
    streak: 0,
    bestStreak: 0,
    updatedAt: 0,
  });
  return {
    srs: { words: {}, verbs: {}, articles: {} },
    resetAt: { words: 0, verbs: 0, articles: 0 },
    settings: {
      dailyGoal: 20,
      wordsCategories: ["all"],
      articlesCategories: ["all"],
      updatedAt: 0,
      trainerPrefsUpdatedAt: 0,
      trainerPrefs: {
        words: {
          directionMode: "ru_to_de",
          requireArticle: true,
          enableBase: true,
          enablePlural: false,
          enableFeminine: false,
        },
        numbers: { directionMode: "num_to_de", range: { min: 0, max: 100 } },
        verbs: { mode: "stammformen", praesensSubMode: "both" },
        time: { displayMode: "analog", stepMode: "any" },
        srs: { words: true, verbs: true, articles: true, dueOnly: false },
      },
    },
    scores: {
      numbers: emptyScore(),
      words: emptyScore(),
      articles: emptyScore(),
      verbs: emptyScore(),
    },
    daily: { day: "", count: 0 },
    onboardingSeen: false,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
const counter = (value: unknown): number =>
  Math.min(1_000_000_000, count(value));
const categoryList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === "string" && item.length <= 200,
        )
        .slice(0, 1000)
    : ["all"];
const forbiddenKeys = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeRecord(raw: unknown): SharedRecord | null {
  if (
    !isRecord(raw) ||
    typeof raw.box !== "number" ||
    !Number.isFinite(raw.box) ||
    typeof raw.lastReviewed !== "string" ||
    Number.isNaN(Date.parse(raw.lastReviewed))
  )
    return null;
  const record: SharedRecord = {
    box: Math.min(5, Math.max(1, Math.round(raw.box))),
    streak: count(raw.streak),
    mistakes: count(raw.mistakes),
    lastReviewed: raw.lastReviewed,
    nextReview:
      typeof raw.nextReview === "string" &&
      !Number.isNaN(Date.parse(raw.nextReview))
        ? raw.nextReview
        : raw.lastReviewed,
  };
  if (
    typeof raw.promotedOn === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.promotedOn)
  )
    record.promotedOn = raw.promotedOn;
  return record;
}

function sanitizeScore(raw: unknown): SharedScore {
  if (!isRecord(raw))
    return { correct: 0, total: 0, streak: 0, bestStreak: 0, updatedAt: 0 };
  const total = counter(raw.total);
  const streak = counter(raw.streak);
  return {
    correct: Math.min(counter(raw.correct), total),
    total,
    streak,
    bestStreak: Math.max(counter(raw.bestStreak), streak),
    updatedAt: count(raw.updatedAt),
  };
}

function sanitizeDaily(raw: unknown): SharedSyncData["daily"] {
  return isRecord(raw) &&
    typeof raw.day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.day)
    ? { day: raw.day, count: counter(raw.count) }
    : { day: "", count: 0 };
}

export function sanitizeSyncData(raw: unknown): SharedSyncData {
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
    trainerPrefsUpdatedAt:
      settings.trainerPrefsUpdatedAt === undefined
        ? isRecord(settings.trainerPrefs)
          ? count(settings.updatedAt)
          : 0
        : count(settings.trainerPrefsUpdatedAt),
  };
  for (const trainer of SCORE_TRAINERS)
    result.scores[trainer] = sanitizeScore(scores[trainer]);
  result.daily = sanitizeDaily(raw.daily);
  result.onboardingSeen = raw.onboardingSeen === true;
  for (const trainer of SRS_TRAINERS) {
    const reset = resetAt[trainer];
    result.resetAt[trainer] =
      typeof reset === "number" && Number.isFinite(reset) && reset > 0
        ? Math.floor(reset)
        : 0;
    const source = srs[trainer];
    if (!isRecord(source)) continue;
    let accepted = 0;
    for (const [key, value] of Object.entries(source)) {
      if (
        accepted >= 200_000 ||
        forbiddenKeys.has(key) ||
        key.length === 0 ||
        key.length > 200
      )
        continue;
      const record = sanitizeRecord(value);
      if (record) {
        result.srs[trainer][key] = record;
        accepted += 1;
      }
    }
  }
  return result;
}

function sanitizeTrainerPrefs(raw: unknown): SharedTrainerPrefs {
  const value = isRecord(raw) ? raw : {};
  const words = isRecord(value.words) ? value.words : {};
  const numbers = isRecord(value.numbers) ? value.numbers : {};
  const range = isRecord(numbers.range) ? numbers.range : {};
  const verbs = isRecord(value.verbs) ? value.verbs : {};
  const time = isRecord(value.time) ? value.time : {};
  const srs = isRecord(value.srs) ? value.srs : {};
  const min = Number(range.min);
  const max = Number(range.max);
  const validRange =
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min >= 0 &&
    max > min &&
    max <= 999_999_999;
  const select = <T extends string>(
    rawValue: unknown,
    allowed: readonly T[],
    fallback: T,
  ): T =>
    typeof rawValue === "string" && allowed.includes(rawValue as T)
      ? (rawValue as T)
      : fallback;
  const bool = (rawValue: unknown, fallback: boolean): boolean =>
    typeof rawValue === "boolean" ? rawValue : fallback;
  return {
    words: {
      directionMode: select(
        words.directionMode,
        ["ru_to_de", "de_to_ru", "mixed"],
        "ru_to_de",
      ),
      requireArticle: bool(words.requireArticle, true),
      enableBase: bool(words.enableBase, true),
      enablePlural: bool(words.enablePlural, false),
      enableFeminine: bool(words.enableFeminine, false),
    },
    numbers: {
      directionMode: select(
        numbers.directionMode,
        ["de_to_num", "num_to_de", "mixed"],
        "num_to_de",
      ),
      range: validRange ? { min, max } : { min: 0, max: 100 },
    },
    verbs: {
      mode: select(
        verbs.mode,
        ["praesens", "stammformen", "multiple_choice", "required_case"],
        "stammformen",
      ),
      praesensSubMode: select(
        verbs.praesensSubMode,
        ["praesens", "form_to_infinitive", "both"],
        "both",
      ),
    },
    time: {
      displayMode: select(
        time.displayMode,
        ["analog", "digital", "both"],
        "analog",
      ),
      stepMode: select(time.stepMode, ["any", "5min"], "any"),
    },
    srs: {
      words: bool(srs.words, true),
      verbs: bool(srs.verbs, true),
      articles: bool(srs.articles, true),
      dueOnly: bool(srs.dueOnly, false),
    },
  };
}

const pickScore = (a: SharedScore, b: SharedScore): SharedScore =>
  a.updatedAt !== b.updatedAt
    ? { ...(a.updatedAt > b.updatedAt ? a : b) }
    : { ...(b.total > a.total ? b : a) };
const mergeDaily = (
  a: SharedSyncData["daily"],
  b: SharedSyncData["daily"],
): SharedSyncData["daily"] =>
  a.day === b.day
    ? { day: a.day, count: Math.max(a.count, b.count) }
    : { ...(a.day > b.day ? a : b) };

export function mergeSyncData(
  a: SharedSyncData,
  b: SharedSyncData,
): SharedSyncData {
  const merged = emptySyncData();
  for (const trainer of SRS_TRAINERS) {
    const resetAt = Math.max(a.resetAt[trainer], b.resetAt[trainer]);
    merged.resetAt[trainer] = resetAt;
    for (const source of [a.srs[trainer], b.srs[trainer]])
      for (const [key, record] of Object.entries(source)) {
        const time = Date.parse(record.lastReviewed);
        if (resetAt > 0 && time <= resetAt) continue;
        const current = merged.srs[trainer][key];
        if (!current || time > Date.parse(current.lastReviewed))
          merged.srs[trainer][key] = record;
      }
  }
  const latestSettings =
    a.settings.updatedAt >= b.settings.updatedAt ? a.settings : b.settings;
  const latestTrainerPrefs =
    a.settings.trainerPrefsUpdatedAt >= b.settings.trainerPrefsUpdatedAt
      ? a.settings
      : b.settings;
  merged.settings = {
    ...latestSettings,
    trainerPrefs: latestTrainerPrefs.trainerPrefs,
    trainerPrefsUpdatedAt: Math.max(
      a.settings.trainerPrefsUpdatedAt,
      b.settings.trainerPrefsUpdatedAt,
    ),
  };
  for (const trainer of SCORE_TRAINERS)
    merged.scores[trainer] = pickScore(a.scores[trainer], b.scores[trainer]);
  merged.daily = mergeDaily(a.daily, b.daily);
  merged.onboardingSeen = a.onboardingSeen || b.onboardingSeen;
  return merged;
}
