import assert from 'node:assert/strict';
import {
  POUR_SPATIAL_CALIBRATION,
  rotatedNozzleLocal,
  kettlePositionForTarget,
  nozzlePositionForTarget,
  kettlePositionForTargetAtTilt,
  nozzlePositionForTargetAtTilt,
  uncompensatedTiltDrift,
  spatialRelationship,
  validateSpatialCalibration,
} from '../pour-spatial-calibration.js';

const c=POUR_SPATIAL_CALIBRATION;
const center={x:0,y:c.bedY,z:0};
const kettle=kettlePositionForTarget(center);
const nozzle=nozzlePositionForTarget(center);
const rel=spatialRelationship(center);
const close=(actual,expected,epsilon=1e-12)=>assert(Math.abs(actual-expected)<epsilon,`${actual} ≉ ${expected}`);

close(kettle.x,1.72);
close(kettle.y,3.15);
close(kettle.z,.08);
close(nozzle.x,.42);
close(nozzle.y,3.35);
close(nozzle.z,.08);
close(rel.clearance,2.17);
assert(rel.horizontal>.4&&rel.horizontal<.45);

for(const target of [
  {x:.70,y:c.bedY,z:0},
  {x:-.70,y:c.bedY,z:0},
  {x:0,y:c.bedY,z:.70},
  {x:0,y:c.bedY,z:-.70},
  {x:.49,y:c.bedY,z:.49},
]){
  const r=spatialRelationship(target);
  close(r.clearance,rel.clearance);
  close(r.horizontal,rel.horizontal);
}

const tiltedLocal=rotatedNozzleLocal(c.maxPourTilt);
assert(tiltedLocal.y>c.nozzleLocalY,'uncompensated negative Z tilt raises the current nozzle tip');
const drift=uncompensatedTiltDrift(c.maxPourTilt);
assert(drift.distance>.35,'current long spout should expose meaningful tilt drift without compensation');

const neutralNozzle=nozzlePositionForTarget(center);
const tiltedKettle=kettlePositionForTargetAtTilt(center,c.maxPourTilt);
const compensatedNozzle=nozzlePositionForTargetAtTilt(center,c.maxPourTilt);
assert(tiltedKettle.y<kettle.y,'body must translate down to hold the tilted nozzle at a stable world height');
close(compensatedNozzle.x,neutralNozzle.x,1e-10);
close(compensatedNozzle.y,neutralNozzle.y,1e-10);
close(compensatedNozzle.z,neutralNozzle.z,1e-10);

for(const tilt of [0,-.05,-.085,-.18,c.maxPourTilt]){
  for(const target of [center,{x:.60,y:c.bedY,z:.20},{x:-.55,y:c.bedY,z:-.25}]){
    const expected=nozzlePositionForTarget(target);
    const actual=nozzlePositionForTargetAtTilt(target,tilt);
    close(actual.x,expected.x,1e-10);
    close(actual.y,expected.y,1e-10);
    close(actual.z,expected.z,1e-10);
  }
}

const audit=validateSpatialCalibration();
assert.equal(audit.valid,true);
assert.equal(audit.checks.length,5);
assert(audit.checks.every(check=>check.compensatedTiltError<1e-9));

const brokenHeight={...c,kettleBodyY:4.5};
assert.equal(validateSpatialCalibration(brokenHeight).valid,false);
const brokenOffset={...c,kettleTargetOffsetX:2.5};
assert.equal(validateSpatialCalibration(brokenOffset).valid,false);

console.log('spatial calibration tests: PASS');
