import { useEffect } from 'react';
import { CATEGORIES_KEY, WORDS_KEY } from './useDictionary';
import { invalidateQueries } from '../api/queryCache';

const UPDATE_NOTICE_KEY = 'app_sw_updated_notice';

/**
 * Talks to public/sw.js (production only):
 *  - a new worker waiting to take over  -> activate it immediately;
 *  - DICTIONARY_UPDATED from the worker -> the cached dictionary is refetched, so a slow-network
 *    session that was shown the cached copy catches up without a page reload.
 */
export function useServiceWorkerUpdates() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    const container = navigator.serviceWorker;
    let cancelled = false;
    let updateRequested = false;
    const hadController = Boolean(container.controller);

    const activateUpdate = (worker: ServiceWorker) => {
      if (updateRequested) return;
      updateRequested = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    };

    const watch = (registration: ServiceWorkerRegistration) => {
      // A waiting worker plus a controller means this is an update, not the first install.
      if (registration.waiting && container.controller) activateUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && container.controller) activateUpdate(installing);
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

    // Once the new worker takes control, load its matching page code.
    let reloading = false;
    const onControllerChange = () => {
      // Reload even if another tab initiated activation; do not reload on first-ever installation.
      if ((!updateRequested && !hadController) || reloading) return;
      reloading = true;
      try {
        sessionStorage.setItem(UPDATE_NOTICE_KEY, '1');
      } catch {
        // The update can still reload if storage is unavailable.
      }
      window.location.reload();
    };
    container.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      container.removeEventListener('message', onMessage);
      container.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);
}
