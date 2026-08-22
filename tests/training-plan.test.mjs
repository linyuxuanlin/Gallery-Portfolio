import assert from 'node:assert/strict';
import { chooseTrainingPlan, evaluateTrainingPlan, trainingPlanSummary } from '../pour-training-plan.js';
import { analyzeBrew } from '../pour-brew-analysis.js';

function samples(flows=[5,5,5,5],radius=.25){
  return flows.map((flow,i)=>({t:i*1000,x:i%2?radius:0,z:0,flow,water:i*5,pouring:true}));
}
function brew(i,{coverage=.82,uniformity=.80,flows=[5,5,5,5],radius=.25,score=85}={}){
  const s=samples(flows,radius);
  return {createdAt:`2026-08-${String(i).padStart(2,'0')}T00:00:00.000Z`,score,metrics:{coverage,uniformity},samples:s,analysis:analyzeBrew(s)};
}

const coverageHistory=[1,2,3,4].map((i,j)=>brew(i,{coverage:.56+j*.02,uniformity:.82}));
let plan=chooseTrainingPlan(coverageHistory);
assert.equal(plan.valid,true);
assert.equal(plan.metric,'coverage');
assert.match(plan.title,/覆盖/);

const unstableHistory=[
  brew(1,{flows:[5,5,5,5]}),
  brew(2,{flows:[4,6,4,6]}),
  brew(3,{flows:[3,7,3,7]}),
  brew(4,{flows:[2,8,2,8]}),
];
plan=chooseTrainingPlan(unstableHistory);
assert.equal(plan.metric,'flowStability');
assert.equal(plan.trendDirection,'declining');

const stableHistory=[1,2,3,4].map(i=>brew(i));
plan=chooseTrainingPlan(stableHistory);
assert.equal(plan.mode,'maintenance');

assert.equal(chooseTrainingPlan([brew(1),brew(2)]).valid,false);
assert.equal(evaluateTrainingPlan({valid:true,mode:'focus',metric:'coverage',target:.75},{metrics:{coverage:.80}}).passed,true);
assert.equal(evaluateTrainingPlan({valid:true,mode:'focus',metric:'edgeExposure',target:.18},{analysis:{edgeExposure:.26}}).passed,false);
assert.equal(trainingPlanSummary({valid:true,mode:'focus',headline:'下一杯',targetText:'粉床覆盖率 ≥ 75%',current:.62,cue:'扩大范围'}).length,3);
console.log('training plan tests: PASS');
