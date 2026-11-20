import { emptySyncData as emptySharedSyncData, mergeSyncData as mergeSharedSyncData, sanitizeSyncData as sanitizeSharedSyncData, SRS_TRAINERS as SHARED_SRS_TRAINERS, SCORE_TRAINERS as SHARED_SCORE_TRAINERS } from '@sprachfunke/shared';
import type { SrsSyncData } from '../types';

export const SRS_TRAINERS = SHARED_SRS_TRAINERS;
export const SCORE_TRAINERS = SHARED_SCORE_TRAINERS;
export const emptySyncData = (): SrsSyncData => emptySharedSyncData() as SrsSyncData;
export const sanitizeSyncData = (raw: unknown): SrsSyncData => sanitizeSharedSyncData(raw) as SrsSyncData;
export const mergeSyncData = (a: SrsSyncData, b: SrsSyncData): SrsSyncData => mergeSharedSyncData(a, b) as SrsSyncData;
