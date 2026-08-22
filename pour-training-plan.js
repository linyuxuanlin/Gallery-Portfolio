import { analyzeBrew } from './pour-brew-analysis.js';
import { analyzeBrewTrend } from './pour-brew-trend.js';

const TARGETS={
  flowStability:{id:'flow-stability',title:'流速稳定专项',metric:'flowStability',direction:'higher',target:.75,targetText:'流速稳定度 ≥ 75%',cue:'这一杯只练倾角控制：目标 5.0 g/s，尽量少做频繁修正。'},
  coverage:{id:'bed-coverage',title:'粉床覆盖专项',metric:'coverage',direction:'higher',target:.75,targetText:'粉床覆盖率 ≥ 75%',cue:'闷蒸阶段主动扩大浸润范围，主体注水不要长期停在中心。'},
  uniformity:{id:'bed-uniformity',title:'粉床均匀专项',metric:'uniformity',direction:'higher',target:.72,targetText:'粉床均匀度 ≥ 72%',cue:'减少固定点冲刷，保持连续小圈移动，让不同区域受水更均匀。'},
  edgeExposure:{id:'edge-control',title:'外圈控制专项',metric:'edgeExposure',direction:'lower',target:.18,targetText:'外圈暴露 ≤ 18%',cue:'主体轨迹尽量收在粉床约 70% 半径以内，避免持续贴滤纸。'}
};

const finite=v=>Number.isFinite(Number(v))?Number(v):null;

export function chooseTrainingPlan(history,{window=8,excludeIds=[]}={}){
  const trend=analyzeBrewTrend(history,{window});
  if(!trend.valid) return {valid:false,reason:'need-more-brews',headline:'至少完成 3 杯后生成专项训练',trend};
  const excluded=new Set(Array.isArray(excludeIds)?excludeIds:[]);
  const candidates=[];
  for(const [key,cfg] of Object.entries(TARGETS)){
    if(excluded.has(cfg.id)) continue;
    const m=trend.metrics[key],last=finite(m?.last);
    if(last===null) continue;
    const misses=cfg.direction==='higher'?Math.max(0,cfg.target-last):Math.max(0,last-cfg.target);
    const worsening=m.direction==='declining'?1:0;
    candidates.push({key,cfg,m,last,misses,priority:worsening*2+misses*4,worsening});
  }
  candidates.sort((a,b)=>b.priority-a.priority||b.misses-a.misses);
  const best=candidates[0];
  if(!best||(best.misses===0&&best.worsening===0)) return {valid:true,mode:'maintenance',headline:'进入综合稳定训练',goal:'保持当前水平，并尝试降低波动',cue:'这一杯不追求更快，只保持熟悉节奏和稳定轨迹。',trend};
  return {valid:true,mode:'focus',id:best.cfg.id,metric:best.cfg.metric,title:best.cfg.title,headline:`下一杯：${best.cfg.title}`,current:best.last,target:best.cfg.target,targetText:best.cfg.targetText,cue:best.cfg.cue,trendDirection:best.m.direction,trend};
}

export function evaluateTrainingPlan(plan,replay){
  if(!plan?.valid||plan.mode!=='focus'||!replay) return {applicable:false,passed:null};
  const metric=plan.metric;
  let value;
  if(metric==='flowStability'||metric==='edgeExposure'){
    const analysis=replay.analysis||analyzeBrew(replay.samples||[]);
    value=finite(analysis?.[metric]);
  }else{
    value=finite(replay.metrics?.[metric]);
  }
  if(value===null) return {applicable:false,passed:null};
  const passed=metric==='edgeExposure'?value<=plan.target:value>=plan.target;
  return {applicable:true,passed,value,target:plan.target,metric};
}

export function trainingPlanSummary(plan){
  if(!plan?.valid) return [plan?.headline||'专项训练尚未生成'];
  if(plan.mode==='maintenance') return [plan.headline,plan.goal,plan.cue];
  return [plan.headline,`${plan.targetText} · 当前 ${(plan.current*100).toFixed(0)}%`,plan.cue];
}
