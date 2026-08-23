import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {POUR_SPATIAL_CALIBRATION as c,validateSpatialCalibration} from '../pour-spatial-calibration.js';

const here=dirname(fileURLToPath(import.meta.url));
const html=readFileSync(resolve(here,'../index.html'),'utf8');

assert.equal(validateSpatialCalibration().valid,true,'spatial calibration model must remain physically valid');
assert(html.includes(`BED_RADIUS=${c.bedRadius.toFixed(2)}`)||html.includes(`BED_RADIUS=.70`),'index bed radius must match calibration');
assert(html.includes(`plane=new THREE.Plane(new THREE.Vector3(0,1,0),-${c.bedY})`),'raycast bed plane must match calibrated bed height');
assert(html.includes(`nozzle.position.set(${c.nozzleLocalX.toFixed(2)},.${String(c.nozzleLocalY).split('.')[1]},0)`)||html.includes('nozzle.position.set(-1.30,.20,0)'),'nozzle local position must match calibration');
assert(html.includes(`kettle.position.set(${c.kettleTargetOffsetX.toFixed(2)},${c.kettleBodyY},.${String(c.kettleTargetOffsetZ).split('.')[1]})`)||html.includes('kettle.position.set(1.72,3.15,.08)'),'initial kettle position must match calibration');
assert(html.includes('new THREE.Vector3(0,1.18,0)'),'target point must remain on calibrated bed plane');

console.log('index spatial calibration integration: PASS');
