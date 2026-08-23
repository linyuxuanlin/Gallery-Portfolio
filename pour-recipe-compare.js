import { metricsForReplay } from './pour-brew-compare.js';

const finite=(v,f=null)=>{const n=Number(v);return Number.isFinite(n)?n:f};
const pct=v=>v==null?'--':`${Math.round(v*100)}%`;
const round=(v,d=1)=>{if(v==null)return null;const p=10**d;return Math.round(v*p)/p};

export function recipeForReplay(replay){
  const recipe=replay?.recipe;
  if(!recipe||typeof recipe!=='object')return null;
  return {
    id:typeof recipe.id==='string'&&recipe.id?recipe.id:'legacy',
    name:typeof recipe.name==='string'&&recipe.name?recipe.name:'未命名配方',
    dose:finite(recipe.dose),water:finite(recipe.water),temperature:finite(recipe.temperature),targetFlow:finite(recipe.targetFlow),
    stages:Array.isArray(recipe.stages)?recipe.stages:[],
  };
}

export function stageForWater(recipe,water){
  const stages=recipe?.stages||[],w=Math.max(0,finite(water,0));
  return stages.find(stage=>w>=Number(stage.from)&&w<Number(stage.to))
    || stages.find(stage=>w===Number(stage.to))
    || stages.at(-1)||null;
}

export function recipeExecutionMetrics(replay){
  const recipe=recipeForReplay(replay),brew=metricsForReplay(replay);
  if(!recipe)return {valid:false,recipe:null,brew,flowMae:null,stageRows:[]};
  let weightedAbs=0,totalWeight=0;
  const stageMap=new Map(),samples=Array.isArray(replay?.samples)?replay.samples:[];
  for(let i=0;i<samples.length;i++){
    const sample=samples[i];
    if(sample?.pouring!==true&&!(Number(sample?.flow)>.08))continue;
    if(sample?.breakBefore===true)continue;
    const stage=stageForWater(recipe,sample?.water),target=finite(stage?.targetFlow,recipe.targetFlow);
    if(target==null)continue;
    const next=samples[i+1];
    const dt=Math.max(20,Math.min(500,finite(next?.t,finite(sample?.t,0)+100)-finite(sample?.t,0)));
    const error=Math.abs(Math.max(0,finite(sample?.flow,0))-target);
    weightedAbs+=error*dt; totalWeight+=dt;
    const key=stage?.id||stage?.name||`${stage?.from??0}-${stage?.to??recipe.water??0}`;
    const row=stageMap.get(key)||{id:key,name:stage?.name||'阶段',from:finite(stage?.from,0),to:finite(stage?.to,recipe.water),targetFlow:target,weightedAbs:0,weight:0};
    row.weightedAbs+=error*dt; row.weight+=dt; stageMap.set(key,row);
  }
  return {
    valid:true,recipe,brew,flowMae:totalWeight?weightedAbs/totalWeight:null,
    stageRows:[...stageMap.values()].map(row=>({id:row.id,name:row.name,from:row.from,to:row.to,targetFlow:row.targetFlow,flowMae:row.weight?row.weightedAbs/row.weight:null})),
  };
}

function trend(a,b,better='higher',epsilon=.005){
  if(a==null||b==null||better==='neutral')return 'neutral';
  const delta=b-a; if(Math.abs(delta)<=epsilon)return 'same';
  return (better==='higher'?delta>0:delta<0)?'better':'worse';
}

export function compareRecipeExecutions(aReplay,bReplay){
  const a=recipeExecutionMetrics(aReplay),b=recipeExecutionMetrics(bReplay);
  if(!a.valid||!b.valid)return {valid:false,a,b,rows:[],headline:'缺少 Recipe 元数据',insights:[]};
  const rows=[
    {key:'flowMae',label:'阶段流速误差',a:a.flowMae,b:b.flowMae,better:'lower',format:v=>v==null?'--':`${round(v,2).toFixed(2)} g/s`,epsilon:.03},
    {key:'flowStability',label:'流速稳定',a:a.brew.flowStability,b:b.brew.flowStability,better:'higher',format:pct,epsilon:.02},
    {key:'coverage',label:'粉床覆盖',a:a.brew.coverage,b:b.brew.coverage,better:'higher',format:pct,epsilon:.02},
    {key:'uniformity',label:'粉床均匀',a:a.brew.uniformity,b:b.brew.uniformity,better:'higher',format:pct,epsilon:.02},
    {key:'edgeExposure',label:'外圈暴露',a:a.brew.edgeExposure,b:b.brew.edgeExposure,better:'lower',format:pct,epsilon:.02},
    {key:'middleUse',label:'中圈利用',a:a.brew.middleUse,b:b.brew.middleUse,better:'higher',format:pct,epsilon:.02},
    {key:'durationMs',label:'总时长',a:a.brew.durationMs,b:b.brew.durationMs,better:'neutral',format:v=>`${round(v/1000,1).toFixed(1)} s`,epsilon:500},
  ].map(row=>({...row,trend:trend(row.a,row.b,row.better,row.epsilon)}));
  const differentRecipe=a.recipe.id!==b.recipe.id;
  const insights=[];
  const flow=rows.find(row=>row.key==='flowMae');
  if(flow?.trend==='better'||flow?.trend==='worse')insights.push(`阶段流速执行${flow.trend==='better'?'更准':'更偏'}：${flow.format(flow.a)} → ${flow.format(flow.b)}`);
  for(const key of ['coverage','uniformity','edgeExposure']){
    const row=rows.find(item=>item.key===key); if(row?.trend==='better'||row?.trend==='worse')insights.push(`${row.label}${row.trend==='better'?'改善':'退步'}：${row.format(row.a)} → ${row.format(row.b)}`);
  }
  return {valid:true,differentRecipe,a,b,rows,headline:differentRecipe?`${a.recipe.name} → ${b.recipe.name}`:`同配方执行对比 · ${a.recipe.name}`,insights:insights.slice(0,3)};
}

