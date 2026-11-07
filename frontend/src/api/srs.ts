import type { SrsSyncData } from '../types';
import { request } from './request';

export const syncSrs = (key: string, data: SrsSyncData) => request<SrsSyncData>('/sync/srs', { method: 'POST', body: { key, ...data } });
