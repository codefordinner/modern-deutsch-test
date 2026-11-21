import { request } from './request';

export type ReminderMode = 'off' | 'incomplete' | 'always';
export interface ReminderPreferences {
  mode: ReminderMode;
  times: string[];
  days: number[];
  timezone: string;
}

export const getReminderPreferences = () => request<ReminderPreferences>('/learner-auth/reminders');
export const saveReminderPreferences = (preferences: ReminderPreferences) =>
  request<ReminderPreferences>('/learner-auth/reminders', { method: 'PUT', body: preferences });
