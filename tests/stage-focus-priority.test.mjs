import assert from 'node:assert/strict';
import { rankFocusTrainingCandidates } from '../pour-stage-priority.js';

const stage={
  id:'main',name:'主体',repeatability:.76,
  flowErrorMean:.42,flowErrorSpread:.18,complianceMean:.81,pauseErrorMean:1.2,
};
const base={
  id:'flow-accuracy',metric:'flowErrorMean',direction:'lower',value:.30,
  current:.42,severity:.42/.30,label:'平均流速误差 ≤ 0.30 g/s',cue:'test',
};

const fragilePause=[{
  stageId:'main',focusId:'pause-rhythm',
  recovery:{recoveryEpisodes:4,recoveredEpisodes:2,activeRecoveries:1,averageRecoveryCups:4.5,recoveryPassRate:.4},
}];

let ranked=rankFocusTrainingCandidates(stage,base,fragilePause);
assert.equal(ranked[0].id,'pause-rhythm','fragile historical focus should beat a modest one-cup deviation');
assert.equal(ranked[0].switchedByRecovery,true);
assert(ranked[0].recovery.score>=70);

const extreme={...stage,flowErrorMean:1.25};
ranked=rankFocusTrainingCandidates(extreme,{...base,current:1.25,severity:1.25/.30},fragilePause);
assert.equal(ranked[0].id,'flow-accuracy','extreme live execution error must outrank historical fragility');

const lowRisk=[{
  stageId:'main',focusId:'pause-rhythm',
  recovery:{recoveryEpisodes:1,recoveredEpisodes:1,activeRecoveries:0,averageRecoveryCups:1,recoveryPassRate:1},
}];
ranked=rankFocusTrainingCandidates(stage,base,lowRisk);
assert.equal(ranked[0].id,'flow-accuracy','low recovery risk must not cause focus churn');

const otherStage=[{
  stageId:'bloom',focusId:'pause-rhythm',
  recovery:{recoveryEpisodes:4,recoveredEpisodes:0,activeRecoveries:1,averageRecoveryCups:5,recoveryPassRate:.2},
}];
ranked=rankFocusTrainingCandidates(stage,base,otherStage);
assert.equal(ranked[0].id,'flow-accuracy','recovery risk must remain stage-scoped');

console.log('stage focus priority tests: PASS');
