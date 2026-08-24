import assert from 'node:assert/strict';
import { recipeStageHistoryEvent, summarizeRecipeStageHistory } from '../pour-training-history.js';

const event=(replayId,status,recoveryPass,{recipeId='r1',stageId='main',focusId='flow-accuracy'}={})=>({
  version:2,
  type:'recipe-stage',
  replayId,
  challengeId:`recipe:${recipeId}:stage:${stageId}:${focusId}`,
  challengeTitle:'主体 · flow-accuracy',
  recordedAt:`2026-08-${String(10+Number(replayId.replace(/\D/g,'')||0)).padStart(2,'0')}T10:00:00Z`,
  passed:false,
  value:.4,
  target:.3,
  graduated:false,
  recipeId,
  stageId,
  stageName:stageId==='main'?'主体':'闷蒸',
  focusId,
  recoveryStatus:status,
  recoveryPass,
});

const events=[
  event('1','recovery-failed',false),
  event('2','recovery-passed',true),
  event('3','recovered',true),
  event('4','recovery-passed',true,{stageId:'bloom',focusId:'pause-rhythm'}),
  event('5','recovered',true,{stageId:'bloom',focusId:'pause-rhythm'}),
  event('6','recovery-failed',false),
];

const summary=summarizeRecipeStageHistory(events,{recipeId:'r1'});
assert.equal(summary.recovery.recoveryEpisodes,3);
assert.equal(summary.recovery.recoveredEpisodes,2);
assert.equal(summary.recovery.activeRecoveries,1);
assert.equal(summary.recovery.recoveryAttempts,6);
assert.equal(summary.recovery.recoveryPasses,4);
assert.equal(summary.recovery.averageRecoveryCups,2.5);
assert(Math.abs(summary.recovery.recoveryPassRate-4/6)<1e-12);

const main=summary.stages.find(stage=>stage.stageId==='main');
assert.equal(main.recovery.recoveryEpisodes,2);
assert.equal(main.recovery.recoveredEpisodes,1);
assert.equal(main.recovery.activeRecoveries,1);
assert.equal(main.recovery.averageRecoveryCups,3);

const bloom=summary.stages.find(stage=>stage.stageId==='bloom');
assert.equal(bloom.recovery.recoveryEpisodes,1);
assert.equal(bloom.recovery.recoveredEpisodes,1);
assert.equal(bloom.recovery.averageRecoveryCups,2);

const transition={
  status:'recovery-passed',
  plan:{stageId:'main',stageName:'主体',focusId:'flow-accuracy'},
  evaluation:{
    applicable:true,
    current:.28,
    target:.30,
    recoveryStatus:'recovery-passed',
    recoveryPass:true,
    trendPolicy:'recovery',
  },
};
const persisted=recipeStageHistoryEvent(transition,{replayId:'x',recipeId:'r1',recordedAt:'2026-08-24T10:00:00Z'});
assert.equal(persisted.recoveryStatus,'recovery-passed');
assert.equal(persisted.recoveryPass,true);
assert.equal(persisted.trendPolicy,'recovery');

console.log('recipe recovery-history regression: PASS');
