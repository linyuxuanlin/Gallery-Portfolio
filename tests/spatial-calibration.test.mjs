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

const audit=validateSpatialCalibration();
assert.equal(audit.valid,true);
assert.equal(audit.checks.length,5);

const brokenHeight={...c,kettleBodyY:4.5};
assert.equal(validateSpatialCalibration(brokenHeight).valid,false);
const brokenOffset={...c,kettleTargetOffsetX:2.5};
assert.equal(validateSpatialCalibration(brokenOffset).valid,false);

console.log('spatial calibration tests: PASS');
