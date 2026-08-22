const CACHE_VERSION = 'pour-lab-v1';
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const APP_SHELL = [
  './',
  './index.html',
  './pour-ghost-sync.js',
  './pour-flow-physics.js',
  './pour-flow-runtime.js',
  './pour-bed-physics.js',
  './pour-stream-physics.js',
  './pour-stream-mesh.js',
  './pour-stream-three.js',
  './pour-lifecycle.js',
  './pour-input-runtime.js',
  './pour-input-bindings.js',
  './pour-input-guard.js',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    await Promise.allSettled(APP_SHELL.map(url => app.add(url)));
    const runtime = await caches.open(RUNTIME_CACHE);
    try {
      const three = await fetch(THREE_URL, { mode: 'cors', cache: 'no-cache' });
      if (three.ok) await runtime.put(THREE_URL, three.clone());
    } catch {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([APP_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('pour-lab-') && !keep.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (fallbackUrl ? await cache.match(fallbackUrl) : undefined) || Response.error();
  }
}

async function cacheFirst(request, cacheName = RUNTIME_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(async response => {
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (url.href === THREE_URL) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
