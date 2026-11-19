import { extractLoginCode } from '../code';

export interface IncomingMessage {
  text?: string;
  chat?: { id?: number; type?: string };
  from?: { id?: number; is_bot?: boolean };
}

export interface AuthHandlerDependencies {
  sendText(chatId: number, text: string): Promise<unknown>;
  confirmCode(code: string, telegramId: string): Promise<boolean>;
}

export async function handleAuthMessage(
  message: IncomingMessage,
  { sendText, confirmCode }: AuthHandlerDependencies,
): Promise<boolean> {
  const chatId = message.chat?.id;
  if (typeof chatId !== 'number' || message.chat?.type !== 'private') return false;
  if (typeof message.from?.id !== 'number' || message.from.is_bot || message.from.id !== chatId) return false;

  const text = message.text?.trim() ?? '';
  if (text === '/start' || text === '/help') {
    await sendText(chatId, 'Чтобы войти, запросите код на сайте и отправьте его сюда одним сообщением.');
    return true;
  }
  const code = extractLoginCode(text);
  if (!code) {
    await sendText(chatId, 'Отправьте шестизначный код, показанный на сайте.');
    return true;
  }

  try {
    const confirmed = await confirmCode(code, String(message.from.id));
    await sendText(
      chatId,
      confirmed
        ? 'Вход подтверждён. Вернитесь на сайт — он завершит вход автоматически.'
        : 'Код не найден или срок его действия истёк. Запросите новый код на сайте.',
    );
  } catch {
    await sendText(chatId, 'Сервис временно недоступен. Попробуйте ещё раз чуть позже.');
  }
  return true;
}
