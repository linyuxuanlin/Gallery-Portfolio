import assert from 'node:assert/strict';
import { createFlowRuntime } from '../pour-flow-runtime.js';

function run({ fps = 60, seconds = 1, pouring = true, controlFlow = 5 }) {
  const rt = createFlowRuntime({ controlFlow });
  const dt = 1 / fps;
  let state = rt.snapshot(false);
  for (let i = 0; i < Math.round(seconds * fps); i++) state = rt.step(dt, pouring);
  return state;
}

const start = createFlowRuntime({ controlFlow: 6 }).snapshot(false);
assert.equal(start.actualFlow, 0);
assert.equal(start.water, 0);
assert.equal(start.targetReached, false);
assert.equal(start.tailActive, false);
assert.equal(start.settled, false);

const a = run({ fps: 60, seconds: .1, pouring: true, controlFlow: 8 });
assert.ok(a.actualFlow < 2, `actual flow must ramp instead of jump, got ${a.actualFlow}`);
assert.ok(a.water > 0 && a.water < .2, `startup inertia should limit first 100ms water, got ${a.water}`);
assert.ok(a.tilt < 0, 'active flow should tilt kettle');

const f30 = run({ fps: 30, seconds: 2, controlFlow: 6 });
const f60 = run({ fps: 60, seconds: 2, controlFlow: 6 });
const f144 = run({ fps: 144, seconds: 2, controlFlow: 6 });
assert.ok(Math.abs(f30.water - f60.water) < .01, `30/60 FPS water drift too large: ${f30.water} vs ${f60.water}`);
assert.ok(Math.abs(f60.water - f144.water) < .01, `60/144 FPS water drift too large: ${f60.water} vs ${f144.water}`);
assert.ok(Math.abs(f30.actualFlow - f144.actualFlow) < .001, `flow response drift too large: ${f30.actualFlow} vs ${f144.actualFlow}`);

const rt = createFlowRuntime({ controlFlow: 6 });
for (let i = 0; i < 120; i++) rt.step(1 / 60, true);
const beforeRelease = rt.snapshot(true);
let released = beforeRelease;
for (let i = 0; i < 30; i++) released = rt.step(1 / 60, false);
assert.ok(released.actualFlow < .7, `release must decay, got ${released.actualFlow}`);
assert.ok(released.water > beforeRelease.water, 'residual stream should still add a small amount of water after release');
assert.ok(Math.abs(released.tilt) < .03, `low residual flow should leave only a small tilt, got ${released.tilt}`);

const release30 = createFlowRuntime({ controlFlow: 6 });
const release144 = createFlowRuntime({ controlFlow: 6 });
for (let i = 0; i < 60; i++) release30.step(1 / 30, true);
for (let i = 0; i < 288; i++) release144.step(1 / 144, true);
const r30Start = release30.snapshot(true).water;
const r144Start = release144.snapshot(true).water;
for (let i = 0; i < 15; i++) release30.step(1 / 30, false);
for (let i = 0; i < 72; i++) release144.step(1 / 144, false);
const tail30 = release30.snapshot(false).water - r30Start;
const tail144 = release144.snapshot(false).water - r144Start;
assert.ok(Math.abs(tail30 - tail144) < .01, `release-tail water drift too large: ${tail30} vs ${tail144}`);

const capped = createFlowRuntime({ controlFlow: 8, targetWater: 1 });
let end;
for (let i = 0; i < 300; i++) end = capped.step(1 / 60, true);
assert.equal(end.water, 1);
assert.equal(end.complete, true);
assert.equal(end.targetReached, true);
assert.equal(end.pouring, false, 'runtime must latch pouring off after target even if input remains held');
assert.equal(end.inputPouring, true, 'raw user input should remain observable separately from physical pouring');
assert.equal(end.settled, true, 'tail should eventually settle to zero');
assert.equal(end.tailActive, false);

const tailLock = createFlowRuntime({ controlFlow: 8, targetWater: 1 });
let hit;
for (let i = 0; i < 300; i++) {
  hit = tailLock.step(1 / 120, true);
  if (hit.targetReached) break;
}
assert.equal(hit.water, 1);
assert.ok(hit.actualFlow > 0, 'target should be reachable while a physical stream still exists');
assert.equal(hit.tailActive, true);
const flowAtTarget = hit.actualFlow;
let afterTarget = hit;
for (let i = 0; i < 12; i++) afterTarget = tailLock.step(1 / 120, true);
assert.equal(afterTarget.water, 1, 'scale mass must stay capped during physical tail');
assert.ok(afterTarget.actualFlow < flowAtTarget, 'held input must not sustain or accelerate flow after target lock');
assert.equal(afterTarget.pouring, false);

console.log('flow-runtime tests: PASS');
