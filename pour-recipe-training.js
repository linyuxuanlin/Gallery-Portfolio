import { activeRecipe, recipeStageAtWater } from './pour-recipe.js';
import { activeFlowSnapshot, setActiveFlowTargetWater } from './pour-flow-runtime.js';

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function recipeTrainingState(recipe, snapshot={}) {
  const water=Math.max(0,finite(snapshot.water,0));
  const actualFlow=Math.max(0,finite(snapshot.actualFlow,0));
  const target=Math.max(1,finite(recipe?.water,250));
  const progress=Math.min(1,water/target);
  const stage=recipeStageAtWater(recipe,water);
  const complete=water>=target-1e-9;
  const stageSpan=Math.max(.001,stage.toWater-stage.fromWater);
  const stageProgress=Math.min(1,Math.max(0,(water-stage.fromWater)/stageSpan));
  const flowDelta=actualFlow-stage.targetFlow;
  let coach='';
  if(complete) coach=`完成 ${Math.round(target)}g · ${recipe?.name||'当前配方'}`;
  else if(stage.id==='bloom') coach=`闷蒸至 ${Math.round(stage.toWater)}g · 目标 ${stage.targetFlow.toFixed(1)} g/s${stage.pauseAfter?` · 随后停 ${Math.round(stage.pauseAfter)}s`:''}`;
  else if(Math.abs(flowDelta)>.8) coach=`${flowDelta>0?'流速偏高':'流速偏低'} · 本阶段目标 ${stage.targetFlow.toFixed(1)} g/s · 至 ${Math.round(stage.toWater)}g`;
  else coach=`${stage.name} · 保持 ${stage.targetFlow.toFixed(1)} g/s · 至 ${Math.round(stage.toWater)}g`;
  return {water,target,progress,stage,stageProgress,actualFlow,flowDelta,complete,phase:complete?'完成':stage.name,coach};
}

export function applyRecipeToTraining(recipe,doc=globalThis.document) {
  if(!recipe) return {applied:false};
  const states=setActiveFlowTargetWater(recipe.water);
  const flow=doc?.getElementById?.('flowControl');
  if(flow){
    flow.value=String(recipe.targetFlow);
    flow.dispatchEvent(new Event('input',{bubbles:true}));
  }
  return {applied:states.length>0,targetWater:recipe.water,targetFlow:recipe.targetFlow};
}

function shouldOwnCoach(doc){
  const pause=doc?.getElementById?.('pauseMetric');
  if(pause?.classList?.contains?.('show')) return false;
  const mode=doc?.getElementById?.('modeLabel')?.textContent||'';
  return !/REPLAY|GHOST/i.test(mode);
}

function paintRecipeTraining(doc,recipe,snapshot){
  const state=recipeTrainingState(recipe,snapshot);
  const bar=doc.getElementById('bar');
  if(bar) bar.style.width=`${Math.min(100,state.progress*100)}%`;
  const mode=doc.getElementById('modeLabel');
  if(mode&&!/REPLAY|GHOST/i.test(mode.textContent||'')) mode.textContent=`${recipe.name} · ${recipe.dose}g:${recipe.water}g`;
  if(shouldOwnCoach(doc)){
    const phase=doc.getElementById('phase'),coach=doc.getElementById('coach');
    if(phase) phase.textContent=state.phase;
    if(coach) coach.textContent=state.coach;
  }
  return state;
}

export function installRecipeTraining(doc=globalThis.document,storage=globalThis.localStorage,{raf=globalThis.requestAnimationFrame}={}){
  if(!doc||doc.__pourRecipeTrainingInstalled) return {installed:false};
  doc.__pourRecipeTrainingInstalled=true;
  let recipe=activeRecipe(storage);
  let stopped=false,frame=0,lastState=null;
  const apply=next=>{recipe=next||activeRecipe(storage);return applyRecipeToTraining(recipe,doc)};
  apply(recipe);
  const onRecipeChanged=event=>apply(event?.detail?.recipe||activeRecipe(storage));
  doc.addEventListener('pour:recipe-changed',onRecipeChanged);
  const tick=()=>{
    if(stopped)return;
    const snapshot=activeFlowSnapshot();
    if(snapshot) lastState=paintRecipeTraining(doc,recipe,snapshot);
    if(typeof raf==='function') frame=raf(tick);
  };
  if(typeof raf==='function') frame=raf(tick);
  return {
    installed:true,
    getRecipe:()=>recipe,
    getState:()=>lastState,
    apply,
    destroy(){stopped=true;doc.removeEventListener('pour:recipe-changed',onRecipeChanged);if(frame&&globalThis.cancelAnimationFrame)globalThis.cancelAnimationFrame(frame)},
  };
}
