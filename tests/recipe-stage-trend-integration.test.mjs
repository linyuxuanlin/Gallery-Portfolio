import assert from 'node:assert/strict';
import fs from 'node:fs';

const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const trend=fs.readFileSync(new URL('../pour-recipe-stage-trend.js',import.meta.url),'utf8');

assert(lifecycle.includes("import { installRecipeStageTrend } from './pour-recipe-stage-trend.js'"));
assert(lifecycle.includes('installRecipeStageTrend(document, globalThis.localStorage)'));
assert(sw.includes("'./pour-recipe-stage-trend.js'"));
assert(sw.includes("pour-lab-v32"));
assert(trend.includes("event?.type === 'recipe-stage'"));
assert(trend.includes("recipeId:recipe.id"));
assert(trend.includes("minSamples = 3"));
console.log('recipe stage trend integration tests: PASS');
