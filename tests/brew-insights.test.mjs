import assert from 'node:assert/strict';
import { buildBrewInsightModel, buildNextBrewActions } from '../pour-brew-insights.js';

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
assert.equal(stableModel.actions.length,0,'stable brew should not invent next-brew corrections');

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
assert.equal(badModel.actions.length,2,'result should focus on two highest-priority actions');
assert.equal(badModel.actions[0].code,badModel.issues.find(i=>['flow-unstable','dwell-hotspot','edge-overuse','middle-underused','coverage-low','uniformity-low','bed-hotspot'].includes(i.code)).code);
for(const action of badModel.actions){
  assert(action.title.length>0);
  assert(action.action.length>12);
  assert(action.target.length>0);
}

const mapped=buildNextBrewActions([
  {code:'coverage-low',severity:'high'},
  {code:'coverage-low',severity:'high'},
  {code:'edge-overuse',severity:'medium'},
  {code:'unknown',severity:'high'},
],3);
assert.deepEqual(mapped.map(a=>a.code),['coverage-low','edge-overuse'],'actions should be unique and ignore unsupported issue codes');
assert.match(mapped[0].target,/75%/);
assert.match(mapped[1].target,/18%/);
assert.deepEqual(buildNextBrewActions(null),[]);
assert.deepEqual(buildNextBrewActions([],0),[]);

const empty=buildBrewInsightModel({samples:[]});
assert.equal(empty.valid,false);
assert.deepEqual(empty.actions,[]);
console.log('brew insights tests: PASS');
