import { useEffect, useSyncExternalStore } from 'react';
import { TAB_IDS, type AppTab } from '../config/tabs';

// Tabs live in `location.hash` (`#/words`): a tab can be linked to and opened in a
// new browser tab, the Back/Forward buttons move between tabs, and a reload keeps
// you where you were. Nothing to install and it works behind any static host.

export const TABS: readonly AppTab[] = TAB_IDS;
export const DEFAULT_TAB: AppTab = 'numbers';

export const tabHref = (tab: AppTab): string => `#/${tab}`;

function parseTab(hash: string): AppTab | null {
  const id = /^#\/?([a-z]+)(?:[/?].*)?$/.exec(hash)?.[1];
  return TABS.find((tab) => tab === id) ?? null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const getHash = () => window.location.hash;
const getServerHash = () => '';

/** The tab selected by the URL; an empty or unrecognised hash means the default tab. */
export function useHashRoute(): AppTab {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const tab = parseTab(hash);

  // Tidy up a garbled hash (`#/nope`) without adding a history entry.
  useEffect(() => {
    if (hash !== '' && tab === null) window.history.replaceState(null, '', tabHref(DEFAULT_TAB));
  }, [hash, tab]);

  return tab ?? DEFAULT_TAB;
}
