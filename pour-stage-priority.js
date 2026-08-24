import { recoveryRisk } from './pour-recovery-risk.js';

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

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
  // Focus history may override a modest one-cup deviation, but never a clearly severe live error.
  return execution+riskScore/50;
}

export function rankFocusTrainingCandidates(stageId,focuses=[],historyStages=[]){
  return (Array.isArray(focuses)?focuses:[]).map(focus=>{
    const recovery=recoveryRiskForFocus(stageId,focus?.id,historyStages);
    const priority=focusTrainingPriority({severity:focus?.severity,recovery});
    return{...focus,recovery,priority};
  }).sort((a,b)=>b.priority-a.priority||(b.recovery?.score||0)-(a.recovery?.score||0)||(b.severity||0)-(a.severity||0));
}

export function rankStageTrainingCandidates(candidates=[],historyStages=[]){
  return (Array.isArray(candidates)?candidates:[]).map(item=>{
    const recovery=recoveryRiskForStage(item?.stage?.id,historyStages);
    const priority=stageTrainingPriority({severity:item?.focus?.severity,repeatability:item?.stage?.repeatability,recovery});
    return{...item,recovery,priority};
  }).sort((a,b)=>b.priority-a.priority||(b.recovery?.score||0)-(a.recovery?.score||0)||(a.stage?.repeatability??1)-(b.stage?.repeatability??1));
}
