import assert from 'node:assert/strict';
import {
  detectPauseSegments,
  activePauseAtWater,
  stablePauseAtWater,
  pauseProgress,
  pauseTimingScore,
  evaluatePauseCue,
  summarizePauses,
  matchPauseSequences,
  pauseSequenceScore,
  rhythmAssessment,
  weightedAvailableScore
} from '../pour-ghost-sync.js';

const samples = [
  {t:0,water:0,x:0,z:0,pouring:true},
  {t:1000,water:5,x:.1,z:0,pouring:true},
  {t:1100,water:5,x:.1,z:0,pouring:false},
  {t:2100,water:5,x:.1,z:0,pouring:false},
  {t:3100,water:5,x:.1,z:0,pouring:false},
  {t:3200,water:5.5,x:.1,z:0,pouring:true},
  {t:5000,water:15,x:0,z:.1,pouring:true},
  {t:5100,water:15,x:0,z:.1,pouring:false},
  {t:5500,water:15,x:0,z:.1,pouring:false},
  {t:5600,water:16,x:0,z:.1,pouring:true}
];

const pauses = detectPauseSegments(samples);
assert.equal(pauses.length, 1, 'short pauses should be ignored');
assert.equal(pauses[0].water, 5);
assert.equal(pauses[0].duration, 2000);
assert.equal(activePauseAtWater(pauses, 5.7), pauses[0]);
assert.equal(activePauseAtWater(pauses, 8), null);
assert.equal(stablePauseAtWater(pauses, 5.8, null, {enterTolerance:1,exitTolerance:2}), pauses[0]);
assert.equal(stablePauseAtWater(pauses, 6.8, pauses[0], {enterTolerance:1,exitTolerance:2}), pauses[0], 'current pause should stay latched inside wider exit window');
assert.equal(stablePauseAtWater(pauses, 7.2, pauses[0], {enterTolerance:1,exitTolerance:2}), null, 'current pause should release outside exit window');
assert.equal(pauseProgress(pauses[0], 1000), .5);
assert.equal(pauseProgress(pauses[0], 3000), 1);
assert.equal(pauseTimingScore(2000, 2000), 1);
assert.ok(pauseTimingScore(2000, 2600) > pauseTimingScore(2000, 4000));
assert.deepEqual(evaluatePauseCue(pauses[0], 0, true), {state:'pause-now',progress:0,remainingMs:2000,score:null});
assert.equal(evaluatePauseCue(pauses[0], 1000, false).state, 'holding');
assert.equal(evaluatePauseCue(pauses[0], 2000, false).state, 'ready');
assert.equal(evaluatePauseCue(pauses[0], 900, true).state, 'resumed-early');
assert.equal(evaluatePauseCue(pauses[0], 1900, true).state, 'matched');
assert.equal(evaluatePauseCue(pauses[0], 3000, true).state, 'resumed-late');
assert.deepEqual(summarizePauses(null), {count:0,totalPauseMs:0,longestPauseMs:0});
assert.deepEqual(summarizePauses(pauses), {count:1,totalPauseMs:2000,longestPauseMs:2000});

const refPauses = [
  {water:40,duration:30000},
  {water:150,duration:12000},
  {water:210,duration:8000}
];
const actualPauses = [
  {water:40.6,duration:29500},
  {water:151.3,duration:13000},
  {water:209.2,duration:7600}
];
const perfectish = matchPauseSequences(refPauses, actualPauses);
assert.equal(perfectish.matches.length, 3);
assert.equal(perfectish.missed.length, 0);
assert.equal(perfectish.extra.length, 0);
assert.ok(pauseSequenceScore(refPauses, actualPauses) > .94, 'small timing/water deviations should still score highly');
const rhythm = rhythmAssessment(refPauses, actualPauses);
assert.equal(rhythm.applicable, true);
assert.ok(rhythm.score > .94);
assert.equal(rhythm.referenceCount, 3);
assert.equal(rhythm.actualCount, 3);

const missingMiddle = [
  {water:39.8,duration:30000},
  {water:210.5,duration:8000}
];
const missingResult = matchPauseSequences(refPauses, missingMiddle);
assert.equal(missingResult.matches.length, 2);
assert.equal(missingResult.missed.length, 1);
assert.equal(missingResult.missed[0].refIndex, 1);
assert.ok(pauseSequenceScore(refPauses, missingMiddle) < pauseSequenceScore(refPauses, actualPauses));

const withExtra = [...actualPauses, {water:235,duration:6000}];
const extraResult = matchPauseSequences(refPauses, withExtra);
assert.equal(extraResult.extra.length, 1);
assert.ok(pauseSequenceScore(refPauses, withExtra) < pauseSequenceScore(refPauses, actualPauses));

const duplicatedNearFirst = [
  {water:40,duration:30000},
  {water:41,duration:30000},
  {water:150,duration:12000},
  {water:210,duration:8000}
];
const duplicateResult = matchPauseSequences(refPauses, duplicatedNearFirst);
assert.equal(duplicateResult.matches.length, 3, 'one actual pause must not satisfy multiple references');
assert.equal(duplicateResult.extra.length, 1);

assert.equal(pauseSequenceScore([], []), 1);
assert.equal(pauseSequenceScore([], [{water:50,duration:1000}]), .7);
const noRhythm = rhythmAssessment([], []);
assert.deepEqual(
  {applicable:noRhythm.applicable,score:noRhythm.score,reason:noRhythm.reason,referenceCount:noRhythm.referenceCount,actualCount:noRhythm.actualCount},
  {applicable:false,score:null,reason:'no-reference-pauses',referenceCount:0,actualCount:0}
);
const noRefButActual = rhythmAssessment([], [{water:50,duration:1200}]);
assert.equal(noRefButActual.applicable, false);
assert.equal(noRefButActual.score, null);
assert.equal(noRefButActual.extra.length, 1);

assert.equal(weightedAvailableScore([{value:.8,weight:.5},{value:.6,weight:.5}]), .7);
assert.equal(weightedAvailableScore([{value:.8,weight:.48},{value:.6,weight:.27},{value:null,weight:.25}]), (0.8*.48+0.6*.27)/(.48+.27));
assert.equal(weightedAvailableScore([{value:null,weight:1}]), null);
assert.equal(weightedAvailableScore(null), null);

console.log('ghost-sync tests: PASS');
