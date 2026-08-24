import assert from 'node:assert/strict';
import { recoveryRiskForStage, stageTrainingPriority, rankStageTrainingCandidates } from '../pour-stage-priority.js';

const stages=[
  {stage:{id:'bloom',repeatability:.70},focus:{id:'flow-accuracy',severity:1.8}},
  {stage:{id:'main',repeatability:.76},focus:{id:'flow-accuracy',severity:1.35}},
];
const history=[
  {stageId:'main',attempts:8,recovery:{recoveryEpisodes:4,recoveredEpisodes:2,activeRecoveries:1,recoveryAttempts:9,recoveryPasses:3,recoveryPassRate:1/3,averageRecoveryCups:4.5}},
  {stageId:'bloom',attempts:5,recovery:{recoveryEpisodes:1,recoveredEpisodes:1,activeRecoveries:0,recoveryAttempts:2,recoveryPasses:2,recoveryPassRate:1,averageRecoveryCups:2}},
];

const mainRisk=recoveryRiskForStage('main',history);
const bloomRisk=recoveryRiskForStage('bloom',history);
assert(mainRisk.score>bloomRisk.score);

const ranked=rankStageTrainingCandidates(stages,history);
assert.equal(ranked[0].stage.id,'main','high Recovery Risk should promote a fragile stage above a slightly worse current execution stage');
assert(ranked[0].priority>ranked[1].priority);

const noHistory=rankStageTrainingCandidates(stages,[]);
assert.equal(noHistory[0].stage.id,'bloom','without Recovery history current execution severity should dominate');

assert(stageTrainingPriority({severity:1.3,repeatability:.8,recovery:{score:80}})>stageTrainingPriority({severity:1.3,repeatability:.8,recovery:{score:0}}));
assert.equal(recoveryRiskForStage('missing',history).applicable,false);

console.log('stage priority tests: PASS');
