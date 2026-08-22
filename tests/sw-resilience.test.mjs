import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /pour-lab-v3/);
assert.match(source, /cdn\.jsdelivr\.net\/npm\/three@0\.180\.0/);
assert.match(source, /unpkg\.com\/three@0\.180\.0/);
assert.match(source, /cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/0\.180\.0/);
assert.match(source, /const DEPENDENCY_TIMEOUT_MS = 3500/);
assert.match(source, /new AbortController\(\)/);
assert.match(source, /setTimeout\(\(\) => controller\.abort\(\), timeoutMs\)/);
assert.match(source, /clearTimeout\(timeout\)/);
assert.match(source, /await fetchWithTimeout\(url, options\)/);
assert.match(source, /runtime\.put\(THREE_URL, response\.clone\(\)\)/);
assert.doesNotMatch(source, /await fetch\(url, options\)/);

const sourceOrder = [
  source.indexOf("cdn.jsdelivr.net/npm/three@0.180.0"),
  source.indexOf("unpkg.com/three@0.180.0"),
  source.indexOf("cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0"),
];
assert(sourceOrder.every(i => i >= 0));
assert(sourceOrder[0] < sourceOrder[1] && sourceOrder[1] < sourceOrder[2]);

console.log('service worker resilience tests: PASS');
