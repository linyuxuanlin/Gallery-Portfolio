import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.match(source, /const CACHE_VERSION = 'pour-lab-v2'/, 'cache version should be bumped');
assert.match(source, /cdn\.jsdelivr\.net\/npm\/three@0\.180\.0\/build\/three\.module\.js/, 'primary Three.js source missing');
assert.match(source, /unpkg\.com\/three@0\.180\.0\/build\/three\.module\.js/, 'fallback Three.js source missing');
assert.match(source, /async function fetchFirstAvailable\(/, 'multi-source fetch helper missing');
assert.match(source, /for \(const url of urls\)/, 'sources must be attempted sequentially');
assert.match(source, /runtime\.put\(THREE_URL, response\.clone\(\)\)/, 'fallback response must be cached under canonical Three.js URL');
assert.match(source, /event\.respondWith\(threeCacheFirst\(\)\)/, 'Three.js requests must use fallback-aware cache strategy');
assert.doesNotMatch(source, /event\.respondWith\(cacheFirst\(request, RUNTIME_CACHE\)\)/, 'legacy single-source cache strategy must not return');

console.log('sw cache fallback tests: PASS');
