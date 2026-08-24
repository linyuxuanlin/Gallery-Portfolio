import assert from 'node:assert/strict';
import { analyzeRecipeStageTrends } from '../pour-recipe-stage-trend.js';

const event=(value,i,{recipeId='r1',focusId='flow-accuracy',stageId='main',target=.30}={})=>({
  type:'recipe-stage',recipeId,stageId,stageName:'主体',focusId,value,target,replayId:`${recipeId}-${i}`,
  recordedAt:`2026-08-${String(10+i).padStart(2,'0')}T10:00:00Z`
});

let a=analyzeRecipeStageTrends([.62,.50,.43,.34,.26].map((v,i)=>event(v,i)),{recipeId:'r1'});
assert.equal(a.applicable,true);
assert.equal(a.trends[0].status,'improving');
assert.equal(a.trends[0].hitTarget,true);

a=analyzeRecipeStageTrends([.22,.27,.33,.41,.48].map((v,i)=>event(v,i)),{recipeId:'r1'});
assert.equal(a.trends[0].status,'declining');
assert.equal(a.trends[0].hitTarget,false);

a=analyzeRecipeStageTrends([.61,.68,.74,.82,.85].map((v,i)=>event(v,i,{focusId:'flow-compliance',target:.80})),{recipeId:'r1'});
assert.equal(a.trends[0].status,'improving');
assert.equal(a.trends[0].hitTarget,true);

const mixed=[
  ...[.6,.5,.4].map((v,i)=>event(v,i,{recipeId:'r1'})),
  ...[.2,.8,.9].map((v,i)=>event(v,i,{recipeId:'r2'})),
];
a=analyzeRecipeStageTrends(mixed,{recipeId:'r1'});
assert.equal(a.trends.length,1);
assert.deepEqual(a.trends[0].values,[.6,.5,.4]);

assert.equal(analyzeRecipeStageTrends([event(.4,0),event(.3,1)],{recipeId:'r1'}).applicable,false);
console.log('recipe stage trend tests: PASS');
