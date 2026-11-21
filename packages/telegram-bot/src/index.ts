import { handleAuthMessage, type IncomingMessage } from './handlers/auth';

type TelegramUpdate = {
  update_id: number;
  message?: IncomingMessage;
  callback_query?: {
    id: string;
    data?: string;
    from?: { id?: number; is_bot?: boolean };
    message?: { message_id?: number; text?: string; chat?: { id?: number; type?: string } };
  };
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

const sendText = (chatId: number, text: string, replyMarkup?: unknown) =>
  telegramRequest('sendMessage', { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });

const botRequest = async <T>(path: string, body?: unknown): Promise<T> => {
  const response = await fetch(`${backendUrl}/api/internal/telegram/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-telegram-bot-secret': backendSecret,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json() as Promise<T>;
};

const notifyDueReminders = async () => {
  const { reminders } = await botRequest<{ reminders: Array<{ telegramId: string; text: string }> }>('reminders/due');
  for (const reminder of reminders) {
    const chatId = Number(reminder.telegramId);
    if (!Number.isSafeInteger(chatId)) continue;
    try {
      await sendText(chatId, `${reminder.text}\n\nЧерез сколько хотите получить напоминание снова?`, {
        inline_keyboard: [[
          { text: '15 мин', callback_data: 'snooze:15' },
          { text: '1 час', callback_data: 'snooze:60' },
        ]],
      });
    } catch {
      // Keep a blocked or unavailable chat from preventing delivery to other learners.
    }
  }
};

const handleSnooze = async (update: NonNullable<TelegramUpdate['callback_query']>) => {
  const chatId = update.message?.chat?.id;
  const telegramId = update.from?.id;
  const minutes = update.data === 'snooze:15' ? 15 : update.data === 'snooze:60' ? 60 : null;
  if (
    !minutes || typeof chatId !== 'number' || update.message?.chat?.type !== 'private'
    || typeof telegramId !== 'number' || update.from?.is_bot || chatId !== telegramId
  ) return;
  const result = await botRequest<{ success: boolean }>('reminders/snooze', { telegramId: String(telegramId), minutes });
  const confirmation = `✅ Напомним через ${minutes === 15 ? '15 минут' : 'час'}.`;
  if (result.success && typeof update.message?.message_id === 'number') {
    try {
      await telegramRequest('editMessageText', {
        chat_id: chatId,
        message_id: update.message.message_id,
        text: `${update.message.text ?? ''}\n\n${confirmation}`.trim(),
        reply_markup: { inline_keyboard: [] },
      });
    } catch {
      // Still acknowledge the action if Telegram cannot edit the original message.
    }
  }
  await telegramRequest('answerCallbackQuery', {
    callback_query_id: update.id,
    text: result.success ? confirmation : 'Напоминания отключены.',
  });
};

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
        { offset: nextOffset, timeout: longPollTimeoutSeconds, allowed_updates: ['message', 'callback_query'] },
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
        if (update.callback_query) {
          try {
            await handleSnooze(update.callback_query);
          } catch {
            console.error('[telegram-bot] Reminder action failed');
          }
        }
      }
      try {
        await notifyDueReminders();
      } catch {
        console.error('[telegram-bot] Reminder delivery check failed');
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
