import { useEffect, useRef, useSyncExternalStore } from 'react';
import { flushPendingSync, getSyncStatus, scheduleSync, setLearnerSyncUser, subscribeSyncStatus, syncNow } from '../utils/srsSync';
import type { SyncStatus } from '../utils/srsSync';

const PULL_THROTTLE_MS = 30_000;

/**
 * Keeps progress (SRS, scores, answers today) in step with the learner's other devices,
 * Mount once, near the app root. The authenticated entry flow performs the initial pull;
 * later pulls are throttled when the tab becomes visible or the connection returns. Pushes after answers
 * (see useSRSProgress / useScores) and right away when the tab is hidden, so answers given in the
 * last couple of seconds are not left behind. Without an account it does nothing.
 */
export function useSrsSync(userId: string | null): void {
  const lastPullAt = useRef(0);

  useEffect(() => {
    setLearnerSyncUser(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      void syncNow(); // resets the status to "off"
      return;
    }
    // handleLearnerAuthenticated() already pulled before rendering the trainers.
    lastPullAt.current = Date.now();
    const pullIfStale = () => {
      const now = Date.now();
      if (now - lastPullAt.current < PULL_THROTTLE_MS) return;
      lastPullAt.current = now;
      void syncNow();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') pullIfStale();
      else flushPendingSync();
    };
    const onOnline = pullIfStale;
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
