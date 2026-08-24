const STORAGE_KEY='pourLabTrainingHistory';
const MAX_EVENTS=180;

function safeRead(storage){
  try{
    const value=JSON.parse(storage?.getItem?.(STORAGE_KEY)||'[]');
    return Array.isArray(value)?value:[];
  }catch{return []}
}

function safeWrite(storage,events){
  const trimmed=events.slice(-MAX_EVENTS);
  try{storage?.setItem?.(STORAGE_KEY,JSON.stringify(trimmed));return trimmed}
  catch{return trimmed}
}

export function trainingHistoryEvent(transition,{recordedAt=new Date().toISOString()}={}){
  const e=transition?.evaluation;
  if(!e?.applicable||!e.replayId)return null;
  const challengeId=e?.challenge?.id||transition?.challenge?.id||null;
  const challengeTitle=e?.challenge?.title||transition?.challenge?.title||null;
  return {
    version:1,
    type:'challenge',
    replayId:e.replayId,
    challengeId,
    challengeTitle,
    recordedAt,
    passed:!!e.passed,
    value:Number.isFinite(Number(e.value))?Number(e.value):null,
    target:Number.isFinite(Number(e.target))?Number(e.target):null,
    graduated:transition.status==='graduated-next'||transition.status==='graduated-maintain',
  };
}

export function recipeStageHistoryEvent(transition,{replayId,recipeId,recordedAt=new Date().toISOString()}={}){
  const e=transition?.evaluation;
  const plan=transition?.plan||null;
  const stageId=plan?.stageId||transition?.completedChallenge?.stageId||null;
  const stageName=plan?.stageName||transition?.completedChallenge?.stageName||stageId;
  const focusId=plan?.focusId||transition?.completedChallenge?.focusId||null;
  if(!e?.applicable||!replayId||!recipeId||!stageId||!focusId)return null;
  const challengeId=`recipe:${recipeId}:stage:${stageId}:${focusId}`;
  const recoveryStatus=typeof e.recoveryStatus==='string'?e.recoveryStatus:null;
  return {
    version:2,
    type:'recipe-stage',
    replayId,
    challengeId,
    challengeTitle:`${stageName} · ${focusId}`,
    recordedAt,
    passed:!!e.passed,
    value:Number.isFinite(Number(e.current))?Number(e.current):null,
    target:Number.isFinite(Number(e.target))?Number(e.target):null,
    graduated:transition.status==='graduated'||transition.graduated===true,
    recipeId,
    stageId,
    stageName,
    focusId,
    recoveryStatus,
    recoveryPass:recoveryStatus?e.recoveryPass===true:null,
    trendPolicy:typeof e.trendPolicy==='string'?e.trendPolicy:null,
  };
}

export function readTrainingHistory(storage=globalThis.localStorage){
  return safeRead(storage).filter(event=>event?.replayId);
}

function recordHistoryEvent(storage,event){
  const events=readTrainingHistory(storage);
  if(!event)return {recorded:false,event:null,events};
  const key=`${event.challengeId||''}|${event.replayId}`;
  if(events.some(item=>`${item.challengeId||''}|${item.replayId}`===key)){
    return {recorded:false,duplicate:true,event,events};
  }
  const next=safeWrite(storage,[...events,event]);
  return {recorded:true,event,events:next};
}

export function recordTrainingTransition(storage=globalThis.localStorage,transition,options={}){
  return recordHistoryEvent(storage,trainingHistoryEvent(transition,options));
}

export function recordRecipeStageTransition(storage=globalThis.localStorage,transition,options={}){
  return recordHistoryEvent(storage,recipeStageHistoryEvent(transition,options));
}

export function summarizeTrainingHistory(events){
  const valid=(Array.isArray(events)?events:[]).filter(event=>event?.replayId);
  let currentStreak=0,bestStreak=0,graduates=0,passes=0;
  const challenges=new Map();
  const days=new Set();

  for(const event of valid){
    if(event.passed){
      passes++;
      currentStreak++;
      bestStreak=Math.max(bestStreak,currentStreak);
    }else currentStreak=0;
    if(event.graduated)graduates++;
    if(event.recordedAt){
      const day=String(event.recordedAt).slice(0,10);
      if(day)days.add(day);
    }
    const id=event.challengeId||'unknown';
    const stat=challenges.get(id)||{id,title:event.challengeTitle||id,attempts:0,passes:0,graduates:0};
    stat.attempts++;
    if(event.passed)stat.passes++;
    if(event.graduated)stat.graduates++;
    challenges.set(id,stat);
  }

  const challengeStats=[...challenges.values()].map(stat=>({
    ...stat,
    passRate:stat.attempts?stat.passes/stat.attempts:0,
  })).sort((a,b)=>b.attempts-a.attempts||b.passRate-a.passRate);

  return {
    attempts:valid.length,
    passes,
    passRate:valid.length?passes/valid.length:0,
    currentStreak,
    bestStreak,
    graduates,
    activeDays:days.size,
    challenges:challengeStats,
  };
}

