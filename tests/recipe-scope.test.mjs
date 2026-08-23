import assert from 'node:assert/strict';
import { analyzeBrewTrend, scopeBrewsByRecipe } from '../pour-brew-trend.js';
import { chooseTrainingPlan } from '../pour-training-plan.js';
import { advanceTrainingChallenge, createChallenge, evaluateChallenge } from '../pour-training-progress.js';

const sample=(flowStability=.8,edgeExposure=.1)=>({t:0,x:0,z:0,flow:5,water:0,pouring:true,flowStability,edgeExposure});
const brew=(id,recipeId,score,{coverage=.8,uniformity=.8,analysis={flowStability:.8,edgeExposure:.1}}={})=>({
  id:String(id),createdAt:`2026-08-${String(id).padStart(2,'0')}T00:00:00.000Z`,score,
  recipe:recipeId?{id:recipeId,name:recipeId}:undefined,
  metrics:{coverage,uniformity},analysis,samples:[sample()],
});

const mixed=[
  brew(1,'A',70,{coverage:.6}),brew(2,'B',99,{coverage:.95}),
  brew(3,'A',75,{coverage:.65}),brew(4,'B',55,{coverage:.96}),
  brew(5,'A',80,{coverage:.7}),brew(6,'B',98,{coverage:.97}),
];

assert.equal(scopeBrewsByRecipe(mixed,'A').length,3);
assert.equal(scopeBrewsByRecipe(mixed,'B').length,3);
const a=analyzeBrewTrend(mixed,{recipeId:'A'});
assert.equal(a.valid,true);
assert.deepEqual(a.brews.map(item=>item.recipe.id),['A','A','A']);
assert.equal(a.metrics.score.direction,'improving');
const b=analyzeBrewTrend(mixed,{recipeId:'B'});
assert.equal(b.metrics.score.direction,'flat');

const planA=chooseTrainingPlan(mixed,{recipeId:'A',targetFlow:6});
assert.equal(planA.recipeId,'A');
if(planA.id==='flow-stability') assert(planA.cue.includes('6.0 g/s'));

const challenge=createChallenge({...planA,valid:true,mode:'focus',id:'bed-coverage',metric:'coverage',title:'粉床覆盖专项',target:.75,targetText:'粉床覆盖率 ≥ 75%',current:.7,recipeId:'A'});
assert.equal(challenge.recipeId,'A');
const mismatch=evaluateChallenge(challenge,brew(7,'B',90,{coverage:.9}));
assert.equal(mismatch.applicable,false);
assert.equal(mismatch.recipeMismatch,true);
assert.equal(mismatch.challenge.attempts,0);

const switched=advanceTrainingChallenge(mixed,challenge,brew(8,'B',90,{coverage:.9}),{recipeId:'B',targetFlow:5,window:8});
assert.notEqual(switched.challenge?.recipeId,'A');
if(switched.challenge) assert.equal(switched.challenge.recipeId,'B');

const legacy=[brew(7,null,60),brew(8,null,65),brew(9,null,70)];
assert.equal(analyzeBrewTrend(legacy,{recipeId:null}).valid,true);

console.log('recipe scope tests: PASS');
