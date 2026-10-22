import { useCallback, useEffect, useState } from 'react';
import { CATEGORIES_KEY, WORDS_KEY } from './useDictionary';
import { invalidateQueries } from '../api/queryCache';

/**
 * Talks to public/sw.js (production only):
 *  - a new worker waiting to take over  -> `updateReady` (the UI offers "Обновить");
 *  - DICTIONARY_UPDATED from the worker -> the cached dictionary is refetched, so a slow-network
 *    session that was shown the cached copy catches up without a page reload.
 */
export function useServiceWorkerUpdates() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    const container = navigator.serviceWorker;
    let cancelled = false;

    const watch = (registration: ServiceWorkerRegistration) => {
      // A worker that is already waiting while a controller exists is an update (not the first install).
      if (registration.waiting && container.controller) setWaiting(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && container.controller) setWaiting(installing);
        });
      });
    };

    container.getRegistration().then((registration) => {
      if (registration && !cancelled) watch(registration);
    });

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'DICTIONARY_UPDATED') return;
      invalidateQueries(event.data.url === '/api/categories' ? CATEGORIES_KEY : WORDS_KEY);
    };
    container.addEventListener('message', onMessage);

    // After the learner accepts the update the new worker takes control: load its page code.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    container.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      container.removeEventListener('message', onMessage);
      container.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    waiting?.postMessage({ type: 'SKIP_WAITING' });
  }, [waiting]);

  return { updateReady: waiting !== null, applyUpdate };
}
