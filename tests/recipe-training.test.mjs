import assert from 'node:assert/strict';
import {createFlowRuntime} from '../pour-flow-runtime.js';
import {normalizeRecipe} from '../pour-recipe.js';
import {recipeTrainingState} from '../pour-recipe-training.js';

const recipe300=normalizeRecipe({id:'r300',name:'V60 18:300',dose:18,water:300,targetFlow:5.5,bloomWater:45,bloomSeconds:40});
const runtime=createFlowRuntime({controlFlow:5,targetWater:250});
let state=runtime.setTargetWater(recipe300.water);
assert.equal(state.targetWater,300);
assert.equal(state.progress,0);

for(let i=0;i<60*20;i++) state=runtime.step(1/60,true);
assert(state.water>90&&state.water<130,'runtime should continue past bloom toward 300g');
assert.equal(state.targetReached,false);

runtime.reset({water:250,actualFlow:0});
state=runtime.snapshot();
assert.equal(state.water,250);
assert.equal(state.targetReached,false,'250g must not finish a 300g recipe');
assert(Math.abs(state.progress-250/300)<1e-12);

runtime.setTargetWater(200);
state=runtime.snapshot();
assert.equal(state.water,200,'lowering target below current mass should clamp to new target');
assert.equal(state.targetReached,true);

let ui=recipeTrainingState(recipe300,{water:20,actualFlow:3.8});
assert.equal(ui.stage.id,'bloom');
assert(ui.coach.includes('45g'));
ui=recipeTrainingState(recipe300,{water:120,actualFlow:7});
assert.equal(ui.stage.id,'main');
assert(ui.coach.includes('流速偏高'));
ui=recipeTrainingState(recipe300,{water:300,actualFlow:0});
assert.equal(ui.complete,true);
assert.equal(ui.phase,'完成');
assert.equal(ui.progress,1);

runtime.dispose();
console.log('recipe training tests: PASS');
