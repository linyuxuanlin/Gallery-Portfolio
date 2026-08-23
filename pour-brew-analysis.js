const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));

function finite(v,fallback=0){v=Number(v);return Number.isFinite(v)?v:fallback}
function sampleDtMs(samples,i){if(i<=0)return 0;return Math.max(0,finite(samples[i].t)-finite(samples[i-1].t))}

export function analyzeBrew(samples,{bedRadius=.70,gridSize=9,minFlow=.08}={}){
  if(!Array.isArray(samples)||samples.length<2){
    return {valid:false,activeMs:0,totalMs:0,water:0,avgFlow:0,flowStability:0,pathDistance:0,pathEfficiency:0,dwellConcentration:0,edgeExposure:0,radial:{inner:0,middle:0,outer:0},pauseCount:0,lifecycleBreakCount:0};
  }
  const cells=new Float64Array(gridSize*gridSize);
  let activeMs=0,flowArea=0,flowSqArea=0,pathDistance=0,activePathDistance=0,edgeMs=0,innerMs=0,middleMs=0,outerMs=0,pauseCount=0,lifecycleBreakCount=0;
  let previousActive=false;
  const firstT=finite(samples[0].t),lastT=finite(samples.at(-1).t,firstT),totalMs=Math.max(0,lastT-firstT);
  for(let i=1;i<samples.length;i++){
    const s=samples[i],p=samples[i-1],dt=sampleDtMs(samples,i);
    if(dt<=0)continue;
    const broken=s?.breakBefore===true;
    if(broken)lifecycleBreakCount++;
    const flow=Math.max(0,finite(s.flow));
    const active=flow>minFlow||s.pouring===true;
    const x=finite(s.x),z=finite(s.z),px=finite(p.x),pz=finite(p.z);
    const step=broken?0:Math.hypot(x-px,z-pz);pathDistance+=step;
    if(active){
      activeMs+=dt;flowArea+=flow*dt;flowSqArea+=flow*flow*dt;activePathDistance+=step;
      const r=Math.hypot(x,z)/Math.max(1e-9,bedRadius);
      if(r<.34)innerMs+=dt;else if(r<.72)middleMs+=dt;else outerMs+=dt;
      if(r>.82)edgeMs+=dt;
      const gx=clamp((x/bedRadius*.5+.5),0,.999999),gz=clamp((z/bedRadius*.5+.5),0,.999999);
      const ix=Math.floor(gx*gridSize),iz=Math.floor(gz*gridSize);cells[iz*gridSize+ix]+=dt;
    }
    if(!broken&&previousActive&&!active)pauseCount++;
    previousActive=active;
  }
  const avgFlow=activeMs?flowArea/activeMs:0;
  const variance=activeMs?Math.max(0,flowSqArea/activeMs-avgFlow*avgFlow):0;
  const cv=avgFlow>1e-6?Math.sqrt(variance)/avgFlow:1;
  const flowStability=clamp(1-cv/.48);
  let maxCell=0;for(const v of cells)if(v>maxCell)maxCell=v;
  const dwellConcentration=activeMs?maxCell/activeMs:0;
  const radialTotal=Math.max(1,innerMs+middleMs+outerMs);
  const displacement=Math.hypot(finite(samples.at(-1).x)-finite(samples[0].x),finite(samples.at(-1).z)-finite(samples[0].z));
  const pathEfficiency=activePathDistance>1e-6?clamp(displacement/activePathDistance):0;
  return {
    valid:true,totalMs,activeMs,water:Math.max(0,finite(samples.at(-1).water)),avgFlow,flowStability,
    pathDistance:activePathDistance,pathEfficiency,dwellConcentration,edgeExposure:activeMs?edgeMs/activeMs:0,
    radial:{inner:innerMs/radialTotal,middle:middleMs/radialTotal,outer:outerMs/radialTotal},pauseCount,lifecycleBreakCount,
  };
}

export function diagnoseBrew(analysis,{coverage=null,uniformity=null,hotspot=null}={}){
  if(!analysis?.valid)return [];
  const issues=[];
  const push=(code,severity,message)=>issues.push({code,severity,message});
  if(analysis.flowStability<.55)push('flow-unstable','high','实际流速波动较大，优先练习稳定倾角与连续出水。');
  else if(analysis.flowStability<.72)push('flow-unstable','medium','流速还有明显波动，可减少频繁修正倾角。');
  if(analysis.dwellConcentration>.34)push('dwell-hotspot','high','注水长时间停留在少数位置，容易形成局部冲刷。');
  else if(analysis.dwellConcentration>.24)push('dwell-hotspot','medium','落点停留略集中，绕圈可以更连续。');
  if(analysis.edgeExposure>.22)push('edge-overuse','medium','外圈停留时间偏多，减少贴近滤纸的持续注水。');
  if(analysis.radial.middle<.34&&analysis.activeMs>5000)push('middle-underused','medium','中圈利用不足，轨迹可能过于中心化或过度贴边。');
  if(Number.isFinite(coverage)&&coverage<.70)push('coverage-low','high','粉床覆盖不足，闷蒸和主体注水需要扩大有效覆盖。');
  if(Number.isFinite(uniformity)&&uniformity<.60)push('uniformity-low','high','粉床湿润分布不均，减少固定点停留并提高轨迹连续性。');
  if(Number.isFinite(hotspot)&&hotspot>4.8)push('bed-hotspot','high','粉床存在明显热点，局部进水量过度集中。');
  const rank={high:3,medium:2,low:1};
  issues.sort((a,b)=>rank[b.severity]-rank[a.severity]);
  return issues;
}
