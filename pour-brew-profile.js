import { analyzeBrew } from './pour-brew-analysis.js';
import { readBrewHistory } from './pour-brew-history.js';

const finite=(v,f=null)=>{const n=Number(v);return Number.isFinite(n)?n:f};
const mean=values=>{const xs=values.filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null};
const spread=values=>{const xs=values.filter(Number.isFinite);if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/xs.length)};
const bedMetric=(brew,key)=>finite(brew?.metrics?.[key]);

export function buildBrewProfile(history,{window=12}={}){
  const brews=[...(Array.isArray(history)?history:[])]
    .filter(b=>b?.samples?.length)
    .sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')))
    .slice(-Math.max(3,window));

  if(brews.length<3)return{valid:false,count:brews.length,headline:'至少完成 3 杯后生成冲煮画像',traits:[],strengths:[],focus:[]};

  const analyses=brews.map(b=>analyzeBrew(b.samples||[]));
  const avg={
    score:mean(brews.map(b=>finite(b.score))),
    flowStability:mean(analyses.map(a=>finite(a.flowStability))),
    edgeExposure:mean(analyses.map(a=>finite(a.edgeExposure))),
    innerShare:mean(analyses.map(a=>finite(a.radial?.inner))),
    middleShare:mean(analyses.map(a=>finite(a.radial?.middle))),
    outerShare:mean(analyses.map(a=>finite(a.radial?.outer))),
    dwellConcentration:mean(analyses.map(a=>finite(a.dwellConcentration))),
    coverage:mean(brews.map(b=>bedMetric(b,'coverage'))),
    uniformity:mean(brews.map(b=>bedMetric(b,'uniformity'))),
  };

  const scoreSpread=spread(brews.map(b=>finite(b.score)));
  const flowSpread=spread(analyses.map(a=>finite(a.flowStability)));

  let spatial='均衡绕圈';
  if((avg.edgeExposure??0)>.24||(avg.outerShare??0)>.38)spatial='偏外圈';
  else if((avg.innerShare??0)>.58)spatial='偏中心';
  else if((avg.middleShare??0)>.50)spatial='中圈利用充分';

  let flow='流速较稳';
  if((avg.flowStability??1)<.62)flow='流速波动明显';
  else if((avg.flowStability??0)>.82)flow='流速控制稳定';

  const consistency=scoreSpread<=4?'表现稳定':scoreSpread>=10?'杯间波动较大':'有一定波动';
  const traits=[spatial,flow,consistency];

  const strengths=[];
  if((avg.flowStability??0)>=.78)strengths.push('流速稳定');
  if((avg.coverage??0)>=.78)strengths.push('粉床覆盖');
  if((avg.uniformity??0)>=.76)strengths.push('粉床均匀');
  if((avg.edgeExposure??1)<=.16)strengths.push('外圈控制');
  if(scoreSpread<=5)strengths.push('杯间一致性');

  const focus=[];
  if((avg.flowStability??1)<.72)focus.push({key:'flow',label:'流速稳定',gap:.72-(avg.flowStability??0)});
  if((avg.coverage??1)<.75)focus.push({key:'coverage',label:'粉床覆盖',gap:.75-(avg.coverage??0)});
  if((avg.uniformity??1)<.72)focus.push({key:'uniformity',label:'粉床均匀',gap:.72-(avg.uniformity??0)});
  if((avg.edgeExposure??0)>.18)focus.push({key:'edge',label:'外圈控制',gap:(avg.edgeExposure??0)-.18});
  if(scoreSpread>8)focus.push({key:'consistency',label:'杯间一致性',gap:Math.min(1,(scoreSpread-8)/12)});
  focus.sort((a,b)=>b.gap-a.gap);

  const headline=focus.length?`${traits[0]} · 优先练 ${focus[0].label}`:`${traits[0]} · 当前整体稳定`;
  return{valid:true,count:brews.length,headline,traits,strengths,focus:focus.slice(0,3),averages:avg,scoreSpread,flowSpread,brews};
}

const pct=v=>Number.isFinite(v)?`${Math.round(v*100)}%`:'--';

