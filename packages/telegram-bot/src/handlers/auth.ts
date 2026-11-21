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
  const command = text.match(/^\/(start|help)(?:@\w+)?(?:\s+(.*))?$/);
  if (command && !command[2]) {
    await sendText(
      chatId,
      command[1] === 'start'
        ? 'Привет! Я бот BlitzDeutsch. Рад видеть вас здесь!\n\nВойти можно кнопкой BlitzDeutsch в Telegram или через сайт. Если вы открыли меня по ссылке для входа, подтверждение произойдёт автоматически. Если у вас есть шестизначный код, отправьте его сюда.'
        : 'Для входа в BlitzDeutsch запросите шестизначный код на сайте и отправьте его сюда. Если вы открыли бота по ссылке с сайта, код подтвердится автоматически.',
    );
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
