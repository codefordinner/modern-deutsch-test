import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';

const headerOrigin = (origin: string) => ({ Origin: origin });
const cookieValue = (header: string | null, name: string): string => {
  const match = header?.match(new RegExp(`(?:^|,\\s*)${name}=([^;,]*)`));
  assert.ok(match, `expected ${name} cookie`);
  return match[1];
};

const getInitData = (botToken: string, userId: number) => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'integration-test',
    user: JSON.stringify({ id: userId }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
};

test('Telegram challenge is browser-bound, one-use, and sessions can be revoked', async (t) => {
  const [{ createApp }, { prisma }] = await Promise.all([
    import('../app'),
    import('../db'),
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
  const authConfig = await fetch(`${base}/api/learner-auth/config`);
  assert.deepEqual(await authConfig.json(), { required: true });

  const previousCookieSecure = process.env.TELEGRAM_COOKIE_SECURE;
  process.env.TELEGRAM_COOKIE_SECURE = 'true';
  let issueResponse: Response;
  try {
    issueResponse = await fetch(`${base}/api/learner-auth/telegram/challenge`, {
      method: 'POST',
      headers: { ...headerOrigin(base), 'content-type': 'application/json' },
      body: '{}',
    });
  } finally {
    if (previousCookieSecure === undefined) delete process.env.TELEGRAM_COOKIE_SECURE;
    else process.env.TELEGRAM_COOKIE_SECURE = previousCookieSecure;
  }
  assert.equal(issueResponse.status, 200);
  assert.match(issueResponse.headers.get('set-cookie') ?? '', /SameSite=None/i);
  assert.match(issueResponse.headers.get('set-cookie') ?? '', /;\s*Secure/i);
  assert.match(issueResponse.headers.get('set-cookie') ?? '', /;\s*Partitioned/i);
  const issue = await issueResponse.json() as { code: string; botUrl: string };
  assert.match(issue.code, /^\d{6}$/);
  assert.equal(issue.botUrl, 'https://t.me/test_sprachfunke_bot');
  const browserCookie = `telegram_challenge=${cookieValue(issueResponse.headers.get('set-cookie'), 'telegram_challenge')}`;
  const unrelatedCookie = 'telegram_challenge=unrelated-browser-binding';

  const wrongBrowserStatus = await fetch(`${base}/api/learner-auth/telegram/challenge/status`, {
    headers: { Cookie: unrelatedCookie },
  });
  assert.equal(wrongBrowserStatus.status, 410);

  const missingSecret = await fetch(`${base}/api/internal/telegram/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: issue.code, telegramId: '700000001', chatType: 'private' }),
  });
  assert.equal(missingSecret.status, 401);

  const groupAttempt = await fetch(`${base}/api/internal/telegram/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-secret': process.env.TELEGRAM_BOT_API_SECRET! },
    body: JSON.stringify({ code: issue.code, telegramId: '700000001', chatType: 'group' }),
  });
  assert.equal(groupAttempt.status, 400);

  const wrongCode = await fetch(`${base}/api/internal/telegram/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-secret': process.env.TELEGRAM_BOT_API_SECRET! },
    body: JSON.stringify({ code: '999999', telegramId: '700000001', chatType: 'private' }),
  });
  assert.equal(wrongCode.status, 404);

  const confirmResponse = await fetch(`${base}/api/internal/telegram/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-secret': process.env.TELEGRAM_BOT_API_SECRET! },
    body: JSON.stringify({ code: issue.code, telegramId: '700000001', chatType: 'private' }),
  });
  assert.equal(confirmResponse.status, 200);
  const repeatedConfirmation = await fetch(`${base}/api/internal/telegram/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-secret': process.env.TELEGRAM_BOT_API_SECRET! },
    body: JSON.stringify({ code: issue.code, telegramId: '700000001', chatType: 'private' }),
  });
  assert.equal(repeatedConfirmation.status, 404);

  const wrongBrowserComplete = await fetch(`${base}/api/learner-auth/telegram/challenge/complete`, {
    method: 'POST',
    headers: { ...headerOrigin(base), Cookie: unrelatedCookie, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(wrongBrowserComplete.status, 409);

  const statusResponse = await fetch(`${base}/api/learner-auth/telegram/challenge/status`, {
    headers: { Cookie: browserCookie },
  });
  assert.equal(statusResponse.status, 200);
  const statusData = await statusResponse.json() as { status: string; expiresAt: string };
  assert.equal(statusData.status, 'confirmed');
  assert.ok(Date.parse(statusData.expiresAt) > Date.now());

  const complete = () => fetch(`${base}/api/learner-auth/telegram/challenge/complete`, {
    method: 'POST',
    headers: { ...headerOrigin(base), Cookie: browserCookie, 'content-type': 'application/json' },
    body: '{}',
  });
  const completionResponses = await Promise.all([complete(), complete()]);
  assert.deepEqual(completionResponses.map((response) => response.status).sort(), [200, 409]);
  const successfulResponse = completionResponses.find((response) => response.status === 200);
  assert.ok(successfulResponse);
  const completionBody = await successfulResponse.json() as { authenticated: boolean; user: { id: string } };
  assert.equal(completionBody.authenticated, true);
  assert.equal(typeof completionBody.user.id, 'string');
  const sessionCookie = `learner_session=${cookieValue(successfulResponse.headers.get('set-cookie'), 'learner_session')}`;

  const meResponse = await fetch(`${base}/api/learner-auth/me`, { headers: { Cookie: sessionCookie } });
  assert.equal(meResponse.status, 200);

  const logoutResponse = await fetch(`${base}/api/learner-auth/logout`, {
    method: 'POST',
    headers: { ...headerOrigin(base), Cookie: sessionCookie, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(logoutResponse.status, 200);
  const afterLogout = await fetch(`${base}/api/learner-auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(afterLogout.status, 401);
});

test('valid Mini App initData creates an HttpOnly user session', async (t) => {
  const [{ createApp }, { prisma }] = await Promise.all([
    import('../app'),
    import('../db'),
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
  const response = await fetch(`${base}/api/learner-auth/telegram/mini-app`, {
    method: 'POST',
    headers: { ...headerOrigin(base), 'content-type': 'application/json' },
    body: JSON.stringify({ initData: getInitData(process.env.TELEGRAM_BOT_TOKEN!, 700000002) }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') || '', /learner_session=.*HttpOnly/i);
  const body = await response.json() as { authenticated: boolean; user: { id: string } };
  assert.equal(body.authenticated, true);
  assert.equal(typeof body.user.id, 'string');
  assert.deepEqual(Object.keys(body).sort(), ['authenticated', 'user']);
  assert.equal(JSON.stringify(body).includes(process.env.TELEGRAM_BOT_TOKEN!), false);
});

test('expired browser challenges cannot be confirmed or completed', async (t) => {
  const [{ createApp }, { prisma }, { digestChallengeCode }] = await Promise.all([
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
  const issueResponse = await fetch(`${base}/api/learner-auth/telegram/challenge`, {
    method: 'POST',
    headers: { ...headerOrigin(base), 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(issueResponse.status, 200);
  const { code } = await issueResponse.json() as { code: string };
  const browserCookie = `telegram_challenge=${cookieValue(issueResponse.headers.get('set-cookie'), 'telegram_challenge')}`;
  await prisma.telegramChallenge.update({
    where: { codeDigest: digestChallengeCode(code) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  const confirmResponse = await fetch(`${base}/api/internal/telegram/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-secret': process.env.TELEGRAM_BOT_API_SECRET! },
    body: JSON.stringify({ code, telegramId: '700000003', chatType: 'private' }),
  });
  assert.equal(confirmResponse.status, 404);
  const statusResponse = await fetch(`${base}/api/learner-auth/telegram/challenge/status`, {
    headers: { Cookie: browserCookie },
  });
  assert.equal(statusResponse.status, 410);
  const completeResponse = await fetch(`${base}/api/learner-auth/telegram/challenge/complete`, {
    method: 'POST',
    headers: { ...headerOrigin(base), Cookie: browserCookie, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(completeResponse.status, 409);
});

test('learner progress is stored on the Telegram account and imports a legacy sync profile once', async (t) => {
  const [{ createApp }, { prisma }, { emptySyncData, hashSyncKey }] = await Promise.all([
    import('../app'),
    import('../db'),
    import('../services/srsSync'),
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
  const legacyKey = 'legacy-progress-key';
  const legacyData = emptySyncData();
  legacyData.srs.words.legacyCard = {
    box: 3,
    streak: 2,
    mistakes: 1,
    lastReviewed: '2026-06-01T12:00:00.000Z',
    nextReview: '2026-06-04T12:00:00.000Z',
  };
  await prisma.syncProfile.create({
    data: { keyHash: hashSyncKey(legacyKey), data: JSON.stringify(legacyData) },
  });

  const login = async (telegramId: number) => {
    const response = await fetch(`${base}/api/learner-auth/telegram/mini-app`, {
      method: 'POST',
      headers: { ...headerOrigin(base), 'content-type': 'application/json' },
      body: JSON.stringify({ initData: getInitData(process.env.TELEGRAM_BOT_TOKEN!, telegramId) }),
    });
    assert.equal(response.status, 200);
    return `learner_session=${cookieValue(response.headers.get('set-cookie'), 'learner_session')}`;
  };

  const firstCookie = await login(700000004);
  const firstResponse = await fetch(`${base}/api/learner-auth/progress/srs`, {
    method: 'POST',
    headers: { ...headerOrigin(base), Cookie: firstCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ data: emptySyncData(), legacyKey }),
  });
  assert.equal(firstResponse.status, 200);
  const firstBody = await firstResponse.json() as {
    data: { srs: { words: Record<string, unknown> } };
    legacyKeyMigrated: boolean;
  };
  assert.equal(firstBody.legacyKeyMigrated, true);
  assert.ok(firstBody.data.srs.words.legacyCard);

  const learner = await prisma.telegramUser.findUniqueOrThrow({
    where: { telegramId: '700000004' },
    include: { progress: true },
  });
  assert.equal(learner.progress?.legacyKeyHash, hashSyncKey(legacyKey));
  assert.equal(learner.progress?.data.includes(legacyKey), false);

  const secondCookie = await login(700000005);
  const secondResponse = await fetch(`${base}/api/learner-auth/progress/srs`, {
    method: 'POST',
    headers: { ...headerOrigin(base), Cookie: secondCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ data: emptySyncData(), legacyKey }),
  });
  assert.equal(secondResponse.status, 409);

  const unauthenticated = await fetch(`${base}/api/learner-auth/progress/srs`, {
    method: 'POST',
    headers: { ...headerOrigin(base), 'content-type': 'application/json' },
    body: JSON.stringify({ data: emptySyncData() }),
  });
  assert.equal(unauthenticated.status, 401);
});
