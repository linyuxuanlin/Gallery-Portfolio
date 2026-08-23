import assert from 'node:assert/strict';
import { createFlowRuntime, suspendAllFlowRuntimes } from '../pour-flow-runtime.js';

const rt = createFlowRuntime({ controlFlow: 6, targetWater: 250 });
let state;
for (let i = 0; i < 90; i++) state = rt.step(1 / 60, true);
assert.ok(state.actualFlow > 5, 'precondition: stream should be established before suspend');
const waterBefore = state.water;

const suspended = rt.suspend();
assert.equal(suspended.actualFlow, 0, 'suspend must clear residual visible flow');
assert.equal(suspended.streamRadius, 0, 'suspend must hide the stream immediately');
assert.equal(suspended.tilt, 0, 'suspend must return kettle to neutral tilt');
assert.equal(suspended.water, waterBefore, 'hidden time must not integrate phantom water');
assert.equal(suspended.addedWater, 0);
assert.equal(suspended.pouring, false);

const resumedIdle = rt.step(1 / 60, false);
assert.equal(resumedIdle.actualFlow, 0, 'first visible idle frame must not resurrect a phantom tail');
assert.equal(resumedIdle.water, waterBefore, 'resume idle frame must keep water stable');

const resumedPour = rt.step(1 / 60, true);
assert.ok(resumedPour.actualFlow > 0, 'new input should ramp from rest after suspension');
assert.ok(resumedPour.actualFlow < 1, 'new input must not inherit the old pre-suspend momentum');

const registered = createFlowRuntime({ controlFlow: 7, targetWater: 250 });
for (let i = 0; i < 90; i++) state = registered.step(1 / 60, true);
const registeredWater = state.water;
const allStates = suspendAllFlowRuntimes();
assert.ok(allStates.length >= 2, 'all active runtimes should participate in lifecycle settlement');
state = registered.snapshot(false);
assert.equal(state.actualFlow, 0, 'registry settlement must clear active flow');
assert.equal(state.water, registeredWater, 'registry settlement must preserve scale water');
registered.dispose();
rt.dispose();

const capped = createFlowRuntime({ controlFlow: 8, targetWater: 1 });
let hit;
for (let i = 0; i < 300; i++) {
  hit = capped.step(1 / 120, true);
  if (hit.targetReached) break;
}
assert.equal(hit.targetReached, true);
assert.ok(hit.actualFlow > 0, 'precondition: target crossing should still have a physical tail');
const cappedSuspend = capped.suspend();
assert.equal(cappedSuspend.water, 1);
assert.equal(cappedSuspend.actualFlow, 0);
assert.equal(cappedSuspend.tailActive, false);
assert.equal(cappedSuspend.settled, true);
assert.equal(cappedSuspend.complete, true, 'suspending after target should settle completion without extra mass');
capped.dispose();

console.log('flow suspend regression: PASS');
