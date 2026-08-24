import assert from 'node:assert/strict';
import { createRecipeStageChallenge, readRecipeStageProgress, syncRecipeStageChallenge } from '../pour-recipe-stage-challenge.js';
import { recoveryProgressSummary } from '../pour-recipe-stage-recovery.js';

const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}};
const plan={applicable:true,mode:'focus',recipeId:'r1',stageId:'main',stageName:'主体',focusId:'flow-accuracy',headline:'主体',cue:'稳住',target:{metric:'flowErrorMean',direction:'lower',value:.30,current:.28,label:'≤ .30'}};
const evalNormal=value=>()=>({applicable:true,passed:value<=.30,originalPassed:value<=.30,current:value,target:.30,trendPolicy:'confirm'});
const evalRecovery=value=>()=>({applicable:true,passed:false,originalPassed:value<=.30,current:value,target:.30,trendPolicy:'recovery',resetStreak:true});

const storage=memory();
let t=syncRecipeStageChallenge(storage,{recipeId:'r1',plan,latestReplayId:'a',evaluate:evalNormal(.2)});
assert.equal(t.status,'started');
t=syncRecipeStageChallenge(storage,{recipeId:'r1',plan,latestReplayId:'b',evaluate:evalNormal(.2)});
assert.equal(t.status,'passed');
assert.equal(t.progress.challenge.consecutivePasses,1);

// A regression enters persistent recovery and clears normal graduation streak.
t=syncRecipeStageChallenge(storage,{recipeId:'r1',plan,latestReplayId:'c',evaluate:evalRecovery(.34)});
assert.equal(t.status,'recovery-failed');
assert.equal(t.progress.challenge.consecutivePasses,0);
assert.equal(t.progress.challenge.recovery.active,true);
assert.equal(t.progress.challenge.recovery.consecutivePasses,0);
assert.equal(readRecipeStageProgress(storage,'r1').challenge.recovery.active,true);

// First recovered cup is recovery 1/2, not normal graduation 1/2.
t=syncRecipeStageChallenge(storage,{recipeId:'r1',plan,latestReplayId:'d',evaluate:evalRecovery(.27)});
assert.equal(t.status,'recovery-passed');
assert.equal(t.progress.challenge.recovery.consecutivePasses,1);
assert.equal(t.progress.challenge.consecutivePasses,0);
let summary=recoveryProgressSummary(t.progress.challenge);
assert.equal(summary.current,1);assert.equal(summary.required,2);

// Second consecutive recovered cup exits recovery, still without graduation progress.
t=syncRecipeStageChallenge(storage,{recipeId:'r1',plan,latestReplayId:'e',evaluate:evalRecovery(.25)});
assert.equal(t.status,'recovered');
assert.equal(t.recovered,true);
assert.equal(t.progress.challenge.recovery,null);
assert.equal(t.progress.challenge.consecutivePasses,0);

// Normal confirmation starts again only after recovery has cleared.
t=syncRecipeStageChallenge(storage,{recipeId:'r1',plan,latestReplayId:'f',evaluate:evalNormal(.24)});
assert.equal(t.status,'passed');assert.equal(t.progress.challenge.consecutivePasses,1);
t=syncRecipeStageChallenge(storage,{recipeId:'r1',plan,latestReplayId:'g',evaluate:evalNormal(.23)});
assert.equal(t.status,'graduated');

// A failed recovery cup resets the recovery streak.
const s2=memory();syncRecipeStageChallenge(s2,{recipeId:'r1',plan,latestReplayId:'a',evaluate:evalNormal(.2)});
t=syncRecipeStageChallenge(s2,{recipeId:'r1',plan,latestReplayId:'b',evaluate:evalRecovery(.25)});assert.equal(t.progress.challenge.recovery.consecutivePasses,1);
t=syncRecipeStageChallenge(s2,{recipeId:'r1',plan,latestReplayId:'c',evaluate:evalRecovery(.4)});assert.equal(t.progress.challenge.recovery.consecutivePasses,0);

console.log('recipe stage recovery tests: PASS');
