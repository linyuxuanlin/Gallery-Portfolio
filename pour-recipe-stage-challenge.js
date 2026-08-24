import { recordRecipeStageTransition } from './pour-training-history.js';

const STORAGE_KEY='pourLabRecipeStageChallenge';
const VERSION=2;
const MAX_COMPLETED=12;
const finite=(value,fallback=null)=>value===null||value===undefined||value===''?fallback:(Number.isFinite(Number(value))?Number(value):fallback);

function safeParse(text,fallback){try{return JSON.parse(text)}catch{return fallback}}
function emptyStore(){return {version:VERSION,recipes:{}}}
function safeRead(storage){try{const parsed=safeParse(storage?.getItem?.(STORAGE_KEY)||'null',null);return parsed?.recipes&&typeof parsed.recipes==='object'?parsed:emptyStore()}catch{return emptyStore()}}
function safeWrite(storage,state){try{storage?.setItem?.(STORAGE_KEY,JSON.stringify(state));return true}catch{return false}}
function challengeKey(plan){return plan?.stageId&&plan?.focusId?`${plan.stageId}:${plan.focusId}`:null}
function normalizeRecovery(recovery){if(!recovery?.active)return null;return {active:true,reason:recovery.reason||'trend-regression',attempts:Math.max(0,Math.floor(finite(recovery.attempts,0))),consecutivePasses:Math.max(0,Math.floor(finite(recovery.consecutivePasses,0))),requiredPasses:Math.max(1,Math.floor(finite(recovery.requiredPasses,2))),startedReplayId:recovery.startedReplayId||null,lastPassed:recovery.lastPassed===true?true:recovery.lastPassed===false?false:null}}

export function readRecipeStageProgress(storage=globalThis.localStorage,recipeId){
  const state=safeRead(storage),entry=state.recipes?.[recipeId],challenge=entry?.challenge?{...entry.challenge,recovery:normalizeRecovery(entry.challenge.recovery)}:null;
  return {recipeId,completedKeys:Array.isArray(entry?.completedKeys)?entry.completedKeys.slice(-MAX_COMPLETED):[],challenge};
}

function writeRecipeStageProgress(storage,recipeId,entry){
  const state=safeRead(storage);state.version=VERSION;
  state.recipes={...(state.recipes||{}),[recipeId]:{completedKeys:Array.isArray(entry.completedKeys)?entry.completedKeys.slice(-MAX_COMPLETED):[],challenge:entry.challenge?{...entry.challenge,version:2,recovery:normalizeRecovery(entry.challenge.recovery)}:null}};
  safeWrite(storage,state);return state.recipes[recipeId];
}

export function createRecipeStageChallenge(plan,latestReplayId,{requiredPasses=2}={}){
  const key=challengeKey(plan);if(!key||!plan?.target)return null;
  return {version:2,key,recipeId:plan.recipeId||null,stageId:plan.stageId,stageName:plan.stageName,focusId:plan.focusId,target:{...plan.target},cue:plan.cue||'',headline:plan.headline||'',baselineReplayId:latestReplayId||null,lastReplayId:latestReplayId||null,baselineValue:finite(plan.target.current),previousValue:finite(plan.target.current),lastValue:null,attempts:0,passes:0,consecutivePasses:0,requiredPasses:Math.max(1,Math.floor(requiredPasses||2)),lastPassed:null,completed:false,recovery:null};
}

function updateRecovery(challenge,evaluation,latestReplayId,{requiredRecoveryPasses=2}={}){
  const policy=evaluation?.trendPolicy||'normal',triggerRecovery=policy==='recovery'||evaluation?.resetStreak===true;
  let recovery=normalizeRecovery(challenge.recovery);
  if(triggerRecovery&&!recovery){
    recovery={active:true,reason:policy,attempts:0,consecutivePasses:0,requiredPasses:Math.max(1,Math.floor(requiredRecoveryPasses||2)),startedReplayId:latestReplayId||null,lastPassed:null};
  }
  if(!recovery)return {challenge,recoveryStatus:null,recovered:false};

  const recoveryPassed=evaluation?.originalPassed===true;
  recovery={...recovery,attempts:recovery.attempts+1,lastPassed:recoveryPassed,consecutivePasses:recoveryPassed?recovery.consecutivePasses+1:0};
  const recovered=recovery.consecutivePasses>=recovery.requiredPasses;
  if(recovered){
    return {challenge:{...challenge,recovery:null,consecutivePasses:0,lastPassed:null},recoveryStatus:'recovered',recovered:true,recovery:{...recovery,active:false}};
  }
  return {challenge:{...challenge,recovery,consecutivePasses:0,lastPassed:false},recoveryStatus:recoveryPassed?'recovery-passed':'recovery-failed',recovered:false,recovery};
}

