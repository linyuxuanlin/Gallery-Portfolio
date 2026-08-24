import { readBrewHistory } from './pour-brew-history.js';
import { activeRecipe } from './pour-recipe.js';
import { analyzeRecipeConsistency } from './pour-recipe-consistency.js';
import { readRecipeStageProgress, syncRecipeStageChallenge } from './pour-recipe-stage-challenge.js';

const finite=(value,fallback=null)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp01=value=>Math.max(0,Math.min(1,finite(value,0)));

function focusForStage(stage){
  const repeatability=clamp01(stage?.repeatability);
  const flowErrorMean=Math.max(0,finite(stage?.flowErrorMean,0));
  const flowErrorSpread=Math.max(0,finite(stage?.flowErrorSpread,0));
  const compliance=clamp01(stage?.complianceMean);
  const pauseError=Math.max(0,finite(stage?.pauseErrorMean,0));
  if(pauseError>=6)return {id:'pause-rhythm',metric:'pauseErrorMean',direction:'lower',value:4,current:pauseError,label:'暂停误差 ≤ 4s',cue:'到达阶段目标水量后先稳定停手，按配方节奏再恢复注水',severity:pauseError/4};
  if(flowErrorSpread>=.32)return {id:'flow-repeatability',metric:'flowErrorSpread',direction:'lower',value:.25,current:flowErrorSpread,label:'杯间流速误差波动 ≤ 0.25 g/s',cue:'这一阶段先固定手腕和倾角，不要频繁追数值；目标是每杯用同样动作复现',severity:flowErrorSpread/.25};
  if(flowErrorMean>=.40)return {id:'flow-accuracy',metric:'flowErrorMean',direction:'lower',value:.30,current:flowErrorMean,label:'平均流速误差 ≤ 0.30 g/s',cue:'进入该阶段前先把壶倾角预置到目标流速附近，再做小幅修正',severity:flowErrorMean/.30};
  if(compliance<.75)return {id:'flow-compliance',metric:'complianceMean',direction:'higher',value:.80,current:compliance,label:'目标流速命中率 ≥ 80%',cue:'减少来回修正，优先延长落在目标流速窗口内的连续时间',severity:(.80-compliance)/.20+1};
  return {id:'repeatability',metric:'repeatability',direction:'higher',value:.82,current:repeatability,label:'阶段复现 ≥ 82%',cue:'复制上一杯该阶段的起始位置、流速和移动节奏，减少动作差异',severity:(.82-repeatability)/.18+1};
}

export function chooseRecipeStageTrainingTarget(consistency,{stableThreshold=.82,excludeKeys=[]}={}){
  if(!consistency?.applicable||!consistency?.stages?.length)return {applicable:false,mode:'insufficient',headline:'同配方数据不足',target:null};
  const stages=consistency.stages.filter(Boolean);
  if(consistency.overallConsistency>=stableThreshold&&stages.every(stage=>clamp01(stage.repeatability)>=stableThreshold)){
    const stage=stages[0];
    return {applicable:true,mode:'maintenance',stageId:stage?.id,stageName:stage?.name,headline:'同配方阶段复现已经稳定',cue:'下一杯维持当前节奏，不需要人为追求更激进的修正',target:{metric:'repeatability',direction:'higher',value:stableThreshold,current:clamp01(stage?.repeatability),label:`阶段复现 ≥ ${Math.round(stableThreshold*100)}%`}};
  }
  const excluded=new Set(Array.isArray(excludeKeys)?excludeKeys:[]);
  const candidates=stages.map(stage=>({stage,focus:focusForStage(stage)})).sort((a,b)=>(b.focus.severity||0)-(a.focus.severity||0)||a.stage.repeatability-b.stage.repeatability);
  let selected=candidates.find(item=>!excluded.has(`${item.stage.id}:${item.focus.id}`));let cycleRestart=false;
  if(!selected){selected=candidates[0];cycleRestart=true}
  const worst=selected?.stage,focus=selected?.focus;
  if(!worst||!focus)return {applicable:false,mode:'insufficient',headline:'阶段数据不足',target:null};
  return {applicable:true,mode:'focus',stageId:worst.id,stageName:worst.name,headline:`下一杯重点：${worst.name}`,cue:focus.cue,focusId:focus.id,target:focus,consistency:{overall:consistency.overallConsistency,repeatability:clamp01(worst.repeatability)},cycleRestart};
}

