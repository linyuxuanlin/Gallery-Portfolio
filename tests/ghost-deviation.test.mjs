import assert from 'node:assert/strict';
import { sampleAtWater, buildGhostDeviationTimeline, ghostDeviationSummary } from '../pour-ghost-deviation.js';

const makeSamples = ({ pathScale = .2, flow = 5, flowWave = 0 } = {}) => Array.from({ length: 51 }, (_, i) => {
  const water = i * 5;
  const angle = i / 8;
  return {
    t: i * 800,
    x: Math.cos(angle) * pathScale,
    z: Math.sin(angle) * pathScale,
    flow: flow + Math.sin(i / 4) * flowWave,
    water,
    pouring: true,
  };
});

const ghost = makeSamples({ pathScale: .22, flow: 5 });
const close = makeSamples({ pathScale: .225, flow: 5.2, flowWave: .1 });
const far = makeSamples({ pathScale: .48, flow: 7, flowWave: .5 });

const interpolated = sampleAtWater([
  { water: 0, x: 0, z: 0, flow: 4, t: 0, pouring: true },
  { water: 10, x: .2, z: .1, flow: 6, t: 1000, pouring: true },
], 5);
assert(Math.abs(interpolated.x - .1) < 1e-9);
assert(Math.abs(interpolated.flow - 5) < 1e-9);
assert.equal(interpolated.water, 5);

const closeTimeline = buildGhostDeviationTimeline(close, ghost);
assert.equal(closeTimeline.valid, true);
assert(closeTimeline.points.length >= 50);
assert(closeTimeline.segments.length >= 9);
assert(closeTimeline.meanPathDelta < .08);
assert(closeTimeline.meanFlowDelta < .7);
assert.equal(ghostDeviationSummary(closeTimeline).headline, '整体跟冲稳定');

const farTimeline = buildGhostDeviationTimeline(far, ghost);
assert.equal(farTimeline.valid, true);
assert(farTimeline.meanPathDelta > .12);
assert(farTimeline.meanFlowDelta > 1);
assert.equal(ghostDeviationSummary(farTimeline).headline, '轨迹偏差是主要问题');
assert(ghostDeviationSummary(farTimeline).notes.length >= 1);

const short = buildGhostDeviationTimeline([{ water: 0 }], ghost);
assert.equal(short.valid, false);

const capped = buildGhostDeviationTimeline(close, ghost, { maxWater: 100, stepWater: 10 });
assert.equal(capped.maxWater, 100);
assert.equal(capped.points.at(-1).water, 100);

console.log('ghost deviation tests: PASS');
