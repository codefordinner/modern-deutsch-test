import type { SrsSyncData } from '../types';
import { request } from './request';

export interface LearnerSrsSyncResponse {
  data: SrsSyncData;
}

export const syncLearnerSrs = (data: SrsSyncData) =>
  request<LearnerSrsSyncResponse>('/learner-auth/progress/srs', {
    method: 'POST',
    body: { data },
  });
