import { request } from './request';

export async function getSpeechAudio(text: string, kind: 'word' | 'sentence' = 'word'): Promise<Blob> {
  const params = new URLSearchParams({ text, kind });
  return request<Blob>(`/audio?${params.toString()}`, { responseType: 'blob' });
}

export interface AudioCacheStats { total: number; words: number; sentences: number }
export const getAudioCacheStats = () => request<AudioCacheStats>('/audio/admin/stats', { auth: true });
export const clearAudioCache = () => request<{ count: number }>('/audio/admin/cache', { method: 'DELETE', auth: true });
export interface AudioRegenerationJob { id: string; status: 'running' | 'completed' | 'failed'; total: number; generated: number; remaining: number; durationMs: number; averageMs: number | null; error: string | null; createdAt: string; updatedAt: string }
export const getAudioRegenerationJob = async () => (await request<{ job: AudioRegenerationJob | null }>('/audio/admin/regenerate-words', { auth: true })).job;
export const regenerateWordAudio = () => request<AudioRegenerationJob>('/audio/admin/regenerate-words', { method: 'POST', auth: true });

export const previewAudioSettings = (text: string, settings: import('./settings').AudioSettings) =>
  request<Blob>('/audio/admin/preview', { method: 'POST', body: { text, settings }, auth: true, responseType: 'blob' });
