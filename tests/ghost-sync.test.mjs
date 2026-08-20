import assert from 'node:assert/strict';
import { detectPauseSegments, activePauseAtWater, pauseProgress, pauseTimingScore, evaluatePauseCue, summarizePauses } from '../pour-ghost-sync.js';

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

console.log('ghost-sync tests: PASS');
