import { useEffect, useSyncExternalStore } from 'react';
import { flushPendingSync, getSyncStatus, subscribeSyncStatus, syncNow } from '../utils/srsSync';
import type { SyncStatus } from '../utils/srsSync';
import { readSyncKey } from '../utils/srsSyncData';
import { useUISettings } from './useUISettings';

/**
 * Keeps progress (SRS, scores, answers today) in step with the learner's other devices (same sync key).
 * Mount once, near the app root. Pulls on start, when the key changes, when the tab
 * becomes visible again and when the connection returns; pushes after answers
 * (see useSRSProgress / useScores) and right away when the tab is hidden, so answers given in the
 * last couple of seconds are not left behind. Without a key it does nothing.
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

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void syncNow();
      else flushPendingSync();
    };
    const onOnline = () => void syncNow();
    const onPageHide = () => flushPendingSync();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [key]);
}

/** The current state of the sync (for the settings modal). */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}
