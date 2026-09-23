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

export interface Word {
  id: string;
  de: string;
  ru: string;
  /** Short clarifying note (e.g. meaning/context) to tell apart words that translate the same way. */
  hint?: string | null;
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

export type SRSState = SRSRecord;

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
