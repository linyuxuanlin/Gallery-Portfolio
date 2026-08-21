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

const a = run({ fps: 60, seconds: .1, pouring: true, controlFlow: 8 });
assert.ok(a.actualFlow < 2, `actual flow must ramp instead of jump, got ${a.actualFlow}`);
assert.ok(a.water > 0 && a.water < .2, `startup inertia should limit first 100ms water, got ${a.water}`);
assert.ok(a.tilt < 0, 'active flow should tilt kettle');

const f30 = run({ fps: 30, seconds: 2, controlFlow: 6 });
const f60 = run({ fps: 60, seconds: 2, controlFlow: 6 });
const f144 = run({ fps: 144, seconds: 2, controlFlow: 6 });
assert.ok(Math.abs(f30.water - f60.water) < .12, `30/60 FPS water drift too large: ${f30.water} vs ${f60.water}`);
assert.ok(Math.abs(f60.water - f144.water) < .12, `60/144 FPS water drift too large: ${f60.water} vs ${f144.water}`);

const rt = createFlowRuntime({ controlFlow: 6 });
for (let i = 0; i < 120; i++) rt.step(1 / 60, true);
const beforeRelease = rt.snapshot(true);
let released = beforeRelease;
for (let i = 0; i < 30; i++) released = rt.step(1 / 60, false);
assert.ok(released.actualFlow < .7, `release must decay, got ${released.actualFlow}`);
assert.ok(released.water > beforeRelease.water, 'residual stream should still add a small amount of water after release');
assert.ok(Math.abs(released.tilt) < .03, `low residual flow should leave only a small tilt, got ${released.tilt}`);

const capped = createFlowRuntime({ controlFlow: 8, targetWater: 1 });
let end;
for (let i = 0; i < 300; i++) end = capped.step(1 / 60, true);
assert.equal(end.water, 1);
assert.equal(end.complete, true);

console.log('flow-runtime tests: PASS');
