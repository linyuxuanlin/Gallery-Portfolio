import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const lifecycle=await readFile(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const moduleSource=await readFile(new URL('../pour-recipe-compare.js',import.meta.url),'utf8');

assert(lifecycle.includes("import { installRecipeComparison } from './pour-recipe-compare.js';"));
assert(lifecycle.includes('installRecipeComparison(document)'));
assert(sw.includes("'./pour-recipe-compare.js'"));
assert(sw.includes("CACHE_VERSION = 'pour-lab-v26'"));
assert(moduleSource.includes('stageForWater(recipe,sample?.water)'));
assert(moduleSource.includes("key:'flowMae'"));
assert(moduleSource.includes("key:'coverage'"));
assert(moduleSource.includes("key:'uniformity'"));
assert(moduleSource.includes("key:'edgeExposure'"));
console.log('recipe compare integration tests: PASS');
