const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp01=value=>Math.max(0,Math.min(1,finite(value)));

function stageForWater(stages,water){
  return stages.find(stage=>water>=finite(stage.fromWater)&&water<finite(stage.toWater))
    || stages.at(-1)
    || null;
}

function pauseAfterBoundary(samples,boundaryWater){
  const src=Array.isArray(samples)?samples:[];
  let reached=-1;
  for(let i=0;i<src.length;i++){
    if(finite(src[i]?.water)>=boundaryWater-1e-6){reached=i;break}
  }
  if(reached<0)return null;
  const startT=finite(src[reached]?.t);
  let lastT=startT;
  for(let i=reached+1;i<src.length;i++){
    const prev=src[i-1],cur=src[i];
    const added=finite(cur?.water)-finite(prev?.water);
    if(added>1e-4 || finite(cur?.flow)>.08 || cur?.pouring===true)break;
    lastT=finite(cur?.t,lastT);
  }
  return Math.max(0,lastT-startT);
}

export function analyzeRecipeExecution(replay,{
  flowTolerance=.6,
  pauseToleranceSeconds=5,
}={}){
  const stages=Array.isArray(replay?.recipe?.stages)?replay.recipe.stages:[];
  const samples=Array.isArray(replay?.samples)?replay.samples:[];
  if(stages.length===0||samples.length<2)return {applicable:false,stages:[],overallScore:null};

  const stats=stages.map(stage=>({
    id:String(stage.id||stage.name||'stage'),
    name:String(stage.name||stage.id||'阶段'),
    fromWater:finite(stage.fromWater),
    toWater:finite(stage.toWater),
    targetFlow:Math.max(.1,finite(stage.targetFlow,5)),
    pauseTargetMs:Math.max(0,finite(stage.pauseAfter))*1000,
    activeMs:0,
    flowErrorIntegral:0,
    withinMs:0,
    addedWater:0,
  }));

  for(let i=1;i<samples.length;i++){
    const prev=samples[i-1],cur=samples[i];
    if(cur?.breakBefore===true)continue;
    const dt=Math.max(0,finite(cur?.t)-finite(prev?.t));
    const added=Math.max(0,finite(cur?.water)-finite(prev?.water));
    if(!(dt>0)||!(added>1e-6))continue;
    const water=(finite(prev?.water)+finite(cur?.water))*.5;
    const stage=stageForWater(stats,water);
    if(!stage)continue;
    const flow=(finite(prev?.flow)+finite(cur?.flow))*.5;
    const error=Math.abs(flow-stage.targetFlow);
    stage.activeMs+=dt;
    stage.flowErrorIntegral+=error*dt;
    stage.withinMs+=(error<=flowTolerance?dt:0);
    stage.addedWater+=added;
  }

  let weightedScore=0,weightedMs=0;
  const output=stats.map((stage,index)=>{
    const flowError=stage.activeMs?stage.flowErrorIntegral/stage.activeMs:null;
    const flowCompliance=stage.activeMs?stage.withinMs/stage.activeMs:null;
    const flowScore=flowError===null?null:clamp01(1-flowError/2.2);
    const pauseActualMs=stage.pauseTargetMs>0?pauseAfterBoundary(samples,stage.toWater):null;
    const pauseErrorMs=pauseActualMs===null?null:pauseActualMs-stage.pauseTargetMs;
    const pauseScore=stage.pauseTargetMs>0&&pauseActualMs!==null
      ? clamp01(1-Math.abs(pauseErrorMs)/(Math.max(1000,pauseToleranceSeconds*1000)*2))
      : null;
    const stageScore=flowScore===null
      ? null
      : pauseScore===null?flowScore:(flowScore*.72+pauseScore*.28);
    if(stageScore!==null){
      const weight=Math.max(1,stage.activeMs);
      weightedScore+=stageScore*weight;
      weightedMs+=weight;
    }
    return {
      ...stage,
      flowError,
      flowCompliance,
      flowScore,
      pauseActualMs,
      pauseErrorMs,
      pauseScore,
      stageScore,
      completed:finite(samples.at(-1)?.water)>=stage.toWater-1,
      index,
    };
  });

  const worst=output.filter(stage=>stage.stageScore!==null).sort((a,b)=>a.stageScore-b.stageScore)[0]||null;
  const headline=!worst
    ? '阶段数据不足'
    : worst.stageScore>=.82
      ? '各阶段执行稳定'
      : `${worst.name}最值得优先调整`;

  return {
    applicable:true,
    stages:output,
    overallScore:weightedMs?weightedScore/weightedMs:null,
    worstStageId:worst?.id||null,
    headline,
  };
}

