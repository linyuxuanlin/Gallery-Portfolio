import assert from 'node:assert/strict';
import fs from 'node:fs';
import { POUR_SPATIAL_CALIBRATION, kettlePositionForTarget } from '../pour-spatial-calibration.js';
import { createStreamMotionRuntime } from '../pour-stream-physics.js';

const c=POUR_SPATIAL_CALIBRATION;
const runtime=createStreamMotionRuntime();
const snapshot=runtime.snapshot();
const expectedPoint={x:0,y:c.bedY,z:0};
const expectedKettle=kettlePositionForTarget(expectedPoint);
const close=(a,b,eps=1e-12)=>assert(Math.abs(a-b)<eps,`${a} ≉ ${b}`);

close(snapshot.actual.x,expectedPoint.x);
close(snapshot.actual.y,expectedPoint.y);
close(snapshot.actual.z,expectedPoint.z);
close(snapshot.kettle.x,expectedKettle.x);
close(snapshot.kettle.y,expectedKettle.y);
close(snapshot.kettle.z,expectedKettle.z);

const moved=runtime.reset({x:.42,y:c.bedY,z:-.18});
close(moved.kettle.x,.42+c.kettleTargetOffsetX);
close(moved.kettle.y,c.kettleBodyY);
close(moved.kettle.z,-.18+c.kettleTargetOffsetZ);

const streamSource=fs.readFileSync(new URL('../pour-stream-physics.js',import.meta.url),'utf8');
assert.match(streamSource,/pour-spatial-calibration\.js/,'stream runtime must consume shared spatial calibration');
assert.doesNotMatch(streamSource,/point=\{x:0,y:1\.18,z:0\}/,'stream runtime must not reintroduce bedY magic defaults');
assert.doesNotMatch(streamSource,/kettle=\{x:1\.72,y:3\.15,z:\.08\}/,'stream runtime must not reintroduce kettle magic defaults');

const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(sw,/pour-lab-v15/,'service worker cache version must advance for calibration dependency');
assert.match(sw,/\.\/pour-spatial-calibration\.js/,'spatial calibration must be available offline');

console.log('spatial runtime integration tests: PASS');
