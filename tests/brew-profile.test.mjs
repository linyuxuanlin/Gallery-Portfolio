import assert from 'node:assert/strict';
import { buildBrewProfile } from '../pour-brew-profile.js';

function circularSamples({radius=.30,n=80,flow=5,variable=false}={}){
  return Array.from({length:n},(_,i)=>({
    t:i*100,
    x:radius*Math.cos(i/5),
    z:radius*Math.sin(i/5),
    flow:variable?(i%2?2.2:7.8):flow,
    water:i*.5,
    pouring:true,
  }));
}
function brew(i,{score=86,radius=.30,coverage=.80,uniformity=.80,variable=false}={}){
  return {createdAt:`2026-08-${String(i).padStart(2,'0')}T00:00:00.000Z`,score,metrics:{coverage,uniformity},samples:circularSamples({radius,variable})};
}

assert.equal(buildBrewProfile([brew(1),brew(2)]).valid,false);

const stable=buildBrewProfile(Array.from({length:8},(_,i)=>brew(i+1,{score:88+(i%2),radius:.30,coverage:.82,uniformity:.80})));
assert.equal(stable.valid,true);
assert(stable.strengths.includes('粉床覆盖'));
assert(stable.strengths.includes('粉床均匀'));
assert(stable.strengths.includes('杯间一致性'));
assert(stable.scoreSpread<2);
assert.equal(stable.traits[2],'表现稳定');

const edge=buildBrewProfile(Array.from({length:8},(_,i)=>brew(i+1,{score:74+i%3,radius:.64,coverage:.58,uniformity:.60})));
assert.equal(edge.traits[0],'偏外圈');
assert(edge.focus.some(x=>x.key==='coverage'));
assert(edge.focus.some(x=>x.key==='uniformity'));
assert(edge.focus.some(x=>x.key==='edge'));

const center=buildBrewProfile(Array.from({length:6},(_,i)=>brew(i+1,{radius:.12,coverage:.80,uniformity:.80})));
assert.equal(center.traits[0],'偏中心');

const variable=buildBrewProfile(Array.from({length:8},(_,i)=>brew(i+1,{score:i%2?97:61,radius:.30,coverage:.80,uniformity:.80,variable:true})));
assert.equal(variable.traits[1],'流速波动明显');
assert.equal(variable.traits[2],'杯间波动较大');
assert(variable.focus.some(x=>x.key==='flow'));
assert(variable.focus.some(x=>x.key==='consistency'));

console.log('brew profile tests: PASS');
