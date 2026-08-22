import { analyzeBrew } from './pour-brew-analysis.js';

const pct=v=>Math.round((Number(v)||0)*100);
const round=(v,d=1)=>{const p=10**d;return Math.round((Number(v)||0)*p)/p};

export function metricsForReplay(replay){
  const a=analyzeBrew(replay?.samples||[]),saved=replay?.metrics||{};
  return {
    valid:a.valid,
    score:Number.isFinite(Number(replay?.score))?Number(replay.score):null,
    durationMs:Number(replay?.duration)||a.totalMs||0,
    avgFlow:a.avgFlow,
    flowStability:a.flowStability,
    edgeExposure:a.edgeExposure,
    middleUse:a.radial?.middle||0,
    dwellConcentration:a.dwellConcentration,
    pauseCount:a.pauseCount,
    coverage:Number.isFinite(Number(saved.coverage))?Number(saved.coverage):null,
    uniformity:Number.isFinite(Number(saved.uniformity))?Number(saved.uniformity):null,
    hotspot:Number.isFinite(Number(saved.hotspot))?Number(saved.hotspot):null,
  };
}

export function compareBrews(aReplay,bReplay){
  const a=metricsForReplay(aReplay),b=metricsForReplay(bReplay);
  const delta=key=>Number.isFinite(a[key])&&Number.isFinite(b[key])?b[key]-a[key]:null;
  const rows=[
    {key:'score',label:'总分',a:a.score,b:b.score,delta:delta('score'),better:'higher',format:v=>v==null?'--':`${Math.round(v)}`},
    {key:'flowStability',label:'流速稳定',a:a.flowStability,b:b.flowStability,delta:delta('flowStability'),better:'higher',format:v=>`${pct(v)}%`},
    {key:'edgeExposure',label:'外圈暴露',a:a.edgeExposure,b:b.edgeExposure,delta:delta('edgeExposure'),better:'lower',format:v=>`${pct(v)}%`},
    {key:'middleUse',label:'中圈利用',a:a.middleUse,b:b.middleUse,delta:delta('middleUse'),better:'higher',format:v=>`${pct(v)}%`},
    {key:'dwellConcentration',label:'停留集中',a:a.dwellConcentration,b:b.dwellConcentration,delta:delta('dwellConcentration'),better:'lower',format:v=>`${pct(v)}%`},
    {key:'coverage',label:'粉床覆盖',a:a.coverage,b:b.coverage,delta:delta('coverage'),better:'higher',format:v=>v==null?'--':`${pct(v)}%`},
    {key:'uniformity',label:'粉床均匀',a:a.uniformity,b:b.uniformity,delta:delta('uniformity'),better:'higher',format:v=>v==null?'--':`${pct(v)}%`},
    {key:'hotspot',label:'热点比',a:a.hotspot,b:b.hotspot,delta:delta('hotspot'),better:'lower',format:v=>v==null?'--':round(v,1).toFixed(1)},
    {key:'avgFlow',label:'平均流速',a:a.avgFlow,b:b.avgFlow,delta:delta('avgFlow'),better:'neutral',format:v=>`${round(v,1).toFixed(1)} g/s`},
    {key:'durationMs',label:'总时长',a:a.durationMs,b:b.durationMs,delta:delta('durationMs'),better:'neutral',format:v=>`${round(v/1000,1).toFixed(1)} s`},
  ];
  for(const row of rows){
    if(row.delta==null||row.better==='neutral'){row.trend='neutral';continue}
    const eps=row.key==='score'?.5:.005;
    if(Math.abs(row.delta)<=eps){row.trend='same';continue}
    const improved=row.better==='higher'?row.delta>0:row.delta<0;
    row.trend=improved?'better':'worse';
  }
  const comparable=rows.filter(r=>r.trend==='better'||r.trend==='worse');
  const better=comparable.filter(r=>r.trend==='better').length,worse=comparable.filter(r=>r.trend==='worse').length;
  return {a,b,rows,better,worse,headline:better===worse?'整体接近':better>worse?`第二杯在 ${better} 项更好`:`第二杯有 ${worse} 项退步`};
}

export function comparisonSummary(result){
  if(!result?.rows)return [];
  const important=['score','flowStability','coverage','uniformity','edgeExposure','dwellConcentration'];
  return result.rows
    .filter(r=>important.includes(r.key)&&(r.trend==='better'||r.trend==='worse'))
    .sort((x,y)=>important.indexOf(x.key)-important.indexOf(y.key))
    .slice(0,3)
    .map(r=>`${r.label}${r.trend==='better'?'改善':'退步'}：${r.format(r.a)} → ${r.format(r.b)}`);
}
