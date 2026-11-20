import { prisma } from '../db';

const [telegramId, action] = process.argv.slice(2);

if (!telegramId || !/^\d{1,20}$/.test(telegramId) || !['grant', 'revoke'].includes(action ?? '')) {
  console.error('Использование: npm run admin:set -- <telegramId> <grant|revoke>');
  process.exitCode = 1;
} else {
  const isAdmin = action === 'grant';
  void (async () => {
    try {
      const user = await prisma.telegramUser.upsert({
        where: { telegramId },
        create: { telegramId, isAdmin },
        update: { isAdmin },
        select: { telegramId: true, isAdmin: true },
      });
      console.log(`Права администратора ${isAdmin ? 'выданы' : 'сняты'} для Telegram ID ${user.telegramId}.`);
    } catch (error) {
      console.error('Не удалось изменить права администратора.', error);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  })();
}
