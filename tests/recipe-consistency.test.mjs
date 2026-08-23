import assert from 'node:assert/strict';
import { analyzeRecipeConsistency, recipeScopedBrews } from '../pour-recipe-consistency.js';

const brew=(id,recipeId,createdAt,overallScore,flowErrors)=>({
  id,createdAt,recipe:{id:recipeId},samples:[{t:0,x:0,z:0,flow:5,water:0},{t:100,x:0,z:0,flow:5,water:1}],
  __execution:{applicable:true,overallScore,stages:[
    {id:'bloom',name:'闷蒸',flowError:flowErrors[0],flowCompliance:.86,stageScore:Math.max(0,1-flowErrors[0]/2),pauseErrorMs:2000},
    {id:'main',name:'主体注水',flowError:flowErrors[1],flowCompliance:.82,stageScore:Math.max(0,1-flowErrors[1]/2),pauseErrorMs:null},
  ]},
});

// analyzeRecipeExecution reads real samples in production; this fixture verifies scope/order contract separately.
const history=[
  brew('a','r1','2026-08-20T00:00:00Z',.85,[.2,.30]),
  brew('b','r1','2026-08-21T00:00:00Z',.86,[.21,.32]),
  brew('x','r2','2026-08-21T12:00:00Z',.30,[1.8,2.2]),
  brew('c','r1','2026-08-22T00:00:00Z',.84,[.19,.31]),
  brew('d','r1','2026-08-23T00:00:00Z',.87,[.22,.29]),
];
assert.deepEqual(recipeScopedBrews(history,'r1').map(b=>b.id),['a','b','c','d']);
assert.equal(recipeScopedBrews(history,'r2').length,1);
assert.equal(recipeScopedBrews(history,'missing').length,0);

// Use synthetic execution-compatible samples for an integration-style deterministic check.
function stageReplay(id,recipeId,createdAt,mainFlow){
  const stages=[
    {id:'bloom',name:'闷蒸',fromWater:0,toWater:10,targetFlow:3.5,pauseAfter:0},
    {id:'main',name:'主体注水',fromWater:10,toWater:30,targetFlow:5,pauseAfter:0},
  ];
  const samples=[];let t=0,water=0;
  for(let i=0;i<10;i++){samples.push({t,x:0,z:0,flow:3.5,water,pouring:true});t+=100;water+=1;}
  for(let i=0;i<20;i++){samples.push({t,x:0,z:0,flow:mainFlow,water,pouring:true});t+=100;water+=1;}
  samples.push({t,x:0,z:0,flow:0,water:30,pouring:false});
  return {id,createdAt,recipe:{id:recipeId,stages},samples};
}
const stable=[stageReplay('1','stable','2026-08-20',5.0),stageReplay('2','stable','2026-08-21',5.05),stageReplay('3','stable','2026-08-22',4.95),stageReplay('4','stable','2026-08-23',5.0)];
const stableResult=analyzeRecipeConsistency(stable,'stable');
assert.equal(stableResult.applicable,true);
assert(stableResult.overallConsistency>.9);
assert(stableResult.stages.every(stage=>stage.repeatability>.9));

const shaky=[stageReplay('1','shaky','2026-08-20',5.0),stageReplay('2','shaky','2026-08-21',7.2),stageReplay('3','shaky','2026-08-22',5.3),stageReplay('4','shaky','2026-08-23',7.5)];
const shakyResult=analyzeRecipeConsistency(shaky,'shaky');
assert.equal(shakyResult.worstStageId,'main');
assert(shakyResult.stages[0].flowErrorSpread>.6);
assert(shakyResult.overallConsistency<.8);
assert.equal(analyzeRecipeConsistency([stable[0],stable[1]],'stable').applicable,false);

console.log('recipe consistency tests: PASS');
