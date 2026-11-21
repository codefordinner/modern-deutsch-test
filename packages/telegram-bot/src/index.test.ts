import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLoginCode } from './code';
import { handleAuthMessage } from './handlers/auth';

test('extracts only a six-digit one-time code', () => {
  assert.equal(extractLoginCode('004219'), '004219');
  assert.equal(extractLoginCode('/start 004219'), '004219');
  assert.equal(extractLoginCode('/start@sprachfunke_bot 004219'), '004219');
  assert.equal(extractLoginCode(' 004219 '), '004219');
  assert.equal(extractLoginCode('4219'), null);
  assert.equal(extractLoginCode('004219 extra'), null);
});

test('welcomes a new private-chat user instead of treating the first /start as a code', async () => {
  const replies: string[] = [];
  const handled = await handleAuthMessage({
    text: '/start',
    chat: { id: 123, type: 'private' },
    from: { id: 123 },
  }, {
    sendText: async (_chatId, text) => { replies.push(text); },
    confirmCode: async () => false,
  });

  assert.equal(handled, true);
  assert.match(replies[0], /Привет!/);
  assert.match(replies[0], /BlitzDeutsch/);
  assert.match(replies[0], /Рад видеть вас здесь/);
  assert.match(replies[0], /кнопкой BlitzDeutsch в Telegram или через сайт/);
  assert.doesNotMatch(replies[0], /вернитесь на сайт|Чтобы начать/i);
  assert.doesNotMatch(replies[0], /неверн|не найден|истёк/i);
});

test('only confirms codes received in private chat from the message sender', async () => {
  const replies: string[] = [];
  const confirmations: Array<[string, string]> = [];
  const dependencies = {
    sendText: async (_chatId: number, text: string) => { replies.push(text); },
    confirmCode: async (code: string, telegramId: string) => {
      confirmations.push([code, telegramId]);
      return true;
    },
  };

  const ignored = await handleAuthMessage({
    text: '004219',
    chat: { id: -100, type: 'group' },
    from: { id: 123 },
  }, dependencies);
  assert.equal(ignored, false);
  assert.equal(confirmations.length, 0);

  const botSenderIgnored = await handleAuthMessage({
    text: '004219',
    chat: { id: 456, type: 'private' },
    from: { id: 456, is_bot: true },
  }, dependencies);
  assert.equal(botSenderIgnored, false);
  assert.equal(confirmations.length, 0);

  const handled = await handleAuthMessage({
    text: '004219',
    chat: { id: 123, type: 'private' },
    from: { id: 123 },
  }, dependencies);
  assert.equal(handled, true);
  assert.deepEqual(confirmations, [['004219', '123']]);
  assert.match(replies[0], /Вход подтверждён/);
});
