import assert from 'node:assert/strict';
import fs from 'node:fs';

const priority=fs.readFileSync(new URL('../pour-stage-priority.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert.match(priority,/selectStickyFocus/);
assert.match(priority,/switchMargin/);
assert.match(priority,/previousFocusId/);
assert.match(priority,/item\?\.focus\?\.id/,'current focus should be the default sticky anchor');
assert.match(sw,/pour-lab-v40/);
assert.match(sw,/\.\/pour-focus-stickiness\.js/);

console.log('focus stickiness integration tests: PASS');
