import assert from 'node:assert/strict';
import {
  stepFlow,
  flowToTilt,
  streamRadiusForFlow,
  integrateWater,
  exponentialStep,
} from '../pour-flow-physics.js';

function simulate({ fps = 60, seconds = 2, start = 0, control = 5, pouring = true }) {
  let flow = start;
  const dt = 1 / fps;
  for (let i = 0; i < Math.round(seconds * fps); i++) flow = stepFlow(flow, control, pouring, dt);
  return flow;
}

function timeToFraction(control, fraction, fps = 120) {
  let flow = 0;
  const dt = 1 / fps;
  for (let i = 1; i <= fps * 3; i++) {
    flow = stepFlow(flow, control, true, dt);
    if (flow >= control * fraction) return i * dt;
  }
  return Infinity;
}

function releaseTime(start, fps = 120) {
  let flow = start;
  const dt = 1 / fps;
  for (let i = 1; i <= fps * 3; i++) {
    flow = stepFlow(flow, start, false, dt);
    if (flow === 0) return i * dt;
  }
  return Infinity;
}

assert.equal(exponentialStep(2, 7, 0, .3), 2);
assert.ok(simulate({ fps: 60, seconds: .1, control: 8 }) < 2, 'flow must not jump instantly');
assert.ok(simulate({ fps: 60, seconds: 1, control: 5 }) > 4, 'flow should converge toward target');

const f30 = simulate({ fps: 30, seconds: 1.5, control: 6 });
const f60 = simulate({ fps: 60, seconds: 1.5, control: 6 });
const f144 = simulate({ fps: 144, seconds: 1.5, control: 6 });
assert.ok(Math.abs(f30 - f60) < .08, `30/60 FPS drift too large: ${f30} vs ${f60}`);
assert.ok(Math.abs(f60 - f144) < .08, `60/144 FPS drift too large: ${f60} vs ${f144}`);

// Calibration envelope for 2/4/6/8 g/s. Low flow should respond promptly,
// while high flow should still take visibly longer due to kettle inertia.
for (const target of [2, 4, 6, 8]) {
  const t90 = timeToFraction(target, .90);
  assert.ok(t90 >= .55, `${target} g/s reaches 90% unrealistically fast: ${t90}s`);
  assert.ok(t90 <= 1.10, `${target} g/s reaches 90% too slowly: ${t90}s`);
  const tail = releaseTime(target);
  assert.ok(tail >= .45, `${target} g/s tail disappears too abruptly: ${tail}s`);
  assert.ok(tail <= 1.10, `${target} g/s tail lingers too long: ${tail}s`);
}
assert.ok(timeToFraction(8, .90) > timeToFraction(2, .90), 'high-flow attack should be slower than low-flow attack');
assert.ok(releaseTime(8) > releaseTime(2), 'high-flow tail should last longer than low-flow tail');

let flow = 6;
for (let i = 0; i < 30; i++) flow = stepFlow(flow, 6, false, 1 / 60);
assert.ok(flow < .7, `release should decay below 0.7 g/s within 0.5 s, got ${flow}`);

assert.equal(flowToTilt(0), 0);
assert.ok(Math.abs(flowToTilt(.1)) < Math.abs(flowToTilt(1)), 'tiny flow should produce only tiny tilt');
assert.ok(Math.abs(flowToTilt(1)) < Math.abs(flowToTilt(2)), 'tilt should increase continuously through low-flow range');
assert.ok(flowToTilt(8) < flowToTilt(2), 'higher flow should require greater negative tilt');

assert.equal(streamRadiusForFlow(0), 0);
assert.equal(streamRadiusForFlow(.04), 0, 'sub-visible tail must not allocate a stream');
const r2 = streamRadiusForFlow(2);
const r4 = streamRadiusForFlow(4);
const r8 = streamRadiusForFlow(8);
assert.ok(r2 < r4 && r4 < r8, 'stream radius must grow monotonically with flow');
assert.ok(r8 / r2 < 2.2, 'radius growth should be area-like, not linear in flow');
assert.ok(Math.abs((r8 / r2) - 2) < .08, `2→8 g/s should roughly double radius, got ${r8 / r2}`);

let water = 0;
for (let i = 0; i < 600; i++) {
  const result = integrateWater(water, 5, 1 / 60, 250);
  water = result.water;
}
assert.ok(Math.abs(water - 50) < 1e-9, `10 s at 5 g/s should be 50 g, got ${water}`);

const capped = integrateWater(249.9, 8, .1, 250);
assert.equal(capped.water, 250);
assert.ok(capped.added <= .1 + 1e-12);

console.log('flow-physics tests: PASS');
