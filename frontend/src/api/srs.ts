import type { SrsSyncData } from '../types';
import { request } from './request';

export const syncSrs = (key: string, data: SrsSyncData) => request<SrsSyncData>('/sync/srs', { method: 'POST', body: { key, ...data } });

export interface LearnerSrsSyncResponse {
  data: SrsSyncData;
  legacyKeyMigrated: boolean;
}

export const syncLearnerSrs = (data: SrsSyncData, legacyKey?: string) =>
  request<LearnerSrsSyncResponse>('/learner-auth/progress/srs', {
    method: 'POST',
    body: { data, ...(legacyKey ? { legacyKey } : {}) },
  });
