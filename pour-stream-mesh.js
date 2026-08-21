const EPS=1e-8;
const norm=(x,y,z)=>{const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l]};
const cross=(ax,ay,az,bx,by,bz)=>[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];
const dot=(ax,ay,az,bx,by,bz)=>ax*bx+ay*by+az*bz;

export function createReusableTubeMesh({segments=16,radialSegments=6}={}){
  const rings=Math.max(2,Math.round(segments)+1);
  const sides=Math.max(3,Math.round(radialSegments));
  const vertexCount=rings*sides;
  const positions=new Float32Array(vertexCount*3);
  const normals=new Float32Array(vertexCount*3);
  const uvs=new Float32Array(vertexCount*2);
  const IndexArray=vertexCount>65535?Uint32Array:Uint16Array;
  const indices=new IndexArray((rings-1)*sides*6);
  const centers=new Float64Array(rings*3);
  const tangents=new Float64Array(rings*3);
  const framesN=new Float64Array(rings*3);
  const framesB=new Float64Array(rings*3);
  let ii=0;
  for(let r=0;r<rings-1;r++)for(let s=0;s<sides;s++){
    const n=(s+1)%sides,a=r*sides+s,b=r*sides+n,c=(r+1)*sides+s,d=(r+1)*sides+n;
    indices[ii++]=a;indices[ii++]=c;indices[ii++]=b;indices[ii++]=b;indices[ii++]=c;indices[ii++]=d;
  }
  for(let r=0;r<rings;r++)for(let s=0;s<sides;s++){
    const vi=r*sides+s;uvs[vi*2]=s/sides;uvs[vi*2+1]=r/(rings-1);
  }
  let updates=0;
  function sampleCenter(points,r){
    const u=r/(rings-1),scaled=u*(points.length-1),i=Math.min(points.length-2,Math.floor(scaled)),f=scaled-i;
    const p=points[i],q=points[i+1],o=r*3;
    centers[o]=p.x+(q.x-p.x)*f;centers[o+1]=p.y+(q.y-p.y)*f;centers[o+2]=p.z+(q.z-p.z)*f;
  }
  function buildFrames(){
    for(let r=0;r<rings;r++){
      const a=Math.max(0,r-1)*3,b=Math.min(rings-1,r+1)*3,o=r*3;
      const [tx,ty,tz]=norm(centers[b]-centers[a],centers[b+1]-centers[a+1],centers[b+2]-centers[a+2]);
      tangents[o]=tx;tangents[o+1]=ty;tangents[o+2]=tz;
    }
    let tx=tangents[0],ty=tangents[1],tz=tangents[2];
    let ux=0,uy=1,uz=0;if(Math.abs(ty)>.92){ux=1;uy=0;uz=0}
    let [nx,ny,nz]=cross(tx,ty,tz,ux,uy,uz);[nx,ny,nz]=norm(nx,ny,nz);
    let [bx,by,bz]=cross(tx,ty,tz,nx,ny,nz);[bx,by,bz]=norm(bx,by,bz);
    framesN[0]=nx;framesN[1]=ny;framesN[2]=nz;framesB[0]=bx;framesB[1]=by;framesB[2]=bz;
    for(let r=1;r<rings;r++){
      const o=r*3;tx=tangents[o];ty=tangents[o+1];tz=tangents[o+2];
      const po=(r-1)*3;
      let pnx=framesN[po],pny=framesN[po+1],pnz=framesN[po+2];
      const proj=dot(pnx,pny,pnz,tx,ty,tz);
      pnx-=tx*proj;pny-=ty*proj;pnz-=tz*proj;
      if(Math.hypot(pnx,pny,pnz)<EPS){
        const pbx=framesB[po],pby=framesB[po+1],pbz=framesB[po+2];
        const bproj=dot(pbx,pby,pbz,tx,ty,tz);
        pnx=pbx-tx*bproj;pny=pby-ty*bproj;pnz=pbz-tz*bproj;
      }
      [nx,ny,nz]=norm(pnx,pny,pnz);
      [bx,by,bz]=cross(tx,ty,tz,nx,ny,nz);[bx,by,bz]=norm(bx,by,bz);
      framesN[o]=nx;framesN[o+1]=ny;framesN[o+2]=nz;framesB[o]=bx;framesB[o+1]=by;framesB[o+2]=bz;
    }
  }
  function update(points,radius){
    if(!Array.isArray(points)||points.length<2)throw new Error('points must contain at least 2 points');
    const rad=Math.max(0,Number(radius)||0);
    for(let r=0;r<rings;r++)sampleCenter(points,r);
    buildFrames();
    for(let r=0;r<rings;r++){
      const o=r*3,px=centers[o],py=centers[o+1],pz=centers[o+2];
      const nx=framesN[o],ny=framesN[o+1],nz=framesN[o+2],bx=framesB[o],by=framesB[o+1],bz=framesB[o+2];
      for(let s=0;s<sides;s++){
        const a=s/sides*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);
        const rx=nx*ca+bx*sa,ry=ny*ca+by*sa,rz=nz*ca+bz*sa,vi=(r*sides+s)*3;
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
