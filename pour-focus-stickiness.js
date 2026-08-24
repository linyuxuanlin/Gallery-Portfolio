const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function selectStickyFocus(candidates,{previousFocusId=null,switchMargin=.45,recoveryOverride=78}={}){
  const ranked=(Array.isArray(candidates)?candidates:[]).filter(Boolean).slice().sort((a,b)=>finite(b?.priority)-finite(a?.priority));
  if(!ranked.length)return{selected:null,switched:false,held:false,reason:'no-candidates',ranked};
  const top=ranked[0];
  if(!previousFocusId)return{selected:top,switched:false,held:false,reason:'no-previous-focus',ranked};
  const previous=ranked.find(item=>item?.id===previousFocusId);
  if(!previous)return{selected:top,switched:top?.id!==previousFocusId,held:false,reason:'previous-focus-unavailable',ranked};
  if(top.id===previousFocusId)return{selected:previous,switched:false,held:true,reason:'previous-focus-still-best',ranked};

  const lead=finite(top.priority)-finite(previous.priority);
  const topRisk=finite(top?.recovery?.score);
  if(topRisk>=recoveryOverride&&topRisk>finite(previous?.recovery?.score)){
    return{selected:top,switched:true,held:false,reason:'recovery-risk-override',lead,ranked};
  }
  if(lead>=switchMargin){
    return{selected:top,switched:true,held:false,reason:'clear-priority-lead',lead,ranked};
  }
  return{selected:previous,switched:false,held:true,reason:'stickiness-margin',lead,ranked};
}

export function focusStickinessLabel(result){
  if(!result?.selected)return'';
  if(result.reason==='stickiness-margin')return'保持当前 Focus，避免因轻微波动频繁切换';
  if(result.reason==='recovery-risk-override')return'历史反弹风险显著升高，切换到更脆弱的 Focus';
  if(result.reason==='clear-priority-lead')return'新 Focus 优先级明显更高，允许切换';
  return'';
}
