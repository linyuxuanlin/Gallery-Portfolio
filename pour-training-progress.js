import { chooseTrainingPlan, evaluateTrainingPlan } from './pour-training-plan.js';

const STORAGE_KEY='pourLabTrainingChallenge';
export const DEFAULT_REQUIRED_PASSES=2;
const finite=v=>Number.isFinite(Number(v))?Number(v):null;

export function trainingReplayId(replay){
  if(!replay) return null;
  return replay.id||[replay.createdAt,replay.duration,replay.score,replay.samples?.length].join('|');
}

export function createChallenge(plan,{createdAt=new Date().toISOString(),baselineReplayId=null,requiredPasses=DEFAULT_REQUIRED_PASSES}={}){
  if(!plan?.valid||plan.mode!=='focus') return null;
  const baselineValue=finite(plan.current);
  return {
    version:3,
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
    requiredPasses:Math.max(1,Math.floor(Number(requiredPasses)||DEFAULT_REQUIRED_PASSES)),
    baselineValue,
    lastValue:baselineValue,
    lastPassed:null,
    lastReplayId:baselineReplayId,
    completed:false,
  };
}

export function restoreChallenge(storage=globalThis.localStorage){
  try{
    const value=JSON.parse(storage?.getItem?.(STORAGE_KEY)||'null');
    if(!value?.id||!value.metric||!Number.isFinite(Number(value.target))) return null;
    return {
      ...value,
      target:Number(value.target),
      requiredPasses:Math.max(1,Math.floor(Number(value.requiredPasses)||DEFAULT_REQUIRED_PASSES)),
      baselineValue:finite(value.baselineValue),
      lastValue:finite(value.lastValue),
      lastReplayId:value.lastReplayId||null,
    };
  }catch{return null}
}

export function saveChallenge(challenge,storage=globalThis.localStorage){
  try{
    if(!challenge){storage?.removeItem?.(STORAGE_KEY);return null}
    storage?.setItem?.(STORAGE_KEY,JSON.stringify(challenge));
    return challenge;
  }catch{return challenge||null}
}

export function evaluateChallenge(challenge,replay,{requiredPasses=challenge?.requiredPasses||DEFAULT_REQUIRED_PASSES}={}){
  if(!challenge||challenge.completed) return {applicable:false,challenge};
  const replayId=trainingReplayId(replay);
  if(!replayId||replayId===challenge.lastReplayId) return {applicable:false,duplicate:!!replayId,challenge};
  const plan={valid:true,mode:'focus',metric:challenge.metric,target:challenge.target};
  const result=evaluateTrainingPlan(plan,replay);
  if(!result.applicable) return {applicable:false,challenge};
  const needed=Math.max(1,Math.floor(Number(requiredPasses)||DEFAULT_REQUIRED_PASSES));
  const previousValue=finite(challenge.lastValue);
  const value=finite(result.value);
  const next={...challenge};
  next.attempts=(challenge.attempts||0)+1;
  next.lastValue=value;
  next.lastPassed=!!result.passed;
  next.lastReplayId=replayId;
  next.requiredPasses=needed;
  if(result.passed){
    next.passes=(challenge.passes||0)+1;
    next.consecutivePasses=(challenge.consecutivePasses||0)+1;
  }else{
    next.consecutivePasses=0;
  }
  next.completed=next.consecutivePasses>=needed;
  const delta=previousValue===null||value===null?null:value-previousValue;
  const improvementDelta=delta===null?null:(challenge.metric==='edgeExposure'?-delta:delta);
  return {
    applicable:true,
    passed:!!result.passed,
    completed:next.completed,
    value:result.value,
    previousValue,
    delta,
    improvementDelta,
    target:result.target,
    replayId,
    streak:next.consecutivePasses,
    requiredPasses:needed,
    remainingPasses:Math.max(0,needed-next.consecutivePasses),
    challenge:next,
  };
}

export function advanceTrainingChallenge(history,currentChallenge,replay,{requiredPasses=DEFAULT_REQUIRED_PASSES,window=8}={}){
  const replayId=trainingReplayId(replay);
  if(currentChallenge&&!currentChallenge.completed){
    const evaluation=evaluateChallenge(currentChallenge,replay,{requiredPasses});
    if(!evaluation.applicable) return {status:evaluation.duplicate?'unchanged':'unevaluable',challenge:currentChallenge,evaluation};
    if(!evaluation.completed) return {status:'continue',challenge:evaluation.challenge,evaluation};
    const nextPlan=chooseTrainingPlan(history,{window,excludeIds:[currentChallenge.id]});
    const nextChallenge=createChallenge(nextPlan,{baselineReplayId:replayId,requiredPasses});
    return {status:nextChallenge?'graduated-next':'graduated-maintain',challenge:nextChallenge,evaluation,nextPlan};
  }
  const plan=chooseTrainingPlan(history,{window});
  const challenge=createChallenge(plan,{baselineReplayId:replayId,requiredPasses});
  return {status:challenge?'start':'maintenance',challenge,nextPlan:plan};
}

function formatDelta(delta){
  if(!Number.isFinite(delta)) return null;
  const pp=Math.round(Math.abs(delta)*100);
  if(pp===0) return '持平';
  return `${delta>0?'+':'-'}${pp}pp`;
}

export function challengeSummary(challenge,evaluation){
  if(!challenge) return ['当前没有专项挑战'];
  const pct=v=>`${Math.round(Number(v||0)*100)}%`;
  const needed=Math.max(1,challenge.requiredPasses||DEFAULT_REQUIRED_PASSES);
  const lines=[challenge.title,challenge.targetText];
  if(evaluation?.applicable){
    const change=evaluation.previousValue===null?null:`上杯 ${pct(evaluation.previousValue)} → 本杯 ${pct(evaluation.value)}${formatDelta(evaluation.delta)?` (${formatDelta(evaluation.delta)})`:''}`;
    lines.push(evaluation.passed?`本杯达标 ✅ ${pct(evaluation.value)}`:`本杯未达标 · ${pct(evaluation.value)}`);
    if(change) lines.push(change);
  }else if(challenge.lastValue!==null){
    lines.push(`${challenge.lastPassed===true?'上杯达标 ✅':challenge.lastPassed===false?'上杯未达标':'当前基线'} · ${pct(challenge.lastValue)}`);
  }
  const streak=challenge.consecutivePasses||0;
  lines.push(`连续达标 ${streak}/${needed}${streak<needed?` · 还差 ${needed-streak} 杯`:' · 专项完成'}`);
  lines.push(`已练 ${challenge.attempts||0} 杯 · 累计达标 ${challenge.passes||0} 杯`);
  return lines;
}

export const TRAINING_CHALLENGE_STORAGE_KEY=STORAGE_KEY;
