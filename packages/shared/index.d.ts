export declare const SRS_TRAINERS: readonly ['words', 'verbs', 'articles'];
export declare const SCORE_TRAINERS: readonly ['numbers', 'words', 'articles', 'verbs'];
export declare const DEFAULT_SRS_WEIGHTS: readonly number[];
export declare const SRS_BOX_COUNT: 5;
export declare const MAX_BOX_WEIGHT: 1000;
export declare const MIN_SYNC_KEY_LENGTH: 6;
export declare const MAX_SYNC_KEY_LENGTH: 200;
export declare function sanitizeWeights(raw: unknown): number[] | null;
export interface SharedScore { correct: number; total: number; streak: number; bestStreak: number; updatedAt: number }
export interface SharedRecord { box: number; streak: number; mistakes: number; lastReviewed: string; nextReview: string; promotedOn?: string }
export interface SharedSyncData { srs: Record<'words' | 'verbs' | 'articles', Record<string, SharedRecord>>; resetAt: Record<'words' | 'verbs' | 'articles', number>; settings: { dailyGoal: number; wordsCategories: string[]; articlesCategories: string[]; updatedAt: number }; scores: Record<'numbers' | 'words' | 'articles' | 'verbs', SharedScore>; daily: { day: string; count: number } }
export declare function emptySyncData(): SharedSyncData;
export declare function sanitizeSyncData(raw: unknown): SharedSyncData;
export declare function mergeSyncData(a: SharedSyncData, b: SharedSyncData): SharedSyncData;
export declare function readSyncKey(value: unknown): string | null;
