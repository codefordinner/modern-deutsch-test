import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

/**
 * SQLite допускает одного писателя. Чтобы запросы не падали с
 * "Operations timed out", даём им время подождать (socket_timeout / pool_timeout)
 * и работаем через одно соединение (connection_limit=1) — тогда PRAGMA ниже
 * действуют на все запросы. Параметры из DATABASE_URL имеют приоритет.
 */
function withSqliteParams(url: string): string {
  if (!url.startsWith('file:')) return url;
  const [base, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  if (!params.has('connection_limit')) params.set('connection_limit', '1');
  if (!params.has('socket_timeout')) params.set('socket_timeout', '120');
  if (!params.has('pool_timeout')) params.set('pool_timeout', '120');
  return `${base}?${params.toString()}`;
}

export const prisma = new PrismaClient({ datasourceUrl: withSqliteParams(process.env.DATABASE_URL) });

/**
 * WAL: читатели не блокируют писателя и наоборот (раньше чтение WAV-blob'ов
 * блокировало запись и наоборот). Режим WAL сохраняется в самом файле БД.
 * Вызывайте один раз при старте.
 */
export async function tuneSqlite(): Promise<void> {
  if (!(process.env.DATABASE_URL ?? '').startsWith('file:')) return;
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 60000');
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
}
