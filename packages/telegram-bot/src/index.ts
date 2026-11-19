import { handleAuthMessage, type IncomingMessage } from './handlers/auth';

type TelegramUpdate = {
  update_id: number;
  message?: IncomingMessage;
};

const token = process.env.TELEGRAM_BOT_TOKEN;
const backendUrl = (process.env.BACKEND_URL || 'http://app-backend:3001').replace(/\/+$/, '');
const backendSecret = process.env.TELEGRAM_BOT_API_SECRET;
if (!token || !backendSecret || Buffer.byteLength(backendSecret) < 32) {
  throw new Error('Bot runtime secrets are not configured or are too short');
}

const apiUrl = `https://api.telegram.org/bot${token}`;
let stopping = false;
let nextOffset = 0;
let retryDelayMs = 1_000;
const longPollTimeoutSeconds = 5;

const telegramRequest = async <T>(method: string, body: unknown, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${apiUrl}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Telegram API returned ${response.status}`);
  const result = await response.json() as { ok?: boolean; result?: T };
  if (!result.ok) throw new Error('Telegram API request failed');
  return result.result as T;
};

const sendText = (chatId: number, text: string) =>
  telegramRequest('sendMessage', { chat_id: chatId, text });

const confirmCode = async (code: string, telegramId: string) => {
  const response = await fetch(`${backendUrl}/api/internal/telegram/confirm`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-secret': backendSecret,
    },
    body: JSON.stringify({
      code,
      telegramId,
      chatType: 'private',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
};

const poll = async () => {
  while (!stopping) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), (longPollTimeoutSeconds + 10) * 1_000);
    try {
      const updates = await telegramRequest<TelegramUpdate[]>(
        'getUpdates',
        { offset: nextOffset, timeout: longPollTimeoutSeconds, allowed_updates: ['message'] },
        controller.signal,
      );
      retryDelayMs = 1_000;
      for (const update of updates) {
        nextOffset = update.update_id + 1;
        if (update.message) {
          try {
            await handleAuthMessage(update.message, { sendText, confirmCode });
          } catch {
            // Never log message content, Telegram IDs, tokens, or backend secrets.
            console.error('[telegram-bot] Message handling failed');
          }
        }
      }
    } catch {
      if (stopping) break;
      console.error('[telegram-bot] Poll failed; retrying');
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
    } finally {
      clearTimeout(timeout);
    }
  }
};

process.once('SIGTERM', () => { stopping = true; });
process.once('SIGINT', () => { stopping = true; });

console.log('[telegram-bot] Long polling started');
void poll();
