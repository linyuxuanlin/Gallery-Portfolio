import assert from 'node:assert/strict';
import fs from 'node:fs';

const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const challenge=fs.readFileSync(new URL('../pour-recipe-stage-challenge.js',import.meta.url),'utf8');
const recovery=fs.readFileSync(new URL('../pour-recipe-stage-recovery.js',import.meta.url),'utf8');

assert.match(lifecycle,/installRecipeStageRecovery/,'lifecycle must install recovery panel');
assert.match(lifecycle,/\.\/pour-recipe-stage-recovery\.js/,'lifecycle must import recovery module');
assert.match(sw,/pour-lab-v35/,'service worker cache version must advance');
assert.match(sw,/\.\/pour-recipe-stage-recovery\.js/,'recovery module must be available offline');
assert.match(challenge,/requiredRecoveryPasses=2/,'recovery must require two consecutive recovered cups');
assert.match(challenge,/originalPassed===true/,'recovery must evaluate the raw target result, not blocked graduation pass');
assert.match(challenge,/consecutivePasses:0/,'recovery must reset normal graduation streak');
assert.match(recovery,/恢复连续达标/,'recovery UI must surface recovery streak');
assert.match(recovery,/不计入正常毕业 2\/2/,'recovery UI must explain that recovery cups do not count toward graduation');

console.log('recipe stage recovery integration tests: PASS');
