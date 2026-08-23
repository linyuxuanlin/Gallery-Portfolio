import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel=await readFile(new URL('../pour-training-plan-panel.js',import.meta.url),'utf8');
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');

assert(panel.includes("from './pour-training-history.js'"),'NEXT SESSION must import training history runtime');
assert(panel.includes('recordTrainingTransition(storage,transition)'),'training transitions must be recorded after evaluation');
assert(panel.includes('trainingHistorySummary(storage)'),'NEXT SESSION must render archive summary');
assert(panel.includes('TRAINING LOG'),'cross-session stats must be visible to the user');
assert(panel.includes('当前连胜'),'current cross-challenge streak must be visible');
assert(panel.includes('最长'),'best streak must be visible');
assert(panel.includes('专项毕业'),'graduation count must be visible');
assert(sw.includes("const CACHE_VERSION = 'pour-lab-v19'"),'service worker cache version must move to v19');
assert(sw.includes("'./pour-training-history.js'"),'training history runtime must be available offline');

console.log('training history integration tests: PASS');
