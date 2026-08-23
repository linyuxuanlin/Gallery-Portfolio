import assert from 'node:assert/strict';
import fs from 'node:fs';

const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const scoring=fs.readFileSync(new URL('../pour-recipe-scoring.js',import.meta.url),'utf8');

assert(lifecycle.includes("import { installRecipeScoring } from './pour-recipe-scoring.js'"));
assert(lifecycle.includes('installRecipeScoring(document, globalThis.localStorage)'));
assert(lifecycle.indexOf('installRecipeScoring(document, globalThis.localStorage)') < lifecycle.indexOf('installBrewHistory(document, globalThis.localStorage)'), 'recipe score correction must run before History persists the finished brew');
assert(sw.includes("const CACHE_VERSION = 'pour-lab-v24'"));
assert(sw.includes("'./pour-recipe-scoring.js'"));
assert(scoring.includes('recipeStageAtWater(normalized,water)'));
assert(scoring.includes('Math.abs(flow-stage.targetFlow)/3.2'));
assert(scoring.includes('recipeAdjusted:true'));
assert(scoring.includes("storage?.setItem?.('pourLabLastBrew'"));

console.log('recipe scoring integration tests: PASS');
