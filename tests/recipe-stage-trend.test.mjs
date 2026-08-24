import assert from 'node:assert/strict';
import { analyzeRecipeStageTrends, classifyTargetTrajectory } from '../pour-recipe-stage-trend.js';

const event=(value,i,{recipeId='r1',focusId='flow-accuracy',stageId='main',target=.30}={})=>({
  type:'recipe-stage',recipeId,stageId,stageName:'主体',focusId,value,target,replayId:`${recipeId}-${i}`,
  recordedAt:`2026-08-${String(10+i).padStart(2,'0')}T10:00:00Z`
});

let a=analyzeRecipeStageTrends([.62,.52,.44,.36,.32].map((v,i)=>event(v,i)),{recipeId:'r1'});
assert.equal(a.applicable,true);
assert.equal(a.trends[0].status,'improving');
assert.equal(a.trends[0].targetState,'converging-below-target');
assert.equal(a.trends[0].hitTarget,false);

a=analyzeRecipeStageTrends([.38,.29,.25,.28,.35].map((v,i)=>event(v,i)),{recipeId:'r1'});
assert.equal(a.trends[0].targetState,'regressing-after-target');
assert.equal(a.trends[0].hitTarget,false);
assert.equal(a.trends[0].everHitTarget,true);
assert(a.trends[0].targetCrossings>=2);

a=analyzeRecipeStageTrends([.42,.34,.29,.27,.26].map((v,i)=>event(v,i)),{recipeId:'r1'});
assert.equal(a.trends[0].targetState,'holding-target');
assert.equal(a.trends[0].hitTarget,true);

a=analyzeRecipeStageTrends([.31,.36,.42,.47,.51].map((v,i)=>event(v,i)),{recipeId:'r1'});
assert.equal(a.trends[0].targetState,'moving-away');

a=analyzeRecipeStageTrends([.61,.68,.74,.78,.79].map((v,i)=>event(v,i,{focusId:'flow-compliance',target:.80})),{recipeId:'r1'});
assert.equal(a.trends[0].targetState,'converging-below-target');

a=analyzeRecipeStageTrends([.82,.86,.84,.81,.76].map((v,i)=>event(v,i,{focusId:'flow-compliance',target:.80})),{recipeId:'r1'});
assert.equal(a.trends[0].targetState,'regressing-after-target');

const mixed=[
  ...[.6,.5,.4].map((v,i)=>event(v,i,{recipeId:'r1'})),
  ...[.2,.8,.9].map((v,i)=>event(v,i,{recipeId:'r2'})),
];
a=analyzeRecipeStageTrends(mixed,{recipeId:'r1'});
assert.equal(a.trends.length,1);
assert.deepEqual(a.trends[0].values,[.6,.5,.4]);

const noTarget=classifyTargetTrajectory({values:[1,2,3],target:null,status:'improving'});
assert.equal(noTarget.state,'no-target');
assert.equal(noTarget.hitTarget,null);

assert.equal(analyzeRecipeStageTrends([event(.4,0),event(.3,1)],{recipeId:'r1'}).applicable,false);
console.log('recipe stage trend tests: PASS');
