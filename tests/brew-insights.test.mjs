import assert from 'node:assert/strict';
import { buildBrewInsightModel } from '../pour-brew-insights.js';

function sample(t,x,z,flow,pouring=true,water=0){return {t,x,z,flow,pouring,water}}

const stable=[];
for(let i=0;i<=100;i++){
  const t=i*100,a=i/100*Math.PI*6,r=.30;
  stable.push(sample(t,Math.cos(a)*r,Math.sin(a)*r,5+Math.sin(a)*.08,true,i*2.5));
}
const stableModel=buildBrewInsightModel({samples:stable,metrics:{coverage:.86,uniformity:.82,hotspot:2.4}});
assert.equal(stableModel.valid,true);
assert(stableModel.analysis.flowStability>.9);
assert(stableModel.stats.avgFlow.endsWith('g/s'));
assert(!stableModel.issues.some(i=>i.code==='flow-unstable'));

const bad=[];
for(let i=0;i<=100;i++){
  const t=i*100;
  const edge=i<75?.64:.05;
  const flow=i%2?2.2:7.8;
  bad.push(sample(t,edge,0,flow,true,i*2.5));
}
const badModel=buildBrewInsightModel({samples:bad,metrics:{coverage:.55,uniformity:.48,hotspot:6.3}});
assert.equal(badModel.valid,true);
assert(badModel.issues.some(i=>i.code==='flow-unstable'));
assert(badModel.issues.some(i=>i.code==='edge-overuse'));
assert(badModel.issues.some(i=>i.code==='coverage-low'));
assert(badModel.issues.some(i=>i.code==='uniformity-low'));
assert(badModel.summary.length>10);

const empty=buildBrewInsightModel({samples:[]});
assert.equal(empty.valid,false);
console.log('brew insights tests: PASS');
