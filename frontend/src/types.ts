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
  plural?: string | null;
  feminine?: string | null;
  femininePlural?: string | null;
  praeteritum?: string | null;
  partizip2?: string | null;
  hilfsverb?: string | null;
  praesens?: string | null;
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

export type TrainerTab = 'numbers' | 'words' | 'verbs' | 'time' | 'admin';

export interface ScoreState {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
}
