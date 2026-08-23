import { POUR_SPATIAL_CALIBRATION, kettlePositionForTarget } from './pour-spatial-calibration.js';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export const DEFAULT_STREAM_PHYSICS=Object.freeze({
  gravity:5.5,
  minFlow:.08,
  minDownVelocity:.10,
  maxDownVelocity:.44,
  minFlowForCalibration:2,
  maxFlowForCalibration:8,
  targetResponseHz:8,
  kettleResponseHz:6,
  streamRefreshMs:40,
  streamIdleRefreshMs:50,
  streamTailRefreshMs:66,
  streamPointEpsilon:.012,
  streamFlowEpsilon:.08,
  streamRadiusEpsilon:.0012,
});

const DEFAULT_POINT=Object.freeze({x:0,y:POUR_SPATIAL_CALIBRATION.bedY,z:0});
const DEFAULT_KETTLE=Object.freeze(kettlePositionForTarget(DEFAULT_POINT));
const DEFAULT_KETTLE_OFFSET=Object.freeze({
  x:DEFAULT_KETTLE.x-DEFAULT_POINT.x,
  y:DEFAULT_KETTLE.y-DEFAULT_POINT.y,
  z:DEFAULT_KETTLE.z-DEFAULT_POINT.z,
});

export function streamDownVelocityForFlow(flow,options={}){
  const cfg={...DEFAULT_STREAM_PHYSICS,...options};
  const f=Math.max(0,Number(flow)||0);
  if(f<cfg.minFlow)return 0;
  const u=clamp((f-cfg.minFlowForCalibration)/Math.max(.001,cfg.maxFlowForCalibration-cfg.minFlowForCalibration),0,1);
  const s=u*u*(3-2*u);
  return cfg.minDownVelocity+(cfg.maxDownVelocity-cfg.minDownVelocity)*s;
}

export function ballisticFlight({startY,endY,flow,gravity=DEFAULT_STREAM_PHYSICS.gravity}={}){
  const sy=Number(startY)||0,ey=Number(endY)||0;
  const dy=Math.max(0,sy-ey);
  const g=Math.max(.001,Number(gravity)||DEFAULT_STREAM_PHYSICS.gravity);
  const down=streamDownVelocityForFlow(flow);
  if(dy<=0)return{time:0,initialVy:-down,gravity:g};
  const time=(-down+Math.sqrt(down*down+2*g*dy))/g;
  return{time,initialVy:-down,gravity:g};
}

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

export function smoothingAlpha(dt,responseHz){
  const seconds=Math.max(0,Number(dt)||0);
  const hz=Math.max(0,Number(responseHz)||0);
  if(!seconds||!hz)return 0;
  return 1-Math.exp(-hz*seconds);
}

export function smoothPoint(current,target,dt,responseHz=DEFAULT_STREAM_PHYSICS.targetResponseHz){
  const a=smoothingAlpha(dt,responseHz);
  const cx=Number(current?.x)||0,cy=Number(current?.y)||0,cz=Number(current?.z)||0;
  const tx=Number(target?.x)||0,ty=Number(target?.y)||0,tz=Number(target?.z)||0;
  return{x:cx+(tx-cx)*a,y:cy+(ty-cy)*a,z:cz+(tz-cz)*a};
}

export function pointDistance(a,b){
  const dx=(Number(a?.x)||0)-(Number(b?.x)||0);
  const dy=(Number(a?.y)||0)-(Number(b?.y)||0);
  const dz=(Number(a?.z)||0)-(Number(b?.z)||0);
  return Math.hypot(dx,dy,dz);
}

export function createStreamMotionRuntime({
  point=DEFAULT_POINT,
  kettle=DEFAULT_KETTLE,
  kettleOffset=DEFAULT_KETTLE_OFFSET,
  targetResponseHz=DEFAULT_STREAM_PHYSICS.targetResponseHz,
  kettleResponseHz=DEFAULT_STREAM_PHYSICS.kettleResponseHz,
}={}){
  let desired={...point};
  let actual={...point};
  let kettlePos={...kettle};
  const offset={...kettleOffset};
  return{
    setDesired(next){desired={x:Number(next?.x)||0,y:Number(next?.y)||0,z:Number(next?.z)||0};return this.snapshot()},
    reset(next=point){desired={...next};actual={...next};kettlePos={x:actual.x+offset.x,y:actual.y+offset.y,z:actual.z+offset.z};return this.snapshot()},
    step(dt){
      actual=smoothPoint(actual,desired,dt,targetResponseHz);
      const kettleTarget={x:actual.x+offset.x,y:actual.y+offset.y,z:actual.z+offset.z};
      kettlePos=smoothPoint(kettlePos,kettleTarget,dt,kettleResponseHz);
      return this.snapshot();
    },
    snapshot(){return{desired:{...desired},actual:{...actual},kettle:{...kettlePos}}},
  };
}

export function streamRefreshInterval({
  previousPoint,currentPoint,
  previousFlow=0,currentFlow=0,
  baseIntervalMs=DEFAULT_STREAM_PHYSICS.streamRefreshMs,
  idleIntervalMs=DEFAULT_STREAM_PHYSICS.streamIdleRefreshMs,
  tailIntervalMs=DEFAULT_STREAM_PHYSICS.streamTailRefreshMs,
  pointEpsilon=DEFAULT_STREAM_PHYSICS.streamPointEpsilon,
  force=false,
}={}){
  const movement=pointDistance(previousPoint,currentPoint);
  const pf=Math.max(0,Number(previousFlow)||0),cf=Math.max(0,Number(currentFlow)||0),maxFlow=Math.max(pf,cf);
  const visibilityChanged=(pf>=DEFAULT_STREAM_PHYSICS.minFlow)!==(cf>=DEFAULT_STREAM_PHYSICS.minFlow);
  if(visibilityChanged)return Math.max(0,baseIntervalMs);
  if(maxFlow<1&&maxFlow>=DEFAULT_STREAM_PHYSICS.minFlow)return Math.max(baseIntervalMs,tailIntervalMs);
  if(force||movement>=pointEpsilon)return Math.max(0,baseIntervalMs);
  return Math.max(baseIntervalMs,idleIntervalMs);
}

export function shouldRefreshStream({
  nowMs=0,lastUpdateMs=-Infinity,
  previousPoint,currentPoint,
  previousFlow=0,currentFlow=0,
  previousRadius=0,currentRadius=0,
  minIntervalMs,
  pointEpsilon=DEFAULT_STREAM_PHYSICS.streamPointEpsilon,
  flowEpsilon=DEFAULT_STREAM_PHYSICS.streamFlowEpsilon,
  radiusEpsilon=DEFAULT_STREAM_PHYSICS.streamRadiusEpsilon,
  force=false,
}={}){
  const interval=minIntervalMs??streamRefreshInterval({previousPoint,currentPoint,previousFlow,currentFlow,pointEpsilon,force});
  if(Number(nowMs)-Number(lastUpdateMs)<Math.max(0,Number(interval)||0))return false;
  if(force)return true;
  const visibilityChanged=(previousFlow>=DEFAULT_STREAM_PHYSICS.minFlow)!==(currentFlow>=DEFAULT_STREAM_PHYSICS.minFlow);
  if(visibilityChanged)return true;
  if(currentFlow<DEFAULT_STREAM_PHYSICS.minFlow)return false;
  return pointDistance(previousPoint,currentPoint)>=pointEpsilon||
    Math.abs((Number(currentFlow)||0)-(Number(previousFlow)||0))>=flowEpsilon||
    Math.abs((Number(currentRadius)||0)-(Number(previousRadius)||0))>=radiusEpsilon;
}
