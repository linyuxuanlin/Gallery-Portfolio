import assert from 'node:assert/strict';
import fs from 'node:fs';
const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert(lifecycle.includes("import { installBedHotspots } from './pour-bed-hotspots.js';"));
assert(lifecycle.includes('installBedHotspots(document, globalThis.localStorage);'));
assert(sw.includes("'./pour-bed-hotspots.js'"));
assert(sw.includes("const CACHE_VERSION = 'pour-lab-v14';"));
console.log('bed hotspot integration tests: PASS');
