import assert from 'node:assert/strict';
import { stageChallengeTrendPolicy, applyStageChallengeTrendPolicy } from '../pour-recipe-stage-policy.js';

const pass={applicable:true,passed:true,current:.28,target:.30};
const fail={applicable:true,passed:false,current:.36,target:.30};

let policy=stageChallengeTrendPolicy({targetState:'holding-target'});
assert.equal(policy.mode,'confirm');
assert.equal(policy.allowPass,true);
assert.equal(applyStageChallengeTrendPolicy(pass,policy).passed,true);

policy=stageChallengeTrendPolicy({targetState:'regressing-after-target'});
assert.equal(policy.mode,'recovery');
assert.equal(policy.allowPass,false);
assert.equal(policy.resetStreak,true);
let result=applyStageChallengeTrendPolicy(pass,policy);
assert.equal(result.passed,false);
assert.equal(result.originalPassed,true);
assert.equal(result.trendBlocked,true);
assert.equal(result.resetStreak,true);

policy=stageChallengeTrendPolicy({targetState:'converging-below-target'});
assert.equal(policy.mode,'converging');
assert.equal(policy.allowPass,false);
result=applyStageChallengeTrendPolicy(fail,policy);
assert.equal(result.passed,false);
assert.equal(result.trendBlocked,false);

policy=stageChallengeTrendPolicy({targetState:'moving-away'});
assert.equal(policy.mode,'recovery');
assert.equal(policy.resetStreak,true);

policy=stageChallengeTrendPolicy({targetState:'stalled-below-target'});
assert.equal(policy.mode,'stalled');
assert.equal(policy.allowPass,false);

policy=stageChallengeTrendPolicy(null);
assert.equal(policy.mode,'normal');
assert.equal(policy.allowPass,true);

console.log('recipe stage policy tests: PASS');
