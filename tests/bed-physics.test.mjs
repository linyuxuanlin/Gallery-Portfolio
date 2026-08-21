import assert from 'node:assert/strict';
import {createBedPhysics} from '../pour-bed-physics.js';

const bed=createBedPhysics();
let m=bed.metrics();
assert.equal(m.coverage,0);
assert.equal(m.uniformity,1);
bed.deposit(0,0,20);
m=bed.metrics();
assert(m.coverage>0);
assert(m.mean>0);
const initialHotspot=m.hotspot;
for(let i=0;i<120;i++) bed.step(1/60);
m=bed.metrics();
assert(m.hotspot<initialHotspot,'diffusion should reduce hotspot');
const beforeDrain=m.totalWaterField;
for(let i=0;i<600;i++) bed.step(1/60);
m=bed.metrics();
assert(m.totalWaterField<beforeDrain,'drainage should reduce retained water');

function run(fps){
  const b=createBedPhysics();
  for(let i=0;i<fps*3;i++){
    if(i<fps) b.deposit(.12,-.05,5/fps);
    b.step(1/fps);
  }
  return b.metrics();
}
const a=run(30),c=run(144);
assert(Math.abs(a.mean-c.mean)<0.002,'bed mean should be near frame-rate independent');
assert(Math.abs(a.uniformity-c.uniformity)<0.02,'uniformity should be near frame-rate independent');

const edge=createBedPhysics();
edge.deposit(.69,0,10);
const em=edge.metrics();
assert(em.mean>0);
assert(Number.isFinite(em.uniformity));
console.log('pour-bed-physics tests: PASS');
