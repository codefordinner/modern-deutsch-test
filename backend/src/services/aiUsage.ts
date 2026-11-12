import { prisma } from '../db';

/**
 * Server-side guard against runaway Gemini spend: `/pictures/:id/check-answer` is
 * public and each call bills the provider. A per-IP rate limit alone can be
 * bypassed by rotating IPs, so on top of that we cap the TOTAL number of checks
 * per calendar day (server's local day). The counter lives in the `Setting` table
 * so it survives restarts; it is best-effort (two concurrent requests may both slip
 * through), which is fine for a spending guard, not accounting.
 */

const COUNTER_KEY = 'aiDailyUsage';
const configuredDailyCap = Number(process.env.AI_DAILY_CHECK_CAP ?? 500);
const GLOBAL_DAILY_CAP = Number.isFinite(configuredDailyCap) && configuredDailyCap > 0
  ? Math.floor(configuredDailyCap)
  : 500;
const DAY_MS = 24 * 60 * 60 * 1000;

const localDay = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

async function readCounter(): Promise<{ day: string; count: number }> {
  const row = await prisma.setting.findUnique({ where: { key: COUNTER_KEY } });
  if (!row) return { day: localDay(new Date()), count: 0 };
  try {
    const parsed = JSON.parse(row.value) as { day?: unknown; count?: unknown };
    const day = typeof parsed.day === 'string' ? parsed.day : localDay(new Date());
    const count = typeof parsed.count === 'number' && Number.isFinite(parsed.count) && parsed.count >= 0 ? parsed.count : 0;
    return { day, count };
  } catch {
    return { day: localDay(new Date()), count: 0 };
  }
}

/**
 * Registers one paid AI check. Returns `{ allowed: false }` when the global daily
 * cap is reached; otherwise increments the counter and returns `{ allowed: true }`.
 */
export async function registerAiUsage(): Promise<{ allowed: boolean }> {
  const today = localDay(new Date());
  const current = await readCounter();
  const count = current.day === today ? current.count + 1 : 1;
  if (count > GLOBAL_DAILY_CAP) return { allowed: false };
  await prisma.setting.upsert({
    where: { key: COUNTER_KEY },
    create: { key: COUNTER_KEY, value: JSON.stringify({ day: today, count }) },
    update: { value: JSON.stringify({ day: today, count }) },
  });
  return { allowed: true };
}

/** How many checks happened today and the cap (for the admin panel / diagnostics). */
export async function readAiUsage(): Promise<{ day: string; count: number; cap: number }> {
  const current = await readCounter();
  return { day: current.day, count: current.day === localDay(new Date()) ? current.count : 0, cap: GLOBAL_DAILY_CAP };
}
