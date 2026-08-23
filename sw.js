const CACHE_VERSION = 'pour-lab-v20';
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const THREE_SOURCES = [
  THREE_URL,
  'https://unpkg.com/three@0.180.0/build/three.module.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.module.js',
];
const DEPENDENCY_TIMEOUT_MS = 3500;

const APP_SHELL = [
  './', './index.html', './pour-ghost-sync.js', './pour-flow-physics.js', './pour-flow-runtime.js', './pour-bed-physics.js', './pour-spatial-calibration.js', './pour-stream-physics.js', './pour-stream-mesh.js', './pour-stream-three.js', './pour-lifecycle.js', './pour-replay-breaks.js', './pour-replay-break-persistence.js', './pour-input-runtime.js', './pour-input-bindings.js', './pour-input-guard.js', './pour-brew-analysis.js', './pour-brew-insights.js', './pour-brew-history.js', './pour-brew-portability.js', './pour-brew-compare.js', './pour-brew-trend.js', './pour-brew-trend-panel.js', './pour-training-plan.js', './pour-training-progress.js', './pour-training-history.js', './pour-training-period.js', './pour-training-plan-panel.js', './pour-replay-visualization.js', './pour-replay-playback.js', './pour-bed-hotspots.js', './pour-ghost-deviation.js',
];

async function fetchWithTimeout(url, options = {}, timeoutMs = DEPENDENCY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

async function fetchFirstAvailable(urls, options = {}) {
  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (response?.ok) return response;
      lastError = new Error(`HTTP ${response?.status || 0} for ${url}`);
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('No dependency source available');
}

async function warmThreeCache() {
  const runtime = await caches.open(RUNTIME_CACHE);
  const cached = await runtime.match(THREE_URL);
  if (cached) return cached;
  const response = await fetchFirstAvailable(THREE_SOURCES, { mode: 'cors', cache: 'no-cache' });
  await runtime.put(THREE_URL, response.clone());
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    await Promise.allSettled(APP_SHELL.map(url => app.add(url)));
    try { await warmThreeCache(); } catch {}
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

async function threeCacheFirst() {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(THREE_URL);
  if (cached) return cached;
  try {
    const response = await fetchFirstAvailable(THREE_SOURCES, { mode: 'cors' });
    await cache.put(THREE_URL, response.clone());
    return response;
  } catch { return Response.error(); }
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
  if (request.mode === 'navigate') { event.respondWith(networkFirst(request, './index.html')); return; }
  if (url.href === THREE_URL) { event.respondWith(threeCacheFirst()); return; }
  if (url.origin === self.location.origin) event.respondWith(staleWhileRevalidate(request));
});
