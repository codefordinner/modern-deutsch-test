import { useEffect, useSyncExternalStore } from 'react';
import { flushPendingSync, getSyncStatus, scheduleSync, setLearnerSyncUser, subscribeSyncStatus, syncNow } from '../utils/srsSync';
import type { SyncStatus } from '../utils/srsSync';

/**
 * Keeps progress (SRS, scores, answers today) in step with the learner's other devices,
 * Mount once, near the app root. Pulls on start, when the tab
 * becomes visible again and when the connection returns; pushes after answers
 * (see useSRSProgress / useScores) and right away when the tab is hidden, so answers given in the
 * last couple of seconds are not left behind. Without an account it does nothing.
 */
export function useSrsSync(userId: string | null): void {
  setLearnerSyncUser(userId);

  useEffect(() => {
    if (!userId) {
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
    const onAccountSettingChanged = () => scheduleSync();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('learner-account-setting-changed', onAccountSettingChanged);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('learner-account-setting-changed', onAccountSettingChanged);
    };
  }, [userId]);
}

/** The current state of the sync (for the settings modal). */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}
