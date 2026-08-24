import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const challenge=await readFile(new URL('../pour-recipe-stage-challenge.js',import.meta.url),'utf8');
const lifecycle=await readFile(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const panel=await readFile(new URL('../pour-recipe-stage-history-panel.js',import.meta.url),'utf8');

assert.match(challenge,/recordRecipeStageTransition/,'stage challenge outcomes must enter long-term training history');
assert.match(challenge,/replayId:latestReplayId/,'history recording must be tied to the real new replay id');
assert.match(challenge,/status=challenge\.completed\?'graduated':passed\?'passed':'failed'/,'history must preserve pass\/fail\/graduated status');

assert.match(lifecycle,/installRecipeStageHistory/,'lifecycle must install recipe stage history panel');
assert.match(lifecycle,/installRecipeStageHistory\(document, globalThis\.localStorage\)/,'stage history panel must use the shared local storage');

assert.match(panel,/recipeStageHistorySummary\(storage,\{recipeId:recipe\.id\}\)/,'panel must scope history to the active recipe');
assert.match(panel,/RECIPE STAGE LOG/,'panel must expose stage history to the user');
assert.match(panel,/stage\.passRate/,'panel must display per-stage pass rate');

assert.match(sw,/pour-lab-v31/,'service worker version must advance for changed cached modules');
assert.match(sw,/\.\/pour-recipe-stage-history-panel\.js/,'stage history panel must be available offline');
assert.match(sw,/\.\/pour-training-history\.js/,'training history runtime must remain in app shell');

console.log('recipe stage training-history integration tests: PASS');