export function syncRecipeStageChallenge(storage=globalThis.localStorage,{recipeId,plan,consistency,latestReplayId,evaluate,requiredPasses=2,requiredRecoveryPasses=2,allowEvaluation=true}={}){
  if(!recipeId)return {applicable:false,status:'no-recipe',progress:null};
  let progress=readRecipeStageProgress(storage,recipeId);const completedKeys=progress.completedKeys.slice();let challenge=progress.challenge;
  if(challenge&&challenge.recipeId&&challenge.recipeId!==recipeId)challenge=null;

  if(!challenge){
    if(!plan?.applicable||plan.mode!=='focus'||!plan.focusId){
      writeRecipeStageProgress(storage,recipeId,{completedKeys,challenge:null});
      return {applicable:!!plan?.applicable,status:plan?.mode==='maintenance'?'maintenance':'no-focus',progress:{recipeId,completedKeys,challenge:null},plan};
    }
    challenge=createRecipeStageChallenge({...plan,recipeId},latestReplayId,{requiredPasses});
    writeRecipeStageProgress(storage,recipeId,{completedKeys,challenge});
    return {applicable:true,status:'started',progress:{recipeId,completedKeys,challenge},plan,evaluation:null};
  }

  const challengePlan={applicable:true,mode:'focus',recipeId,stageId:challenge.stageId,stageName:challenge.stageName,focusId:challenge.focusId,target:challenge.target,cue:challenge.cue,headline:challenge.headline};
  if(!allowEvaluation||!latestReplayId||latestReplayId===challenge.lastReplayId){
    return {applicable:true,status:challenge.recovery?.active?'recovery-waiting':'waiting',progress:{recipeId,completedKeys,challenge},plan:challengePlan,evaluation:null};
  }

  const evaluation=typeof evaluate==='function'?evaluate(challengePlan,consistency):{applicable:false};
  if(!evaluation?.applicable){
    challenge={...challenge,lastReplayId:latestReplayId};writeRecipeStageProgress(storage,recipeId,{completedKeys,challenge});
    return {applicable:true,status:'unscored',progress:{recipeId,completedKeys,challenge},plan:challengePlan,evaluation};
  }

  challenge={...challenge,lastReplayId:latestReplayId,previousValue:challenge.lastValue??challenge.previousValue,lastValue:finite(evaluation.current),attempts:(challenge.attempts||0)+1};
  const recoveryResult=updateRecovery(challenge,evaluation,latestReplayId,{requiredRecoveryPasses});
  challenge=recoveryResult.challenge;

  if(recoveryResult.recoveryStatus){
    const historyEvaluation={...evaluation,passed:false,recoveryPass:evaluation.originalPassed===true,recoveryStatus:recoveryResult.recoveryStatus};
    recordRecipeStageTransition(storage,{status:recoveryResult.recoveryStatus,graduated:false,plan:challengePlan,evaluation:historyEvaluation,completedChallenge:null},{replayId:latestReplayId,recipeId});
    writeRecipeStageProgress(storage,recipeId,{completedKeys,challenge});
    return {applicable:true,status:recoveryResult.recoveryStatus,recovered:recoveryResult.recovered,graduated:false,progress:{recipeId,completedKeys,challenge},plan:challengePlan,evaluation:historyEvaluation,recovery:recoveryResult.recovery||null};
  }

  const passed=!!evaluation.passed;
  challenge={...challenge,passes:(challenge.passes||0)+(passed?1:0),consecutivePasses:passed?(challenge.consecutivePasses||0)+1:0,lastPassed:passed};
  challenge.completed=challenge.consecutivePasses>=challenge.requiredPasses;
  const status=challenge.completed?'graduated':passed?'passed':'failed';
  recordRecipeStageTransition(storage,{status,graduated:challenge.completed,plan:challengePlan,evaluation:{...evaluation,passed},completedChallenge:challenge.completed?challenge:null},{replayId:latestReplayId,recipeId});

  if(challenge.completed){
    const completed=[...completedKeys.filter(key=>key!==challenge.key),challenge.key].slice(-MAX_COMPLETED);
    writeRecipeStageProgress(storage,recipeId,{completedKeys:completed,challenge:null});
    return {applicable:true,status:'graduated',graduated:true,completedKey:challenge.key,progress:{recipeId,completedKeys:completed,challenge:null},plan:challengePlan,evaluation:{...evaluation,passed:true},completedChallenge:challenge};
  }

  writeRecipeStageProgress(storage,recipeId,{completedKeys,challenge});
  return {applicable:true,status:passed?'passed':'failed',graduated:false,progress:{recipeId,completedKeys,challenge},plan:challengePlan,evaluation:{...evaluation,passed}};
}

export function resetRecipeStageChallenges(storage=globalThis.localStorage,recipeId){
  if(!recipeId)return false;const state=safeRead(storage);if(!state.recipes?.[recipeId])return false;delete state.recipes[recipeId];return safeWrite(storage,state);
}

export const RECIPE_STAGE_CHALLENGE_STORAGE_KEY=STORAGE_KEY;
