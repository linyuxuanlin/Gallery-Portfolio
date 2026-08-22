import assert from 'node:assert/strict';
import {analyzeBrew,diagnoseBrew} from '../pour-brew-analysis.js';

function makeSamples({flow=5,points=[[0,0]],seconds=10}={}){
  const out=[];let water=0;
  for(let i=0;i<=seconds*10;i++){
    const t=i*100,p=points[i%points.length],f=i===0?0:flow;
    if(i>0)water+=f*.1;
    out.push({t,x:p[0],z:p[1],flow:f,water,pouring:f>.08});
  }
  return out;
}

assert.equal(analyzeBrew([]).valid,false);

const stable=analyzeBrew(makeSamples({flow:5,points:[[0,0],[.18,0],[0,.18],[-.18,0],[0,-.18]],seconds:12}));
assert(stable.flowStability>.95);
assert(stable.radial.middle>0);
assert(stable.dwellConcentration<.30);

const stuck=analyzeBrew(makeSamples({flow:5,points:[[0,0]],seconds:12}));
assert(stuck.dwellConcentration>.90);
assert(diagnoseBrew(stuck).some(x=>x.code==='dwell-hotspot'));

const edge=analyzeBrew(makeSamples({flow:5,points:[[.65,0],[.62,.12],[.62,-.12]],seconds:12}));
assert(edge.edgeExposure>.8);
assert(diagnoseBrew(edge).some(x=>x.code==='edge-overuse'));

const variable=[];let water=0;for(let i=0;i<=120;i++){const f=i===0?0:(i%2?2:8);if(i>0)water+=f*.1;variable.push({t:i*100,x:.15,z:0,flow:f,water,pouring:f>.08});}
const unstable=analyzeBrew(variable);
assert(unstable.flowStability<.55);
assert(diagnoseBrew(unstable).some(x=>x.code==='flow-unstable'));

const withBed=diagnoseBrew(stable,{coverage:.52,uniformity:.48,hotspot:5.5});
assert(withBed.some(x=>x.code==='coverage-low'));
assert(withBed.some(x=>x.code==='uniformity-low'));
assert(withBed.some(x=>x.code==='bed-hotspot'));

function run(fps){
  const out=[];let water=0;
  for(let i=0;i<=fps*10;i++){
    const t=i/fps*1000,a=i/fps*1.7,x=.30*Math.cos(a),z=.30*Math.sin(a),f=i===0?0:5;
    if(i>0)water+=f/fps;
    out.push({t,x,z,flow:f,water,pouring:f>.08});
  }
  return analyzeBrew(out);
}
const a=run(30),b=run(144);
assert(Math.abs(a.avgFlow-b.avgFlow)<1e-10);
assert(Math.abs(a.radial.middle-b.radial.middle)<.01);
assert(Math.abs(a.edgeExposure-b.edgeExposure)<.01);

console.log('brew analysis tests: PASS');
