import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /createFlowRuntime/);
assert.match(html, /createBedPhysics/);
assert.match(html, /sampleBallisticArc/);
assert.match(html, /createStreamMotionRuntime/);
assert.match(html, /shouldRefreshStream/);
assert.match(html, /runtime=flowRuntime\.step\(dt,pouring\)/);
assert.match(html, /motionRuntime\.setDesired\(desiredPoint\)/);
assert.match(html, /targetPoint\.set\(motion\.actual\.x,motion\.actual\.y,motion\.actual\.z\)/);
assert.match(html, /kettle\.position\.set\(motion\.kettle\.x,motion\.kettle\.y,motion\.kettle\.z\)/);
assert.match(html, /bedPhysics\.deposit\(targetPoint\.x,targetPoint\.z,runtime\.addedWater\)/);
assert.match(html, /flow:runtime\.actualFlow,water:runtime\.water/);
assert.match(html, /kettle\.rotation\.z=runtime\.tilt/);
assert.match(html, /runtime\.streamRadius/);
assert.match(html, /sampleBallisticArc\(start,end,runtime\.actualFlow,\{segments:16\}\)/);
assert.match(html, /const streamMaterial=new THREE\.MeshPhysicalMaterial/);
assert.match(html, /stream\.geometry\.dispose\(\);stream\.geometry=nextGeometry/);
assert.match(html, /stream\.visible=false/);
assert.doesNotMatch(html, /targetPoint\.set\(hit\.x,1\.18,hit\.z\);marker/);
assert.doesNotMatch(html, /kettle\.position\.set\(hit\.x\+1\.72,3\.15,hit\.z\+\.08\)/);
assert.doesNotMatch(html, /stream\.material\.dispose\(\)/);
assert.doesNotMatch(html, /water\s*\+=\s*flow\s*\*\s*dt/);
assert.doesNotMatch(html, /kettle\.rotation\.z=-Math\.min\([^\n]*runtime\.tilt/);
assert.doesNotMatch(html, /\.010\s*\+\s*runtime\.actualFlow\s*\*\s*\.0022/);
assert.doesNotMatch(html, /vy=-\.18/);
assert.doesNotMatch(html, /const G=5\.5/);

console.log('index physics integration tests: PASS');
