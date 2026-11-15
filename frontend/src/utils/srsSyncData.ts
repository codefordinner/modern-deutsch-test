import { emptySyncData as emptySharedSyncData, mergeSyncData as mergeSharedSyncData, sanitizeSyncData as sanitizeSharedSyncData, SRS_TRAINERS as SHARED_SRS_TRAINERS, SCORE_TRAINERS as SHARED_SCORE_TRAINERS, MIN_SYNC_KEY_LENGTH as SHARED_MIN_SYNC_KEY_LENGTH, MAX_SYNC_KEY_LENGTH as SHARED_MAX_SYNC_KEY_LENGTH, readSyncKey as readSharedSyncKey } from '@sprachfunke/shared';
import type { SrsSyncData } from '../types';

export const SRS_TRAINERS = SHARED_SRS_TRAINERS;
export const SCORE_TRAINERS = SHARED_SCORE_TRAINERS;
export const MIN_SYNC_KEY_LENGTH = SHARED_MIN_SYNC_KEY_LENGTH;
export const MAX_SYNC_KEY_LENGTH = SHARED_MAX_SYNC_KEY_LENGTH;

export const emptySyncData = (): SrsSyncData => emptySharedSyncData() as SrsSyncData;
export const sanitizeSyncData = (raw: unknown): SrsSyncData => sanitizeSharedSyncData(raw) as SrsSyncData;
export const mergeSyncData = (a: SrsSyncData, b: SrsSyncData): SrsSyncData => mergeSharedSyncData(a, b) as SrsSyncData;
export const readSyncKey = (value: unknown): string | null => readSharedSyncKey(value);
