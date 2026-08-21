import assert from 'node:assert/strict';
import {createReusableStreamGeometry} from '../pour-stream-three.js';

class BufferAttribute{
  constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.needsUpdate=false}
}
class BufferGeometry{
  constructor(){this.attributes={};this.index=null}
  setAttribute(name,attribute){this.attributes[name]=attribute;return this}
  setIndex(attribute){this.index=attribute;return this}
}
const THREE={BufferGeometry,BufferAttribute};
const stream=createReusableStreamGeometry(THREE,{segments:16,radialSegments:6});
const positionArray=stream.positionAttribute.array;
const normalArray=stream.normalAttribute.array;
const indexArray=stream.geometry.index.array;
const points=[{x:0,y:3,z:0},{x:.15,y:2.4,z:.03},{x:.42,y:1.18,z:.18}];
stream.update(points,.02);
assert.equal(stream.positionAttribute.array,positionArray,'position GPU backing array should be reused');
assert.equal(stream.normalAttribute.array,normalArray,'normal GPU backing array should be reused');
assert.equal(stream.geometry.index.array,indexArray,'index topology should remain stable');
assert.equal(stream.positionAttribute.needsUpdate,true);
assert.equal(stream.normalAttribute.needsUpdate,true);
assert.equal(stream.updates,1);
const before=positionArray.slice();
stream.positionAttribute.needsUpdate=false;stream.normalAttribute.needsUpdate=false;
stream.update(points,.03);
assert.equal(stream.positionAttribute.array,positionArray);
assert.equal(stream.normalAttribute.array,normalArray);
assert(positionArray.some((value,i)=>Math.abs(value-before[i])>1e-6),'radius update should mutate existing vertices');
assert.equal(stream.positionAttribute.needsUpdate,true);
assert.equal(stream.normalAttribute.needsUpdate,true);
assert.equal(stream.updates,2);
assert.equal(stream.geometry.attributes.uv.array,stream.tube.uvs,'UV buffer should be shared with reusable tube');
console.log('stream three adapter tests: PASS');
