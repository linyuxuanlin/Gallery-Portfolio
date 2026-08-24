import assert from 'node:assert/strict';
import fs from 'node:fs';

const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert(lifecycle.includes("import { installRecipeStageTraining } from './pour-recipe-stage-training.js'"));
assert(lifecycle.includes('installRecipeStageTraining(document, globalThis.localStorage)'));
assert(sw.includes("'./pour-recipe-stage-training.js'"));
assert(sw.includes("const CACHE_VERSION = 'pour-lab-v29'"));

console.log('recipe stage training integration tests: PASS');
