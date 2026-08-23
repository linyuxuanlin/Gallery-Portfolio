import assert from 'node:assert/strict';
import { buildReplayHeatmap, replayVisualizationSummary } from '../pour-replay-visualization.js';

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

const edge=buildReplayHeatmap(Array.from({length:20},(_,i)=>({t:i*100,x:.65,z:0,flow:5,water:i,pouring:true})));
assert.equal(replayVisualizationSummary(edge).headline,'外圈轨迹偏多');
console.log('replay visualization tests: PASS');
