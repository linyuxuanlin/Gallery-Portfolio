import fs from 'node:fs';
import assert from 'node:assert/strict';

const lifecycle = fs.readFileSync(new URL('../pour-lifecycle.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert(lifecycle.includes("import { installGhostDeviation } from './pour-ghost-deviation.js';"));
assert(lifecycle.includes('installGhostDeviation(document, globalThis.localStorage);'));
assert(sw.includes("const CACHE_VERSION = 'pour-lab-v12';"));
assert(sw.includes("'./pour-ghost-deviation.js'"));

console.log('ghost deviation integration tests: PASS');
