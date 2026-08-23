import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const lifecycle=await readFile(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');

assert(lifecycle.includes("import { installRecipeExecution } from './pour-recipe-execution.js';"));
assert(lifecycle.includes('installRecipeExecution(document, globalThis.localStorage);'));
assert(sw.includes("'./pour-recipe-execution.js'"));
assert(sw.includes("const CACHE_VERSION = 'pour-lab-v27';"));

console.log('recipe execution integration: PASS');
