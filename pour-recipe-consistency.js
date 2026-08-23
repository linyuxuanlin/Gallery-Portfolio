import { readBrewHistory } from './pour-brew-history.js';
import { activeRecipe } from './pour-recipe.js';
import { analyzeRecipeExecution } from './pour-recipe-execution.js';

const finite=(v,f=null)=>Number.isFinite(Number(v))?Number(v):f;
const mean=values=>{const a=values.filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null};
const stdev=values=>{const a=values.filter(Number.isFinite);if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length)};
const clamp01=v=>Math.max(0,Math.min(1,finite(v,0)));

export function recipeScopedBrews(history,recipeId,{window=6}={}){
  return (Array.isArray(history)?history:[])
    .filter(brew=>brew?.samples?.length&&brew?.recipe?.id===recipeId)
    .sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')))
    .slice(-Math.max(3,window));
}

export function analyzeRecipeConsistency(history,recipeId,{window=6}={}){
  const brews=recipeScopedBrews(history,recipeId,{window});
  if(brews.length<3)return {applicable:false,count:brews.length,recipeId,headline:'至少完成 3 杯同配方后分析一致性',stages:[],overallConsistency:null};
  const executions=brews.map(brew=>({brew,result:analyzeRecipeExecution(brew)})).filter(item=>item.result?.applicable);
  if(executions.length<3)return {applicable:false,count:executions.length,recipeId,headline:'同配方阶段数据不足',stages:[],overallConsistency:null};
  const stageIds=[];
  for(const {result} of executions)for(const stage of result.stages)if(!stageIds.includes(stage.id))stageIds.push(stage.id);
  const stages=stageIds.map(id=>{
    const rows=executions.map(({result})=>result.stages.find(stage=>stage.id===id)).filter(Boolean);
    const flowErrors=rows.map(row=>finite(row.flowError)).filter(Number.isFinite);
    const compliances=rows.map(row=>finite(row.flowCompliance)).filter(Number.isFinite);
    const scores=rows.map(row=>finite(row.stageScore)).filter(Number.isFinite);
    const pauseErrors=rows.map(row=>row.pauseErrorMs===null?null:Math.abs(finite(row.pauseErrorMs,0))/1000).filter(Number.isFinite);
    const flowErrorMean=mean(flowErrors),flowErrorSpread=stdev(flowErrors),scoreMean=mean(scores),scoreSpread=stdev(scores),complianceMean=mean(compliances),pauseErrorMean=mean(pauseErrors);
    const repeatability=clamp01(1-Math.min(.55,(flowErrorSpread||0)/1.2)-Math.min(.35,(scoreSpread||0)*1.8)-Math.min(.10,(pauseErrorMean||0)/80));
    return {id,name:rows[0]?.name||id,count:rows.length,flowErrorMean,flowErrorSpread,complianceMean,scoreMean,scoreSpread,pauseErrorMean,repeatability};
  }).sort((a,b)=>a.repeatability-b.repeatability);
  const overallScores=executions.map(item=>finite(item.result.overallScore)).filter(Number.isFinite);
  const executionMean=mean(overallScores),executionSpread=stdev(overallScores);
  const overallConsistency=clamp01(1-Math.min(.75,executionSpread*2.3)-Math.min(.25,(stages[0]?.flowErrorSpread||0)/1.5));
  const worst=stages[0]||null;
  const headline=overallConsistency>=.82?'同配方复现稳定':overallConsistency>=.66?`${worst?.name||'阶段'}仍有波动`:`${worst?.name||'阶段'}复现性不足`;
  return {applicable:true,count:executions.length,recipeId,headline,overallConsistency,executionMean,executionSpread,stages,worstStageId:worst?.id||null,brews};
}

