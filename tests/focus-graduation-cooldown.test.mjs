import assert from 'node:assert/strict';
import { summarizeRecipeStageHistory } from '../pour-training-history.js';
import { graduationCooldownForFocus, rankFocusTrainingCandidates } from '../pour-stage-priority.js';

const event=(replayId,focusId,{graduated=false,recordedAt}={})=>({
  type:'recipe-stage',recipeId:'r1',stageId:'main',stageName:'主体',focusId,
  replayId,challengeId:`recipe:r1:stage:main:${focusId}`,
  recordedAt:recordedAt||`2026-08-24T10:00:${String(replayId).padStart(2,'0')}Z`,
  passed:true,value:.3,target:.3,graduated,
});

let events=[
  event('01','flow-accuracy',{graduated:true}),
  event('02','pause-rhythm'),
];
let history=summarizeRecipeStageHistory(events,{recipeId:'r1'});
let cooldown=graduationCooldownForFocus('main','flow-accuracy',history.stages);
assert.equal(cooldown.active,true);
assert.equal(cooldown.cupsSinceGraduation,1);
assert.equal(cooldown.remaining,1);

// Two distinct Replay cups after graduation release the cooldown, regardless of wall-clock time.
events.push(event('03','pause-rhythm'));
history=summarizeRecipeStageHistory(events,{recipeId:'r1'});
cooldown=graduationCooldownForFocus('main','flow-accuracy',history.stages);
assert.equal(cooldown.active,false);
assert.equal(cooldown.cupsSinceGraduation,2);

const stage={
  id:'main',name:'主体',repeatability:.76,
  flowErrorMean:.36,flowErrorSpread:.18,complianceMean:.82,pauseErrorMean:6,
};
const recentlyGraduated=[
  {
    stageId:'main',focusId:'flow-accuracy',graduates:1,
    lastGraduatedAt:'2026-08-24T10:00:00Z',cupsSinceGraduation:0,
    recovery:{recoveryEpisodes:0,recoveredEpisodes:0,activeRecoveries:0,recoveryPassRate:0},
  },
  {
    stageId:'main',focusId:'pause-rhythm',graduates:0,cupsSinceGraduation:null,
    recovery:{recoveryEpisodes:4,recoveredEpisodes:4,activeRecoveries:0,averageRecoveryCups:1,recoveryPassRate:1},
  },
];
let ranked=rankFocusTrainingCandidates(stage,{
  id:'flow-accuracy',metric:'flowErrorMean',direction:'lower',value:.30,current:.36,
  label:'平均流速误差 ≤ 0.30 g/s',cue:'',severity:1.2,
},recentlyGraduated);
assert.equal(ranked[0].id,'pause-rhythm','freshly graduated focus should cool down when a viable alternative exists');
assert.equal(ranked.find(item=>item.id==='flow-accuracy').cooldown.active,true);

// Serious live execution error is allowed to override the cooldown.
const emergencyHistory=[{
  stageId:'main',focusId:'flow-accuracy',graduates:1,
  lastGraduatedAt:'2026-08-24T10:00:00Z',cupsSinceGraduation:0,
  recovery:{recoveryEpisodes:0,recoveredEpisodes:0,activeRecoveries:0,recoveryPassRate:0},
}];
ranked=rankFocusTrainingCandidates({...stage,flowErrorMean:1.1},{
  id:'flow-accuracy',metric:'flowErrorMean',direction:'lower',value:.30,current:1.1,
  label:'平均流速误差 ≤ 0.30 g/s',cue:'',severity:3.7,
},emergencyHistory);
assert.equal(ranked[0].id,'flow-accuracy');
assert.equal(ranked[0].cooldownBypassed,true);

console.log('focus graduation cooldown tests: PASS');
