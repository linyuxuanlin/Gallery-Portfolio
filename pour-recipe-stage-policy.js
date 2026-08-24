import { analyzeRecipeStageTrends } from './pour-recipe-stage-trend.js';

const finite=(value,fallback=null)=>value===null||value===undefined||value===''?fallback:(Number.isFinite(Number(value))?Number(value):fallback);

export function buildRecipeStageTrendPreview(events,{recipeId,plan,consistency,replayId,recordedAt}={}){
  const history=Array.isArray(events)?events.slice():[];
  if(!recipeId||!plan?.stageId||!plan?.focusId||!plan?.target)return {analysis:analyzeRecipeStageTrends(history,{recipeId}),trend:null,previewed:false};
  const alreadyRecorded=history.some(event=>event?.type==='recipe-stage'&&event.recipeId===recipeId&&event.replayId===replayId&&event.stageId===plan.stageId&&event.focusId===plan.focusId);
  let previewed=false;
  if(!alreadyRecorded&&replayId&&consistency?.applicable){
    const stage=consistency.stages?.find(item=>item.id===plan.stageId);
    const value=finite(stage?.[plan.target.metric]);
    if(value!==null){
      history.push({
        version:1,type:'recipe-stage',recipeId,replayId,stageId:plan.stageId,stageName:plan.stageName||stage?.name||plan.stageId,
        focusId:plan.focusId,value,target:finite(plan.target.value),recordedAt:recordedAt||consistency.brews?.at(-1)?.createdAt||new Date().toISOString(),preview:true,
      });
      previewed=true;
    }
  }
  const analysis=analyzeRecipeStageTrends(history,{recipeId});
  const trend=analysis.trends?.find(item=>item.stageId===plan.stageId&&item.focusId===plan.focusId)||null;
  return {analysis,trend,previewed};
}

export function stageChallengeTrendPolicy(trend){
  if(!trend)return {mode:'normal',allowPass:true,resetStreak:false,label:'按当前专项验收',action:null};
  switch(trend.targetState){
    case 'regressing-after-target':
      return {mode:'recovery',allowPass:false,resetStreak:true,label:'恢复模式',action:'曾经达标但最近反弹：本杯不允许晋级，先重新稳定在目标线内。'};
    case 'converging-below-target':
      return {mode:'converging',allowPass:false,resetStreak:false,label:'持续收敛',action:'正在接近目标：保持当前动作，不切换专项。'};
    case 'moving-away':
      return {mode:'recovery',allowPass:false,resetStreak:true,label:'恢复模式',action:'当前表现正在远离目标：先恢复可控基线，再重新累计连续达标。'};
    case 'stalled-below-target':
      return {mode:'stalled',allowPass:false,resetStreak:false,label:'继续专项',action:'尚未过线且接近停滞：保留专项，只调整一个变量。'};
    case 'holding-target':
      return {mode:'confirm',allowPass:true,resetStreak:false,label:'复现确认',action:'已在目标线内保持：继续累计连续 2 杯达标后再毕业。'};
    default:
      return {mode:'normal',allowPass:true,resetStreak:false,label:'按当前专项验收',action:trend.recommendedAction||null};
  }
}

export function applyStageChallengeTrendPolicy(evaluation,policy){
  if(!evaluation?.applicable)return evaluation;
  const originalPassed=!!evaluation.passed;
  if(policy?.allowPass!==false)return {...evaluation,originalPassed,trendPolicy:policy?.mode||'normal'};
  return {...evaluation,passed:false,originalPassed,trendBlocked:originalPassed,trendPolicy:policy?.mode||'blocked',resetStreak:!!policy?.resetStreak};
}
