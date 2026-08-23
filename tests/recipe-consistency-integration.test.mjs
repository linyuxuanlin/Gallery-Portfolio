import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const lifecycle=await readFile(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
assert(lifecycle.includes("import { installRecipeConsistency } from './pour-recipe-consistency.js';"));
assert(lifecycle.includes('installRecipeConsistency(document, globalThis.localStorage)'));
assert(sw.includes("'./pour-recipe-consistency.js'"));
assert(sw.includes("const CACHE_VERSION = 'pour-lab-v28'"));
console.log('recipe consistency integration tests: PASS');
