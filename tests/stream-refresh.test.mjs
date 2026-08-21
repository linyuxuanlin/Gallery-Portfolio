import assert from 'node:assert/strict';
import {streamRefreshInterval,shouldRefreshStream} from '../pour-stream-physics.js';

const p0={x:0,y:1.18,z:0};
const pMove={x:.03,y:1.18,z:0};

assert.equal(streamRefreshInterval({previousPoint:p0,currentPoint:pMove,previousFlow:5,currentFlow:5}),40,'moving stream should target about 25 Hz geometry refresh');
assert.equal(streamRefreshInterval({previousPoint:p0,currentPoint:p0,previousFlow:5,currentFlow:5}),50,'stable visible stream should target about 20 Hz');
assert.equal(streamRefreshInterval({previousPoint:p0,currentPoint:p0,previousFlow:.4,currentFlow:.3}),66,'low-flow tail should target about 15 Hz');
assert.equal(streamRefreshInterval({previousPoint:p0,currentPoint:{x:.004,y:1.18,z:.003},previousFlow:5,currentFlow:5,force:true}),40,'forced landing motion should use the moving cadence');

assert.equal(shouldRefreshStream({nowMs:39,lastUpdateMs:0,previousPoint:p0,currentPoint:pMove,previousFlow:5,currentFlow:5,force:true}),false,'moving geometry must remain throttled before 40ms');
assert.equal(shouldRefreshStream({nowMs:40,lastUpdateMs:0,previousPoint:p0,currentPoint:pMove,previousFlow:5,currentFlow:5,force:true}),true,'moving geometry may refresh at 40ms');
assert.equal(shouldRefreshStream({nowMs:49,lastUpdateMs:0,previousPoint:p0,currentPoint:p0,previousFlow:5,currentFlow:5.2,previousRadius:.02,currentRadius:.021}),false,'flow-only changes should wait for idle cadence');
assert.equal(shouldRefreshStream({nowMs:50,lastUpdateMs:0,previousPoint:p0,currentPoint:p0,previousFlow:5,currentFlow:5.2,previousRadius:.02,currentRadius:.021}),true,'flow-only changes may refresh at 50ms');
assert.equal(shouldRefreshStream({nowMs:65,lastUpdateMs:0,previousPoint:p0,currentPoint:p0,previousFlow:.5,currentFlow:.3,previousRadius:.012,currentRadius:.010}),false,'tail geometry should remain throttled before 66ms');
assert.equal(shouldRefreshStream({nowMs:66,lastUpdateMs:0,previousPoint:p0,currentPoint:p0,previousFlow:.5,currentFlow:.3,previousRadius:.012,currentRadius:.010}),true,'tail geometry may refresh at 66ms');

function movingRefreshCount(fps=144){
  let last=-Infinity,count=0;
  for(let i=0;i<fps;i++){
    const t=i*1000/fps;
    const current={x:(i/fps)*.7,y:1.18,z:0};
    const previous={x:(Math.max(0,i-1)/fps)*.7,y:1.18,z:0};
    if(shouldRefreshStream({nowMs:t,lastUpdateMs:last,previousPoint:previous,currentPoint:current,previousFlow:5,currentFlow:5,previousRadius:.02,currentRadius:.02,force:true})){
      last=t;count++;
    }
  }
  return count;
}

const moving144=movingRefreshCount(144);
assert.ok(moving144>=23&&moving144<=25,`144 Hz pointer motion should rebuild about 24 times/s, got ${moving144}`);

console.log('stream-refresh tests: PASS', {moving144});
