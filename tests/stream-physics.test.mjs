import assert from 'node:assert/strict';
import {streamDownVelocityForFlow,ballisticFlight,sampleBallisticArc,arcSagFromChord,smoothingAlpha,smoothPoint,pointDistance,createStreamMotionRuntime,shouldRefreshStream} from '../pour-stream-physics.js';

assert.equal(streamDownVelocityForFlow(0),0);
assert.equal(streamDownVelocityForFlow(.04),0);
const v2=streamDownVelocityForFlow(2),v4=streamDownVelocityForFlow(4),v6=streamDownVelocityForFlow(6),v8=streamDownVelocityForFlow(8);
assert.ok(v2<v4&&v4<v6&&v6<v8,'exit down velocity must increase with flow');
assert.ok(v2>=.09&&v2<=.14,`2 g/s exit velocity out of range: ${v2}`);
assert.ok(v8>=.40&&v8<=.48,`8 g/s exit velocity out of range: ${v8}`);

const start={x:0,y:3.35,z:0},end={x:-1.1,y:1.18,z:.25};
const arcs=[2,4,6,8].map(flow=>sampleBallisticArc(start,end,flow));
for(const [i,arc] of arcs.entries()){
  assert.deepEqual(arc[0],start,`flow ${[2,4,6,8][i]} start point drifted`);
  assert.deepEqual(arc.at(-1),end,`flow ${[2,4,6,8][i]} must land exactly on target`);
  for(let j=1;j<arc.length;j++) assert.ok(arc[j].y<=arc[j-1].y+1e-12,'stream must not move upward');
}
const sags=arcs.map(arcSagFromChord);
assert.ok(sags[0]>sags[1]&&sags[1]>sags[2]&&sags[2]>sags[3],`low flow should sag more: ${sags}`);
assert.ok(sags[0]-sags[3]>.04,`2→8 g/s visual sag difference too subtle: ${sags}`);

const flights=[2,4,6,8].map(flow=>ballisticFlight({startY:start.y,endY:end.y,flow}));
for(let i=1;i<flights.length;i++) assert.ok(flights[i].time<flights[i-1].time,'higher flow should reach the bed sooner');
assert.ok(flights[0].time<1&&flights[0].time>.75,`2 g/s flight time implausible: ${flights[0].time}`);
assert.ok(flights[3].time<.9&&flights[3].time>.65,`8 g/s flight time implausible: ${flights[3].time}`);

assert.ok(smoothingAlpha(1/60,8)>0&&smoothingAlpha(1/60,8)<1);
const target={x:.7,y:1.18,z:-.5};
function run(fps){let p={x:0,y:1.18,z:0};for(let i=0;i<fps;i++)p=smoothPoint(p,target,1/fps,8);return p}
const p30=run(30),p60=run(60),p144=run(144);
assert.ok(pointDistance(p30,p60)<1e-10,`30/60 Hz smoothing drifted: ${pointDistance(p30,p60)}`);
assert.ok(pointDistance(p60,p144)<1e-10,`60/144 Hz smoothing drifted: ${pointDistance(p60,p144)}`);
assert.ok(pointDistance(p60,target)<.001,'target follower should converge within one second');
const first=smoothPoint({x:0,y:1.18,z:0},target,1/60,8);
assert.ok(first.x>0&&first.x<target.x,'target should move immediately without teleporting');

function runMotion(fps){
  const motion=createStreamMotionRuntime();
  motion.setDesired(target);
  let snap;
  for(let i=0;i<fps;i++)snap=motion.step(1/fps);
  return snap;
}
const m30=runMotion(30),m60=runMotion(60),m144=runMotion(144);
assert.ok(pointDistance(m30.actual,m60.actual)<1e-10,'actual stream point must be frame-rate independent');
assert.ok(pointDistance(m60.actual,m144.actual)<1e-10,'actual stream point must match on high refresh displays');
assert.ok(pointDistance(m30.kettle,m60.kettle)<.001,'kettle follower FPS drift must remain visually negligible');
assert.ok(pointDistance(m60.kettle,m144.kettle)<.001,'kettle follower must remain stable on high refresh displays');
assert.ok(m60.kettle.x>m60.actual.x,'kettle should stay offset from the actual landing point');

const p0={x:0,y:1.18,z:0},pTiny={x:.004,y:1.18,z:.003},pMove={x:.03,y:1.18,z:0};
assert.equal(shouldRefreshStream({nowMs:10,lastUpdateMs:0,previousPoint:p0,currentPoint:pMove,previousFlow:5,currentFlow:5,previousRadius:.02,currentRadius:.02}),false,'refresh must respect the minimum interval');
assert.equal(shouldRefreshStream({nowMs:40,lastUpdateMs:0,previousPoint:p0,currentPoint:pTiny,previousFlow:5,currentFlow:5.02,previousRadius:.02,currentRadius:.0203}),false,'sub-threshold visual changes should not rebuild geometry');
assert.equal(shouldRefreshStream({nowMs:40,lastUpdateMs:0,previousPoint:p0,currentPoint:pMove,previousFlow:5,currentFlow:5,previousRadius:.02,currentRadius:.02}),true,'meaningful landing-point movement should rebuild geometry');
assert.equal(shouldRefreshStream({nowMs:40,lastUpdateMs:0,previousPoint:p0,currentPoint:p0,previousFlow:0,currentFlow:.2,previousRadius:0,currentRadius:.01}),true,'stream visibility changes must refresh after the throttle window');
assert.equal(shouldRefreshStream({nowMs:100,lastUpdateMs:0,previousPoint:p0,currentPoint:pMove,previousFlow:0,currentFlow:0,previousRadius:0,currentRadius:0}),false,'invisible stream should not rebuild for pointer movement alone');
assert.equal(shouldRefreshStream({nowMs:10,lastUpdateMs:0,force:true}),false,'forced refresh must still obey the geometry throttle');
assert.equal(shouldRefreshStream({nowMs:40,lastUpdateMs:0,force:true}),true,'forced refresh may bypass visual thresholds after the throttle window');

console.log('stream-physics tests: PASS');
