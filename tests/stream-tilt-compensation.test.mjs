import assert from 'node:assert/strict';
import { createFlowRuntime, activeFlowTilt } from '../pour-flow-runtime.js';
import { createStreamMotionRuntime } from '../pour-stream-physics.js';
import { nozzlePositionForTargetAtTilt, POUR_SPATIAL_CALIBRATION } from '../pour-spatial-calibration.js';

const flow=createFlowRuntime({controlFlow:8});
const motion=createStreamMotionRuntime();
motion.reset({x:0,y:POUR_SPATIAL_CALIBRATION.bedY,z:0});
for(let i=0;i<240;i++){
  flow.step(1/120,true);
  motion.step(1/120);
}
const state=flow.snapshot(true);
const moved=motion.snapshot();
assert(Math.abs(activeFlowTilt()-state.tilt)<1e-12);
assert(state.tilt<-0.2,'high flow should produce a meaningful kettle tilt');
const neutralNozzle=nozzlePositionForTargetAtTilt(moved.actual,0);
const tiltedNozzle=nozzlePositionForTargetAtTilt(moved.actual,state.tilt);
assert(Math.hypot(tiltedNozzle.x-neutralNozzle.x,tiltedNozzle.y-neutralNozzle.y,tiltedNozzle.z-neutralNozzle.z)<1e-9,'calibration must anchor the nozzle tip across tilt');
const expectedKettle={x:tiltedNozzle.x-(-1.30*Math.cos(state.tilt)-.20*Math.sin(state.tilt)),y:tiltedNozzle.y-(-1.30*Math.sin(state.tilt)+.20*Math.cos(state.tilt)),z:tiltedNozzle.z};
assert(Math.hypot(moved.kettle.x-expectedKettle.x,moved.kettle.y-expectedKettle.y,moved.kettle.z-expectedKettle.z)<.002,'motion runtime should converge to tilt-compensated kettle position');

const custom=createStreamMotionRuntime({kettleOffset:{x:2,y:2,z:2},tiltProvider:()=>-.27});
const customState=custom.reset({x:.1,y:1,z:.2});
assert.deepEqual(customState.kettle,{x:2.1,y:3,z:2.2},'custom offsets must remain opt-out from shared calibration compensation');

flow.dispose();
assert.equal(activeFlowTilt(),0);
console.log('stream tilt compensation tests: PASS');
