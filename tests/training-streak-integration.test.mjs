import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const progress=fs.readFileSync(path.join(root,'pour-training-progress.js'),'utf8');
const panel=fs.readFileSync(path.join(root,'pour-training-plan-panel.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

assert.match(progress,/DEFAULT_REQUIRED_PASSES=2/,'challenge runtime must default to two consecutive passes');
assert.match(progress,/baselineValue/,'challenge runtime must retain the baseline metric');
assert.match(progress,/previousValue/,'evaluation must expose the prior cup value');
assert.match(progress,/remainingPasses/,'evaluation must expose remaining streak progress');
assert.match(progress,/consecutivePasses>=needed/,'graduation must depend on the consecutive streak');

assert.match(panel,/DEFAULT_REQUIRED_PASSES/,'NEXT SESSION must consume the shared streak requirement');
assert.match(panel,/appendStreak/,'NEXT SESSION must render visual streak progress');
assert.match(panel,/上一杯/,'graduation view must show the previous-to-current metric change');
assert.doesNotMatch(panel,/requiredPasses\s*:\s*1/,'UI must not silently downgrade challenges to one-cup graduation');

assert.match(sw,/pour-lab-v16/,'service worker cache must be bumped after training runtime changes');
assert.match(sw,/\.\/pour-training-progress\.js/);
assert.match(sw,/\.\/pour-training-plan-panel\.js/);

console.log('training streak integration tests: PASS');
