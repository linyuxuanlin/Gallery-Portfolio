import assert from 'node:assert/strict';
import { buildReplayHeatmap, replayVisualizationSummary, replayDuration, replayModelAtTime, normalizeReplayLayers } from '../pour-replay-visualization.js';

const samples=[];
for(let i=0;i<20;i++) samples.push({t:i*100,x:.28*Math.cos(i/3),z:.28*Math.sin(i/3),flow:5,water:i*2,pouring:true});
for(let i=20;i<28;i++) samples.push({t:i*100,x:.2,z:.1,flow:0,water:40,pouring:false});
for(let i=28;i<40;i++) samples.push({t:i*100,x:.5*Math.cos(i/4),z:.5*Math.sin(i/4),flow:5.5,water:40+(i-28)*3,pouring:true});

const model=buildReplayHeatmap(samples,{size:32});
assert.equal(model.path.length,samples.length);
assert.equal(model.pauses.length,1);
assert(model.pauses[0].duration>=700);
assert(model.max>0);
const summary=replayVisualizationSummary(model);
assert.equal(summary.valid,true);
assert.equal(summary.pauseCount,1);
assert(summary.outerShare>=0&&summary.outerShare<=1);
assert.equal(replayDuration(model),3900);

const firstHalf=replayModelAtTime(model,1950);
assert(firstHalf.path.length<model.path.length);
assert(firstHalf.cursor.t<=1950);
assert(firstHalf.cursor.t>=1800);
assert(firstHalf.max>0);
assert(firstHalf.path.every(point=>point.t<=1950));
assert(firstHalf.pauses.length===0,'pause should not count before its >=500ms duration completes');

const duringPause=replayModelAtTime(model,2700);
assert.equal(duringPause.cursor.pouring,false);
assert.equal(duringPause.pauses.length,1);

const end=replayModelAtTime(model,999999);
assert.equal(end.path.length,model.path.length);
assert.equal(end.cursor.t,3900);

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
const beforeBreak=replayModelAtTime(broken,500);
assert.equal(beforeBreak.breakCount,0);
const afterBreak=replayModelAtTime(broken,1100);
assert.equal(afterBreak.breakCount,1);
assert.equal(afterBreak.path.at(-2).breakBefore,true);

console.log('replay visualization tests: PASS');
