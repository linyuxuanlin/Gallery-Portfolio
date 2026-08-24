import assert from 'node:assert/strict';
import fs from 'node:fs';

const stageTraining=fs.readFileSync(new URL('../pour-recipe-stage-training.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert.match(stageTraining,/rankStageTrainingCandidates/);
assert.match(stageTraining,/summarizeRecipeStageHistory/);
assert.match(stageTraining,/recoveryStages:recoveryHistory\.stages/);
assert.match(stageTraining,/Recovery Risk/);
assert.match(stageTraining,/recoveryRisk:selected\.recovery/);
assert.match(sw,/pour-stage-priority\.js/);

console.log('stage priority integration tests: PASS');
