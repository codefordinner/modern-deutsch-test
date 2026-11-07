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
