import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReminderPreferences, zonedReminderTime } from './reminders';

test('reminder preferences validate and normalize the schedule', () => {
    assert.deepEqual(normalizeReminderPreferences({
      mode: 'always',
      times: ['18:00', '09:15', '18:00'],
      days: [1, 0, 1],
      timezone: 'Europe/Berlin',
    }), {
      mode: 'always',
      times: ['09:15', '18:00'],
      days: [0, 1],
      timezone: 'Europe/Berlin',
    });
});

test('reminder preferences reject invalid time, day and time zone values', () => {
    assert.equal(normalizeReminderPreferences({
      mode: 'always', times: ['24:00'], days: [1], timezone: 'UTC',
    }), null);
    assert.equal(normalizeReminderPreferences({
      mode: 'always', times: ['09:00'], days: [7], timezone: 'UTC',
    }), null);
    assert.equal(normalizeReminderPreferences({
      mode: 'always', times: ['09:00'], days: [1], timezone: 'Not/AZone',
    }), null);
});

test('zonedReminderTime uses the learner timezone, including day boundaries', () => {
    assert.deepEqual(zonedReminderTime(new Date('2026-01-04T23:30:00.000Z'), 'Europe/Berlin'), {
      date: '2026-01-05',
      minute: '00:30',
      day: 1,
    });
});

test('takeDueReminders honors completed goals and sends each schedule slot once', async (t) => {
  const { prisma } = await import('../db');
  const suffix = `${Date.now()}-${Math.random()}`;
  const completedUser = await prisma.telegramUser.create({
    data: { telegramId: `reminder-complete-${suffix}` },
  });
  const noGoalUser = await prisma.telegramUser.create({
    data: { telegramId: `reminder-no-goal-${suffix}` },
  });
  t.after(async () => {
    await prisma.telegramUser.deleteMany({ where: { id: { in: [completedUser.id, noGoalUser.id] } } });
    await prisma.$disconnect();
  });
  const sharedProgress = (dailyGoal: number, count: number) => JSON.stringify({
    settings: { dailyGoal },
    daily: { day: '2026-01-04', count },
  });
  await prisma.learnerProgress.createMany({
    data: [
      { userId: completedUser.id, data: sharedProgress(5, 5) },
      { userId: noGoalUser.id, data: sharedProgress(0, 0) },
    ],
  });
  await prisma.reminderSettings.createMany({
    data: [completedUser, noGoalUser].map(({ id }) => ({
      userId: id,
      mode: 'incomplete',
      times: '["09:00"]',
      days: '[0,1,2,3,4,5,6]',
      timezone: 'UTC',
    })),
  });

  const now = new Date('2026-01-04T09:00:00.000Z');
  const first = await (await import('./reminders')).takeDueReminders(now);
  assert.deepEqual(first.map(({ telegramId }) => telegramId), [noGoalUser.telegramId]);
  assert.deepEqual(await (await import('./reminders')).takeDueReminders(now), []);
});
