import type { AnalyticsStats } from '../types';
import { ApiError, request } from './request';

export function trackEvent(eventType: string, trainerType?: string, isCorrect?: boolean): void {
  request('/analytics/event', { method: 'POST', body: { eventType, trainerType, isCorrect } }).catch(() => {});
}

export async function getStats(days = 30): Promise<AnalyticsStats> {
  const data = await request<Partial<AnalyticsStats>>(`/analytics/stats?days=${days}`, { auth: true });
  if (
    typeof data.totals !== 'object' || data.totals === null || !Array.isArray(data.daily) ||
    !Array.isArray(data.weekly) || !Array.isArray(data.hourly) || !Array.isArray(data.weekdays) || !Array.isArray(data.heatmap)
  ) throw new ApiError('Сервер вернул статистику в неожиданном формате', 200);
  return data as AnalyticsStats;
}
