import assert from 'node:assert/strict';
import { createChallenge, evaluateChallenge, advanceTrainingChallenge, challengeSummary } from '../pour-training-progress.js';

const plan={valid:true,mode:'focus',id:'bed-coverage',metric:'coverage',title:'粉床覆盖专项',target:.75,targetText:'粉床覆盖率 ≥ 75%',cue:'扩大浸润'};
const replay=value=>({metrics:{coverage:value},analysis:{}});

let challenge=createChallenge(plan,{createdAt:'2026-08-23T00:00:00.000Z'});
assert.equal(challenge.attempts,0);
let r=evaluateChallenge(challenge,replay(.62));
assert.equal(r.applicable,true);assert.equal(r.passed,false);assert.equal(r.completed,false);assert.equal(r.challenge.attempts,1);assert.equal(r.challenge.consecutivePasses,0);
challenge=r.challenge;
r=evaluateChallenge(challenge,replay(.79));
assert.equal(r.passed,true);assert.equal(r.completed,true);assert.equal(r.challenge.passes,1);

challenge=createChallenge(plan);
r=evaluateChallenge(challenge,replay(.78),{requiredPasses:2});
assert.equal(r.completed,false);challenge=r.challenge;
r=evaluateChallenge(challenge,replay(.70),{requiredPasses:2});
assert.equal(r.completed,false);assert.equal(r.challenge.consecutivePasses,0);challenge=r.challenge;
r=evaluateChallenge(challenge,replay(.80),{requiredPasses:2});challenge=r.challenge;
r=evaluateChallenge(challenge,replay(.81),{requiredPasses:2});
assert.equal(r.completed,true);assert.equal(r.challenge.passes,3);assert.equal(r.challenge.attempts,4);

const flowPlan={valid:true,mode:'focus',id:'flow-stability',metric:'flowStability',title:'流速稳定专项',target:.75,targetText:'流速稳定度 ≥ 75%',cue:'稳住'};
let flow=createChallenge(flowPlan);
let fr=evaluateChallenge(flow,{analysis:{flowStability:.74},metrics:{}});
assert.equal(fr.passed,false);flow=fr.challenge;
fr=evaluateChallenge(flow,{analysis:{flowStability:.76},metrics:{}});
assert.equal(fr.passed,true);

const summary=challengeSummary(r.challenge,r);
assert(summary.some(x=>x.includes('本杯达标')));
assert(summary.some(x=>x.includes('已练 4 杯')));

const invalid=evaluateChallenge(createChallenge(plan),{metrics:{},analysis:{}});
assert.equal(invalid.applicable,false);

console.log('training progress tests: PASS');
