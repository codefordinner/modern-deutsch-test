import { prisma } from '../db';

export type ReminderMode = 'off' | 'incomplete' | 'always';
export interface ReminderPreferences {
  mode: ReminderMode;
  times: string[];
  days: number[];
  timezone: string;
}

const DEFAULT_PREFERENCES: ReminderPreferences = {
  mode: 'off',
  times: ['09:00'],
  days: [0, 1, 2, 3, 4, 5, 6],
  timezone: 'UTC',
};

const isTime = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export function normalizeReminderPreferences(raw: unknown): ReminderPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const mode = value.mode;
  const times = value.times;
  const days = value.days;
  const timezone = value.timezone;
  if (!['off', 'incomplete', 'always'].includes(String(mode))) return null;
  if (!Array.isArray(times) || times.length > 8 || !times.every(isTime)) return null;
  if (!Array.isArray(days) || days.length > 7 || !days.every((day) =>
    Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6,
  )) return null;
  if (typeof timezone !== 'string' || timezone.length > 100) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    return null;
  }
  return {
    mode: mode as ReminderMode,
    times: [...new Set(times as string[])].sort(),
    days: [...new Set(days as number[])].sort((a, b) => a - b),
    timezone,
  };
}

export async function getReminderPreferences(userId: string): Promise<ReminderPreferences> {
  const row = await prisma.reminderSettings.findUnique({ where: { userId } });
  if (!row) return DEFAULT_PREFERENCES;
  try {
    return normalizeReminderPreferences({
      mode: row.mode,
      times: JSON.parse(row.times),
      days: JSON.parse(row.days),
      timezone: row.timezone,
    }) ?? DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function saveReminderPreferences(userId: string, raw: unknown) {
  const preferences = normalizeReminderPreferences(raw);
  if (!preferences) throw new Error('Некорректные настройки напоминаний.');
  await prisma.reminderSettings.upsert({
    where: { userId },
    create: {
      userId,
      mode: preferences.mode,
      times: JSON.stringify(preferences.times),
      days: JSON.stringify(preferences.days),
      timezone: preferences.timezone,
      lastSentSlot: null,
      snoozeUntil: null,
    },
    update: {
      mode: preferences.mode,
      times: JSON.stringify(preferences.times),
      days: JSON.stringify(preferences.days),
      timezone: preferences.timezone,
      lastSentSlot: null,
      snoozeUntil: null,
    },
  });
  return preferences;
}

export const zonedReminderTime = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minute: `${values.hour}:${values.minute}`,
    day: weekdays.indexOf(values.weekday),
  };
};

function syncedDailyProgress(raw: string | undefined, localDay: string) {
  if (!raw) return { count: 0, goal: 0 };
  try {
    const data = JSON.parse(raw) as {
      settings?: { dailyGoal?: number };
      daily?: { day?: string; count?: number };
    };
    return {
      count: data.daily?.day === localDay && Number.isFinite(data.daily.count) ? Number(data.daily.count) : 0,
      goal: Number.isFinite(data.settings?.dailyGoal) ? Number(data.settings?.dailyGoal) : 0,
    };
  } catch {
    return { count: 0, goal: 0 };
  }
}

export async function takeDueReminders(now = new Date()) {
  const rows = await prisma.reminderSettings.findMany({
    where: { mode: { not: 'off' } },
    include: {
      user: {
        select: {
          telegramId: true,
          progress: { select: { data: true } },
        },
      },
    },
  });
  const due: Array<{ telegramId: string; text: string }> = [];
  for (const row of rows) {
    let prefs = DEFAULT_PREFERENCES;
    try {
      prefs = normalizeReminderPreferences({
        mode: row.mode,
        times: JSON.parse(row.times),
        days: JSON.parse(row.days),
        timezone: row.timezone,
      }) ?? DEFAULT_PREFERENCES;
    } catch {
      // Corrupted stored settings are treated as disabled defaults.
    }
    const local = zonedReminderTime(now, prefs.timezone);
    const snoozeDue = row.snoozeUntil && row.snoozeUntil <= now;
    const scheduledTime = prefs.days.includes(local.day) && prefs.times.includes(local.minute);
    if (!snoozeDue && !scheduledTime) continue;
    const slot = snoozeDue
      ? `snooze:${row.snoozeUntil!.toISOString()}`
      : `${local.date}:${local.minute}`;
    if (row.lastSentSlot === slot) continue;
    const progress = syncedDailyProgress(row.user.progress?.data, local.date);
    if (prefs.mode === 'incomplete' && !snoozeDue && progress.goal > 0 && progress.count >= progress.goal) continue;
    const update = await prisma.reminderSettings.updateMany({
      where: {
        userId: row.userId,
        lastSentSlot: row.lastSentSlot,
        ...(snoozeDue ? { snoozeUntil: row.snoozeUntil } : {}),
      },
      data: { lastSentSlot: slot, ...(snoozeDue ? { snoozeUntil: null } : {}) },
    });
    if (update.count !== 1) continue;
    due.push({
      telegramId: row.user.telegramId,
      text: prefs.mode === 'incomplete' && progress.goal > 0
        ? `Пора позаниматься немецким! Цель на сегодня: ${progress.count} из ${progress.goal} ответов.`
        : 'Пора позаниматься немецким! Открой BlitzDeutsch и продолжай обучение.',
    });
  }
  return due;
}

export async function snoozeReminder(telegramId: string, minutes: 15 | 60) {
  const user = await prisma.telegramUser.findUnique({
    where: { telegramId },
    select: { id: true, reminderSettings: { select: { mode: true } } },
  });
  if (!user?.reminderSettings || user.reminderSettings.mode === 'off') return false;
  await prisma.reminderSettings.update({
    where: { userId: user.id },
    data: { snoozeUntil: new Date(Date.now() + minutes * 60_000) },
  });
  return true;
}
