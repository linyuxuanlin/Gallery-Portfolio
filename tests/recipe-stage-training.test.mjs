import assert from 'node:assert/strict';
import { chooseRecipeStageTrainingTarget, evaluateRecipeStageTrainingTarget } from '../pour-recipe-stage-training.js';

const consistency=(stage,overall=.64)=>({applicable:true,overallConsistency:overall,worstStageId:stage.id,stages:[stage]});
const base={id:'main',name:'主体注水',flowErrorMean:.2,flowErrorSpread:.1,complianceMean:.88,pauseErrorMean:0,repeatability:.72};

let plan=chooseRecipeStageTrainingTarget(consistency({...base,pauseErrorMean:9}));
assert.equal(plan.focusId,'pause-rhythm');
assert.equal(plan.target.value,4);

plan=chooseRecipeStageTrainingTarget(consistency({...base,flowErrorSpread:.48}));
assert.equal(plan.focusId,'flow-repeatability');
assert.equal(plan.target.metric,'flowErrorSpread');

plan=chooseRecipeStageTrainingTarget(consistency({...base,flowErrorMean:.62}));
assert.equal(plan.focusId,'flow-accuracy');
assert.equal(plan.target.metric,'flowErrorMean');

plan=chooseRecipeStageTrainingTarget(consistency({...base,complianceMean:.58}));
assert.equal(plan.focusId,'flow-compliance');
assert.equal(plan.target.direction,'higher');

plan=chooseRecipeStageTrainingTarget(consistency({...base,repeatability:.68}));
assert.equal(plan.focusId,'repeatability');

const stable=chooseRecipeStageTrainingTarget(consistency({...base,repeatability:.9},.9));
assert.equal(stable.mode,'maintenance');

const notEnough=chooseRecipeStageTrainingTarget({applicable:false,stages:[]});
assert.equal(notEnough.applicable,false);

const current={applicable:true,stages:[{...base,flowErrorSpread:.20}]};
plan=chooseRecipeStageTrainingTarget(consistency({...base,flowErrorSpread:.48}));
const evaluation=evaluateRecipeStageTrainingTarget(plan,current);
assert.equal(evaluation.applicable,true);
assert.equal(evaluation.passed,true);

const failed=evaluateRecipeStageTrainingTarget(plan,{applicable:true,stages:[{...base,flowErrorSpread:.40}]});
assert.equal(failed.passed,false);

console.log('recipe stage training tests: PASS');
