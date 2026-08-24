import assert from 'node:assert/strict';
import fs from 'node:fs';

const training=fs.readFileSync(new URL('../pour-recipe-stage-training.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert.match(training,/pour-recipe-stage-policy\.js/);
assert.match(training,/buildRecipeStageTrendPreview/);
assert.match(training,/stageChallengeTrendPolicy/);
assert.match(training,/applyStageChallengeTrendPolicy/);
assert.match(training,/requiredPasses:2/);
assert.match(training,/recipeStageTrainingPolicy/);
assert.doesNotMatch(training,/requiredPasses:1/);

assert.match(sw,/pour-recipe-stage-policy\.js/);
assert.match(sw,/pour-lab-v34/);

console.log('recipe stage policy integration tests: PASS');
