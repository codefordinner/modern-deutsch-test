import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

test('analytics events require Telegram auth and are attributed to the learner account', async (t) => {
  const [{ createApp }, { prisma }, { createUserSession, USER_SESSION_COOKIE }] = await Promise.all([
    import('../app'),
    import('../db'),
    import('../services/telegramAuth'),
  ]);
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const anonymousEvent = await fetch(`${base}/api/analytics/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eventType: 'visit' }),
  });
  assert.equal(anonymousEvent.status, 401);

  const user = await prisma.telegramUser.create({ data: { telegramId: `analytics-${Date.now()}` } });
  const sessionToken = await createUserSession(user.id);
  const eventResponse = await fetch(`${base}/api/analytics/event`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `${USER_SESSION_COOKIE}=${sessionToken}`,
    },
    body: JSON.stringify({ eventType: 'quiz_answer', trainerType: 'words', isCorrect: true }),
  });
  assert.equal(eventResponse.status, 200);

  const event = await prisma.analyticsEvent.findFirst({
    where: { learnerId: user.id, eventType: 'quiz_answer' },
  });
  assert.equal(event?.trainerType, 'words');
  assert.equal(event?.isCorrect, true);
  assert.equal(event?.visitorId, null);
});
