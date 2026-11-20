import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

const originHeaders = (base: string) => ({ Origin: base, 'content-type': 'application/json' });

test('admin user management lists accounts, exposes progress, and blocks/revokes a learner session', async (t) => {
  const [{ createApp }, { prisma }, { createUserSession }] = await Promise.all([
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
  const admin = await prisma.telegramUser.create({ data: { telegramId: 'users-admin', isAdmin: true } });
  const learner = await prisma.telegramUser.create({ data: { telegramId: 'users-learner' } });
  await prisma.learnerProgress.create({ data: { userId: learner.id, data: JSON.stringify({ onboardingSeen: true }) } });
  const adminToken = await createUserSession(admin.id);
  const learnerToken = await createUserSession(learner.id);
  const adminCookie = `learner_session=${adminToken}`;
  const learnerCookie = `learner_session=${learnerToken}`;

  const listed = await fetch(`${base}/api/users`, { headers: { Cookie: adminCookie } });
  assert.equal(listed.status, 200);
  const body = await listed.json() as { users: Array<{ id: string; telegramId: string; hasProgress: boolean }> };
  assert.ok(body.users.some((user) => user.id === learner.id && user.telegramId === learner.telegramId && user.hasProgress));

  const snapshot = await fetch(`${base}/api/users/${learner.id}/progress`, { headers: { Cookie: adminCookie } });
  assert.equal(snapshot.status, 200);
  assert.deepEqual((await snapshot.json() as { progress: { data: { onboardingSeen: boolean } } }).progress.data, { onboardingSeen: true });

  const banned = await fetch(`${base}/api/users/${learner.id}/ban`, {
    method: 'PATCH', headers: { ...originHeaders(base), Cookie: adminCookie }, body: JSON.stringify({ isBanned: true }),
  });
  assert.equal(banned.status, 200);
  const denied = await fetch(`${base}/api/learner-auth/me`, { headers: { Cookie: learnerCookie } });
  assert.equal(denied.status, 401);
});
