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

export function readTrainingHistory(storage=globalThis.localStorage){
  return safeRead(storage).filter(event=>event?.replayId);
}

export function recordTrainingTransition(storage=globalThis.localStorage,transition,options={}){
  const event=trainingHistoryEvent(transition,options);
  const events=readTrainingHistory(storage);
  if(!event)return {recorded:false,event:null,events};
  const key=`${event.challengeId||''}|${event.replayId}`;
  if(events.some(item=>`${item.challengeId||''}|${item.replayId}`===key)){
    return {recorded:false,duplicate:true,event,events};
  }
  const next=safeWrite(storage,[...events,event]);
  return {recorded:true,event,events:next};
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

export function trainingHistorySummary(storage=globalThis.localStorage){
  return summarizeTrainingHistory(readTrainingHistory(storage));
}

export const TRAINING_HISTORY_STORAGE_KEY=STORAGE_KEY;
