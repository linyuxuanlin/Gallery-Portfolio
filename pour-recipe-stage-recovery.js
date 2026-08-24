import { activeRecipe } from './pour-recipe.js';
import { readRecipeStageProgress } from './pour-recipe-stage-challenge.js';

function ensureStyle(doc){
  if(doc.getElementById('pourRecipeStageRecoveryStyle'))return;
  const style=doc.createElement('style');style.id='pourRecipeStageRecoveryStyle';
  style.textContent='.recipe-stage-recovery{display:none;margin-top:8px;padding:8px 9px;border:1px solid rgba(240,199,120,.28);border-radius:11px;background:rgba(240,199,120,.06)}.recipe-stage-recovery.show{display:block}.recipe-stage-recovery-head{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:var(--warn)}.recipe-stage-recovery-main{margin-top:5px;font-size:10px;color:var(--text);font-weight:700}.recipe-stage-recovery-progress{margin-top:4px;font-size:9px;color:var(--accent)}.recipe-stage-recovery-cue{margin-top:4px;font-size:9px;color:var(--muted);line-height:1.45}';
  doc.head.appendChild(style);
}

function ensurePanel(doc){
  let panel=doc.getElementById('recipeStageRecovery');if(panel)return panel;
  const host=doc.getElementById('recipeStageTraining')||doc.getElementById('recipeStageTrend')||doc.getElementById('results');
  if(!host?.parentElement)return null;
  panel=doc.createElement('div');panel.id='recipeStageRecovery';panel.className='recipe-stage-recovery';
  panel.innerHTML='<div class="recipe-stage-recovery-head"><span>RECOVERY MODE</span><b id="recipeStageRecoveryMeta">--</b></div><div class="recipe-stage-recovery-main" id="recipeStageRecoveryMain"></div><div class="recipe-stage-recovery-progress" id="recipeStageRecoveryProgress"></div><div class="recipe-stage-recovery-cue" id="recipeStageRecoveryCue"></div>';
  host.insertAdjacentElement('afterend',panel);return panel;
}

export function recoveryProgressSummary(challenge){
  const recovery=challenge?.recovery;
  if(!recovery?.active)return {active:false};
  const current=Math.max(0,recovery.consecutivePasses||0),required=Math.max(1,recovery.requiredPasses||2);
  return {
    active:true,
    current,
    required,
    attempts:Math.max(0,recovery.attempts||0),
    remaining:Math.max(0,required-current),
    reason:recovery.reason||'recovery',
    stageName:challenge.stageName||challenge.stageId||'当前阶段',
    lastPassed:recovery.lastPassed,
  };
}

export function renderRecipeStageRecovery(doc=globalThis.document,storage=globalThis.localStorage){
  const panel=ensurePanel(doc);if(!panel)return {rendered:false};
  const recipe=activeRecipe(storage),progress=readRecipeStageProgress(storage,recipe.id),summary=recoveryProgressSummary(progress.challenge);
  if(!summary.active){panel.classList.remove('show');return {rendered:false,summary,recipe,progress};}
  doc.getElementById('recipeStageRecoveryMeta').textContent=`${summary.current}/${summary.required}`;
  doc.getElementById('recipeStageRecoveryMain').textContent=`${summary.stageName} · 重新稳定到目标线内`;
  doc.getElementById('recipeStageRecoveryProgress').textContent=`恢复连续达标 ${summary.current}/${summary.required} · 已验收 ${summary.attempts} 杯`;
  doc.getElementById('recipeStageRecoveryCue').textContent=summary.lastPassed===false?'上一杯仍未稳定：连续计数已归零。先恢复可控动作，再追求晋级。':'恢复中的达标杯只用于解除 recovery，不计入正常毕业 2/2；解除后再重新累计专项毕业。';
  panel.classList.add('show');return {rendered:true,summary,recipe,progress};
}

export function installRecipeStageRecovery(doc=globalThis.document,storage=globalThis.localStorage){
  if(!doc||doc.__pourRecipeStageRecoveryInstalled)return {installed:false};doc.__pourRecipeStageRecoveryInstalled=true;
  ensureStyle(doc);ensurePanel(doc);const update=()=>renderRecipeStageRecovery(doc,storage);
  doc.addEventListener?.('pour:recipe-changed',update);doc.addEventListener?.('pour:recipe-score-updated',update);doc.addEventListener?.('pour:history-imported',update);
  const results=doc.getElementById?.('results');if(results&&typeof MutationObserver!=='undefined'){const observer=new MutationObserver(()=>{if(results.classList.contains('show'))queueMicrotask(update)});observer.observe(results,{attributes:true,attributeFilter:['class']})}
  update();return {installed:true,update};
}
