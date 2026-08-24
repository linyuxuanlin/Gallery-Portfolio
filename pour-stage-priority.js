import { recoveryRisk } from './pour-recovery-risk.js';

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp01=value=>Math.max(0,Math.min(1,finite(value)));

export function recoveryRiskForStage(stageId,historyStages=[]){
  const matches=(Array.isArray(historyStages)?historyStages:[]).filter(stage=>stage?.stageId===stageId);
  if(!matches.length)return{applicable:false,score:0,level:'none',label:'暂无反弹',reason:'尚无 Recovery 记录'};
  return matches.map(stage=>recoveryRisk(stage?.recovery)).sort((a,b)=>b.score-a.score)[0];
}

export function recoveryRiskForFocus(stageId,focusId,historyStages=[]){
  const matches=(Array.isArray(historyStages)?historyStages:[]).filter(stage=>stage?.stageId===stageId&&stage?.focusId===focusId);
  if(!matches.length)return{applicable:false,score:0,level:'none',label:'暂无反弹',reason:'该 Focus 尚无 Recovery 记录'};
  return matches.map(stage=>recoveryRisk(stage?.recovery)).sort((a,b)=>b.score-a.score)[0];
}

export function stageTrainingPriority({severity=0,repeatability=1,recovery={}}={}){
  const execution=Math.max(0,finite(severity));
  const instability=Math.max(0,1-Math.max(0,Math.min(1,finite(repeatability,1))));
  const riskScore=Math.max(0,Math.min(100,finite(recovery?.score)));
  return execution+instability*.75+riskScore/45;
}

export function focusTrainingPriority({severity=0,recovery={}}={}){
  const execution=Math.max(0,finite(severity));
  const riskScore=Math.max(0,Math.min(100,finite(recovery?.score)));
  // Historical fragility can beat a modest one-cup deviation, not an extreme live error.
  return execution+riskScore/50;
}

function focusFromStage(stage,focusId){
  const repeatability=clamp01(stage?.repeatability);
  const flowErrorMean=Math.max(0,finite(stage?.flowErrorMean));
  const flowErrorSpread=Math.max(0,finite(stage?.flowErrorSpread));
  const compliance=clamp01(stage?.complianceMean);
  const pauseError=Math.max(0,finite(stage?.pauseErrorMean));
  if(focusId==='pause-rhythm')return{id:'pause-rhythm',metric:'pauseErrorMean',direction:'lower',value:4,current:pauseError,label:'暂停误差 ≤ 4s',cue:'到达阶段目标水量后先稳定停手，按配方节奏再恢复注水',severity:pauseError/4};
  if(focusId==='flow-repeatability')return{id:'flow-repeatability',metric:'flowErrorSpread',direction:'lower',value:.25,current:flowErrorSpread,label:'杯间流速误差波动 ≤ 0.25 g/s',cue:'这一阶段先固定手腕和倾角，不要频繁追数值；目标是每杯用同样动作复现',severity:flowErrorSpread/.25};
  if(focusId==='flow-accuracy')return{id:'flow-accuracy',metric:'flowErrorMean',direction:'lower',value:.30,current:flowErrorMean,label:'平均流速误差 ≤ 0.30 g/s',cue:'进入该阶段前先把壶倾角预置到目标流速附近，再做小幅修正',severity:flowErrorMean/.30};
  if(focusId==='flow-compliance')return{id:'flow-compliance',metric:'complianceMean',direction:'higher',value:.80,current:compliance,label:'目标流速命中率 ≥ 80%',cue:'减少来回修正，优先延长落在目标流速窗口内的连续时间',severity:Math.max(0,(.80-compliance)/.20+1)};
  if(focusId==='repeatability')return{id:'repeatability',metric:'repeatability',direction:'higher',value:.82,current:repeatability,label:'阶段复现 ≥ 82%',cue:'复制上一杯该阶段的起始位置、流速和移动节奏，减少动作差异',severity:Math.max(0,(.82-repeatability)/.18+1)};
  return null;
}

export function rankFocusTrainingCandidates(stage,baseFocus,historyStages=[]){
  const stageId=stage?.id;
  const ids=new Set([baseFocus?.id]);
  for(const history of Array.isArray(historyStages)?historyStages:[]){
    if(history?.stageId!==stageId||!history?.focusId)continue;
    const risk=recoveryRisk(history?.recovery);
    if(risk.applicable&&risk.score>=30)ids.add(history.focusId);
  }
  return [...ids].map(id=>{
    const focus=id===baseFocus?.id?baseFocus:focusFromStage(stage,id);
    if(!focus)return null;
    const recovery=recoveryRiskForFocus(stageId,id,historyStages);
    return{...focus,recovery,priority:focusTrainingPriority({severity:focus.severity,recovery}),switchedByRecovery:id!==baseFocus?.id};
  }).filter(Boolean).sort((a,b)=>b.priority-a.priority||(b.recovery?.score||0)-(a.recovery?.score||0)||(b.severity||0)-(a.severity||0));
}

export function rankStageTrainingCandidates(candidates=[],historyStages=[]){
  return (Array.isArray(candidates)?candidates:[]).map(item=>{
    const recovery=recoveryRiskForStage(item?.stage?.id,historyStages);
    const focusCandidates=rankFocusTrainingCandidates(item?.stage,item?.focus,historyStages);
    const selectedFocus=focusCandidates[0]||item?.focus;
    const focusRecovery=selectedFocus?.recovery||recoveryRiskForFocus(item?.stage?.id,selectedFocus?.id,historyStages);
    const priority=stageTrainingPriority({severity:selectedFocus?.severity,repeatability:item?.stage?.repeatability,recovery});
    return{...item,focus:selectedFocus,recovery,focusRecovery,focusSwitchedByRecovery:selectedFocus?.switchedByRecovery===true,priority};
  }).sort((a,b)=>b.priority-a.priority||(b.recovery?.score||0)-(a.recovery?.score||0)||(a.stage?.repeatability??1)-(b.stage?.repeatability??1));
}
