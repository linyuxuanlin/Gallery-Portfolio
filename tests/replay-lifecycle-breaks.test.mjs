import assert from 'node:assert/strict';
import {recordLifecycleBreak,readPendingLifecycleBreaks,clearPendingLifecycleBreaks,applyLifecycleBreaks,attachPendingLifecycleBreaks} from '../pour-replay-breaks.js';

function storage(){const map=new Map();return {getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}}
const s=storage();
assert.equal(recordLifecycleBreak({t:1000,hiddenMs:100,recordedAt:10000},s).recorded,false);
assert.equal(recordLifecycleBreak({t:1000,hiddenMs:3000,reason:'hidden',recordedAt:10000},s).recorded,true);
assert.equal(recordLifecycleBreak({t:1001,hiddenMs:3000,reason:'hidden',recordedAt:10020},s).recorded,false);
assert.equal(readPendingLifecycleBreaks(s).length,1);
const replay={createdAt:new Date(12000).toISOString(),duration:2500,samples:[{t:0,x:0,z:0,flow:5,pouring:true},{t:900,x:.1,z:0,flow:5,pouring:true},{t:1000,x:.4,z:.2,flow:0,pouring:false},{t:1300,x:.42,z:.2,flow:5,pouring:true}]};
const {replay:marked}=attachPendingLifecycleBreaks(replay,s);
assert.equal(marked.lifecycleBreaks.length,1);
assert.equal(marked.lifecycleBreaks[0].sampleIndex,2);
assert.equal(marked.samples[2].breakBefore,true);
assert.equal(marked.samples[2].breakHiddenMs,3000);
assert.equal(replay.samples[2].breakBefore,undefined);
assert.equal(clearPendingLifecycleBreaks(s),true);
assert.equal(readPendingLifecycleBreaks(s).length,0);
const stale=applyLifecycleBreaks({...replay,createdAt:new Date(10*60*60*1000).toISOString()},[{t:1000,hiddenMs:3000,recordedAt:10000}]);
assert.equal(stale.lifecycleBreaks,undefined);
console.log('replay lifecycle break tests: PASS');
