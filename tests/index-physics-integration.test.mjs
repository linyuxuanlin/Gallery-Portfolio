import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /createFlowRuntime/);
assert.match(html, /createBedPhysics/);
assert.match(html, /runtime=flowRuntime\.step\(dt,pouring\)/);
assert.match(html, /bedPhysics\.deposit\(targetPoint\.x,targetPoint\.z,runtime\.addedWater\)/);
assert.match(html, /flow:runtime\.actualFlow,water:runtime\.water/);
assert.match(html, /kettle\.rotation\.z=runtime\.tilt/);
assert.match(html, /runtime\.streamRadius/);
assert.match(html, /now-lastStreamUpdate>=33/);
assert.doesNotMatch(html, /water\s*\+=\s*flow\s*\*\s*dt/);
assert.doesNotMatch(html, /kettle\.rotation\.z=-Math\.min\([^\n]*runtime\.tilt/);
assert.doesNotMatch(html, /\.010\s*\+\s*runtime\.actualFlow\s*\*\s*\.0022/);

console.log('index physics integration tests: PASS');
