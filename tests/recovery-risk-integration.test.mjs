import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel=fs.readFileSync(new URL('../pour-recipe-stage-history-panel.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert(panel.includes("from './pour-recovery-risk.js'"),'Stage Log must import recovery risk');
assert(panel.includes('rankRecoveryRisks(summary.stages)'),'Stage rows must be ranked by recovery risk');
assert(panel.includes('Recovery Risk'),'Stage Log must show a visible recovery risk score');
assert(panel.includes('stage.recoveryRisk.level'),'risk level must affect visible UI state');
assert(sw.includes("const CACHE_VERSION = 'pour-lab-v37'"),'service worker cache version must refresh');
assert(sw.includes("'./pour-recovery-risk.js'"),'service worker must cache recovery risk module');

console.log('recovery risk integration tests: PASS');