export function evaluateRecipeStageTrainingTarget(target,consistency){
  if(!target?.applicable||target.mode!=='focus'||!target.target||!consistency?.applicable)return {applicable:false,passed:null,current:null};
  const stage=consistency.stages?.find(item=>item.id===target.stageId);if(!stage)return {applicable:false,passed:null,current:null};
  const current=finite(stage[target.target.metric]);if(current===null)return {applicable:false,passed:null,current:null};
  const passed=target.target.direction==='higher'?current>=target.target.value:current<=target.target.value;
  return {applicable:true,passed,current,target:target.target.value,direction:target.target.direction,stageId:stage.id};
}

function fmt(metric,value){
  if(value===null||!Number.isFinite(Number(value)))return '—';
  if(metric==='repeatability'||metric==='complianceMean')return `${Math.round(value*100)}%`;
  if(metric==='pauseErrorMean')return `${value.toFixed(1)}s`;
  return `${value.toFixed(2)} g/s`;
}
function fmtDelta(metric,from,to){
  if(!Number.isFinite(Number(from))||!Number.isFinite(Number(to)))return '';
  const delta=to-from;
  if(metric==='repeatability'||metric==='complianceMean')return `${fmt(metric,from)} → ${fmt(metric,to)} (${delta>=0?'+':''}${Math.round(delta*100)}pp)`;
  if(metric==='pauseErrorMean')return `${fmt(metric,from)} → ${fmt(metric,to)} (${delta>=0?'+':''}${delta.toFixed(1)}s)`;
  return `${fmt(metric,from)} → ${fmt(metric,to)} (${delta>=0?'+':''}${delta.toFixed(2)} g/s)`;
}

function ensureStyle(doc){
  if(doc.getElementById('pourRecipeStageTrainingStyle'))return;
  const style=doc.createElement('style');style.id='pourRecipeStageTrainingStyle';
  style.textContent='.recipe-stage-training{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.recipe-stage-training.show{display:block}.recipe-stage-training-head{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--muted)}.recipe-stage-training-head b{color:var(--text)}.recipe-stage-training-main{margin-top:6px;font-size:10px;color:var(--text);font-weight:700}.recipe-stage-training-target{margin-top:4px;font-size:9px;color:var(--good)}.recipe-stage-training-progress{margin-top:5px;font-size:9px;color:var(--accent)}.recipe-stage-training-cue{margin-top:4px;font-size:9px;color:var(--muted);line-height:1.45}';doc.head.appendChild(style);
}
function ensurePanel(doc){
  let panel=doc.getElementById('recipeStageTraining');if(panel)return panel;
  const host=doc.getElementById('recipeConsistency')||doc.getElementById('recipeExecution')||doc.getElementById('results');if(!host?.parentElement)return null;
  panel=doc.createElement('div');panel.id='recipeStageTraining';panel.className='recipe-stage-training';
  panel.innerHTML='<div class="recipe-stage-training-head"><span>STAGE FOCUS</span><b id="recipeStageTrainingScore">--</b></div><div class="recipe-stage-training-main" id="recipeStageTrainingMain"></div><div class="recipe-stage-training-target" id="recipeStageTrainingTarget"></div><div class="recipe-stage-training-progress" id="recipeStageTrainingProgress"></div><div class="recipe-stage-training-cue" id="recipeStageTrainingCue"></div>';
  host.insertAdjacentElement('afterend',panel);return panel;
}

