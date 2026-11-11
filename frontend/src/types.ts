export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  isBuiltin: boolean;
  _count?: {
    words: number;
  };
}

/** Explicit part of speech of a dictionary entry (`null`/missing = not specified). */
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other';
export type RequiredCase = 'nominativ' | 'akkusativ' | 'dativ' | 'genitiv';

export interface Word {
  id: string;
  de: string;
  ru: string;
  /** Short clarifying note (e.g. meaning/context) to tell apart words that translate the same way. */
  hint?: string | null;
  /** Which trainers the entry belongs to — the verbs trainer only takes `'verb'`. */
  partOfSpeech?: PartOfSpeech | null;
  plural?: string | null;
  feminine?: string | null;
  praeteritum?: string | null;
  partizip2?: string | null;
  /** Always 'haben' | 'sein' (the server normalises legacy 'hat' / 'ist'). */
  hilfsverb?: 'haben' | 'sein' | null;
  praesensIch?: string | null;
  praesensDu?: string | null;
  praesensErSieEs?: string | null;
  praesensWir?: string | null;
  praesensIhr?: string | null;
  praesensSie?: string | null;
  requiredCase?: RequiredCase | null;
  /** The PRIMARY category (the first of the word's categories). Read all of them via utils/wordCategories.ts. */
  categoryId: string;
  category?: Category;
  /** Every category of the word, primary first. Absent in responses of an older server / cache. */
  categories?: Category[];
  categoryIds?: string[];
}

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

/** The SRS snapshot exchanged with the server: progress per trainer + the time of its last reset (ms, 0 = never). */
export interface SrsSyncData {
  srs: Record<SrsTrainer, Record<string, SRSRecord>>;
  resetAt: Record<SrsTrainer, number>;
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
  /** Distinct visitors that opened the app in this slot. */
  visitors: number;
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
  /** All visits ever recorded (not limited to the chosen range). */
  allTimeVisits: number;
  visits: number;
  uniqueVisitors: number;
  visitsToday: number;
  uniqueToday: number;
  answers: number;
  correct: number;
  accuracy: number | null;
  /** Days of the range with at least one visit. */
  activeDays: number;
  avgVisitsPerDay: number;
  /** Visitors who came on two or more different days of the range. */
  returningVisitors: number;
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
