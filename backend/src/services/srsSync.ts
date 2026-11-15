import crypto from 'crypto';
import {
  MAX_SYNC_KEY_LENGTH,
  MIN_SYNC_KEY_LENGTH,
  emptySyncData as emptySharedSyncData,
  mergeSyncData as mergeSharedSyncData,
  sanitizeSyncData as sanitizeSharedSyncData,
  SRS_TRAINERS,
  SCORE_TRAINERS,
} from '@sprachfunke/shared';
export { MIN_SYNC_KEY_LENGTH, MAX_SYNC_KEY_LENGTH } from '@sprachfunke/shared';

export const SYNC_TRAINERS = SRS_TRAINERS;
export type SyncTrainer = (typeof SYNC_TRAINERS)[number];
export const SYNC_SCORE_TRAINERS = SCORE_TRAINERS;
export type SyncScoreTrainer = (typeof SYNC_SCORE_TRAINERS)[number];

export interface SyncRecord { box: number; streak: number; mistakes: number; lastReviewed: string; nextReview: string; promotedOn?: string }
export type SyncMap = Record<string, SyncRecord>;
export interface SyncScore { correct: number; total: number; streak: number; bestStreak: number; updatedAt: number }
export interface SyncDaily { day: string; count: number }
export interface SyncData {
  srs: Record<SyncTrainer, SyncMap>;
  resetAt: Record<SyncTrainer, number>;
  settings: { dailyGoal: number; wordsCategories: string[]; articlesCategories: string[]; updatedAt: number };
  scores: Record<SyncScoreTrainer, SyncScore>;
  daily: SyncDaily;
}

export const emptySyncData = (): SyncData => emptySharedSyncData() as SyncData;
export const sanitizeSyncData = (raw: unknown): SyncData => sanitizeSharedSyncData(raw) as SyncData;
export const mergeSyncData = (a: SyncData, b: SyncData): SyncData => mergeSharedSyncData(a, b) as SyncData;

/** The key itself is never stored, only its hash identifies the profile. */
export const hashSyncKey = (key: string): string => crypto.createHash('sha256').update(`deutsch-sync:${key}`).digest('hex');

export function readSyncKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length >= MIN_SYNC_KEY_LENGTH && key.length <= MAX_SYNC_KEY_LENGTH ? key : null;
}
