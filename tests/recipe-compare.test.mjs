import assert from 'node:assert/strict';
import { recipeForReplay, stageForWater, recipeExecutionMetrics, compareRecipeExecutions } from '../pour-recipe-compare.js';

const recipe=(id,name,targetFlow=5)=>({id,name,dose:15,water:250,temperature:92,targetFlow,stages:[
  {id:'bloom',name:'闷蒸',from:0,to:40,targetFlow:4},
  {id:'main',name:'主体',from:40,to:180,targetFlow},
  {id:'finish',name:'收尾',from:180,to:250,targetFlow:4.5},
]});
const replay=(id,r,offset=0)=>({
  id,recipe:r,duration:60000,score:90,
  metrics:{coverage:.80+offset,uniformity:.78+offset,hotspot:1.4},
  samples:Array.from({length:101},(_,i)=>{const water=i*2.5;const target=water<40?4:water<180?r.targetFlow:4.5;return {t:i*600,x:.25*Math.cos(i/8),z:.25*Math.sin(i/8),water,flow:target+(i%2?offset:-offset),pouring:true}}),
});

const aRecipe=recipe('a','A',5),bRecipe=recipe('b','B',6),a=replay('a1',aRecipe,0),b=replay('b1',bRecipe,.15);
assert.equal(recipeForReplay({}),null);
assert.equal(stageForWater(aRecipe,20).id,'bloom');
assert.equal(stageForWater(aRecipe,100).id,'main');
assert.equal(stageForWater(aRecipe,249).id,'finish');
assert(recipeExecutionMetrics(a).flowMae<.01);
assert(recipeExecutionMetrics(b).flowMae>.1);
assert.equal(recipeExecutionMetrics(a).stageRows.length,3);
const compared=compareRecipeExecutions(a,b);
assert.equal(compared.valid,true);
assert.equal(compared.differentRecipe,true);
assert(compared.headline.includes('A → B'));
assert.equal(compared.rows.find(row=>row.key==='flowMae').trend,'worse');
assert.equal(compared.rows.find(row=>row.key==='coverage').trend,'better');
const same=compareRecipeExecutions(a,replay('a2',aRecipe,0));
assert.equal(same.differentRecipe,false);
assert(same.headline.includes('同配方执行对比'));
assert.equal(compareRecipeExecutions({samples:[]},b).valid,false);
console.log('recipe compare tests: PASS');
