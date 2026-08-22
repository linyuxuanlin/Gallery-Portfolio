import { persistLatestBrew } from './pour-brew-history.js';
import { chooseTrainingPlan, trainingPlanSummary } from './pour-training-plan.js';
import { advanceTrainingChallenge, challengeSummary, restoreChallenge, saveChallenge } from './pour-training-progress.js';

function ensureStyle(doc){
  if(doc.getElementById('pourTrainingPlanStyle'))return;
  const s=doc.createElement('style');s.id='pourTrainingPlanStyle';
  s.textContent='.training-plan{display:none;margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:12px;background:#0003}.training-plan.show{display:block}.training-plan-head{display:flex;justify-content:space-between;gap:8px;font-size:10px}.training-plan-body{display:grid;gap:4px;margin-top:6px;font-size:9px;color:var(--muted)}.training-plan-goal{color:var(--good);font-weight:700}.training-plan-pass{color:var(--good);font-weight:800}.training-plan-fail{color:var(--warn);font-weight:700}.training-plan-cue{padding-top:3px;border-top:1px solid var(--line)}';
  doc.head.appendChild(s);
}

function ensurePanel(doc){
  let p=doc.getElementById('trainingPlan');if(p)return p;
  const trend=doc.getElementById('brewTrend');if(!trend?.parentElement)return null;
  p=doc.createElement('div');p.id='trainingPlan';p.className='training-plan';trend.insertAdjacentElement('beforebegin',p);return p;
}

function appendLines(doc,body,lines,{goalIndex=-1,status=null}={}){
  lines.forEach((line,i)=>{
    const d=doc.createElement('div');
    if(i===goalIndex)d.className='training-plan-goal';
    if(status&&i===0)d.className=status==='pass'?'training-plan-pass':'training-plan-fail';
    d.textContent=line;body.appendChild(d);
  });
}

function pct(v){return `${Math.round(Number(v||0)*100)}%`}

export function renderTrainingPlan(doc=globalThis.document,storage=globalThis.localStorage){
  const p=ensurePanel(doc);if(!p)return {rendered:false};
  const history=persistLatestBrew(storage);
  const latest=history[0]||null;
  const current=restoreChallenge(storage);
  const transition=advanceTrainingChallenge(history,current,latest,{requiredPasses:1,window:8});
  saveChallenge(transition.challenge,storage);
  p.replaceChildren();

  const fallbackPlan=transition.nextPlan||chooseTrainingPlan(history,{window:8});
  if(!transition.challenge&&!fallbackPlan?.valid){p.classList.remove('show');return {rendered:false,transition,plan:fallbackPlan}}

  const h=doc.createElement('div');h.className='training-plan-head';
  const label=doc.createElement('span');label.textContent='NEXT SESSION';
  const title=doc.createElement('b');
  if(transition.status==='graduated-next') title.textContent=`已晋级 · ${transition.challenge.title}`;
  else if(transition.status==='graduated-maintain') title.textContent='专项毕业 · 综合稳定';
  else title.textContent=transition.challenge?.title||(fallbackPlan?.mode==='maintenance'?'综合稳定训练':'专项训练');
  h.append(label,title);p.appendChild(h);

  const body=doc.createElement('div');body.className='training-plan-body';
  if(transition.status==='graduated-next'||transition.status==='graduated-maintain'){
    const old=current;
    appendLines(doc,body,[`${old?.title||'专项'}达标 ✅ · ${pct(transition.evaluation?.value)}`],{status:'pass'});
    if(transition.challenge){
      appendLines(doc,body,[`下一专项：${transition.challenge.title}`,transition.challenge.targetText,transition.challenge.cue],{goalIndex:1});
    }else{
      appendLines(doc,body,['进入综合稳定训练','保持已达标能力，同时降低整杯波动。'],{goalIndex:0});
    }
  }else if(transition.challenge){
    const summary=challengeSummary(transition.challenge,transition.evaluation);
    appendLines(doc,body,summary,{goalIndex:1,status:transition.evaluation?.applicable?(transition.evaluation.passed?'pass':'fail'):null});
    const cue=doc.createElement('div');cue.className='training-plan-cue';cue.textContent=transition.challenge.cue;body.appendChild(cue);
  }else if(fallbackPlan?.valid){
    appendLines(doc,body,trainingPlanSummary(fallbackPlan),{goalIndex:fallbackPlan.mode==='focus'?1:-1});
  }
  p.appendChild(body);p.classList.add('show');
  doc.__pourTrainingPlanLastTransition=transition;
  return {rendered:true,transition,challenge:transition.challenge,plan:fallbackPlan};
}

export function installTrainingPlan(doc=globalThis.document,storage=globalThis.localStorage){
  if(!doc||doc.__pourTrainingPlanInstalled)return {installed:false};
  doc.__pourTrainingPlanInstalled=true;ensureStyle(doc);
  const update=()=>renderTrainingPlan(doc,storage);
  const results=doc.getElementById('results');
  if(results&&typeof MutationObserver!=='undefined'){
    const observer=new MutationObserver(update);observer.observe(results,{attributes:true,attributeFilter:['class']});
  }
  update();return {installed:true,update};
}
