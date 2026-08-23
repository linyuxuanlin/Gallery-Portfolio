const LAST_BREW_KEY='pourLabLastBrew';
const DEFAULT_SIZE=48;
const BED_RADIUS=.70;
const DEFAULT_CHECKPOINT_EVERY=48;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function replaySignature(replay){
  const samples=Array.isArray(replay?.samples)?replay.samples:[],last=samples.at(-1);
  return [replay?.id||replay?.createdAt||'',samples.length,finite(last?.t),finite(last?.water),finite(replay?.duration)].join('|');
}
function makeState(size,radius,sigma){return{size,radius,sigma,grid:new Float64Array(size*size),rawPauses:[],max:0,breakCount:0}}
function clonePause(p){return{startIndex:p.startIndex,endIndex:p.endIndex,startT:p.startT,endT:p.endT,x:p.x,z:p.z,water:p.water,segment:p.segment}}
function cloneState(s){return{size:s.size,radius:s.radius,sigma:s.sigma,grid:s.grid.slice(),rawPauses:s.rawPauses.map(clonePause),max:s.max,breakCount:s.breakCount}}
function finalizePauses(pauses){return pauses.map(p=>({...p,duration:Math.max(0,p.endT-p.startT)})).filter(p=>p.duration>=500)}
function accumulatePoint(state,p,index){
  if(p.breakBefore)state.breakCount++;
  if(!p.pouring){
    const prev=state.rawPauses.at(-1);
    if(!prev||prev.endIndex!==index-1||p.breakBefore)state.rawPauses.push({startIndex:index,endIndex:index,startT:p.t,endT:p.t,x:p.x,z:p.z,water:p.water,segment:p.segment});
    else{prev.endIndex=index;prev.endT=p.t;prev.x=(prev.x+p.x)/2;prev.z=(prev.z+p.z)/2;prev.water=p.water}
    return;
  }
  const gx=(p.x/state.radius*.5+.5)*state.size,gz=(p.z/state.radius*.5+.5)*state.size,influence=Math.max(.15,Math.min(2.2,p.flow/5));
  const minX=Math.max(0,Math.floor(gx-state.sigma*3)),maxX=Math.min(state.size-1,Math.ceil(gx+state.sigma*3));
  const minZ=Math.max(0,Math.floor(gz-state.sigma*3)),maxZ=Math.min(state.size-1,Math.ceil(gz+state.sigma*3));
  for(let iy=minZ;iy<=maxZ;iy++)for(let ix=minX;ix<=maxX;ix++){
    const nx=(ix+.5)/state.size*2-1,nz=(iy+.5)/state.size*2-1;if(nx*nx+nz*nz>1)continue;
    const dx=ix+.5-gx,dz=iy+.5-gz,value=influence*Math.exp(-(dx*dx+dz*dz)/(2*state.sigma*state.sigma)),gi=iy*state.size+ix;
    state.grid[gi]+=value;if(state.grid[gi]>state.max)state.max=state.grid[gi];
  }
}

