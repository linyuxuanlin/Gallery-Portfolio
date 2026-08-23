import assert from 'node:assert/strict';
import { recipeAwareBaseScore, recipeAdjustedReplayScore, enrichReplayWithRecipeScore } from '../pour-recipe-scoring.js';

const recipe=targetFlow=>({id:`recipe-${targetFlow}`,name:`${targetFlow} g/s`,dose:15,water:250,temperature:92,targetFlow,bloomWater:0,bloomSeconds:0,stages:[{id:'main',name:'主体',fromWater:0,toWater:250,targetFlow,pauseAfter:0}]});
const replay=flow=>({score:0,metrics:{bed:1,path:null,flow:null,rhythm:null,rhythmApplicable:false},samples:Array.from({length:101},(_,i)=>({t:i*100,x:0,z:0,flow,water:i*2.5,pouring:true}))});

const matched=recipeAwareBaseScore(replay(6).samples,recipe(6));
assert(matched.score>.9999);
assert(matched.flowScore>.9999);

const wronglyJudged=recipeAwareBaseScore(replay(6).samples,recipe(5));
assert(wronglyJudged.flowScore<.70,'6 g/s should be penalized only when the recipe actually asks for 5 g/s');

assert.equal(recipeAdjustedReplayScore(replay(6),recipe(6)).score,100);
const enriched=enrichReplayWithRecipeScore(replay(6),recipe(6));
assert.equal(enriched.replay.score,100);
assert.equal(enriched.replay.recipe.targetFlow,6);
assert.equal(enriched.replay.metrics.recipeAdjusted,true);

const staged=recipe(6);
staged.stages=[{id:'bloom',name:'闷蒸',fromWater:0,toWater:100,targetFlow:4,pauseAfter:0},{id:'main',name:'主体',fromWater:100,toWater:250,targetFlow:6,pauseAfter:0}];
const stagedSamples=[];
for(let i=0;i<=100;i++){
  const water=i*2.5;
  stagedSamples.push({t:i*100,x:0,z:0,flow:water<100?4:6,water,pouring:true});
}
assert(recipeAwareBaseScore(stagedSamples,staged).flowScore>.99,'stage-specific target flow should be honored');

const ghost=replay(6);
ghost.metrics={bed:1,path:1,flow:1,rhythm:1,rhythmApplicable:true};
assert.equal(recipeAdjustedReplayScore(ghost,recipe(6)).score,100,'Ghost weighting should stay unchanged after recipe-aware base scoring');

console.log('recipe scoring tests: PASS');
