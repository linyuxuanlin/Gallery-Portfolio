import { createReusableTubeMesh } from './pour-stream-mesh.js';

export function createReusableStreamGeometry(THREE,{segments=16,radialSegments=6}={}){
  if(!THREE?.BufferGeometry||!THREE?.BufferAttribute)throw new Error('THREE BufferGeometry/BufferAttribute required');
  const tube=createReusableTubeMesh({segments,radialSegments});
  const geometry=new THREE.BufferGeometry();
  const position=new THREE.BufferAttribute(tube.positions,3);
  const normal=new THREE.BufferAttribute(tube.normals,3);
  const uv=new THREE.BufferAttribute(tube.uvs,2);
  geometry.setAttribute('position',position);
  geometry.setAttribute('normal',normal);
  geometry.setAttribute('uv',uv);
  geometry.setIndex(new THREE.BufferAttribute(tube.indices,1));

  let updates=0;
  function update(points,radius){
    tube.update(points,radius);
    position.needsUpdate=true;
    normal.needsUpdate=true;
    updates++;
    return api;
  }

  const api={
    geometry,
    tube,
    update,
    get updates(){return updates},
    get positionAttribute(){return position},
    get normalAttribute(){return normal},
    get uvAttribute(){return uv},
  };
  return api;
}
