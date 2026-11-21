import { request } from './request';

export interface TelegramChallenge {
  code: string;
  expiresAt: string;
  botUrl: string;
  botUsername: string;
}

export interface TelegramChallengeStatus {
  status: 'pending' | 'confirmed';
  expiresAt: string;
}

export interface LearnerSession {
  authenticated: true;
  user: { id: string; isAdmin: boolean };
}

const basePath = '/learner-auth';

export const getLearnerAuthConfig = () =>
  request<{ required: boolean; botUrl?: string | null }>(`${basePath}/config`);
export const getLearnerSession = () => request<LearnerSession>(`${basePath}/me`);
export const loginWithMiniApp = (initData: string) =>
  request<LearnerSession>(`${basePath}/telegram/mini-app`, { method: 'POST', body: { initData } });
export const requestTelegramChallenge = () =>
  request<TelegramChallenge>(`${basePath}/telegram/challenge`, { method: 'POST', body: {}, timeoutMs: 15_000 });
export const getTelegramChallengeStatus = () =>
  request<TelegramChallengeStatus>(`${basePath}/telegram/challenge/status`);
export const completeTelegramChallenge = () =>
  request<LearnerSession>(`${basePath}/telegram/challenge/complete`, { method: 'POST', body: {} });
export const logoutLearner = () => request<{ success: boolean }>(`${basePath}/logout`, { method: 'POST' });
