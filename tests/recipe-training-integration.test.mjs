import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [lifecycle,sw,training,flowRuntime]=await Promise.all([
  readFile(new URL('../pour-lifecycle.js',import.meta.url),'utf8'),
  readFile(new URL('../sw.js',import.meta.url),'utf8'),
  readFile(new URL('../pour-recipe-training.js',import.meta.url),'utf8'),
  readFile(new URL('../pour-flow-runtime.js',import.meta.url),'utf8'),
]);

assert(lifecycle.includes("installRecipeTraining"),'lifecycle must install recipe training bridge');
assert(lifecycle.includes("./pour-recipe-training.js"),'lifecycle must import recipe training bridge');
assert(sw.includes("pour-lab-v23"),'service worker cache version must advance');
assert(sw.includes("./pour-recipe-training.js"),'recipe training bridge must be available offline');
assert(training.includes("setActiveFlowTargetWater(recipe.water)"),'active recipe water must control runtime target');
assert(training.includes("bar.style.width"),'recipe progress must override hardcoded 250g progress');
assert(flowRuntime.includes("targetWater: waterTarget"),'runtime snapshot must expose target water');
assert(flowRuntime.includes("setTargetWater(value)"),'runtime must support dynamic recipe targets');
assert(!flowRuntime.includes("Math.min(targetWater"),'runtime must not keep immutable constructor target in reset path');

console.log('recipe training integration tests: PASS');
