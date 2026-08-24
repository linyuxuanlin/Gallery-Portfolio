import assert from 'node:assert/strict';
import {
  recordRecipeStageTransition,
  readTrainingHistory,
  recipeStageHistorySummary,
  summarizeRecipeStageHistory,
} from '../pour-training-history.js';

const memory=()=>{
  const map=new Map();
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),map};
};
const stageTransition=(passed,status='passed',stageId='main',focusId='flow-accuracy')=>({
  status,
  graduated:status==='graduated',
  plan:{stageId,stageName:stageId==='main'?'主体':'闷蒸',focusId},
  evaluation:{applicable:true,passed,current:passed?.25:.55,target:.30},
  completedChallenge:status==='graduated'?{stageId,stageName:'主体',focusId}:null,
});

const storage=memory();
let transition=stageTransition(false);
let result=recordRecipeStageTransition(storage,transition,{replayId:'a',recipeId:'r1',recordedAt:'2026-08-20T10:00:00Z'});
assert.equal(result.recorded,true);
result=recordRecipeStageTransition(storage,transition,{replayId:'a',recipeId:'r1',recordedAt:'2026-08-20T10:00:01Z'});
assert.equal(result.duplicate,true,'same recipe-stage challenge + replay must not double count');

recordRecipeStageTransition(storage,stageTransition(true),{replayId:'b',recipeId:'r1',recordedAt:'2026-08-21T10:00:00Z'});
recordRecipeStageTransition(storage,stageTransition(true,'graduated'),{replayId:'c',recipeId:'r1',recordedAt:'2026-08-22T10:00:00Z'});
recordRecipeStageTransition(storage,stageTransition(true,'passed','bloom','pause-rhythm'),{replayId:'d',recipeId:'r1',recordedAt:'2026-08-23T10:00:00Z'});
recordRecipeStageTransition(storage,stageTransition(true),{replayId:'e',recipeId:'r2',recordedAt:'2026-08-23T11:00:00Z'});

const all=readTrainingHistory(storage);
assert.equal(all.length,5);
assert.equal(all[0].type,'recipe-stage');
assert.equal(all[0].challengeId,'recipe:r1:stage:main:flow-accuracy');

const r1=recipeStageHistorySummary(storage,{recipeId:'r1'});
assert.equal(r1.attempts,4);
assert.equal(r1.passes,3);
assert.equal(r1.graduates,1);
assert.equal(r1.stages.length,2);
const main=r1.stages.find(item=>item.stageId==='main');
assert.equal(main.attempts,3);
assert.equal(main.passes,2);
assert.equal(main.graduates,1);
assert.equal(main.passRate,2/3);

const mainOnly=summarizeRecipeStageHistory(all,{recipeId:'r1',stageId:'main',focusId:'flow-accuracy'});
assert.equal(mainOnly.attempts,3);
assert.equal(mainOnly.activeDays,3);
assert.equal(mainOnly.bestStreak,2);

console.log('recipe stage training-history tests: PASS');
