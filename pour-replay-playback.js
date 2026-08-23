export function createReplayPlaybackController({
  getFraction=()=>0,setFraction=()=>{},now=()=>performance.now(),
  raf=callback=>requestAnimationFrame(callback),caf=id=>cancelAnimationFrame(id),onState=()=>{},renderIntervalMs=33,
}={}){
  let playing=false,speed=1,lastAt=null,lastRenderAt=null,pendingAdvance=0,frameId=0;
  const snapshot=()=>({playing,speed,fraction:Math.max(0,Math.min(1,Number(getFraction())||0))});
  const emit=()=>{const s=snapshot();onState(s);return s};
  function tick(at){
    frameId=0;if(!playing)return;
    if(lastAt===null){lastAt=at;lastRenderAt=at}
    else{
      const dt=Math.max(0,Math.min(100,at-lastAt));lastAt=at;
      const durationMs=Math.max(1,Number(globalThis.__pourReplayDurationMs)||1);
      pendingAdvance+=(dt*speed)/durationMs;
      const current=snapshot().fraction,next=Math.min(1,current+pendingAdvance);
      if(next>=1||at-lastRenderAt>=Math.max(16,Number(renderIntervalMs)||33)){
        setFraction(next);pendingAdvance=0;lastRenderAt=at;
        if(next>=1){playing=false;lastAt=null;lastRenderAt=null;emit();return}
      }
    }
    frameId=raf(tick);
  }
  function play(){if(snapshot().fraction>=1)setFraction(0);if(playing)return emit();playing=true;lastAt=null;lastRenderAt=null;pendingAdvance=0;emit();frameId=raf(tick);return snapshot()}
  function pause(){if(!playing)return emit();playing=false;lastAt=null;lastRenderAt=null;pendingAdvance=0;if(frameId){caf(frameId);frameId=0}return emit()}
  function toggle(){return playing?pause():play()}
  function setSpeed(value){speed=[.5,1,2].includes(Number(value))?Number(value):1;return emit()}
  function seek(fraction){pendingAdvance=0;setFraction(Math.max(0,Math.min(1,Number(fraction)||0)));lastAt=null;lastRenderAt=null;return emit()}
  function dispose(){pause()}
  return {play,pause,toggle,setSpeed,seek,snapshot,dispose};
}
function ensureStyle(doc){
  if(doc.getElementById('pourReplayPlaybackStyle'))return;
  const style=doc.createElement('style');style.id='pourReplayPlaybackStyle';
  style.textContent='.replay-playback{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.replay-playback button{padding:5px 8px;border-radius:999px;font-size:9px}.replay-playback .active{background:var(--text);color:#171714}';
  doc.head.appendChild(style);
}
export function installReplayPlayback(doc=globalThis.document){
  if(!doc||doc.__pourReplayPlaybackInstalled)return {installed:false};
  const slider=doc.getElementById('replayVizSlider'),layers=doc.getElementById('replayVizLayers');
  if(!slider||!layers)return {installed:false,reason:'replay-ui-missing'};
  doc.__pourReplayPlaybackInstalled=true;ensureStyle(doc);
  const controls=doc.createElement('div');controls.className='replay-playback';
  controls.innerHTML='<button type="button" data-action="toggle">播放</button><button type="button" data-speed="0.5">0.5×</button><button type="button" data-speed="1" class="active">1×</button><button type="button" data-speed="2">2×</button>';
  layers.insertAdjacentElement('afterend',controls);
  const readFraction=()=>Math.max(0,Math.min(1,(Number(slider.value)||0)/1000));
  const writeFraction=fraction=>{slider.value=String(Math.round(Math.max(0,Math.min(1,fraction))*1000));slider.dispatchEvent(new Event('input',{bubbles:true}))};
  const controller=createReplayPlaybackController({
    getFraction:readFraction,setFraction:writeFraction,renderIntervalMs:33,
    onState:state=>{const toggle=controls.querySelector('[data-action="toggle"]');if(toggle)toggle.textContent=state.playing?'暂停':'播放';controls.querySelectorAll('[data-speed]').forEach(button=>button.classList.toggle('active',Number(button.dataset.speed)===state.speed))}
  });
  const durationLabel=doc.getElementById('replayVizEnd');
  const parseDuration=()=>{const text=durationLabel?.textContent||'0:00.0',[m,s]=text.split(':');globalThis.__pourReplayDurationMs=Math.max(1,(Number(m)||0)*60000+(Number(s)||0)*1000)};
  parseDuration();
  controls.addEventListener('click',event=>{const button=event.target.closest?.('button');if(!button)return;if(button.dataset.action==='toggle')controller.toggle();else if(button.dataset.speed)controller.setSpeed(Number(button.dataset.speed))});
  slider.addEventListener('pointerdown',()=>controller.pause());
  slider.addEventListener('input',parseDuration);
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)controller.pause()});
  return {installed:true,controller,controls};
}
