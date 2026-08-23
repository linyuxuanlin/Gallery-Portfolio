import assert from 'node:assert/strict';
import {analyzeRecipeExecution} from '../pour-recipe-execution.js';

const recipe={stages:[
  {id:'bloom',name:'闷蒸',fromWater:0,toWater:40,targetFlow:3.5,pauseAfter:40},
  {id:'main',name:'主体',fromWater:40,toWater:180,targetFlow:5,pauseAfter:0},
  {id:'finish',name:'收尾',fromWater:180,toWater:250,targetFlow:4.5,pauseAfter:0},
]};
const samples=[];
let t=0,w=0;
function push(flow,water,pouring=true,extra={}){samples.push({t,flow,water,pouring,x:0,z:0,...extra});}
push(3.5,0,true);
for(let i=0;i<8;i++){t+=1000;w+=5;push(3.5,w,true)}
for(let i=0;i<40;i++){t+=1000;push(0,w,false)}
for(let i=0;i<28;i++){t+=1000;w+=5;push(5,w,true)}
for(let i=0;i<14;i++){t+=1000;w+=5;push(4.5,w,true)}

const replay={recipe,samples};
const result=analyzeRecipeExecution(replay);
assert.equal(result.applicable,true);
assert.equal(result.stages.length,3);
assert(Math.abs(result.stages[0].flowError)<1e-9);
assert(Math.abs(result.stages[0].pauseActualMs-40000)<1001);
assert(result.stages.every(stage=>stage.flowCompliance>.95));
assert(result.overallScore>.95);
assert.equal(result.headline,'各阶段执行稳定');

const bad=JSON.parse(JSON.stringify(replay));
for(const sample of bad.samples)if(sample.water>=40&&sample.water<180&&sample.flow>0)sample.flow=7;
const badResult=analyzeRecipeExecution(bad);
const main=badResult.stages.find(stage=>stage.id==='main');
assert(main.flowError>1.5);
assert.equal(badResult.worstStageId,'main');

assert.equal(analyzeRecipeExecution({samples}).applicable,false);

const broken=JSON.parse(JSON.stringify(replay));
const firstMain=broken.samples.findIndex(sample=>sample.water>40);
broken.samples[firstMain].breakBefore=true;
assert.equal(analyzeRecipeExecution(broken).applicable,true);

console.log('recipe execution tests: PASS');
