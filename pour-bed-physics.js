export function createBedPhysics({size=25,radius=0.70,diffusion=0.22,drainRate=0.018,capacity=1.6}={}){
  const n=size*size, wet=new Float64Array(n), valid=new Uint8Array(n), delta=new Float64Array(n);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const nx=(x+.5)/size*2-1,nz=(y+.5)/size*2-1;
    if(nx*nx+nz*nz<=1) valid[y*size+x]=1;
  }
  function deposit(x,z,grams,{sigma=2.1,efficiency=.085}={}){
    if(!(grams>0)) return 0;
    const gx=(x/radius*.5+.5)*size,gz=(z/radius*.5+.5)*size;
    let applied=0;
    for(let iy=Math.max(0,Math.floor(gz-6));iy<Math.min(size,Math.ceil(gz+6));iy++)for(let ix=Math.max(0,Math.floor(gx-6));ix<Math.min(size,Math.ceil(gx+6));ix++){
      const i=iy*size+ix;if(!valid[i])continue;
      const d2=(ix+.5-gx)**2+(iy+.5-gz)**2;
      const add=grams*Math.exp(-d2/(2*sigma*sigma))*efficiency;
      const before=wet[i];wet[i]=Math.min(capacity,before+add);applied+=wet[i]-before;
    }
    return applied;
  }
  function step(dt){
    dt=Math.max(0,Number(dt)||0);if(dt===0)return;
    // Diffuse by symmetric pairwise fluxes. Every amount removed from one cell
    // is added to its neighbour, so diffusion alone cannot create/destroy bed
    // moisture at the circular boundary. Reuse one scratch buffer to avoid a
    // per-frame wet.slice() allocation on mobile.
    delta.fill(0);
    const k=Math.min(.24,diffusion*dt);
    if(k>0){
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const i=y*size+x;if(!valid[i])continue;
        if(x+1<size){
          const j=i+1;
          if(valid[j]){const flux=k*(wet[j]-wet[i]);delta[i]+=flux;delta[j]-=flux;}
        }
        if(y+1<size){
          const j=i+size;
          if(valid[j]){const flux=k*(wet[j]-wet[i]);delta[i]+=flux;delta[j]-=flux;}
        }
      }
    }
    const drain=Math.exp(-drainRate*dt);
    for(let i=0;i<n;i++){
      if(!valid[i])continue;
      let next=(wet[i]+delta[i])*drain;
      if(next<1e-8)next=0;
      wet[i]=Math.min(capacity,Math.max(0,next));
    }
  }
  function metrics(){
    let covered=0,total=0,sum=0,sum2=0,max=0;
    for(let i=0;i<n;i++){if(!valid[i])continue;total++;const w=wet[i];sum+=w;sum2+=w*w;if(w>.18)covered++;if(w>max)max=w;}
    const mean=total?sum/total:0,variance=total?Math.max(0,sum2/total-mean*mean):0;
    const uniformity=mean<.04?1:Math.max(0,1-Math.sqrt(variance)/(mean*1.55));
    return {coverage:total?covered/total:0,uniformity,hotspot:mean>.03?max/mean:0,mean,max,totalWaterField:sum};
  }
  function reset(){wet.fill(0);delta.fill(0)}
  return {size,radius,wet,valid,deposit,step,metrics,reset};
}
