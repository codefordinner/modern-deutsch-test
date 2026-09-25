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
  femininePlural?: string | null;
  praeteritum?: string | null;
  partizip2?: string | null;
  hilfsverb?: string | null;
  praesensIch?: string | null;
  praesensDu?: string | null;
  praesensErSieEs?: string | null;
  praesensWir?: string | null;
  praesensIhr?: string | null;
  praesensSie?: string | null;
  categoryId: string;
  category?: Category;
}

export interface SRSRecord {
  box: number; // 1 to 5
  streak: number;
  mistakes: number;
  lastReviewed: string; // ISO
  nextReview: string; // ISO
}

export interface NumberRangeSettings {
  min: number;
  max: number;
  allowLarge?: boolean;
}

export type TrainerTab = 'numbers' | 'words' | 'verbs' | 'time' | 'admin';

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

export interface DayCount {
  date: string;
  count: number;
}

export interface TabCount {
  tab: string;
  count: number;
}

export interface AnalyticsStats {
  totalVisits: number;
  uniqueVisitors: number;
  visitsToday: number;
  last7Days: DayCount[];
  topTabs: TabCount[];
}
