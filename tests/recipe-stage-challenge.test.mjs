import assert from 'node:assert/strict';
import { readRecipeStageProgress, syncRecipeStageChallenge, resetRecipeStageChallenges } from '../pour-recipe-stage-challenge.js';

const memoryStorage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)}};
const plan={applicable:true,mode:'focus',recipeId:'recipe-a',stageId:'main',stageName:'主体注水',focusId:'flow-accuracy',headline:'下一杯重点：主体注水',cue:'稳住倾角',target:{metric:'flowErrorMean',direction:'lower',value:.30,current:.55,label:'平均流速误差 ≤ 0.30 g/s'}};
const evaluator=value=>target=>({applicable:true,passed:value<=target.target.value,current:value,target:target.target.value});

const storage=memoryStorage();
let result=syncRecipeStageChallenge(storage,{recipeId:'recipe-a',plan,latestReplayId:'brew-1',evaluate:evaluator(.2),requiredPasses:2});
assert.equal(result.status,'started');
assert.equal(result.progress.challenge.attempts,0,'baseline brew must not count as an attempt');

result=syncRecipeStageChallenge(storage,{recipeId:'recipe-a',plan,latestReplayId:'brew-1',evaluate:evaluator(.2),requiredPasses:2});
assert.equal(result.status,'waiting');
assert.equal(result.progress.challenge.attempts,0,'same replay must be deduplicated');

result=syncRecipeStageChallenge(storage,{recipeId:'recipe-a',plan,latestReplayId:'brew-imported',evaluate:evaluator(.2),requiredPasses:2,allowEvaluation:false});
assert.equal(result.status,'waiting');
assert.equal(result.progress.challenge.attempts,0,'history import refresh must not count as training');

result=syncRecipeStageChallenge(storage,{recipeId:'recipe-a',plan,latestReplayId:'brew-2',evaluate:evaluator(.2),requiredPasses:2});
assert.equal(result.status,'passed');
assert.equal(result.progress.challenge.consecutivePasses,1);

result=syncRecipeStageChallenge(storage,{recipeId:'recipe-a',plan,latestReplayId:'brew-3',evaluate:evaluator(.6),requiredPasses:2});
assert.equal(result.status,'failed');
assert.equal(result.progress.challenge.consecutivePasses,0,'a miss must reset the consecutive pass streak');

result=syncRecipeStageChallenge(storage,{recipeId:'recipe-a',plan,latestReplayId:'brew-4',evaluate:evaluator(.25),requiredPasses:2});
assert.equal(result.progress.challenge.consecutivePasses,1);
result=syncRecipeStageChallenge(storage,{recipeId:'recipe-a',plan,latestReplayId:'brew-5',evaluate:evaluator(.20),requiredPasses:2});
assert.equal(result.status,'graduated');
assert.equal(result.completedKey,'main:flow-accuracy');
assert.deepEqual(readRecipeStageProgress(storage,'recipe-a').completedKeys,['main:flow-accuracy']);
assert.equal(readRecipeStageProgress(storage,'recipe-a').challenge,null);

const recipeB={...plan,recipeId:'recipe-b'};
result=syncRecipeStageChallenge(storage,{recipeId:'recipe-b',plan:recipeB,latestReplayId:'brew-b1',evaluate:evaluator(.2)});
assert.equal(result.status,'started');
assert.deepEqual(readRecipeStageProgress(storage,'recipe-a').completedKeys,['main:flow-accuracy'],'recipe progress must remain isolated');
assert.equal(resetRecipeStageChallenges(storage,'recipe-b'),true);
assert.equal(readRecipeStageProgress(storage,'recipe-b').challenge,null);

console.log('recipe stage challenge tests: PASS');
