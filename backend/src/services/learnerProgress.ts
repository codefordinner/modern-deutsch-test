import {
  emptySyncData,
  mergeSyncData,
  sanitizeSyncData,
  type SyncData,
} from './srsSync';

type ProgressStore = {
  learnerProgress: {
    findUnique: (args: { where: { userId: string } }) => Promise<{
      data: string;
      revision: number;
    } | null>;
    create: (args: { data: { userId: string; data: string; revision: number } }) => Promise<unknown>;
    updateMany: (args: {
      where: { userId: string; revision: number };
      data: { data: string; revision: { increment: number } };
    }) => Promise<{ count: number }>;
  };
};

const parseStoredData = (raw: string | null | undefined): SyncData => {
  if (!raw) return emptySyncData();
  try {
    return sanitizeSyncData(JSON.parse(raw));
  } catch {
    return emptySyncData();
  }
};

export async function syncLearnerProgress(
  store: ProgressStore,
  userId: string,
  incomingRaw: unknown,
): Promise<{ data: SyncData }> {
  const incoming = sanitizeSyncData(incomingRaw);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const stored = await store.learnerProgress.findUnique({ where: { userId } });
    const previous = parseStoredData(stored?.data);
    const merged = mergeSyncData(previous, incoming);
    const data = JSON.stringify(merged);
    try {
      if (!stored) {
        await store.learnerProgress.create({
          data: { userId, data, revision: 0 },
        });
        return { data: merged };
      }

      const updated = await store.learnerProgress.updateMany({
        where: { userId, revision: stored.revision },
        data: { data, revision: { increment: 1 } },
      });
      if (updated.count === 1) {
        return { data: merged };
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      // Another request created the row or claimed the key after our read.
      // Retry against its latest revision rather than dropping this snapshot.
    }
  }

  throw new Error('Синхронизация занята. Повторите попытку.');
}
