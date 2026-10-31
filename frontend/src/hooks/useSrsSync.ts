import { useEffect, useSyncExternalStore } from 'react';
import { getSyncStatus, subscribeSyncStatus, syncNow } from '../utils/srsSync';
import type { SyncStatus } from '../utils/srsSync';
import { readSyncKey } from '../utils/srsSyncData';
import { useUISettings } from './useUISettings';

/**
 * Keeps SRS progress in step with the learner's other devices (same sync key).
 * Mount once, near the app root. Pulls on start, when the key changes, when the
 * tab becomes visible again and when the connection returns; pushes after answers
 * (see useSRSProgress). Without a key it does nothing.
 */
export function useSrsSync(): void {
  const [{ syncKey }] = useUISettings();
  const key = readSyncKey(syncKey);

  useEffect(() => {
    if (!key) {
      void syncNow(); // resets the status to "off"
      return;
    }
    void syncNow();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow();
    };
    const onOnline = () => void syncNow();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [key]);
}

/** The current state of the sync (for the settings modal). */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}
