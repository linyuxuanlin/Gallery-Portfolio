import assert from 'node:assert/strict';
import fs from 'node:fs';

const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert.match(lifecycle,/import \{ installBrewInsights \} from '\.\/pour-brew-insights\.js'/);
assert.match(lifecycle,/installBrewInsights\(document, globalThis\.localStorage\)/);
assert.match(sw,/\.\/pour-brew-analysis\.js/);
assert.match(sw,/\.\/pour-brew-insights\.js/);
assert.match(sw,/const CACHE_VERSION = 'pour-lab-v4'/);
console.log('brew insights integration tests: PASS');
