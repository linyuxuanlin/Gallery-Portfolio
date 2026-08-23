import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lifecycle=readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert.match(lifecycle,/installReplayVisualization/);
assert.match(lifecycle,/\.\/pour-replay-visualization\.js/);
assert.match(sw,/pour-lab-v11/);
assert.match(sw,/\.\/pour-replay-visualization\.js/);
console.log('replay visualization integration tests: PASS');
