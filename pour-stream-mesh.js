const EPS=1e-8;
const norm=(x,y,z)=>{const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l]};
const cross=(ax,ay,az,bx,by,bz)=>[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];

export function createReusableTubeMesh({segments=16,radialSegments=6}={}){
  const rings=Math.max(2,Math.round(segments)+1);
  const sides=Math.max(3,Math.round(radialSegments));
  const vertexCount=rings*sides;
  const positions=new Float32Array(vertexCount*3);
  const normals=new Float32Array(vertexCount*3);
  const uvs=new Float32Array(vertexCount*2);
  const IndexArray=vertexCount>65535?Uint32Array:Uint16Array;
  const indices=new IndexArray((rings-1)*sides*6);
  let ii=0;
  for(let r=0;r<rings-1;r++)for(let s=0;s<sides;s++){
    const n=(s+1)%sides,a=r*sides+s,b=r*sides+n,c=(r+1)*sides+s,d=(r+1)*sides+n;
    indices[ii++]=a;indices[ii++]=c;indices[ii++]=b;indices[ii++]=b;indices[ii++]=c;indices[ii++]=d;
  }
  for(let r=0;r<rings;r++)for(let s=0;s<sides;s++){
    const vi=r*sides+s;uvs[vi*2]=s/sides;uvs[vi*2+1]=r/(rings-1);
  }
  let updates=0;
  function update(points,radius){
    if(!Array.isArray(points)||points.length<2)throw new Error('points must contain at least 2 points');
    const rad=Math.max(0,Number(radius)||0);
    for(let r=0;r<rings;r++){
      const u=r/(rings-1),scaled=u*(points.length-1),i=Math.min(points.length-2,Math.floor(scaled)),f=scaled-i;
      const p=points[i],q=points[i+1];
      const px=p.x+(q.x-p.x)*f,py=p.y+(q.y-p.y)*f,pz=p.z+(q.z-p.z)*f;
      const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+2)];
      const [tx,ty,tz]=norm(next.x-prev.x,next.y-prev.y,next.z-prev.z);
      let ux=0,uy=1,uz=0;
      if(Math.abs(ty)>.92){ux=1;uy=0;uz=0}
      let [nx,ny,nz]=cross(tx,ty,tz,ux,uy,uz);[nx,ny,nz]=norm(nx,ny,nz);
      let [bx,by,bz]=cross(tx,ty,tz,nx,ny,nz);[bx,by,bz]=norm(bx,by,bz);
      for(let s=0;s<sides;s++){
        const a=s/sides*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);
        let rx=nx*ca+bx*sa,ry=ny*ca+by*sa,rz=nz*ca+bz*sa;
        const rl=Math.hypot(rx,ry,rz);if(rl<EPS){rx=nx;ry=ny;rz=nz}
        const vi=(r*sides+s)*3;
        positions[vi]=px+rx*rad;positions[vi+1]=py+ry*rad;positions[vi+2]=pz+rz*rad;
        normals[vi]=rx;normals[vi+1]=ry;normals[vi+2]=rz;
      }
    }
    updates++;
    return api;
  }
  const api={segments:rings-1,radialSegments:sides,positions,normals,uvs,indices,update,get updates(){return updates}};
  return api;
}
