import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

// A small shared cache for server data (a stand-in for TanStack Query, which
// this app doesn't need in full):
//
//  - components asking for the same key share ONE request and one result, so the
//    trainers and the admin panel no longer fetch the same word list twice;
//  - data stays in memory when a component unmounts (switching tabs), and is
//    shown immediately on the next mount; if it has gone stale it is refreshed
//    in the background (stale-while-revalidate);
//  - a refresh that brings back identical data keeps the old object identity, so
//    it doesn't re-render consumers or restart a question the learner is answering;
//  - `invalidateQueries` marks data as outdated after a change (e.g. the admin
//    edited a word) and refreshes whatever is currently on screen.

interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  isFetching: boolean;
}

interface Entry<T> {
  key: string;
  state: QueryState<T>;
  /** When the data was last loaded successfully; 0 = never, or the last attempt failed. */
  updatedAt: number;
  invalidated: boolean;
  /** Increases with every request; results of superseded requests are ignored. */
  requestId: number;
  inFlight: Promise<void> | null;
  fetcher: (() => Promise<T>) | null;
  listeners: Set<() => void>;
  /** Cheap structural hash of the last stored data, so refetches don't JSON.stringify big lists. */
  dataHash: number | undefined;
}

const DEFAULT_STALE_MS = 60_000;

const entries = new Map<string, Entry<unknown>>();

function getEntry<T>(key: string): Entry<T> {
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      key,
      state: { data: undefined, error: undefined, isFetching: false },
      updatedAt: 0,
      invalidated: false,
      requestId: 0,
      inFlight: null,
      fetcher: null,
      listeners: new Set(),
      dataHash: undefined,
    };
    entries.set(key, entry);
  }
  return entry as Entry<T>;
}

function setState<T>(entry: Entry<T>, patch: Partial<QueryState<T>>): void {
  entry.state = { ...entry.state, ...patch };
  entry.listeners.forEach((listener) => listener());
}

/**
 * A stable, cheap structural hash used to detect whether a refetch brought back
 * the same data. JSON.stringify over a dictionary of thousands of words on every
 * refetch (and every service-worker DICTIONARY_UPDATED message) was measurable.
 * The hash is not a guarantee of deep equality — a rare collision only means we
 * replace the object (an extra render), never wrong data.
 */
function hashData(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const seen = new Set<unknown>();
  let h = 0x811c9dc5;
  const mix = (n: number) => { h ^= n; h = Math.imul(h, 0x01000193); };
  const visit = (v: unknown): void => {
    if (v === null) { mix(0); return; }
    const t = typeof v;
    if (t === 'number') { mix(v as number); return; }
    if (t === 'boolean') { mix(v ? 1 : 2); return; }
    if (t === 'string') { for (let i = 0; i < (v as string).length; i++) mix((v as string).charCodeAt(i)); return; }
    if (t !== 'object') return;
    if (seen.has(v)) { mix(7); return; }
    seen.add(v);
    if (Array.isArray(v)) { mix(3); for (const item of v) visit(item); return; }
    mix(4);
    const record = v as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) { visit(key); visit(record[key]); }
  };
  visit(value);
  return h;
}

function isSameData(entry: Entry<unknown>, previous: unknown, next: unknown): boolean {
  if (previous === next) return true;
  // A hash match is enough to keep the old object identity. Collisions only cause
  // an extra render, never wrong data — and the huge lists skip JSON.stringify.
  return entry.dataHash !== undefined && entry.dataHash === hashData(next);
}

function runFetch<T>(entry: Entry<T>, fetcher: () => Promise<T>): Promise<void> {
  const requestId = ++entry.requestId;
  // While there is nothing to show yet, a retry starts from a clean slate (no stale error).
  setState(entry, { isFetching: true, error: entry.state.data === undefined ? undefined : entry.state.error });

  const promise: Promise<void> = fetcher()
    .then(
      (data) => {
        if (requestId !== entry.requestId) return;
        entry.updatedAt = Date.now();
        entry.invalidated = false;
        const previous = entry.state.data;
        if (previous !== undefined && isSameData(entry, previous, data)) {
          setState(entry, { error: undefined, isFetching: false });
        } else {
          entry.dataHash = hashData(data);
          setState(entry, { data, error: undefined, isFetching: false });
        }
      },
      (error: unknown) => {
        if (requestId !== entry.requestId) return;
        entry.updatedAt = 0;
        setState(entry, { error, isFetching: false });
      }
    )
    .finally(() => {
      if (entry.inFlight === promise) entry.inFlight = null;
    });

  entry.inFlight = promise;
  return promise;
}

const isStale = (entry: Entry<unknown>, staleTimeMs: number): boolean =>
  entry.invalidated || entry.updatedAt === 0 || Date.now() - entry.updatedAt >= staleTimeMs;

/**
 * Marks every cached query whose key starts with `prefix` as outdated and
 * refreshes the ones that are currently displayed; the others reload on next use.
 */
export function invalidateQueries(prefix: string): void {
  for (const entry of entries.values()) {
    if (!entry.key.startsWith(prefix)) continue;
    entry.invalidated = true;
    if (entry.listeners.size > 0 && entry.fetcher) void runFetch(entry, entry.fetcher);
  }
}

export interface UseQueryOptions {
  /** How long loaded data counts as fresh (no request at all on mount). */
  staleTimeMs?: number;
  enabled?: boolean;
}

export interface UseQueryResult<T> {
  data: T | undefined;
  /** The last error — only meaningful while there is no `data` to show. */
  error: unknown;
  /** Nothing to show yet and nothing has failed. */
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  { staleTimeMs = DEFAULT_STALE_MS, enabled = true }: UseQueryOptions = {}
): UseQueryResult<T> {
  const entry = getEntry<T>(key);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Assign the fetcher synchronously (not in an effect): `invalidateQueries`
  // may run between the first render and the effect (e.g. a DICTIONARY_UPDATED
  // message from the service worker) and must not skip this entry as "no fetcher".
  entry.fetcher = () => fetcherRef.current();

  const subscribe = useCallback(
    (listener: () => void) => {
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [entry]
  );
  const state = useSyncExternalStore(
    subscribe,
    () => entry.state,
    () => entry.state
  );

  useEffect(() => {
    entry.fetcher = () => fetcherRef.current();
    if (!enabled || entry.inFlight) return;
    if (isStale(entry, staleTimeMs)) void runFetch(entry, entry.fetcher);
  }, [entry, enabled, staleTimeMs]);

  const refetch = useCallback(() => runFetch(entry, () => fetcherRef.current()), [entry]);

  return {
    data: state.data,
    error: state.error,
    isLoading: enabled && state.data === undefined && state.error === undefined,
    isFetching: state.isFetching,
    refetch,
  };
}