function createRecoveryStats(){
  return {
    recoveryEpisodes:0,
    recoveredEpisodes:0,
    activeRecoveries:0,
    recoveryAttempts:0,
    recoveryPasses:0,
    recoveryCupsToRecover:[],
    recoveryPassRate:0,
    averageRecoveryCups:null,
  };
}

function applyRecoveryStats(stats,event,state){
  const status=event?.recoveryStatus;
  if(!status)return;
  const key=event.challengeId||`${event.recipeId||''}:${event.stageId||''}:${event.focusId||''}`;
  let episode=state.get(key);
  if(!episode){
    episode={attempts:0};
    state.set(key,episode);
    stats.recoveryEpisodes++;
  }
  episode.attempts++;
  stats.recoveryAttempts++;
  if(event.recoveryPass===true)stats.recoveryPasses++;
  if(status==='recovered'){
    stats.recoveredEpisodes++;
    stats.recoveryCupsToRecover.push(episode.attempts);
    state.delete(key);
  }
}

function finishRecoveryStats(stats,state){
  stats.activeRecoveries=state.size;
  stats.recoveryPassRate=stats.recoveryAttempts?stats.recoveryPasses/stats.recoveryAttempts:0;
  stats.averageRecoveryCups=stats.recoveryCupsToRecover.length
    ?stats.recoveryCupsToRecover.reduce((sum,value)=>sum+value,0)/stats.recoveryCupsToRecover.length
    :null;
  return stats;
}

export function summarizeRecipeStageHistory(events,{recipeId,stageId=null,focusId=null}={}){
  const filtered=(Array.isArray(events)?events:[]).filter(event=>
    event?.type==='recipe-stage'&&
    (!recipeId||event.recipeId===recipeId)&&
    (!stageId||event.stageId===stageId)&&
    (!focusId||event.focusId===focusId)
  );
  const base=summarizeTrainingHistory(filtered);
  const stages=new Map();
  const overallRecovery=createRecoveryStats();
  const overallRecoveryState=new Map();

  for(const event of filtered){
    const key=`${event.stageId||'unknown'}:${event.focusId||'unknown'}`;
    const stat=stages.get(key)||{
      key,
      stageId:event.stageId||null,
      stageName:event.stageName||event.stageId||'阶段',
      focusId:event.focusId||null,
      attempts:0,
      passes:0,
      graduates:0,
      lastValue:null,
      target:null,
      lastRecordedAt:null,
      recovery:createRecoveryStats(),
      recoveryState:new Map(),
    };
    stat.attempts++;
    if(event.passed)stat.passes++;
    if(event.graduated)stat.graduates++;
    stat.lastValue=event.value;
    stat.target=event.target;
    stat.lastRecordedAt=event.recordedAt||stat.lastRecordedAt;
    applyRecoveryStats(stat.recovery,event,stat.recoveryState);
    applyRecoveryStats(overallRecovery,event,overallRecoveryState);
    stages.set(key,stat);
  }

  const stageStats=[...stages.values()].map(stat=>{
    const recovery=finishRecoveryStats(stat.recovery,stat.recoveryState);
    const {recoveryState,...clean}=stat;
    return {
      ...clean,
      recovery,
      passRate:stat.attempts?stat.passes/stat.attempts:0,
    };
  }).sort((a,b)=>
    b.recovery.recoveryEpisodes-a.recovery.recoveryEpisodes||
    b.attempts-a.attempts||
    b.passRate-a.passRate
  );

  return {
    ...base,
    recipeId:recipeId||null,
    recovery:finishRecoveryStats(overallRecovery,overallRecoveryState),
    stages:stageStats,
  };
}

export function recipeStageHistorySummary(storage=globalThis.localStorage,scope={}){
  return summarizeRecipeStageHistory(readTrainingHistory(storage),scope);
}

export function trainingHistorySummary(storage=globalThis.localStorage){
  return summarizeTrainingHistory(readTrainingHistory(storage));
}

export const TRAINING_HISTORY_STORAGE_KEY=STORAGE_KEY;
