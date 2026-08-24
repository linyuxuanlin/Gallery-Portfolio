import { activeRecipe } from './pour-recipe.js';
import { recipeStageHistorySummary } from './pour-training-history.js';

const FOCUS_LABELS={
  'pause-rhythm':'暂停节奏',
  'flow-repeatability':'流速复现',
  'flow-accuracy':'流速准确',
  'flow-compliance':'流速命中',
  'repeatability':'综合复现',
};

function ensureStyle(doc){
  if(doc.getElementById('pourRecipeStageHistoryStyle'))return;
  const style=doc.createElement('style');
  style.id='pourRecipeStageHistoryStyle';
  style.textContent='.recipe-stage-history{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.recipe-stage-history.show{display:block}.recipe-stage-history-head{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--muted)}.recipe-stage-history-head b{color:var(--text)}.recipe-stage-history-summary{margin-top:6px;font-size:9px;color:var(--muted)}.recipe-stage-history-recovery{margin-top:5px;font-size:9px;color:var(--warn)}.recipe-stage-history-list{display:grid;gap:5px;margin-top:7px}.recipe-stage-history-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 7px;border-radius:9px;background:#fff1;font-size:9px}.recipe-stage-history-row b{display:block;color:var(--text);font-size:9px}.recipe-stage-history-row span{color:var(--muted)}.recipe-stage-history-rate{align-self:center;color:var(--good);font-variant-numeric:tabular-nums}.recipe-stage-history-recovery-meta{display:block;margin-top:2px;color:var(--warn)!important}';
  doc.head.appendChild(style);
}

function ensurePanel(doc){
  let panel=doc.getElementById('recipeStageHistory');
  if(panel)return panel;
  const host=doc.getElementById('recipeStageTraining')||doc.getElementById('recipeConsistency')||doc.getElementById('results');
  if(!host?.parentElement)return null;
  panel=doc.createElement('div');
  panel.id='recipeStageHistory';
  panel.className='recipe-stage-history';
  panel.innerHTML='<div class="recipe-stage-history-head"><span>RECIPE STAGE LOG</span><b id="recipeStageHistoryMeta">--</b></div><div class="recipe-stage-history-summary" id="recipeStageHistorySummary"></div><div class="recipe-stage-history-recovery" id="recipeStageHistoryRecovery"></div><div class="recipe-stage-history-list" id="recipeStageHistoryList"></div>';
  host.insertAdjacentElement('afterend',panel);
  return panel;
}

function recoveryCopy(recovery){
  if(!recovery?.recoveryEpisodes)return '';
  const recovered=`恢复 ${recovery.recoveredEpisodes}/${recovery.recoveryEpisodes}`;
  const average=recovery.averageRecoveryCups===null?'':` · 平均 ${recovery.averageRecoveryCups.toFixed(1)} 杯恢复`;
  const active=recovery.activeRecoveries?` · 当前 ${recovery.activeRecoveries} 个恢复中`:'';
  return `${recovered}${average}${active}`;
}

export function renderRecipeStageHistory(doc=globalThis.document,storage=globalThis.localStorage){
  const panel=ensurePanel(doc);
  if(!panel)return {rendered:false};
  const recipe=activeRecipe(storage);
  const summary=recipeStageHistorySummary(storage,{recipeId:recipe.id});
  if(!summary.attempts){panel.classList.remove('show');return {rendered:false,summary,recipe}}

  doc.getElementById('recipeStageHistoryMeta').textContent=`${summary.attempts} 杯验收`;
  doc.getElementById('recipeStageHistorySummary').textContent=`达标 ${Math.round(summary.passRate*100)}% · 连胜 ${summary.currentStreak} · 最长 ${summary.bestStreak} · 毕业 ${summary.graduates} · 活跃 ${summary.activeDays} 天`;
  const recoveryEl=doc.getElementById('recipeStageHistoryRecovery');
  recoveryEl.textContent=recoveryCopy(summary.recovery);
  recoveryEl.style.display=recoveryEl.textContent?'block':'none';

  const list=doc.getElementById('recipeStageHistoryList');
  list.replaceChildren();
  for(const stage of summary.stages.slice(0,6)){
    const row=doc.createElement('div');row.className='recipe-stage-history-row';
    const copy=doc.createElement('div');
    const title=doc.createElement('b');title.textContent=`${stage.stageName} · ${FOCUS_LABELS[stage.focusId]||stage.focusId||'专项'}`;
    const meta=doc.createElement('span');meta.textContent=`${stage.attempts} 杯 · 达标 ${stage.passes} · 毕业 ${stage.graduates}`;
    copy.append(title,meta);
    const recovery=recoveryCopy(stage.recovery);
    if(recovery){
      const recoveryMeta=doc.createElement('span');
      recoveryMeta.className='recipe-stage-history-recovery-meta';
      recoveryMeta.textContent=recovery;
      copy.appendChild(recoveryMeta);
    }
    const rate=doc.createElement('div');rate.className='recipe-stage-history-rate';rate.textContent=`${Math.round(stage.passRate*100)}%`;
    row.append(copy,rate);list.appendChild(row);
  }
  panel.classList.add('show');
  return {rendered:true,summary,recipe};
}

export function installRecipeStageHistory(doc=globalThis.document,storage=globalThis.localStorage){
  if(!doc||doc.__pourRecipeStageHistoryInstalled)return {installed:false};
  doc.__pourRecipeStageHistoryInstalled=true;
  ensureStyle(doc);ensurePanel(doc);
  const update=()=>renderRecipeStageHistory(doc,storage);
  doc.addEventListener?.('pour:recipe-changed',update);
  doc.addEventListener?.('pour:recipe-score-updated',update);
  doc.addEventListener?.('pour:history-imported',update);
  const results=doc.getElementById?.('results');
  if(results&&typeof MutationObserver!=='undefined'){
    const observer=new MutationObserver(()=>{if(results.classList.contains('show'))queueMicrotask(update)});
    observer.observe(results,{attributes:true,attributeFilter:['class']});
  }
  update();
  return {installed:true,update};
}
