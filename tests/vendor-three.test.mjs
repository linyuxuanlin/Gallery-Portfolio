import assert from 'node:assert/strict';
import { gitBlobSha, verifyBlob, patchIndexForVendoredThree, patchServiceWorkerForVendoredThree } from '../scripts/vendor-three.mjs';

const hello = Buffer.from('hello\n');
assert.equal(gitBlobSha(hello), 'ce013625030ba8dba906f756967f9e9ca394464a');
assert.equal(verifyBlob(hello, 'ce013625030ba8dba906f756967f9e9ca394464a'), 'ce013625030ba8dba906f756967f9e9ca394464a');
assert.throws(() => verifyBlob(hello, '0000000000000000000000000000000000000000'), /integrity mismatch/);

const oldIndex = "<script type=\"module\">\nimport * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';\n</script>";
const patchedIndex = patchIndexForVendoredThree(oldIndex);
assert(patchedIndex.includes("import * as THREE from './vendor/three/three.module.min.js';"));
assert(!patchedIndex.includes('cdn.jsdelivr.net/npm/three'));
assert.equal(patchIndexForVendoredThree(patchedIndex), patchedIndex, 'index patch must be idempotent');

const oldSw = `const CACHE_VERSION = 'pour-lab-v41';
const APP_CACHE = \`${'${CACHE_VERSION}'}-app\`;
const RUNTIME_CACHE = \`${'${CACHE_VERSION}'}-runtime\`;
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const THREE_SOURCES = [THREE_URL, 'https://unpkg.com/three@0.180.0/build/three.module.js', 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.module.js'];
const DEPENDENCY_TIMEOUT_MS = 3500;
const APP_SHELL = ['./pour-stage-priority.js',];
async function fetchWithTimeout(url) { try { return await fetch(url); } finally {} }
async function fetchFirstAvailable(urls) { for (const url of urls) { const response = await fetchWithTimeout(url); if (response.ok) return response; } }
async function warmThreeCache() { const runtime = await caches.open(RUNTIME_CACHE); return runtime.match(THREE_URL); }
self.addEventListener('install', event => { event.waitUntil((async () => { const app = await caches.open(APP_CACHE); try { await warmThreeCache(); } catch {} await self.skipWaiting(); })()); });
self.addEventListener('activate', event => { event.waitUntil((async () => { const keep = new Set([APP_CACHE, RUNTIME_CACHE]); const names = await caches.keys(); await Promise.all(names.filter(name => !keep.has(name)).map(name => caches.delete(name))); })()); });
async function threeCacheFirst() { const cache = await caches.open(RUNTIME_CACHE); return cache.match(THREE_URL); }
self.addEventListener('fetch', event => { const { request } = event; const url = new URL(request.url); if (url.href === THREE_URL) { event.respondWith(threeCacheFirst()); return; } if (url.origin === self.location.origin) event.respondWith(fetch(request)); });`;

const patchedSw = patchServiceWorkerForVendoredThree(oldSw);
assert(patchedSw.includes("const CACHE_VERSION = 'pour-lab-v42';"));
assert(patchedSw.includes("'./vendor/three/three.module.min.js'"));
assert(patchedSw.includes("'./vendor/three/three.core.min.js'"));
assert(!patchedSw.includes('cdn.jsdelivr.net/npm/three'));
assert(!patchedSw.includes('unpkg.com/three'));
assert(!patchedSw.includes('cdnjs.cloudflare.com/ajax/libs/three.js'));
assert(!patchedSw.includes('THREE_URL'));
assert(!patchedSw.includes('THREE_SOURCES'));
assert(!patchedSw.includes('warmThreeCache'));
assert(!patchedSw.includes('threeCacheFirst'));
assert(!patchedSw.includes('RUNTIME_CACHE'));
assert.equal((patchServiceWorkerForVendoredThree(patchedSw).match(/vendor\/three\/three\.module\.min\.js/g)||[]).length, 1);

console.log('vendor Three.js tests: PASS');
