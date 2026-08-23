import assert from 'node:assert/strict';
import fs from 'node:fs';

const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const profile=fs.readFileSync(new URL('../pour-brew-profile.js',import.meta.url),'utf8');

assert.match(lifecycle,/import \{ installBrewProfile \} from '\.\/pour-brew-profile\.js'/);
assert.match(lifecycle,/installBrewProfile\(document, globalThis\.localStorage\)/);
assert.match(sw,/pour-lab-v21/);
assert.match(sw,/\.\/pour-brew-profile\.js/);
assert.match(profile,/readBrewHistory/);
assert.match(profile,/analyzeBrew/);
assert.match(profile,/BREW PROFILE/);
assert.match(profile,/至少完成 3 杯后生成冲煮画像/);

console.log('brew profile integration tests: PASS');
