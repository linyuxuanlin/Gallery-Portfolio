import assert from 'node:assert/strict';
import { buildReplayHeatmap, replayVisualizationSummary, replayDuration, replayModelAtTime, normalizeReplayLayers, createReplayTimelineCache, getReplayTimelineCache } from '../pour-replay-visualization.js';

const samples=[];
for(let i=0;i<20;i++) samples.push({t:i*100,x:.28*Math.cos(i/3),z:.28*Math.sin(i/3),flow:5,water:i*2,pouring:true});
for(let i=20;i<28;i++) samples.push({t:i*100,x:.2,z:.1,flow:0,water:40,pouring:false});
for(let i=28;i<240;i++) samples.push({t:i*100,x:.5*Math.cos(i/4),z:.5*Math.sin(i/4),flow:5.5,water:40+(i-28)*.8,pouring:true});

const model=buildReplayHeatmap(samples,{size:32});
assert.equal(model.path.length,samples.length);
assert.equal(model.pauses.length,1);
assert(model.pauses[0].duration>=700);
assert(model.max>0);
const summary=replayVisualizationSummary(model);
assert.equal(summary.valid,true);
assert.equal(summary.pauseCount,1);
assert(summary.outerShare>=0&&summary.outerShare<=1);
assert.equal(replayDuration(model),23900);

const cache=createReplayTimelineCache(model,{checkpointEvery:32});
assert(cache.checkpoints.length>5);
assert.equal(getReplayTimelineCache(model),getReplayTimelineCache(model),'model cache should be reused');

for(const time of [0,1950,2700,8150,12340,23900,999999]){
  const cached=replayModelAtTime(model,time,{cache});
  const source=model.path.filter(point=>point.t<=Math.min(time,replayDuration(model)));
  const exact=buildReplayHeatmap(source,{size:model.size,radius:model.radius,sigma:model.sigma});
  assert.equal(cached.path.length,exact.path.length,`path mismatch at ${time}`);
  assert.equal(cached.pauses.length,exact.pauses.length,`pause mismatch at ${time}`);
  assert.equal(cached.breakCount,exact.breakCount,`break mismatch at ${time}`);
  assert(Math.abs(cached.max-exact.max)<1e-10,`max mismatch at ${time}`);
  for(let i=0;i<cached.grid.length;i++) assert(Math.abs(cached.grid[i]-exact.grid[i])<1e-10,`grid mismatch at ${time}/${i}`);
  assert(cached.cacheStats.replayedSamples<=31,`checkpoint replay exceeded bound: ${cached.cacheStats.replayedSamples}`);
}

const firstHalf=replayModelAtTime(model,1950,{cache});
assert(firstHalf.path.length<model.path.length);
assert(firstHalf.cursor.t<=1950);
assert(firstHalf.cursor.t>=1800);
assert(firstHalf.max>0);
assert(firstHalf.path.every(point=>point.t<=1950));
assert(firstHalf.pauses.length===0,'pause should not count before its >=500ms duration completes');

const duringPause=replayModelAtTime(model,2700,{cache});
assert.equal(duringPause.cursor.pouring,false);
assert.equal(duringPause.pauses.length,1);

const end=replayModelAtTime(model,999999,{cache});
assert.equal(end.path.length,model.path.length);
assert.equal(end.cursor.t,23900);

const empty=replayModelAtTime(buildReplayHeatmap([]),500);
assert.equal(empty.path.length,0);
assert.equal(empty.cursor,null);

assert.deepEqual(normalizeReplayLayers(),{heatmap:true,path:true,pauses:true,cursor:true});
assert.deepEqual(normalizeReplayLayers({heatmap:false,path:false}),{heatmap:false,path:false,pauses:true,cursor:true});

const edge=buildReplayHeatmap(Array.from({length:20},(_,i)=>({t:i*100,x:.65,z:0,flow:5,water:i,pouring:true})));
assert.equal(replayVisualizationSummary(edge).headline,'外圈轨迹偏多');

const brokenSamples=[
  {t:0,x:0,z:0,flow:5,water:0,pouring:true},
  {t:100,x:.1,z:0,flow:5,water:1,pouring:true},
  {t:1000,x:-.4,z:.3,flow:5,water:2,pouring:true,breakBefore:true},
  {t:1100,x:-.3,z:.3,flow:5,water:3,pouring:true},
];
const broken=buildReplayHeatmap(brokenSamples,{size:24});
const brokenCache=createReplayTimelineCache(broken,{checkpointEvery:8});
const beforeBreak=replayModelAtTime(broken,500,{cache:brokenCache});
assert.equal(beforeBreak.breakCount,0);
const afterBreak=replayModelAtTime(broken,1100,{cache:brokenCache});
assert.equal(afterBreak.breakCount,1);
assert.equal(afterBreak.path.at(-2).breakBefore,true);

console.log('replay visualization cache tests: PASS');