export function renderRecipeStageTraining(doc=globalThis.document,storage=globalThis.localStorage,{evaluateLatest=true}={}){
  const panel=ensurePanel(doc);if(!panel)return {rendered:false};
  const recipe=activeRecipe(storage),history=readBrewHistory(storage),consistency=analyzeRecipeConsistency(history,recipe.id);
  if(!consistency.applicable){panel.classList.remove('show');return {rendered:false,consistency}}
  let progress=readRecipeStageProgress(storage,recipe.id);
  let plan=chooseRecipeStageTrainingTarget(consistency,{excludeKeys:progress.completedKeys});
  const latest=consistency.brews?.at(-1)||null;
  let transition=syncRecipeStageChallenge(storage,{recipeId:recipe.id,plan,consistency,latestReplayId:latest?.id||null,evaluate:evaluateRecipeStageTrainingTarget,requiredPasses:2,allowEvaluation:evaluateLatest});
  if(transition.graduated){
    progress=transition.progress;plan=chooseRecipeStageTrainingTarget(consistency,{excludeKeys:progress.completedKeys});
    transition=syncRecipeStageChallenge(storage,{recipeId:recipe.id,plan,consistency,latestReplayId:latest?.id||null,evaluate:evaluateRecipeStageTrainingTarget,requiredPasses:2,allowEvaluation:false});
  }
  const shownPlan=transition.plan||plan;
  if(!shownPlan?.applicable){panel.classList.remove('show');return {rendered:false,plan:shownPlan,consistency,transition}}
  const challenge=transition.progress?.challenge||null;
  doc.getElementById('recipeStageTrainingScore').textContent=consistency.overallConsistency===null?'--':`${Math.round(consistency.overallConsistency*100)}% consistency`;
  doc.getElementById('recipeStageTrainingMain').textContent=shownPlan.headline;
  const currentValue=challenge&&Number.isFinite(Number(challenge.lastValue))?challenge.lastValue:shownPlan.target?.current;
  doc.getElementById('recipeStageTrainingTarget').textContent=shownPlan.target?`${shownPlan.target.label} · 当前 ${fmt(shownPlan.target.metric,currentValue)}`:'保持当前表现';
  const progressEl=doc.getElementById('recipeStageTrainingProgress');
  if(shownPlan.mode==='maintenance')progressEl.textContent='本配方进入综合稳定训练';
  else if(challenge){const streak=`连续达标 ${challenge.consecutivePasses||0}/${challenge.requiredPasses||2}`;const attempts=`已验收 ${challenge.attempts||0} 杯`;const delta=fmtDelta(challenge.target.metric,challenge.previousValue,challenge.lastValue);progressEl.textContent=[streak,attempts,delta].filter(Boolean).join(' · ')}
  else progressEl.textContent='下一杯开始记录专项挑战';
  doc.getElementById('recipeStageTrainingCue').textContent=shownPlan.cue;panel.classList.add('show');
  return {rendered:true,plan:shownPlan,consistency,transition};
}

export function installRecipeStageTraining(doc=globalThis.document,storage=globalThis.localStorage){
  if(!doc||doc.__pourRecipeStageTrainingInstalled)return {installed:false};
  doc.__pourRecipeStageTrainingInstalled=true;ensureStyle(doc);ensurePanel(doc);
  const refresh=()=>renderRecipeStageTraining(doc,storage,{evaluateLatest:false});
  const evaluate=()=>renderRecipeStageTraining(doc,storage,{evaluateLatest:true});
  doc.addEventListener?.('pour:history-imported',refresh);doc.addEventListener?.('pour:recipe-changed',refresh);doc.addEventListener?.('pour:recipe-score-updated',evaluate);
  const results=doc.getElementById?.('results');if(results&&typeof MutationObserver!=='undefined'){const observer=new MutationObserver(()=>{if(results.classList.contains('show'))queueMicrotask(evaluate)});observer.observe(results,{attributes:true,attributeFilter:['class']})}
  refresh();return {installed:true,update:refresh,evaluate};
}
