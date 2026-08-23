import assert from 'node:assert/strict';
import fs from 'node:fs';
const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(lifecycle,/installTrainingPeriod/);
assert.match(lifecycle,/\.\/pour-training-period\.js/);
assert.match(sw,/pour-lab-v20/);
assert.match(sw,/\.\/pour-training-period\.js/);
console.log('training period integration tests: PASS');
