import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel=fs.readFileSync(new URL('../pour-training-plan-panel.js',import.meta.url),'utf8');
const progress=fs.readFileSync(new URL('../pour-training-progress.js',import.meta.url),'utf8');
const plan=fs.readFileSync(new URL('../pour-training-plan.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert.match(panel,/advanceTrainingChallenge/,'NEXT SESSION must use persistent challenge progression');
assert.match(panel,/restoreChallenge/,'panel must restore persisted challenge');
assert.match(panel,/saveChallenge/,'panel must persist challenge after evaluation');
assert.match(panel,/persistLatestBrew/,'panel must evaluate against latest persisted brew');
assert.match(panel,/已晋级/,'panel must expose graduation state');
assert.match(panel,/本杯未达标/,'panel must expose failed attempt state through challenge summary');

assert.match(progress,/lastReplayId/,'challenge must remember evaluated replay id');
assert.match(progress,/replayId===challenge\.lastReplayId/,'same replay must not count twice');
assert.match(progress,/baselineReplayId:replayId/,'new challenge must baseline the brew that created it');
assert.match(progress,/excludeIds:\[currentChallenge\.id\]/,'graduation must search for a different next focus');

assert.match(plan,/replay\.analysis\|\|analyzeBrew/,'flow/edge challenges must derive analysis when replay has no cached analysis');
assert.match(sw,/pour-lab-v9/,'service worker cache version must be bumped for challenge runtime');
assert.match(sw,/\.\/pour-training-progress\.js/,'training challenge runtime must be available offline');

console.log('training challenge integration tests: PASS');
