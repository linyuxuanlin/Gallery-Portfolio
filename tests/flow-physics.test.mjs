import assert from 'node:assert/strict';
import { stepFlow, flowToTilt, integrateWater, exponentialStep } from '../pour-flow-physics.js';

function simulate({ fps = 60, seconds = 2, start = 0, control = 5, pouring = true }) {
  let flow = start;
  const dt = 1 / fps;
  for (let i = 0; i < Math.round(seconds * fps); i++) flow = stepFlow(flow, control, pouring, dt);
  return flow;
}

assert.equal(exponentialStep(2, 7, 0, .3), 2);
assert.ok(simulate({ fps: 60, seconds: .1, control: 8 }) < 2, 'flow must not jump instantly');
assert.ok(simulate({ fps: 60, seconds: 1, control: 5 }) > 4, 'flow should converge toward target');

const f30 = simulate({ fps: 30, seconds: 1.5, control: 6 });
const f60 = simulate({ fps: 60, seconds: 1.5, control: 6 });
const f144 = simulate({ fps: 144, seconds: 1.5, control: 6 });
assert.ok(Math.abs(f30 - f60) < .08, `30/60 FPS drift too large: ${f30} vs ${f60}`);
assert.ok(Math.abs(f60 - f144) < .08, `60/144 FPS drift too large: ${f60} vs ${f144}`);

let flow = 6;
for (let i = 0; i < 30; i++) flow = stepFlow(flow, 6, false, 1 / 60);
assert.ok(flow < .7, `release should decay below 0.7 g/s within 0.5 s, got ${flow}`);

assert.equal(flowToTilt(0), 0);
assert.ok(flowToTilt(8) < flowToTilt(2), 'higher flow should require greater negative tilt');

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
