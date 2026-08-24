const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));

export function recoveryRisk(recovery={}){
  const episodes=Math.max(0,Number(recovery.recoveryEpisodes)||0);
  if(!episodes){
    return {applicable:false,score:0,level:'none',label:'暂无反弹',reason:'尚无 Recovery 记录'};
  }
  const recovered=Math.max(0,Number(recovery.recoveredEpisodes)||0);
  const active=Math.max(0,Number(recovery.activeRecoveries)||0);
  const average=Number.isFinite(Number(recovery.averageRecoveryCups))?Math.max(0,Number(recovery.averageRecoveryCups)):null;
  const passRate=clamp(recovery.recoveryPassRate);

  const frequency=clamp(episodes/4);
  const unrecovered=clamp((episodes-recovered)/episodes);
  const slow=average===null?0:clamp((average-1)/4);
  const fragility=1-passRate;
  const activePenalty=active?1:0;

  const score=Math.round(100*(frequency*.22+unrecovered*.24+slow*.28+fragility*.16+activePenalty*.10));

  let level='low',label='低风险';
  if(score>=72){level='critical';label='高风险'}
  else if(score>=52){level='high';label='偏高'}
  else if(score>=30){level='medium';label='中等'}

  const reasons=[];
  if(active)reasons.push('当前仍在恢复');
  if(unrecovered>=.34)reasons.push('恢复完成率偏低');
  if(average!==null&&average>=3.5)reasons.push('平均恢复较慢');
  if(passRate<.55)reasons.push('恢复杯达标率偏低');
  if(episodes>=3)reasons.push('反弹较频繁');
  if(!reasons.length)reasons.push('反弹少且恢复较快');

  return {applicable:true,score,level,label,reason:reasons.slice(0,2).join(' · ')};
}

export function rankRecoveryRisks(stages=[]){
  return (Array.isArray(stages)?stages:[])
    .map(stage=>({...stage,recoveryRisk:recoveryRisk(stage?.recovery)}))
    .sort((a,b)=>b.recoveryRisk.score-a.recoveryRisk.score||b.attempts-a.attempts);
}
