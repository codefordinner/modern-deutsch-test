/* Deutsch Trainer service worker.
 *
 *  - app shell (HTML)         network first, cached copy when offline;
 *  - /assets/* (hashed files) cache first (a new build has new file names);
 *  - GET /api/words and /api/categories (the public dictionary)
 *                             network first with a short timeout: on a slow or dead network the
 *                             cached copy is shown and the request keeps running in the
 *                             background; when it brings DIFFERENT data, open pages are told
 *                             (DICTIONARY_UPDATED) so the UI refreshes without a reload.
 *                             The API cache is capped at MAX_API_ENTRIES (oldest dropped first);
 *  - everything else (admin, analytics, any non-GET) is never touched.
 *
 * Updates: a new worker does NOT take over by itself (no skipWaiting on install). The page shows
 * "доступна новая версия" and sends SKIP_WAITING when the learner agrees.
 *
 * Bump VERSION when you change this file's caching rules: old caches are deleted on activate.
 */
const VERSION = 'v2';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const API_CACHE = `api-${VERSION}`;
const CURRENT = [SHELL_CACHE, ASSET_CACHE, API_CACHE];

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];
const PUBLIC_API = new Set(['/api/words', '/api/categories']);
const MAX_API_ENTRIES = 20;
const API_NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    // No skipWaiting() here: taking over mid-session could mix old page code with new assets.
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => !CURRENT.includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackKey ?? request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackKey ?? request);
    if (cached) return cached;
    throw error;
  }
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => client.postMessage(message));
}

/** Keeps only the newest MAX_API_ENTRIES responses (Cache keys are in insertion order). */
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

async function sameBody(a, b) {
  if (!a || !b) return false;
  try {
    return (await a.clone().text()) === (await b.clone().text());
  } catch {
    return false;
  }
}

/**
 * Dictionary requests. Online and fast: the fresh response. Slow (> API_NETWORK_TIMEOUT_MS), failing
 * or offline: the cached copy, while the real request finishes in the background (kept alive with
 * waitUntil) and, if the data turned out to be different, tells the open pages to refetch.
 * Every good response is stored; the cache never grows past MAX_API_ENTRIES.
 */
async function dictionaryRequest(event) {
  const { request } = event;
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const cachedCopy = cached ? cached.clone() : null; // `cached` itself is handed to the page and gets consumed

  const network = fetch(request);

  const bookkeeping = network.then(async (response) => {
    if (!response.ok) return;
    const forCompare = response.clone();
    const forStore = response.clone();
    const unchanged = await sameBody(cachedCopy, forCompare);
    await cache.delete(request); // re-insert so this entry becomes the newest
    await cache.put(request, forStore);
    await trimCache(cache, MAX_API_ENTRIES);
    if (cachedCopy && !unchanged) await notifyClients({ type: 'DICTIONARY_UPDATED', url: new URL(request.url).pathname });
  });
  event.waitUntil(bookkeeping.catch(() => {}));

  if (!cached) return network; // nothing to fall back to: wait for the network (errors reach the page)

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), API_NETWORK_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first && first.status < 500) return first;
  } catch {
    // offline: fall through to the cached copy
  }
  return cached;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (PUBLIC_API.has(url.pathname)) event.respondWith(dictionaryRequest(event));
    return; // admin / analytics / export: straight to the network
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/index.html'));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});
