import { activeRecipe, normalizeRecipe, recipeStageAtWater } from './pour-recipe.js';

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function recipeAwareBaseScore(samples,recipe){
  const src=Array.isArray(samples)?samples:[];
  if(src.length<2)return {applicable:false,score:null,flowScore:null,edgeScore:null,activeMs:0};
  const normalized=normalizeRecipe(recipe||{});
  let quality=0,flowQuality=0,edgeQuality=0,activeMs=0;
  for(let i=1;i<src.length;i++){
    const prev=src[i-1],cur=src[i];
    const dt=Math.max(0,finite(cur?.t)-finite(prev?.t));
    const addedWater=Math.max(0,finite(cur?.water)-finite(prev?.water));
    if(!(dt>0)||!(addedWater>1e-6))continue;
    const water=(finite(prev?.water)+finite(cur?.water))*.5;
    const stage=recipeStageAtWater(normalized,water);
    const flow=(finite(prev?.flow)+finite(cur?.flow))*.5;
    const x=(finite(prev?.x)+finite(cur?.x))*.5,z=(finite(prev?.z)+finite(cur?.z))*.5;
    const flowScore=clamp01(1-Math.abs(flow-stage.targetFlow)/3.2);
    const center=Math.hypot(x,z);
    const edgeScore=clamp01(1-Math.max(0,center-.56)*4);
    quality+=(flowScore*.72+edgeScore*.28)*dt;
    flowQuality+=flowScore*dt;
    edgeQuality+=edgeScore*dt;
    activeMs+=dt;
  }
  if(!activeMs)return {applicable:false,score:null,flowScore:null,edgeScore:null,activeMs:0};
  return {applicable:true,score:quality/activeMs,flowScore:flowQuality/activeMs,edgeScore:edgeQuality/activeMs,activeMs};
}

function weightedAvailable(items){
  let sum=0,weight=0;
  for(const item of items||[]){
    if(!Number.isFinite(Number(item?.value))||!(Number(item?.weight)>0))continue;
    sum+=clamp01(item.value)*Number(item.weight);
    weight+=Number(item.weight);
  }
  return weight?sum/weight:null;
}

export function recipeAdjustedReplayScore(replay,recipe){
  if(!replay?.samples?.length)return {applicable:false,score:null,base:null};
  const base=recipeAwareBaseScore(replay.samples,recipe);
  if(!base.applicable)return {applicable:false,score:null,base};
  const bed=clamp01(replay?.metrics?.bed);
  let score=Math.round(100*(.68*base.score+.32*bed));
  const rawPath=replay?.metrics?.path,rawFlow=replay?.metrics?.flow;
  const path=rawPath==null?null:Number(rawPath),flow=rawFlow==null?null:Number(rawFlow);
  if(Number.isFinite(path)&&Number.isFinite(flow)){
    const rhythmApplicable=replay?.metrics?.rhythmApplicable===true;
    const follow=weightedAvailable([
      {value:path,weight:.48},
      {value:flow,weight:.27},
      {value:rhythmApplicable?Number(replay?.metrics?.rhythm):null,weight:.25},
    ]);
    if(follow!==null)score=Math.round(score*.67+follow*33);
  }
  return {applicable:true,score,base,bedScore:bed};
}

export function enrichReplayWithRecipeScore(replay,recipe){
  const normalized=normalizeRecipe(recipe||{});
  const result=recipeAdjustedReplayScore(replay,normalized);
  if(!result.applicable)return {changed:false,replay,result};
  const next={
    ...replay,
    score:result.score,
    recipe:{
      id:normalized.id,name:normalized.name,dose:normalized.dose,water:normalized.water,
      temperature:normalized.temperature,targetFlow:normalized.targetFlow,
      stages:normalized.stages.map(stage=>({...stage})),
    },
    metrics:{
      ...(replay.metrics||{}),recipeFlow:result.base.flowScore,recipeEdge:result.base.edgeScore,
      recipeBase:result.base.score,recipeAdjusted:true,
    },
  };
  return {changed:next.score!==replay.score||replay?.metrics?.recipeAdjusted!==true,replay:next,result};
}

export function installRecipeScoring(doc=globalThis.document,storage=globalThis.localStorage){
  if(!doc||doc.__pourRecipeScoringInstalled)return {installed:false};
  doc.__pourRecipeScoringInstalled=true;
  const apply=()=>{
    let replay=null;
    try{replay=JSON.parse(storage?.getItem?.('pourLabLastBrew')||'null')}catch{}
    if(!replay?.samples?.length)return {updated:false};
    const enriched=enrichReplayWithRecipeScore(replay,activeRecipe(storage));
    if(!enriched.changed)return {updated:false,replay:enriched.replay,result:enriched.result};
    try{storage?.setItem?.('pourLabLastBrew',JSON.stringify(enriched.replay))}
    catch{return {updated:false,error:'storage'}}
    const score=doc.getElementById?.('score');
    if(score)score.textContent=`评分 ${enriched.replay.score}`;
    const resultFlow=doc.getElementById?.('resultFlow');
    if(resultFlow&&!Number.isFinite(Number(enriched.replay.metrics?.flow)))resultFlow.textContent=Math.round(enriched.replay.metrics.recipeFlow*100);
    doc.dispatchEvent?.(new CustomEvent('pour:recipe-score-updated',{detail:{replay:enriched.replay,result:enriched.result}}));
    return {updated:true,replay:enriched.replay,result:enriched.result};
  };
  const results=doc.getElementById?.('results');
  if(results&&typeof MutationObserver!=='undefined'){
    const observer=new MutationObserver(()=>{if(results.classList.contains('show'))queueMicrotask(apply)});
    observer.observe(results,{attributes:true,attributeFilter:['class']});
  }
  return {installed:true,apply};
}