function recipeMeta(recipe){
  const parts=[];
  if(recipe.dose!=null)parts.push(`${round(recipe.dose,1)}g 粉`);
  if(recipe.water!=null)parts.push(`${Math.round(recipe.water)}g 水`);
  if(recipe.temperature!=null)parts.push(`${Math.round(recipe.temperature)}℃`);
  if(recipe.targetFlow!=null)parts.push(`${round(recipe.targetFlow,1)} g/s`);
  return parts.join(' · ');
}

function ensureStyle(doc){
  if(doc.getElementById('pourRecipeCompareStyle'))return;
  const style=doc.createElement('style'); style.id='pourRecipeCompareStyle';
  style.textContent='.recipe-compare{display:none;margin-top:8px;padding:8px;border-radius:10px;background:#0003;border:1px solid var(--line)}.recipe-compare.show{display:block}.recipe-compare-head{font-size:10px;color:var(--text);margin-bottom:3px}.recipe-compare-meta{font-size:8px;color:var(--muted);display:grid;gap:2px;margin-bottom:6px}.recipe-compare-grid{display:grid;grid-template-columns:1fr auto auto;gap:4px 8px;font-size:9px;align-items:center}.recipe-compare-grid .better{color:var(--good)}.recipe-compare-grid .worse{color:var(--warn)}.recipe-compare-grid .same,.recipe-compare-grid .neutral{color:var(--muted)}.recipe-compare-notes{display:grid;gap:2px;margin-top:6px;font-size:9px;color:var(--muted)}';
  doc.head.appendChild(style);
}
function ensurePanel(doc){
  let panel=doc.getElementById('recipeExecutionCompare'); if(panel)return panel;
  const host=doc.getElementById('brewHistoryCompare')||doc.getElementById('brewHistory'); if(!host?.parentElement)return null;
  panel=doc.createElement('div'); panel.id='recipeExecutionCompare'; panel.className='recipe-compare'; host.insertAdjacentElement('afterend',panel); return panel;
}
export function renderRecipeComparison(doc=globalThis.document){
  const panel=ensurePanel(doc); if(!panel)return {rendered:false};
  const state=doc.__pourBrewCompareState,aReplay=state?.first,bReplay=state?.second;
  if(!aReplay||!bReplay){panel.classList.remove('show');return {rendered:false}}
  const result=compareRecipeExecutions(aReplay,bReplay); if(!result.valid){panel.classList.remove('show');return {rendered:false,result}}
  panel.replaceChildren();
  const head=doc.createElement('div'); head.className='recipe-compare-head'; head.textContent=`RECIPE EXECUTION · ${result.headline}`;
  const meta=doc.createElement('div'); meta.className='recipe-compare-meta';
  for(const text of [`A · ${recipeMeta(result.a.recipe)}`,`B · ${recipeMeta(result.b.recipe)}`]){const div=doc.createElement('div');div.textContent=text;meta.appendChild(div)}
  const grid=doc.createElement('div'); grid.className='recipe-compare-grid';
  for(const row of result.rows){const label=doc.createElement('span');label.textContent=row.label;const av=doc.createElement('span');av.textContent=`A ${row.format(row.a)}`;const bv=doc.createElement('span');bv.className=row.trend;bv.textContent=`B ${row.format(row.b)}`;grid.append(label,av,bv)}
  panel.append(head,meta,grid);
  if(result.insights.length){const notes=doc.createElement('div');notes.className='recipe-compare-notes';for(const note of result.insights){const div=doc.createElement('div');div.textContent=note;notes.appendChild(div)}panel.appendChild(notes)}
  panel.classList.add('show'); return {rendered:true,result};
}
export function installRecipeComparison(doc=globalThis.document){
  if(!doc||doc.__pourRecipeComparisonInstalled)return {installed:false};
  doc.__pourRecipeComparisonInstalled=true; ensureStyle(doc); ensurePanel(doc); const update=()=>renderRecipeComparison(doc);
  const history=doc.getElementById('brewHistory');
  if(history&&typeof MutationObserver!=='undefined'){const observer=new MutationObserver(update);observer.observe(history,{childList:true,subtree:true,attributes:true})}
  doc.addEventListener?.('pour:history-imported',update); update(); return {installed:true,update};
}
