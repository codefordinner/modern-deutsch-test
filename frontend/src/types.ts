import type { SharedCategory, SharedPartOfSpeech, SharedRequiredCase, SharedWord } from '@sprachfunke/shared';

export type Category = SharedCategory;

/** Explicit part of speech of a dictionary entry (`null`/missing = not specified). */
export type PartOfSpeech = SharedPartOfSpeech;
export type RequiredCase = SharedRequiredCase;

export type Word = SharedWord;

export interface SRSRecord {
  box: number; // 1 to 5
  streak: number;
  mistakes: number;
  lastReviewed: string; // ISO
  nextReview: string; // ISO — a card is "due" once this has passed (see utils/srsDue.ts)
  promotedOn?: string; // local day YYYY-MM-DD of the last promotion (max one box up per day)
}

/** Trainers whose SRS progress can be synced between devices (see utils/srsSync.ts). */
export type SrsTrainer = 'words' | 'verbs' | 'articles';

/** Trainers that keep a score and whose score is synced (the scored tabs of config/tabs.ts). */
export type ScoreTrainer = 'numbers' | 'words' | 'articles' | 'verbs';

/** A trainer's score as exchanged with the server; `updatedAt` (ms) decides which device's score wins. */
export interface SyncScore {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
  updatedAt: number;
}

/** "Answers today": the learner's local day (YYYY-MM-DD) and the counter; '' = no data. */
export interface SyncDaily {
  day: string;
  count: number;
}

/** The SRS snapshot exchanged with the server: progress per trainer + the time of its last reset (ms, 0 = never). */
export interface SrsSyncData {
  srs: Record<SrsTrainer, Record<string, SRSRecord>>;
  resetAt: Record<SrsTrainer, number>;
  settings: SyncSettings;
  scores: Record<ScoreTrainer, SyncScore>;
  daily: SyncDaily;
  onboardingSeen: boolean;
}

/** Learner settings shared by devices through the Telegram account. */
export interface SyncSettings {
  dailyGoal: number;
  wordsCategories: string[];
  articlesCategories: string[];
  updatedAt: number;
  trainerPrefsUpdatedAt: number;
  trainerPrefs: {
    words: { directionMode: 'ru_to_de' | 'de_to_ru' | 'mixed'; requireArticle: boolean; enableBase: boolean; enablePlural: boolean; enableFeminine: boolean };
    numbers: { directionMode: 'de_to_num' | 'num_to_de' | 'mixed'; range: NumberRangeSettings };
    verbs: { mode: 'praesens' | 'stammformen' | 'multiple_choice' | 'required_case'; praesensSubMode: 'praesens' | 'form_to_infinitive' | 'both' };
    time: { displayMode: 'analog' | 'digital' | 'both'; stepMode: 'any' | '5min' };
    srs: Record<SrsTrainer, boolean> & { dueOnly: boolean };
  };
}

export interface NumberRangeSettings {
  min: number;
  max: number;
}

export type { AppTab, TrainerTab } from './config/tabs';

export interface ScoreState {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
  /** When the score last changed (ms); used by the cross-device sync. Absent = never synced. */
  updatedAt?: number;
}

/**
 * One typed (or selected) answer compared against the expected one. The
 * feedback box renders it as "Вы ввели: …" / "Правильно: …" with the
 * differing characters highlighted.
 */
export interface AnswerCheck {
  /** Optional heading, e.g. "Präteritum" when several fields are checked at once. */
  label?: string;
  /** Exactly what the user typed / picked. */
  user: string;
  /** The correct answer, as it should be displayed. */
  expected: string;
  isCorrect: boolean;
  /** Replaces the default "Вы ввели" caption (e.g. "Вы выбрали" for a dropdown). */
  userLabel?: string;
  /** Start of `expected` that the user wasn't asked to type (e.g. the article) — shown, but never highlighted. */
  neutralPrefix?: string;
  /** Ignore spaces when comparing (German number words). */
  ignoreSpaces?: boolean;
  /** Further accepted answers, listed under the comparison. */
  alternatives?: string[];
}

export interface Feedback {
  isCorrect: boolean;
  message: string;
  /** When set, a wrong answer is explained with these comparisons instead of `message`. */
  checks?: AnswerCheck[];
}

// ---- Trainer card dimensions (shared by the trainers and the SRS screens) ----

export type WordDirection = 'ru_to_de' | 'de_to_ru';
export type WordFormType = 'base' | 'plural' | 'feminine';

/**
 * Which underlying verb form a "форма → инфинитив" question quizzes on.
 * Präsens forms are per-pronoun; Präteritum and Partizip II are a single
 * fixed form per verb (no pronoun involved).
 */
export type VerbFormSource = 'praesens' | 'praeteritum' | 'partizip2';

// ---- API payloads ----

export interface WordsPage {
  words: Word[];
  total: number;
  page: number;
  limit: number;
}

// ---- Analytics (GET /api/analytics/stats) ----

/** What happened in one time slot (a day, a week, an hour of the day, a weekday). */
export interface StatsBucket {
  visits: number;
  /** Distinct authenticated learners with any activity in this slot. */
  activeLearners: number;
  /** Quiz answers given in this slot. */
  answers: number;
}

export interface DailyStat extends StatsBucket {
  /** YYYY-MM-DD in the server's statistics time zone. */
  date: string;
}

export interface WeeklyStat extends StatsBucket {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
}

export interface HourlyStat extends StatsBucket {
  /** 0…23 */
  hour: number;
}

export interface WeekdayStat extends StatsBucket {
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
}

export interface TrainerStat {
  trainer: string;
  answers: number;
  correct: number;
  /** Percent, null without answers. */
  accuracy: number | null;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface AnalyticsTotals {
  /** Total Telegram accounts currently registered. */
  registeredLearners: number;
  visits: number;
  activeLearners: number;
  visitsToday: number;
  activeToday: number;
  newLearners: number;
  answers: number;
  correct: number;
  accuracy: number | null;
  /** Days of the range with at least one visit. */
  activeDays: number;
  avgVisitsPerDay: number;
  /** Learners active on two or more different days of the range. */
  returningLearners: number;
  returningRate: number;
}

export interface AnalyticsStats {
  days: number;
  timeZone: string;
  generatedAt: string;
  /** true = the server hit its event cap, the oldest events are missing. */
  truncated: boolean;
  totals: AnalyticsTotals;
  daily: DailyStat[];
  weekly: WeeklyStat[];
  hourly: HourlyStat[];
  weekdays: WeekdayStat[];
  /** visits[weekday 0=Mon…6=Sun][hour 0…23] */
  heatmap: number[][];
  trainers: TrainerStat[];
  tabs: NamedCount[];
  devices: NamedCount[];
  browsers: NamedCount[];
}
