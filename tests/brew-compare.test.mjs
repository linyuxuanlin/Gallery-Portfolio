import assert from 'node:assert/strict';
import {compareBrews,comparisonSummary,metricsForReplay} from '../pour-brew-compare.js';

function samples(flow=5,r=.3,n=20){
  const out=[];let water=0;
  for(let i=0;i<n;i++){
    const t=i*500,f=i===0?0:flow;
    water+=i===0?0:f*.5;
    out.push({t,x:Math.cos(i*.4)*r,z:Math.sin(i*.4)*r,flow:f,water,pouring:i>0});
  }
  return out;
}

const a={score:70,duration:10000,samples:samples(4.2,.62),metrics:{coverage:.62,uniformity:.55,hotspot:5.4}};
const b={score:88,duration:9800,samples:samples(5,.35),metrics:{coverage:.82,uniformity:.78,hotspot:3.1}};
const result=compareBrews(a,b);
assert.equal(result.rows.find(r=>r.key==='score').trend,'better');
assert.equal(result.rows.find(r=>r.key==='coverage').trend,'better');
assert.equal(result.rows.find(r=>r.key==='uniformity').trend,'better');
assert.equal(result.rows.find(r=>r.key==='hotspot').trend,'better');
assert(result.better>result.worse);
assert(comparisonSummary(result).length>0);
assert.equal(metricsForReplay({samples:[]}).valid,false);
const c=compareBrews({...a,score:80},{...a,score:80.2});
assert.equal(c.rows.find(r=>r.key==='score').trend,'same');
console.log('brew compare tests: PASS');
