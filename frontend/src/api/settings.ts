import { request } from './request';

export interface SrsWeightsResponse { weights: number[]; isDefault: boolean }
export const fetchSrsWeights = () => request<SrsWeightsResponse>('/settings/srs-weights');
export const saveSrsWeights = (weights: number[]) => request<SrsWeightsResponse>('/settings/srs-weights', { method: 'PUT', body: { weights }, auth: true });
export const resetSrsWeights = () => request<SrsWeightsResponse>('/settings/srs-weights', { method: 'DELETE', auth: true });

export interface AudioVoiceResponse { voice: string; isDefault: boolean }
export interface AudioSettings { voice: string; lengthScale: number; noiseScale: number; noiseWScale: number; sentenceSilence: number }
export interface AudioSettingsResponse { settings: AudioSettings; isDefault: boolean }
export const fetchAudioSettings = () => request<AudioSettingsResponse>('/settings/audio-settings');
export const saveAudioSettings = (settings: AudioSettings) => request<AudioSettingsResponse>('/settings/audio-settings', { method: 'PUT', body: { settings }, auth: true });
export const resetAudioSettings = () => request<AudioSettingsResponse>('/settings/audio-settings', { method: 'DELETE', auth: true });
export const fetchAudioVoice = () => request<AudioVoiceResponse>('/settings/audio-voice');
export const saveAudioVoice = (voice: string) => request<AudioVoiceResponse>('/settings/audio-voice', { method: 'PUT', body: { voice }, auth: true });
export const resetAudioVoice = () => request<AudioVoiceResponse>('/settings/audio-voice', { method: 'DELETE', auth: true });

export interface AIModel { name: string; displayName: string; supportedGenerationMethods: string[] }
export interface AIProfile { model: string; prompt: string; severity?: number; batchSize?: number }
export interface AISettingsResponse { provider: 'gemini'; hasApiKey: boolean; isDefault: boolean; profiles: Record<string, AIProfile> }
export interface AICheckResponse { ok: boolean; message: string; settings: AISettingsResponse }
export const fetchAISettings = () => request<AISettingsResponse>('/settings/ai', { auth: true });
export const fetchAIModels = () => request<{ models: AIModel[] }>('/settings/ai/models', { auth: true });
export const saveAISettings = (profileId: string, model: string, apiKey: string | undefined, prompt: string, severity?: number, batchSize?: number) => request<AISettingsResponse>('/settings/ai', { method: 'PUT', body: { profileId, model, prompt, ...(severity === undefined ? {} : { severity }), ...(batchSize === undefined ? {} : { batchSize }), ...(apiKey ? { apiKey } : {}) }, auth: true });
export const checkAISettings = () => request<AICheckResponse & { models: AIModel[] }>('/settings/ai/check', { method: 'POST', auth: true });
export const resetAIPrompt = (profileId: string) => request<AISettingsResponse>(`/settings/ai/profile/${encodeURIComponent(profileId)}`, { method: 'DELETE', auth: true });
export interface AIErrorLog {
  id: string;
  operation: string;
  profileId: string | null;
  model: string | null;
  errorCode: string;
  providerStatus: number | null;
  message: string;
  durationMs: number | null;
  createdAt: string;
}
export const fetchAIErrorLogs = (limit = 100) => request<{ logs: AIErrorLog[] }>(`/settings/ai/logs?limit=${limit}`, { auth: true });
export const clearAIErrorLogs = () => request<{ ok: boolean }>('/settings/ai/logs', { method: 'DELETE', auth: true });
export interface AIQueueItem { id: string; operation: string; profileId?: string; model?: string; status: 'queued' | 'running' | 'completed' | 'failed'; createdAt: string; startedAt?: string; finishedAt?: string; error?: string }
export interface AIQueueSnapshot { items: AIQueueItem[]; active: number; waiting: number; concurrency: number }

export interface WordFillResult { json: string; count: number }
export const fillWordsViaAI = (words: string, categories: string[], defaultCategory?: string) => request<WordFillResult>('/settings/ai/word-fill', { method: 'POST', body: { words, categories, defaultCategory }, auth: true });
