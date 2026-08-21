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

const curved=[{x:0,y:3,z:0},{x:.01,y:2.7,z:.02},{x:.08,y:2.2,z:.12},{x:.25,y:1.6,z:.2},{x:.42,y:1.18,z:.28}];
const smooth=createReusableTubeMesh({segments:24,radialSegments:8});
smooth.update(curved,.02);
for(let r=1;r<=24;r++){
  const a=(r-1)*8*3,b=r*8*3;
  const dot=smooth.normals[a]*smooth.normals[b]+smooth.normals[a+1]*smooth.normals[b+1]+smooth.normals[a+2]*smooth.normals[b+2];
  assert(dot>0.75,`tube frame flipped between rings ${r-1} and ${r}: dot=${dot}`);
}

const seamBefore=[];
for(let r=0;r<=24;r++){
  const i=r*8*3;
  seamBefore.push([smooth.normals[i],smooth.normals[i+1],smooth.normals[i+2]]);
}
const nudged=curved.map((p,i)=>({...p,x:p.x+(i===2?.002:0)}));
smooth.update(nudged,.02);
for(let r=0;r<=24;r++){
  const i=r*8*3,n=seamBefore[r];
  const dot=n[0]*smooth.normals[i]+n[1]*smooth.normals[i+1]+n[2]*smooth.normals[i+2];
  assert(dot>0.9,`small trajectory edit caused seam jump at ring ${r}: dot=${dot}`);
}
console.log('stream mesh tests: PASS');