function ensureStyle(doc){
  if(doc.getElementById('pourBrewProfileStyle'))return;
  const s=doc.createElement('style');s.id='pourBrewProfileStyle';
  s.textContent='.brew-profile{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.brew-profile.show{display:block}.brew-profile-head{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--muted)}.brew-profile-head b{color:var(--text)}.brew-profile-traits{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.brew-profile-chip{font-size:9px;padding:5px 7px;border-radius:999px;background:#fff1;color:var(--text)}.brew-profile-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:7px}.brew-profile-metric{padding:6px;border-radius:9px;background:#0003;text-align:center}.brew-profile-metric b{display:block;font-size:11px;color:var(--text)}.brew-profile-metric span{font-size:8px;color:var(--muted)}.brew-profile-copy{margin-top:7px;font-size:9px;color:var(--muted);line-height:1.5}@media(max-width:560px){.brew-profile-grid{grid-template-columns:repeat(2,1fr)}}';
  doc.head.appendChild(s);
}

function ensurePanel(doc){
  let panel=doc.getElementById('brewProfile');if(panel)return panel;
  const host=doc.getElementById('trainingPeriod')||doc.getElementById('brewHistory')||doc.getElementById('results');
  if(!host?.parentElement)return null;
  panel=doc.createElement('div');panel.id='brewProfile';panel.className='brew-profile';
  panel.innerHTML='<div class="brew-profile-head"><span>BREW PROFILE</span><b id="brewProfileHeadline">--</b></div><div class="brew-profile-traits" id="brewProfileTraits"></div><div class="brew-profile-grid"><div class="brew-profile-metric"><b id="profileFlow">--</b><span>FLOW STABILITY</span></div><div class="brew-profile-metric"><b id="profileCoverage">--</b><span>COVERAGE</span></div><div class="brew-profile-metric"><b id="profileUniformity">--</b><span>UNIFORMITY</span></div><div class="brew-profile-metric"><b id="profileConsistency">--</b><span>SCORE SPREAD</span></div></div><div class="brew-profile-copy" id="brewProfileCopy"></div>';
  host.insertAdjacentElement('afterend',panel);return panel;
}

export function renderBrewProfile(doc=globalThis.document,storage=globalThis.localStorage){
  const panel=ensurePanel(doc);if(!panel)return{rendered:false};
  const profile=buildBrewProfile(readBrewHistory(storage));
  if(!profile.valid){panel.classList.remove('show');return{rendered:false,profile}};
  doc.getElementById('brewProfileHeadline').textContent=profile.headline;
  const traits=doc.getElementById('brewProfileTraits');traits.replaceChildren();
  for(const trait of profile.traits){const chip=doc.createElement('span');chip.className='brew-profile-chip';chip.textContent=trait;traits.appendChild(chip)}
  doc.getElementById('profileFlow').textContent=pct(profile.averages.flowStability);
  doc.getElementById('profileCoverage').textContent=pct(profile.averages.coverage);
  doc.getElementById('profileUniformity').textContent=pct(profile.averages.uniformity);
  doc.getElementById('profileConsistency').textContent=`±${profile.scoreSpread.toFixed(1)}`;
  const strengths=profile.strengths.length?`优势：${profile.strengths.join(' / ')}`:'优势仍在形成';
  const focus=profile.focus.length?`下一重点：${profile.focus.map(x=>x.label).join(' → ')}`:'当前没有明显短板';
  doc.getElementById('brewProfileCopy').textContent=`基于最近 ${profile.count} 杯 · ${strengths} · ${focus}`;
  panel.classList.add('show');return{rendered:true,profile};
}

export function installBrewProfile(doc=globalThis.document,storage=globalThis.localStorage){
  if(!doc||doc.__pourBrewProfileInstalled)return{installed:false};
  doc.__pourBrewProfileInstalled=true;ensureStyle(doc);ensurePanel(doc);
  const update=()=>renderBrewProfile(doc,storage);
  doc.addEventListener?.('pour:history-imported',update);
  const results=doc.getElementById('results');
  if(results&&typeof MutationObserver!=='undefined'){const observer=new MutationObserver(update);observer.observe(results,{attributes:true,attributeFilter:['class']})}
  update();return{installed:true,update};
}