export function buildReplayHeatmap(samples,{size=DEFAULT_SIZE,radius=BED_RADIUS,sigma=1.65}={}){
  const gridSize=Math.max(8,Math.floor(size)),src=Array.isArray(samples)?samples:[],path=[];let segment=0;
  for(const sample of src){
    const breakBefore=sample?.breakBefore===true;if(breakBefore)segment++;
    const flow=Math.max(0,finite(sample?.flow));
    path.push({x:finite(sample?.x),z:finite(sample?.z),t:Math.max(0,finite(sample?.t)),water:Math.max(0,finite(sample?.water)),flow,pouring:sample?.pouring===true||flow>.08,breakBefore,segment});
  }
  const state=makeState(gridSize,radius,sigma);for(let i=0;i<path.length;i++)accumulatePoint(state,path[i],i);
  return{size:gridSize,radius,sigma,grid:state.grid,max:state.max,path,pauses:finalizePauses(state.rawPauses),breakCount:state.breakCount};
}
export function replayDuration(model){const path=model?.path||[];return path.length?Math.max(0,finite(path.at(-1)?.t)):0}
export function createReplayTimelineCache(model,{checkpointEvery=DEFAULT_CHECKPOINT_EVERY}={}){
  const every=Math.max(8,Math.floor(checkpointEvery)),path=model?.path||[],state=makeState(Math.max(8,Math.floor(model?.size||DEFAULT_SIZE)),finite(model?.radius,BED_RADIUS),finite(model?.sigma,1.65));
  const checkpoints=[{endIndex:-1,state:cloneState(state)}];
  for(let i=0;i<path.length;i++){accumulatePoint(state,path[i],i);if((i+1)%every===0||i===path.length-1)checkpoints.push({endIndex:i,state:cloneState(state)})}
  return{model,checkpointEvery:every,checkpoints,duration:replayDuration(model)};
}
const timelineCacheByModel=new WeakMap();
export function getReplayTimelineCache(model,{checkpointEvery=DEFAULT_CHECKPOINT_EVERY}={}){
  if(!model||typeof model!=='object')return null;const every=Math.max(8,Math.floor(checkpointEvery)),old=timelineCacheByModel.get(model);if(old?.checkpointEvery===every)return old;
  const cache=createReplayTimelineCache(model,{checkpointEvery:every});timelineCacheByModel.set(model,cache);return cache;
}
function endIndexAtTime(path,time){let lo=0,hi=path.length-1,out=-1;while(lo<=hi){const mid=(lo+hi)>>1;if(finite(path[mid]?.t)<=time){out=mid;lo=mid+1}else hi=mid-1}return out}
function checkpointForIndex(cache,index){let lo=0,hi=cache.checkpoints.length-1,out=cache.checkpoints[0];while(lo<=hi){const mid=(lo+hi)>>1,c=cache.checkpoints[mid];if(c.endIndex<=index){out=c;lo=mid+1}else hi=mid-1}return out}
export function replayModelAtTime(model,timeMs,{cache=getReplayTimelineCache(model)}={}){
  if(!model?.path?.length)return{...(model||{}),path:[],pauses:[],grid:new Float64Array(model?.grid?.length||0),max:0,cursor:null,cacheStats:{checkpointIndex:-1,replayedSamples:0}};
  const end=cache?.duration??replayDuration(model),time=Math.max(0,Math.min(end,finite(timeMs,end))),endIndex=endIndexAtTime(model.path,time);
  if(endIndex<0)return{...model,grid:new Float64Array(model.grid.length),max:0,path:[],pauses:[],breakCount:0,cursor:model.path[0],time,duration:end,cacheStats:{checkpointIndex:-1,replayedSamples:0}};
  const checkpoint=cache?checkpointForIndex(cache,endIndex):null,state=checkpoint?cloneState(checkpoint.state):makeState(model.size,model.radius,finite(model.sigma,1.65));
  const start=(checkpoint?.endIndex??-1)+1;for(let i=start;i<=endIndex;i++)accumulatePoint(state,model.path[i],i);
  return{size:model.size,radius:model.radius,sigma:model.sigma,grid:state.grid,max:state.max,path:model.path.slice(0,endIndex+1),pauses:finalizePauses(state.rawPauses),breakCount:state.breakCount,cursor:model.path[endIndex],time,duration:end,cacheStats:{checkpointIndex:checkpoint?.endIndex??-1,replayedSamples:Math.max(0,endIndex-start+1)}};
}
export function replayVisualizationSummary(model){
  if(!model?.path?.length)return{valid:false,headline:'暂无轨迹数据'};const active=model.path.filter(p=>p.pouring);if(!active.length)return{valid:false,headline:'暂无有效注水轨迹'};
  let wr=0,w=0,mr=0;for(const p of active){const r=Math.hypot(p.x,p.z),q=Math.max(.2,p.flow);wr+=r*q;w+=q;mr=Math.max(mr,r)}const meanRadius=w?wr/w:0,outerShare=active.filter(p=>Math.hypot(p.x,p.z)>model.radius*.78).length/active.length;
  return{valid:true,headline:outerShare>.22?'外圈轨迹偏多':meanRadius<model.radius*.22?'轨迹偏中心':'轨迹分布正常',meanRadius,maxRadius:mr,outerShare,pauseCount:model.pauses.length,breakCount:model.breakCount||0};
}
export function normalizeReplayLayers(layers={}){return{heatmap:layers.heatmap!==false,path:layers.path!==false,pauses:layers.pauses!==false,cursor:layers.cursor!==false}}
function readLatest(storage){try{const p=JSON.parse(storage?.getItem?.(LAST_BREW_KEY)||'null');return p?.samples?.length?p:null}catch{return null}}
function ensureStyle(doc){if(doc.getElementById('pourReplayVizStyle'))return;const s=doc.createElement('style');s.id='pourReplayVizStyle';s.textContent='.replay-viz{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.replay-viz.show{display:block}.replay-viz-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:var(--muted)}.replay-viz-head b{color:var(--text)}.replay-viz-controls{display:grid;gap:7px;margin-top:8px}.replay-viz-time{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;font-size:9px;color:var(--muted)}.replay-viz-time input{width:100%;accent-color:var(--accent)}.replay-viz-layers{display:flex;flex-wrap:wrap;gap:5px}.replay-viz-layer{border:1px solid var(--line);background:#fff1;color:var(--muted);border-radius:999px;padding:5px 8px;font-size:9px}.replay-viz-layer.active{color:var(--text);border-color:#ffffff38;background:#fff2}.replay-viz-wrap{display:grid;grid-template-columns:minmax(0,220px) 1fr;gap:10px;align-items:center;margin-top:7px}.replay-viz canvas{width:100%;aspect-ratio:1;border-radius:12px;background:#0b0b0a}.replay-viz-copy{font-size:9px;color:var(--muted);line-height:1.5}.replay-viz-copy b{display:block;color:var(--text);font-size:10px;margin-bottom:4px}@media(max-width:560px){.replay-viz-wrap{grid-template-columns:1fr}.replay-viz canvas{max-width:210px;justify-self:center}}';doc.head.appendChild(s)}
function ensurePanel(doc){let p=doc.getElementById('replayViz');if(p)return p;const host=doc.getElementById('brewInsights')||doc.getElementById('results');if(!host?.parentElement)return null;p=doc.createElement('div');p.id='replayViz';p.className='replay-viz';p.innerHTML='<div class="replay-viz-head"><span>REPLAY MAP</span><b id="replayVizMeta">--</b></div><div class="replay-viz-controls"><div class="replay-viz-time"><span id="replayVizNow">0:00.0</span><input id="replayVizSlider" type="range" min="0" max="1000" value="1000" step="1"><span id="replayVizEnd">0:00.0</span></div><div class="replay-viz-layers" id="replayVizLayers"><button class="replay-viz-layer active" data-layer="heatmap">热力</button><button class="replay-viz-layer active" data-layer="path">路径</button><button class="replay-viz-layer active" data-layer="pauses">暂停</button></div></div><div class="replay-viz-wrap"><canvas id="replayVizCanvas" width="360" height="360"></canvas><div class="replay-viz-copy" id="replayVizCopy"></div></div>';host.insertAdjacentElement('afterend',p);return p}
function fmtMs(ms){const total=Math.max(0,finite(ms))/1000,m=Math.floor(total/60),s=total-m*60;return`${m}:${s.toFixed(1).padStart(4,'0')}`}
function drawModel(canvas,model,layers={}){const v=normalizeReplayLayers(layers),ctx=canvas?.getContext?.('2d');if(!ctx)return;const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)*.43;ctx.clearRect(0,0,w,h);ctx.fillStyle='#10100f';ctx.fillRect(0,0,w,h);ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();if(v.heatmap&&model.max>0){const cell=r*2/model.size;for(let iy=0;iy<model.size;iy++)for(let ix=0;ix<model.size;ix++){const n=model.grid[iy*model.size+ix]/model.max;if(n<.025)continue;ctx.fillStyle=`rgba(232,192,123,${Math.min(.78,.08+Math.sqrt(n)*.7)})`;ctx.fillRect(cx-r+ix*cell,cy-r+iy*cell,cell+1,cell+1)}}const active=model.path.filter(p=>p.pouring);if(v.path&&active.length>1){ctx.beginPath();active.forEach((p,i)=>{const x=cx+p.x/model.radius*r,y=cy+p.z/model.radius*r,prev=active[i-1];if(i===0||p.segment!==prev?.segment)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.strokeStyle='rgba(167,223,176,.9)';ctx.lineWidth=2;ctx.stroke()}if(v.pauses)for(const p of model.pauses){const x=cx+p.x/model.radius*r,y=cy+p.z/model.radius*r;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle='rgba(240,199,120,.95)';ctx.fill()}if(v.cursor&&model.cursor){const x=cx+model.cursor.x/model.radius*r,y=cy+model.cursor.z/model.radius*r;ctx.beginPath();ctx.arc(x,y,6.5,0,Math.PI*2);ctx.fillStyle=model.cursor.pouring?'rgba(154,216,255,.95)':'rgba(255,255,255,.75)';ctx.fill();ctx.strokeStyle='#10100f';ctx.lineWidth=2;ctx.stroke()}ctx.restore();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,r*.5,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.08)';ctx.stroke()}
function renderCopy(doc,model,summary){const copy=doc.getElementById('replayVizCopy');copy.replaceChildren();const title=doc.createElement('b');title.textContent=summary.headline;const d=doc.createElement('div'),c=model.cursor,ct=c?` · 游标 ${Math.round(c.water)}g / ${c.flow.toFixed(1)} g/s${c.pouring?'':' · 停止注水'}`:'';d.textContent=summary.valid?`平均半径 ${Math.round(summary.meanRadius/model.radius*100)}% · 外圈占比 ${Math.round(summary.outerShare*100)}%${ct} · 黄色点为 ≥0.5s 暂停${model.breakCount?' · 系统中断处轨迹已断开':''}`:'完成一杯后显示轨迹热力图';copy.append(title,d)}

export function renderReplayVisualization(doc=globalThis.document,storage=globalThis.localStorage){
  const panel=ensurePanel(doc);if(!panel)return{rendered:false};const replay=readLatest(storage);if(!replay){panel.classList.remove('show');return{rendered:false}};
  const state=doc.__pourReplayVizState||{fraction:1,layers:normalizeReplayLayers(),replaySignature:'',fullModel:null,timelineCache:null};doc.__pourReplayVizState=state;state.layers=normalizeReplayLayers(state.layers);state.fraction=Math.max(0,Math.min(1,finite(state.fraction,1)));
  const signature=replaySignature(replay);if(state.replaySignature!==signature||!state.fullModel){state.replaySignature=signature;state.fullModel=buildReplayHeatmap(replay.samples);state.timelineCache=createReplayTimelineCache(state.fullModel)}
  const fullModel=state.fullModel,duration=state.timelineCache?.duration??replayDuration(fullModel),slider=doc.getElementById('replayVizSlider');slider.value=String(Math.round(state.fraction*1000));const time=duration*state.fraction,model=replayModelAtTime(fullModel,time,{cache:state.timelineCache}),summary=replayVisualizationSummary(model);
  drawModel(doc.getElementById('replayVizCanvas'),model,state.layers);doc.getElementById('replayVizNow').textContent=fmtMs(time);doc.getElementById('replayVizEnd').textContent=fmtMs(duration);doc.getElementById('replayVizMeta').textContent=`${model.path.length}/${fullModel.path.length} 点 · ${model.pauses.length} 次暂停${model.breakCount?` · ${model.breakCount} 次中断`:''}`;renderCopy(doc,model,summary);
  slider.oninput=()=>{state.fraction=Math.max(0,Math.min(1,finite(slider.value)/1000));renderReplayVisualization(doc,storage)};for(const button of doc.querySelectorAll?.('#replayVizLayers [data-layer]')||[]){const key=button.dataset.layer;button.classList.toggle('active',state.layers[key]!==false);button.onclick=()=>{state.layers[key]=!state.layers[key];renderReplayVisualization(doc,storage)}}panel.classList.add('show');return{rendered:true,model,fullModel,summary,state};
}
export function installReplayVisualization(doc=globalThis.document,storage=globalThis.localStorage){if(!doc||doc.__pourReplayVizInstalled)return{installed:false};doc.__pourReplayVizInstalled=true;ensureStyle(doc);ensurePanel(doc);const update=()=>renderReplayVisualization(doc,storage),results=doc.getElementById('results');if(results&&typeof MutationObserver!=='undefined'){const observer=new MutationObserver(update);observer.observe(results,{attributes:true,attributeFilter:['class']})}update();return{installed:true,update}}
