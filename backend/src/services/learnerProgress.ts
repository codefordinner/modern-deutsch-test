import {
  emptySyncData,
  hashSyncKey,
  mergeSyncData,
  readSyncKey,
  sanitizeSyncData,
  type SyncData,
} from './srsSync';

type ProgressStore = {
  learnerProgress: {
    findUnique: (args: { where: { userId: string } }) => Promise<{
      data: string;
      revision: number;
      legacyKeyHash: string | null;
    } | null>;
    findUniqueByLegacyKey: (keyHash: string) => Promise<{ userId: string } | null>;
    create: (args: { data: { userId: string; data: string; revision: number; legacyKeyHash: string | null } }) => Promise<unknown>;
    updateMany: (args: {
      where: { userId: string; revision: number };
      data: { data: string; revision: { increment: number }; legacyKeyHash?: string };
    }) => Promise<{ count: number }>;
  };
  syncProfile: {
    findUnique: (args: { where: { keyHash: string } }) => Promise<{ data: string } | null>;
  };
};

export class LegacySyncKeyConflictError extends Error {
  constructor() {
    super('Этот ключ синхронизации уже привязан к другому профилю Telegram.');
    this.name = 'LegacySyncKeyConflictError';
  }
}

const parseStoredData = (raw: string | null | undefined): SyncData => {
  if (!raw) return emptySyncData();
  try {
    return sanitizeSyncData(JSON.parse(raw));
  } catch {
    return emptySyncData();
  }
};

/**
 * Merges a device snapshot into the learner's account. A legacy sync profile is
 * imported exactly once and claimed by its hash so it cannot be silently copied
 * into multiple Telegram accounts.
 */
export async function syncLearnerProgress(
  store: ProgressStore,
  userId: string,
  incomingRaw: unknown,
  legacyKeyRaw?: unknown,
): Promise<{ data: SyncData; legacyKeyMigrated: boolean }> {
  const incoming = sanitizeSyncData(incomingRaw);
  const legacyKey = legacyKeyRaw === undefined || legacyKeyRaw === null || legacyKeyRaw === ''
    ? null
    : readSyncKey(legacyKeyRaw);
  if (legacyKeyRaw !== undefined && legacyKeyRaw !== null && legacyKeyRaw !== '' && !legacyKey) {
    throw new Error('Некорректный ключ синхронизации.');
  }
  const legacyKeyHash = legacyKey ? hashSyncKey(legacyKey) : null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const stored = await store.learnerProgress.findUnique({ where: { userId } });
    if (stored?.legacyKeyHash && legacyKeyHash && stored.legacyKeyHash !== legacyKeyHash) {
      throw new LegacySyncKeyConflictError();
    }

    let previous = parseStoredData(stored?.data);
    let claimedHash = stored?.legacyKeyHash ?? null;
    if (legacyKeyHash) {
      const owner = await store.learnerProgress.findUniqueByLegacyKey(legacyKeyHash);
      if (owner && owner.userId !== userId) throw new LegacySyncKeyConflictError();
      const legacy = await store.syncProfile.findUnique({ where: { keyHash: legacyKeyHash } });
      previous = mergeSyncData(previous, parseStoredData(legacy?.data));
      claimedHash = legacyKeyHash;
    }

    const merged = mergeSyncData(previous, incoming);
    const data = JSON.stringify(merged);
    try {
      if (!stored) {
        await store.learnerProgress.create({
          data: { userId, data, revision: 0, legacyKeyHash: claimedHash },
        });
        return { data: merged, legacyKeyMigrated: Boolean(legacyKeyHash && claimedHash === legacyKeyHash) };
      }

      const updated = await store.learnerProgress.updateMany({
        where: { userId, revision: stored.revision },
        data: {
          data,
          revision: { increment: 1 },
          ...(claimedHash && !stored.legacyKeyHash ? { legacyKeyHash: claimedHash } : {}),
        },
      });
      if (updated.count === 1) {
        return { data: merged, legacyKeyMigrated: Boolean(legacyKeyHash && claimedHash === legacyKeyHash) };
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      if (legacyKeyHash) {
        const owner = await store.learnerProgress.findUniqueByLegacyKey(legacyKeyHash);
        if (owner && owner.userId !== userId) throw new LegacySyncKeyConflictError();
      }
      // Another request created the row or claimed the key after our read.
      // Retry against its latest revision rather than dropping this snapshot.
    }
  }

  throw new Error('Синхронизация занята. Повторите попытку.');
}
