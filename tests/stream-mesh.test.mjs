import assert from 'node:assert/strict';
import {createReusableTubeMesh} from '../pour-stream-mesh.js';

const points=[{x:0,y:3,z:0},{x:.2,y:2.5,z:0},{x:.4,y:1.2,z:.1}];
const mesh=createReusableTubeMesh({segments:16,radialSegments:6});
const positions=mesh.positions,normals=mesh.normals,indices=mesh.indices;
mesh.update(points,.02);

assert.equal(mesh.positions,positions,'position buffer must be reused');
assert.equal(mesh.normals,normals,'normal buffer must be reused');
assert.equal(mesh.indices,indices,'index buffer must be reused');
assert.equal(mesh.positions.length,17*6*3);
assert.equal(mesh.indices.length,16*6*6);
for(const value of mesh.positions)assert(Number.isFinite(value));
for(let i=0;i<mesh.normals.length;i+=3){
  const length=Math.hypot(mesh.normals[i],mesh.normals[i+1],mesh.normals[i+2]);
  assert(Math.abs(length-1)<1e-5,'tube normals should stay normalized');
}

const before=mesh.positions.slice();
mesh.update(points,.03);
assert.equal(mesh.positions,positions,'updates must mutate existing position buffer');
assert(mesh.positions.some((value,i)=>Math.abs(value-before[i])>1e-6),'radius changes should update vertices');
assert.equal(mesh.updates,2);
console.log('stream mesh tests: PASS');
