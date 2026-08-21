const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export const DEFAULT_STREAM_PHYSICS=Object.freeze({
  gravity:5.5,
  minFlow:.08,
  minDownVelocity:.10,
  maxDownVelocity:.44,
  minFlowForCalibration:2,
  maxFlowForCalibration:8,
});

// A gooseneck stream leaves the spout with modest downward momentum. Higher
// flow carries more momentum and therefore follows a slightly straighter,
// faster path before reaching the bed. Values are scene units / second.
export function streamDownVelocityForFlow(flow,options={}){
  const cfg={...DEFAULT_STREAM_PHYSICS,...options};
  const f=Math.max(0,Number(flow)||0);
  if(f<cfg.minFlow)return 0;
  const u=clamp((f-cfg.minFlowForCalibration)/Math.max(.001,cfg.maxFlowForCalibration-cfg.minFlowForCalibration),0,1);
  // Smoothstep avoids a visible kink at the calibrated 2 and 8 g/s anchors.
  const s=u*u*(3-2*u);
  return cfg.minDownVelocity+(cfg.maxDownVelocity-cfg.minDownVelocity)*s;
}

export function ballisticFlight({startY,endY,flow,gravity=DEFAULT_STREAM_PHYSICS.gravity}={}){
  const sy=Number(startY)||0,ey=Number(endY)||0;
  const dy=Math.max(0,sy-ey);
  const g=Math.max(.001,Number(gravity)||DEFAULT_STREAM_PHYSICS.gravity);
  const down=streamDownVelocityForFlow(flow);
  if(dy<=0)return{time:0,initialVy:-down,gravity:g};
  // y(t)=start - down*t - 1/2*g*t^2. Solve for the positive root.
  const time=(-down+Math.sqrt(down*down+2*g*dy))/g;
  return{time,initialVy:-down,gravity:g};
}

// Framework-independent arc sampler. x/z are solved so the stream still lands
// exactly at the chosen bed point, while flow changes flight time and sag.
export function sampleBallisticArc(start,end,flow,{segments=16,gravity=DEFAULT_STREAM_PHYSICS.gravity}={}){
  const sx=Number(start?.x)||0,sy=Number(start?.y)||0,sz=Number(start?.z)||0;
  const ex=Number(end?.x)||0,ey=Number(end?.y)||0,ez=Number(end?.z)||0;
  const flight=ballisticFlight({startY:sy,endY:ey,flow,gravity});
  const count=Math.max(2,Math.round(segments));
  if(flight.time<=0)return Array.from({length:count+1},(_,i)=>{
    const u=i/count;return{x:sx+(ex-sx)*u,y:sy+(ey-sy)*u,z:sz+(ez-sz)*u};
  });
  const vx=(ex-sx)/flight.time,vz=(ez-sz)/flight.time;
  const out=[];
  for(let i=0;i<=count;i++){
    const t=flight.time*i/count;
    out.push({x:sx+vx*t,y:sy+flight.initialVy*t-.5*flight.gravity*t*t,z:sz+vz*t});
  }
  // Force exact endpoint to avoid tiny floating-point drift in Three.js tubes.
  out[out.length-1]={x:ex,y:ey,z:ez};
  return out;
}

export function arcSagFromChord(points){
  if(!Array.isArray(points)||points.length<3)return 0;
  const a=points[0],b=points[points.length-1];
  let max=0;
  for(let i=1;i<points.length-1;i++){
    const u=i/(points.length-1);
    const chordY=a.y+(b.y-a.y)*u;
    max=Math.max(max,points[i].y-chordY);
  }
  return max;
}
