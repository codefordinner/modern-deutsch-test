import { request } from './request';

export interface AdminUser {
  id: string;
  telegramId: string;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
  progressUpdatedAt: string | null;
  hasProgress: boolean;
}

export interface LearnerProgressSnapshot {
  revision: number;
  updatedAt: string;
  data: {
    srs?: Record<string, Record<string, unknown>>;
    scores?: Record<string, { correct?: number; total?: number; streak?: number; bestStreak?: number }>;
    daily?: { day?: string; count?: number };
    settings?: { dailyGoal?: number; wordsCategories?: string[]; articlesCategories?: string[] };
    onboardingSeen?: boolean;
  } | null;
}

export const getAdminUsers = async () => (await request<{ users: AdminUser[] }>('/users', { auth: true })).users;
export const getAdminUserProgress = async (id: string) =>
  (await request<{ progress: LearnerProgressSnapshot | null }>(`/users/${encodeURIComponent(id)}/progress`, { auth: true })).progress;
export const setUserAdmin = (id: string, isAdmin: boolean) =>
  request<{ success: boolean }>(`/users/${encodeURIComponent(id)}/admin`, { method: 'PATCH', body: { isAdmin }, auth: true });
export const setUserBanned = (id: string, isBanned: boolean) =>
  request<{ success: boolean }>(`/users/${encodeURIComponent(id)}/ban`, { method: 'PATCH', body: { isBanned }, auth: true });
export const resetUserProgress = (id: string) =>
  request<{ success: boolean; deleted: number }>(`/users/${encodeURIComponent(id)}/progress`, { method: 'DELETE', auth: true });
export const deleteAdminUser = (id: string) =>
  request<{ success: boolean }>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