function ensureStyle(doc){
  if(doc.getElementById('pourRecipeExecutionStyle'))return;
  const style=doc.createElement('style');
  style.id='pourRecipeExecutionStyle';
  style.textContent=`
    .recipe-exec{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}
    .recipe-exec.show{display:block}
    .recipe-exec-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:10px;color:var(--muted)}
    .recipe-exec-head b{color:var(--text)}
    .recipe-exec-grid{display:grid;gap:5px;margin-top:7px}
    .recipe-exec-row{display:grid;grid-template-columns:minmax(56px,.8fr) repeat(3,1fr);gap:6px;align-items:center;padding:6px 7px;border-radius:9px;background:#fff1;font-size:9px}
    .recipe-exec-row strong{color:var(--text)}
    .recipe-exec-row span{color:var(--muted)}
    .recipe-exec-row .good{color:var(--good)}
    .recipe-exec-row .warn{color:var(--warn)}
    @media(max-width:560px){.recipe-exec-row{grid-template-columns:1fr 1fr}.recipe-exec-row strong{grid-column:1/-1}}
  `;
  doc.head.appendChild(style);
}

function ensurePanel(doc){
  let panel=doc.getElementById('recipeExecution');
  if(panel)return panel;
  const host=doc.getElementById('brewInsights')||doc.getElementById('results');
  if(!host?.parentElement)return null;
  panel=doc.createElement('div');
  panel.id='recipeExecution';
  panel.className='recipe-exec';
  panel.innerHTML='<div class="recipe-exec-head"><span>RECIPE EXECUTION</span><b id="recipeExecutionScore">--</b></div><div class="recipe-exec-grid" id="recipeExecutionGrid"></div>';
  host.insertAdjacentElement('afterend',panel);
  return panel;
}

function fmtPause(ms){
  if(ms===null)return '—';
  return `${ms>=0?'+':''}${(ms/1000).toFixed(1)}s`;
}

export function renderRecipeExecution(doc=globalThis.document,storage=globalThis.localStorage){
  const panel=ensurePanel(doc);
  if(!panel)return {rendered:false};
  let replay=null;
  try{replay=JSON.parse(storage?.getItem?.('pourLabLastBrew')||'null')}catch{}
  const result=analyzeRecipeExecution(replay);
  if(!result.applicable){
    panel.classList.remove('show');
    return {rendered:false,result};
  }
  doc.getElementById('recipeExecutionScore').textContent=result.overallScore===null?'--':`${Math.round(result.overallScore*100)} · ${result.headline}`;
  const grid=doc.getElementById('recipeExecutionGrid');
  grid.replaceChildren();
  for(const stage of result.stages){
    const row=doc.createElement('div');
    row.className='recipe-exec-row';
    const name=doc.createElement('strong');name.textContent=stage.name;
    const flow=doc.createElement('span');
    flow.className=(stage.flowError??99)<=.6?'good':'warn';
    flow.textContent=stage.flowError===null?'流速 —':`流速 Δ ${stage.flowError.toFixed(2)} g/s`;
    const compliance=doc.createElement('span');
    compliance.textContent=stage.flowCompliance===null?'命中 —':`命中 ${Math.round(stage.flowCompliance*100)}%`;
    const pause=doc.createElement('span');
    if(stage.pauseTargetMs>0){
      pause.className=Math.abs(stage.pauseErrorMs??1e9)<=5000?'good':'warn';
      pause.textContent=stage.pauseActualMs===null?'暂停 —':`暂停 ${fmtPause(stage.pauseErrorMs)}`;
    }else pause.textContent=`注水 ${Math.round(stage.addedWater)}g`;
    row.append(name,flow,compliance,pause);
    grid.appendChild(row);
  }
  panel.classList.add('show');
  return {rendered:true,result};
}

export function installRecipeExecution(doc=globalThis.document,storage=globalThis.localStorage){
  if(!doc||doc.__pourRecipeExecutionInstalled)return {installed:false};
  doc.__pourRecipeExecutionInstalled=true;
  ensureStyle(doc);ensurePanel(doc);
  const update=()=>renderRecipeExecution(doc,storage);
  const results=doc.getElementById?.('results');
  if(results&&typeof MutationObserver!=='undefined'){
    const observer=new MutationObserver(()=>{if(results.classList.contains('show'))queueMicrotask(update)});
    observer.observe(results,{attributes:true,attributeFilter:['class']});
  }
  doc.addEventListener?.('pour:recipe-score-updated',update);
  update();
  return {installed:true,update};
}
