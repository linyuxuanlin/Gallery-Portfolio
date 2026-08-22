import { chooseTrainingPlan, evaluateTrainingPlan } from './pour-training-plan.js';

const STORAGE_KEY='pourLabTrainingChallenge';
const finite=v=>Number.isFinite(Number(v))?Number(v):null;

export function trainingReplayId(replay){
  if(!replay) return null;
  return replay.id||[replay.createdAt,replay.duration,replay.score,replay.samples?.length].join('|');
}

export function createChallenge(plan,{createdAt=new Date().toISOString(),baselineReplayId=null}={}){
  if(!plan?.valid||plan.mode!=='focus') return null;
  return {
    version:2,
    id:plan.id,
    metric:plan.metric,
    title:plan.title,
    target:plan.target,
    targetText:plan.targetText,
    cue:plan.cue,
    createdAt,
    attempts:0,
    passes:0,
    consecutivePasses:0,
    lastValue:null,
    lastPassed:null,
    lastReplayId:baselineReplayId,
    completed:false,
  };
}

export function restoreChallenge(storage=globalThis.localStorage){
  try{
    const value=JSON.parse(storage?.getItem?.(STORAGE_KEY)||'null');
    if(!value?.id||!value.metric||!Number.isFinite(Number(value.target))) return null;
    return {...value,target:Number(value.target),lastReplayId:value.lastReplayId||null};
  }catch{return null}
}

export function saveChallenge(challenge,storage=globalThis.localStorage){
  if(!challenge){storage?.removeItem?.(STORAGE_KEY);return null}
  storage?.setItem?.(STORAGE_KEY,JSON.stringify(challenge));
  return challenge;
}

export function evaluateChallenge(challenge,replay,{requiredPasses=1}={}){
  if(!challenge||challenge.completed) return {applicable:false,challenge};
  const replayId=trainingReplayId(replay);
  if(!replayId||replayId===challenge.lastReplayId) return {applicable:false,duplicate:!!replayId,challenge};
  const plan={valid:true,mode:'focus',metric:challenge.metric,target:challenge.target};
  const result=evaluateTrainingPlan(plan,replay);
  if(!result.applicable) return {applicable:false,challenge};
  const next={...challenge};
  next.attempts=(challenge.attempts||0)+1;
  next.lastValue=finite(result.value);
  next.lastPassed=!!result.passed;
  next.lastReplayId=replayId;
  if(result.passed){
    next.passes=(challenge.passes||0)+1;
    next.consecutivePasses=(challenge.consecutivePasses||0)+1;
  }else{
    next.consecutivePasses=0;
  }
  next.completed=next.consecutivePasses>=Math.max(1,requiredPasses);
  return {applicable:true,passed:!!result.passed,completed:next.completed,value:result.value,target:result.target,replayId,challenge:next};
}

export function advanceTrainingChallenge(history,currentChallenge,replay,{requiredPasses=1,window=8}={}){
  const replayId=trainingReplayId(replay);
  if(currentChallenge&&!currentChallenge.completed){
    const evaluation=evaluateChallenge(currentChallenge,replay,{requiredPasses});
    if(!evaluation.applicable) return {status:evaluation.duplicate?'unchanged':'unevaluable',challenge:currentChallenge,evaluation};
    if(!evaluation.completed) return {status:'continue',challenge:evaluation.challenge,evaluation};
    const nextPlan=chooseTrainingPlan(history,{window,excludeIds:[currentChallenge.id]});
    const nextChallenge=createChallenge(nextPlan,{baselineReplayId:replayId});
    return {status:nextChallenge?'graduated-next':'graduated-maintain',challenge:nextChallenge,evaluation,nextPlan};
  }
  const plan=chooseTrainingPlan(history,{window});
  const challenge=createChallenge(plan,{baselineReplayId:replayId});
  return {status:challenge?'start':'maintenance',challenge,nextPlan:plan};
}

export function challengeSummary(challenge,evaluation){
  if(!challenge) return ['当前没有专项挑战'];
  const pct=v=>`${Math.round(Number(v||0)*100)}%`;
  const lines=[challenge.title,challenge.targetText];
  if(evaluation?.applicable){
    lines.push(evaluation.passed?`本杯达标 ✅ ${pct(evaluation.value)}`:`本杯未达标 · ${pct(evaluation.value)}`);
  }else if(challenge.lastValue!==null){
    lines.push(`${challenge.lastPassed?'上杯达标 ✅':'上杯未达标'} · ${pct(challenge.lastValue)}`);
  }
  lines.push(`已练 ${challenge.attempts||0} 杯 · 达标 ${challenge.passes||0} 杯`);
  return lines;
}

export const TRAINING_CHALLENGE_STORAGE_KEY=STORAGE_KEY;
