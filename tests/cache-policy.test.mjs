import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const lifecycle = await readFile(new URL('../pour-lifecycle.js', import.meta.url), 'utf8');

assert.match(sw, /CACHE_VERSION\s*=\s*'pour-lab-v1'/);
assert.match(sw, /request\.mode\s*===\s*'navigate'/);
assert.match(sw, /networkFirst\(request, '\.\/index\.html'\)/);
assert.match(sw, /cacheFirst\(request, RUNTIME_CACHE\)/);
assert.match(sw, /staleWhileRevalidate\(request\)/);
assert.match(sw, /cdn\.jsdelivr\.net\/npm\/three@0\.180\.0\/build\/three\.module\.js/);
assert.match(sw, /Promise\.allSettled\(APP_SHELL\.map/);
assert.match(sw, /clients\.claim\(\)/);

for (const moduleName of [
  'pour-ghost-sync.js',
  'pour-flow-runtime.js',
  'pour-bed-physics.js',
  'pour-stream-physics.js',
  'pour-stream-three.js',
  'pour-lifecycle.js',
  'pour-input-runtime.js',
  'pour-input-bindings.js',
  'pour-input-guard.js',
]) {
  assert.ok(sw.includes(`./${moduleName}`), `${moduleName} must be precached`);
}

assert.match(lifecycle, /registerPourServiceWorker/);
assert.match(lifecycle, /serviceWorker\.register\('\.\/sw\.js', \{ scope: '\.\/' \}\)/);
assert.match(lifecycle, /addEventListener\('load'/);

console.log('cache policy tests: PASS');
