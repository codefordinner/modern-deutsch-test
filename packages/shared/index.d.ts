export declare const SRS_TRAINERS: readonly ['words', 'verbs', 'articles'];
export declare const SCORE_TRAINERS: readonly ['numbers', 'words', 'articles', 'verbs'];
export declare const DEFAULT_SRS_WEIGHTS: readonly number[];
export declare const SRS_BOX_COUNT: 5;
export declare const MAX_BOX_WEIGHT: 1000;
export declare const PARTS_OF_SPEECH: readonly ['noun', 'verb', 'adjective', 'adverb', 'other'];
export type SharedPartOfSpeech = (typeof PARTS_OF_SPEECH)[number];
export declare const REQUIRED_CASES: readonly ['nominativ', 'akkusativ', 'dativ', 'genitiv'];
export type SharedRequiredCase = (typeof REQUIRED_CASES)[number];
export declare const ADMIN_TABS: readonly ['words', 'categories', 'import', 'duplicates', 'srs', 'audio', 'pictures', 'ai-settings', 'ai-logs', 'analytics', 'users'];
export type SharedAdminTab = (typeof ADMIN_TABS)[number];
export declare const WORD_TEXT_FIELDS: readonly ['hint', 'plural', 'feminine', 'praeteritum', 'partizip2', 'hilfsverb', 'praesensIch', 'praesensDu', 'praesensErSieEs', 'praesensWir', 'praesensIhr', 'praesensSie', 'requiredCase'];
export interface SharedCategory {
  id: string; name: string; icon?: string | null; color?: string | null; isBuiltin: boolean;
  _count?: { words: number };
}
export interface SharedWord {
  id: string; de: string; ru: string; hint?: string | null; partOfSpeech?: SharedPartOfSpeech | null;
  plural?: string | null; feminine?: string | null; praeteritum?: string | null; partizip2?: string | null;
  hilfsverb?: 'haben' | 'sein' | null; praesensIch?: string | null; praesensDu?: string | null;
  praesensErSieEs?: string | null; praesensWir?: string | null; praesensIhr?: string | null;
  praesensSie?: string | null; requiredCase?: SharedRequiredCase | null; categoryId: string;
  category?: SharedCategory; categories?: SharedCategory[]; categoryIds?: string[];
}
export declare function sanitizeWeights(raw: unknown): number[] | null;
export interface SharedScore { correct: number; total: number; streak: number; bestStreak: number; updatedAt: number }
export interface SharedRecord { box: number; streak: number; mistakes: number; lastReviewed: string; nextReview: string; promotedOn?: string }
export interface SharedSyncData { srs: Record<'words' | 'verbs' | 'articles', Record<string, SharedRecord>>; resetAt: Record<'words' | 'verbs' | 'articles', number>; settings: { dailyGoal: number; wordsCategories: string[]; articlesCategories: string[]; updatedAt: number; trainerPrefsUpdatedAt: number; trainerPrefs: { words: { directionMode: 'ru_to_de' | 'de_to_ru' | 'mixed'; requireArticle: boolean; enableBase: boolean; enablePlural: boolean; enableFeminine: boolean }; numbers: { directionMode: 'de_to_num' | 'num_to_de' | 'mixed'; range: { min: number; max: number } }; verbs: { mode: 'praesens' | 'stammformen' | 'multiple_choice' | 'required_case'; praesensSubMode: 'praesens' | 'form_to_infinitive' | 'both' }; time: { displayMode: 'analog' | 'digital' | 'both'; stepMode: 'any' | '5min' }; srs: Record<'words' | 'verbs' | 'articles', boolean> & { dueOnly: boolean } } }; scores: Record<'numbers' | 'words' | 'articles' | 'verbs', SharedScore>; daily: { day: string; count: number }; onboardingSeen: boolean }
export declare function emptySyncData(): SharedSyncData;
export declare function sanitizeSyncData(raw: unknown): SharedSyncData;
export declare function mergeSyncData(a: SharedSyncData, b: SharedSyncData): SharedSyncData;
