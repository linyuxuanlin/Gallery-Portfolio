import assert from 'node:assert/strict';
import fs from 'node:fs';

const stage=fs.readFileSync(new URL('../pour-recipe-stage-training.js',import.meta.url),'utf8');
const challenge=fs.readFileSync(new URL('../pour-recipe-stage-challenge.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert.match(stage,/from '\.\/pour-recipe-stage-challenge\.js'/);
assert.match(stage,/requiredPasses:2/,'stage focus must require two consecutive passes');
assert.match(stage,/allowEvaluation:evaluateLatest/,'UI refresh and brew evaluation must stay separate');
assert.match(stage,/pour:history-imported',refresh/,'history imports must not score a challenge attempt');
assert.match(stage,/pour:recipe-changed',refresh/,'recipe switching must not score a challenge attempt');
assert.match(stage,/pour:recipe-score-updated',evaluate/,'real brew scoring event must evaluate the challenge');
assert.match(stage,/excludeKeys:progress\.completedKeys/,'graduated focus targets must be excluded when selecting the next weakness');
assert.match(stage,/continuous|连续达标|consecutivePasses/,'challenge progress must surface the consecutive-pass streak');

assert.match(challenge,/latestReplayId===challenge\.lastReplayId/,'same replay must not be counted twice');
assert.match(challenge,/allowEvaluation=true/,'challenge runtime must support non-scoring refreshes');
assert.match(challenge,/consecutivePasses>=challenge\.requiredPasses/,'graduation must depend on a pass streak');
assert.match(challenge,/recipes:\{\}/,'challenge storage must be recipe scoped');

assert.match(sw,/pour-lab-v30/);
assert.match(sw,/\.\/pour-recipe-stage-challenge\.js/,'offline app shell must include the stage challenge runtime');

console.log('recipe stage challenge integration tests: PASS');
