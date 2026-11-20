import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  createLoginCode,
  digestChallengeCode,
  telegramUserIdFromInitData,
} from './telegramAuth';

const makeInitData = (botToken: string, authDate: number, user: unknown) => {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'test-query',
    user: JSON.stringify(user),
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
};

test('accepts correctly signed and fresh Mini App initData', () => {
  const now = 1_800_000_000;
  const initData = makeInitData('test-bot-token', now - 20, { id: 987654321 });
  assert.equal(telegramUserIdFromInitData(initData, 'test-bot-token', now), '987654321');
});

test('rejects tampered, expired, future and malformed Mini App initData', () => {
  const now = 1_800_000_000;
  const valid = makeInitData('test-bot-token', now - 10, { id: 987654321 });
  assert.equal(telegramUserIdFromInitData(`${valid}&extra=changed`, 'test-bot-token', now), null);
  assert.equal(telegramUserIdFromInitData(makeInitData('test-bot-token', now - 301, { id: 1 }), 'test-bot-token', now), null);
  assert.equal(telegramUserIdFromInitData(makeInitData('test-bot-token', now + 31, { id: 1 }), 'test-bot-token', now), null);
  assert.equal(telegramUserIdFromInitData('not-init-data', 'test-bot-token', now), null);
});

test('generates six-digit codes including leading zeroes and stores keyed digests', () => {
  process.env.TELEGRAM_AUTH_PEPPER = 'test-only-pepper-with-enough-entropy-0123456789';
  const code = createLoginCode();
  assert.match(code, /^\d{6}$/);
  assert.match(digestChallengeCode(code), /^[a-f0-9]{64}$/);
  assert.notEqual(digestChallengeCode(code), code);
});
