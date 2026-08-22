import assert from 'node:assert/strict';
import { createFlowRuntime } from '../pour-flow-runtime.js';

function runTo(fps, seconds) {
  const rt = createFlowRuntime({ controlFlow: 8, targetWater: 1 });
  let state = rt.snapshot(false);
  for (let i = 0; i < Math.round(fps * seconds); i++) state = rt.step(1 / fps, true);
  return state;
}

const f30 = runTo(30, 1);
const f60 = runTo(60, 1);
const f144 = runTo(144, 1);
for (const state of [f30, f60, f144]) {
  assert.equal(state.water, 1);
  assert.equal(state.targetReached, true);
  assert.ok(state.actualFlow >= 0);
}
const spread = Math.max(f30.actualFlow, f60.actualFlow, f144.actualFlow)
  - Math.min(f30.actualFlow, f60.actualFlow, f144.actualFlow);
assert.ok(spread < .03, `target-tail flow drift too large at equal physical time: ${spread}`);

function firstHit(fps) {
  const rt = createFlowRuntime({ controlFlow: 8, targetWater: 1 });
  let state;
  for (let i = 0; i < fps * 2; i++) {
    state = rt.step(1 / fps, true);
    if (state.targetReached) return { rt, state };
  }
  throw new Error(`target not reached at ${fps} FPS`);
}

for (const fps of [30, 60, 144]) {
  const { rt, state } = firstHit(fps);
  const firstTailFlow = state.actualFlow;
  assert.equal(state.water, 1);
  assert.equal(state.pouring, false);
  assert.equal(state.tailActive, true);
  const next = rt.step(1 / fps, true);
  assert.ok(next.actualFlow <= firstTailFlow, `held input re-accelerated tail at ${fps} FPS`);
  assert.equal(next.water, 1);
}

console.log('flow target-crossing tests: PASS');
