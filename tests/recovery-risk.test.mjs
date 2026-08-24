import assert from 'node:assert/strict';
import { recoveryRisk, rankRecoveryRisks } from '../pour-recovery-risk.js';

assert.equal(recoveryRisk({recoveryEpisodes:0}).applicable,false);

const low=recoveryRisk({
  recoveryEpisodes:1,recoveredEpisodes:1,activeRecoveries:0,
  averageRecoveryCups:1,recoveryPassRate:1,
});
assert.equal(low.level,'low');
assert(low.score<30);

const risky=recoveryRisk({
  recoveryEpisodes:4,recoveredEpisodes:2,activeRecoveries:1,
  averageRecoveryCups:4.5,recoveryPassRate:.4,
});
assert(['high','critical'].includes(risky.level));
assert(risky.score>low.score);
assert(risky.reason.includes('当前仍在恢复'));

const ordered=rankRecoveryRisks([
  {stageId:'bloom',attempts:8,recovery:{recoveryEpisodes:1,recoveredEpisodes:1,averageRecoveryCups:1,recoveryPassRate:1,activeRecoveries:0}},
  {stageId:'main',attempts:6,recovery:{recoveryEpisodes:4,recoveredEpisodes:2,averageRecoveryCups:4,recoveryPassRate:.4,activeRecoveries:1}},
]);
assert.equal(ordered[0].stageId,'main');
assert(ordered[0].recoveryRisk.score>ordered[1].recoveryRisk.score);

console.log('recovery risk tests: PASS');
