import assert from 'node:assert/strict';
import {analyzeBrewTrend,trendSummary} from '../pour-brew-trend.js';
const mk=(i,score,c=.7,u=.7)=>({createdAt:`2026-08-${String(i).padStart(2,'0')}T00:00:00Z`,score,metrics:{coverage:c,uniformity:u},samples:[{t:0,x:0,z:0,flow:5,water:0,pouring:true},{t:1000,x:.1,z:0,flow:5,water:5,pouring:true},{t:2000,x:.2,z:.1,flow:5,water:10,pouring:true}]});
let h=[];for(let i=1;i<=8;i++)h.push(mk(i,68+i*2,.62+i*.03,.6+i*.03));let t=analyzeBrewTrend(h);assert(t.valid);assert.equal(t.metrics.score.direction,'improving');assert.match(t.headline,/进步/);assert(trendSummary(t)[1].includes('70'));
let d=[];for(let i=1;i<=6;i++)d.push(mk(i,95-i*3,.95-i*.05,.92-i*.05));t=analyzeBrewTrend(d);assert.equal(t.metrics.score.direction,'declining');assert.match(t.headline,/回落/);assert(t.priorities.length>=1);
assert.equal(analyzeBrewTrend([mk(1,80),mk(2,81)]).valid,false);
console.log('brew trend tests: PASS');
