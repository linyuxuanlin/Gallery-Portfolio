import assert from 'node:assert/strict';
import fs from 'node:fs';

const history=fs.readFileSync(new URL('../pour-brew-history.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert.match(history,/from '\.\/pour-brew-compare\.js'/,'history must import comparison engine');
assert.match(history,/选择 A/,'history must expose baseline selection');
assert.match(history,/与 A 对比/,'history must expose second-brew comparison action');
assert.match(history,/brewHistoryCompare/,'history must render comparison panel');
assert.match(history,/comparisonSummary\(result\)/,'history must render readable comparison summary');
assert.match(sw,/\.\/pour-brew-compare\.js/,'comparison module must be cached for offline use');
assert.match(sw,/pour-lab-v6/,'service worker cache version must advance with app shell');

console.log('brew history compare integration tests: PASS');
