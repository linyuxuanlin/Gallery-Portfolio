import assert from 'node:assert/strict';
import {recordLifecycleBreak,readPendingLifecycleBreaks} from '../pour-replay-breaks.js';
import {persistLifecycleBreaksToLatest} from '../pour-replay-break-persistence.js';
import {analyzeBrew} from '../pour-brew-analysis.js';
import {buildReplayHeatmap} from '../pour-replay-visualization.js';

const localMap=new Map(),sessionMap=new Map();
const localStorage={getItem:key=>localMap.has(key)?localMap.get(key):null,setItem:(key,value)=>localMap.set(key,value)};
const sessionStorage={getItem:key=>sessionMap.has(key)?sessionMap.get(key):null,setItem:(key,value)=>sessionMap.set(key,value),removeItem:key=>sessionMap.delete(key)};
const now=Date.now();
const replay={createdAt:new Date(now).toISOString(),duration:2200,samples:[
  {t:0,x:0,z:0,flow:5,water:0,pouring:true},
  {t:900,x:.05,z:0,flow:5,water:30,pouring:true},
  {t:1000,x:.55,z:.2,flow:0,water:30,pouring:false},
  {t:1300,x:.56,z:.2,flow:5,water:35,pouring:true},
  {t:2200,x:.58,z:.22,flow:5,water:70,pouring:true},
]};
localMap.set('pourLabLastBrew',JSON.stringify(replay));
recordLifecycleBreak({t:1000,hiddenMs:5000,reason:'hidden',recordedAt:now-1000},sessionStorage);
const persisted=persistLifecycleBreaksToLatest(localStorage,sessionStorage);
assert.equal(persisted.updated,true);
const saved=JSON.parse(localMap.get('pourLabLastBrew'));
assert.equal(saved.samples[2].breakBefore,true);
assert.equal(readPendingLifecycleBreaks(sessionStorage).length,0);
const analysis=analyzeBrew(saved.samples);
assert.equal(analysis.lifecycleBreakCount,1);
assert(analysis.pathDistance<.2,'lifecycle jump must not inflate active path distance');
const map=buildReplayHeatmap(saved.samples,{size:24});
assert.equal(map.breakCount,1);
assert.equal(map.path[2].segment,1);
console.log('replay break persistence tests: PASS');
