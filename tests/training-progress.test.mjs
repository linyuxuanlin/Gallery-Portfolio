import assert from 'node:assert/strict';
import { DEFAULT_REQUIRED_PASSES, createChallenge, evaluateChallenge, advanceTrainingChallenge, challengeSummary, trainingReplayId } from '../pour-training-progress.js';
import { evaluateTrainingPlan } from '../pour-training-plan.js';

const plan={valid:true,mode:'focus',id:'bed-coverage',metric:'coverage',title:'粉床覆盖专项',current:.68,target:.75,targetText:'粉床覆盖率 ≥ 75%',cue:'扩大浸润'};
const replay=(value,id='brew-a')=>({id,metrics:{coverage:value},analysis:{},samples:[{t:0,x:0,z:0,flow:0,water:0},{t:1000,x:0,z:0,flow:5,water:5}]});

assert.equal(DEFAULT_REQUIRED_PASSES,2);
let challenge=createChallenge(plan,{createdAt:'2026-08-23T00:00:00.000Z',baselineReplayId:'baseline'});
assert.equal(challenge.version,3);
assert.equal(challenge.attempts,0);
assert.equal(challenge.requiredPasses,2);
assert.equal(challenge.lastValue,.68,'challenge must preserve the baseline brew metric');

let r=evaluateChallenge(challenge,replay(.62,'brew-1'));
assert.equal(r.applicable,true);assert.equal(r.passed,false);assert.equal(r.completed,false);assert.equal(r.challenge.attempts,1);assert.equal(r.challenge.consecutivePasses,0);
assert.equal(r.previousValue,.68);assert(Math.abs(r.delta+.06)<1e-12);assert.equal(r.remainingPasses,2);
challenge=r.challenge;
const duplicate=evaluateChallenge(challenge,replay(.90,'brew-1'));
assert.equal(duplicate.applicable,false);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.challenge.attempts,1);

r=evaluateChallenge(challenge,replay(.79,'brew-2'));
assert.equal(r.passed,true);assert.equal(r.completed,false,'one good cup must not graduate a two-cup challenge');assert.equal(r.challenge.passes,1);assert.equal(r.challenge.consecutivePasses,1);assert.equal(r.remainingPasses,1);
assert.equal(r.previousValue,.62);assert(Math.abs(r.delta-.17)<1e-12);
challenge=r.challenge;
r=evaluateChallenge(challenge,replay(.81,'brew-3'));
assert.equal(r.passed,true);assert.equal(r.completed,true);assert.equal(r.challenge.consecutivePasses,2);assert.equal(r.remainingPasses,0);

challenge=createChallenge(plan,{baselineReplayId:'baseline'});
r=evaluateChallenge(challenge,replay(.78,'brew-1'));
assert.equal(r.completed,false);challenge=r.challenge;
r=evaluateChallenge(challenge,replay(.70,'brew-2'));
assert.equal(r.completed,false);assert.equal(r.challenge.consecutivePasses,0,'a miss must reset the streak');challenge=r.challenge;
r=evaluateChallenge(challenge,replay(.80,'brew-3'));challenge=r.challenge;
r=evaluateChallenge(challenge,replay(.81,'brew-4'));
assert.equal(r.completed,true);assert.equal(r.challenge.passes,3);assert.equal(r.challenge.attempts,4);

const flowPlan={valid:true,mode:'focus',id:'flow-stability',metric:'flowStability',title:'流速稳定专项',current:.70,target:.75,targetText:'流速稳定度 ≥ 75%',cue:'稳住'};
const stableReplay={id:'flow-1',samples:[{t:0,x:0,z:0,flow:0,water:0},{t:1000,x:.1,z:0,flow:5,water:5,pouring:true},{t:2000,x:.2,z:0,flow:5,water:10,pouring:true}],metrics:{}};
const derived=evaluateTrainingPlan(flowPlan,stableReplay);
assert.equal(derived.applicable,true);assert(derived.value>.99);assert.equal(derived.passed,true);

const edgePlan={valid:true,mode:'focus',id:'edge-control',metric:'edgeExposure',title:'外圈控制专项',current:.26,target:.18,targetText:'外圈暴露 ≤ 18%',cue:'收圈'};
challenge=createChallenge(edgePlan,{baselineReplayId:'edge-base'});
const edgeReplay={id:'edge-1',analysis:{edgeExposure:.16},samples:[{t:0,x:0,z:0,flow:0,water:0}],metrics:{}};
r=evaluateChallenge(challenge,edgeReplay);
assert.equal(r.passed,true);assert(Math.abs(r.delta+.10)<1e-12);assert(Math.abs(r.improvementDelta-.10)<1e-12,'lower-is-better metric must report positive improvement');

const summary=challengeSummary(r.challenge,r);
assert(summary.some(x=>x.includes('本杯达标')));
assert(summary.some(x=>x.includes('上杯 26% → 本杯 16%')));
assert(summary.some(x=>x.includes('连续达标 1/2')));

const invalid=evaluateChallenge(createChallenge(plan),{id:'invalid',metrics:{},analysis:{},samples:[]});
assert.equal(invalid.applicable,false);
assert.equal(trainingReplayId({createdAt:'x',duration:1,score:2,samples:[{}]}),'x|1|2|1');

const history=[replay(.80,'latest'),replay(.60,'older'),replay(.55,'oldest')];
const start=advanceTrainingChallenge(history,null,history[0]);
if(start.challenge){
  assert.equal(start.challenge.lastReplayId,'latest','new challenge must baseline the brew that created it');
  assert.equal(start.challenge.requiredPasses,2);
  const same=advanceTrainingChallenge(history,start.challenge,history[0]);
  assert.equal(same.status,'unchanged');assert.equal(same.challenge.attempts,0);
}

console.log('training progress tests: PASS');
