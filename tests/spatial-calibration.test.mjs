import assert from 'node:assert/strict';
import {
  POUR_SPATIAL_CALIBRATION,
  kettlePositionForTarget,
  nozzlePositionForTarget,
  spatialRelationship,
  validateSpatialCalibration,
} from '../pour-spatial-calibration.js';

const c=POUR_SPATIAL_CALIBRATION;
const center={x:0,y:c.bedY,z:0};
const kettle=kettlePositionForTarget(center);
const nozzle=nozzlePositionForTarget(center);
const rel=spatialRelationship(center);

assert.equal(kettle.x,1.72);
assert.equal(kettle.y,3.15);
assert.equal(kettle.z,.08);
assert.equal(nozzle.x,.42);
assert.equal(nozzle.y,3.35);
assert.equal(nozzle.z,.08);
assert(Math.abs(rel.clearance-2.17)<1e-12);
assert(rel.horizontal>.4&&rel.horizontal<.45);

for(const target of [
  {x:.70,y:c.bedY,z:0},
  {x:-.70,y:c.bedY,z:0},
  {x:0,y:c.bedY,z:.70},
  {x:0,y:c.bedY,z:-.70},
  {x:.49,y:c.bedY,z:.49},
]){
  const r=spatialRelationship(target);
  assert(Math.abs(r.clearance-rel.clearance)<1e-12,'nozzle height above bed must not drift with target');
  assert(Math.abs(r.horizontal-rel.horizontal)<1e-12,'horizontal nozzle-to-target relationship must remain invariant');
}

const audit=validateSpatialCalibration();
assert.equal(audit.valid,true);
assert.equal(audit.checks.length,5);

const brokenHeight={...c,kettleBodyY:4.5};
assert.equal(validateSpatialCalibration(brokenHeight).valid,false);
const brokenOffset={...c,kettleTargetOffsetX:2.5};
assert.equal(validateSpatialCalibration(brokenOffset).valid,false);

console.log('spatial calibration tests: PASS');