function ensureStyle(doc){
  if(doc.getElementById('pourRecipeConsistencyStyle'))return;
  const style=doc.createElement('style');style.id='pourRecipeConsistencyStyle';
  style.textContent='.recipe-consistency{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.recipe-consistency.show{display:block}.recipe-consistency-head{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--muted)}.recipe-consistency-head b{color:var(--text)}.recipe-consistency-grid{display:grid;gap:5px;margin-top:7px}.recipe-consistency-row{display:grid;grid-template-columns:minmax(64px,.8fr) repeat(3,1fr);gap:6px;padding:6px 7px;border-radius:9px;background:#fff1;font-size:9px}.recipe-consistency-row strong{color:var(--text)}.recipe-consistency-row span{color:var(--muted)}.recipe-consistency-row .good{color:var(--good)}.recipe-consistency-row .warn{color:var(--warn)}@media(max-width:560px){.recipe-consistency-row{grid-template-columns:1fr 1fr}.recipe-consistency-row strong{grid-column:1/-1}}';
  doc.head.appendChild(style);
}
function ensurePanel(doc){
  let panel=doc.getElementById('recipeConsistency');if(panel)return panel;
  const host=doc.getElementById('recipeExecution')||doc.getElementById('brewInsights')||doc.getElementById('results');if(!host?.parentElement)return null;
  panel=doc.createElement('div');panel.id='recipeConsistency';panel.className='recipe-consistency';
  panel.innerHTML='<div class="recipe-consistency-head"><span>RECIPE CONSISTENCY</span><b id="recipeConsistencyScore">--</b></div><div class="recipe-consistency-grid" id="recipeConsistencyGrid"></div>';
  host.insertAdjacentElement('afterend',panel);return panel;
}
export function renderRecipeConsistency(doc=globalThis.document,storage=globalThis.localStorage){
  const panel=ensurePanel(doc);if(!panel)return {rendered:false};
  const recipe=activeRecipe(storage),history=readBrewHistory(storage),result=analyzeRecipeConsistency(history,recipe.id);
  if(!result.applicable){panel.classList.remove('show');return {rendered:false,result}}
  doc.getElementById('recipeConsistencyScore').textContent=`${Math.round(result.overallConsistency*100)} · ${result.headline} · ${result.count} 杯`;
  const grid=doc.getElementById('recipeConsistencyGrid');grid.replaceChildren();
  for(const stage of result.stages){
    const row=doc.createElement('div');row.className='recipe-consistency-row';
    const name=doc.createElement('strong');name.textContent=stage.name;
    const rep=doc.createElement('span');rep.className=stage.repeatability>=.75?'good':'warn';rep.textContent=`复现 ${Math.round(stage.repeatability*100)}%`;
    const flow=doc.createElement('span');flow.textContent=stage.flowErrorMean===null?'流速 —':`流速 Δ ${stage.flowErrorMean.toFixed(2)}±${stage.flowErrorSpread.toFixed(2)}`;
    const hit=doc.createElement('span');hit.textContent=stage.complianceMean===null?'命中 —':`命中 ${Math.round(stage.complianceMean*100)}%`;
    row.append(name,rep,flow,hit);grid.appendChild(row);
  }
  panel.classList.add('show');return {rendered:true,result};
}
export function installRecipeConsistency(doc=globalThis.document,storage=globalThis.localStorage){
  if(!doc||doc.__pourRecipeConsistencyInstalled)return {installed:false};
  doc.__pourRecipeConsistencyInstalled=true;ensureStyle(doc);ensurePanel(doc);
  const update=()=>renderRecipeConsistency(doc,storage);
  doc.addEventListener?.('pour:history-imported',update);doc.addEventListener?.('pour:recipe-changed',update);doc.addEventListener?.('pour:recipe-score-updated',update);
  const results=doc.getElementById?.('results');if(results&&typeof MutationObserver!=='undefined'){const observer=new MutationObserver(()=>{if(results.classList.contains('show'))queueMicrotask(update)});observer.observe(results,{attributes:true,attributeFilter:['class']})}
  update();return {installed:true,update};
}
