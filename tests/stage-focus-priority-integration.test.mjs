import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const priority=await readFile(new URL('../pour-stage-priority.js',import.meta.url),'utf8');
const training=await readFile(new URL('../pour-recipe-stage-training.js',import.meta.url),'utf8');

assert(priority.includes('recoveryRiskForFocus'), 'priority runtime must keep focus-scoped Recovery Risk');
assert(priority.includes('rankFocusTrainingCandidates'), 'priority runtime must rank Focus candidates');
assert(priority.includes('risk.score>=30'), 'low-risk history must not create Focus churn');
assert(priority.includes('focusSwitchedByRecovery'), 'selection must expose history-driven Focus switching');
assert(training.includes('rankStageTrainingCandidates'), 'STAGE FOCUS must keep consuming the shared priority runtime');
assert(training.includes('recoveryStages:recoveryHistory.stages'), 'STAGE FOCUS must pass Recipe-scoped Recovery History into priority ranking');

console.log('stage focus priority integration tests: PASS');
