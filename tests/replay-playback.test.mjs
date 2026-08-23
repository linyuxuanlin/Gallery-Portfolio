import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createReplayPlaybackController } from '../pour-replay-playback.js';

let fraction=0;
let callback=null;
globalThis.__pourReplayDurationMs=1000;
const controller=createReplayPlaybackController({
  getFraction:()=>fraction,
  setFraction:value=>{fraction=value},
  raf:fn=>{callback=fn;return 1},
  caf:()=>{},
  onState:()=>{},
  renderIntervalMs:33,
});

controller.play();
callback(0);
callback(100);
assert(Math.abs(fraction-.1)<1e-9,'1x playback should advance by elapsed fraction');
controller.setSpeed(2);
callback(200);
assert(Math.abs(fraction-.3)<1e-9,'2x playback should advance twice as fast');
controller.pause();
assert.equal(controller.snapshot().playing,false);
controller.seek(.8);
assert.equal(fraction,.8);
controller.setSpeed(.5);
controller.play();
callback(300);
callback(400);
assert(Math.abs(fraction-.85)<1e-9,'0.5x playback should advance at half speed');
controller.seek(1);
controller.play();
assert.equal(fraction,0,'playing from the end should restart from zero');
assert.equal(controller.setSpeed(3).speed,1,'unsupported playback speeds should fall back to 1x');

let smoothFraction=0;
let smoothCallback=null;
let redraws=0;
const smooth=createReplayPlaybackController({
  getFraction:()=>smoothFraction,
  setFraction:value=>{smoothFraction=value;redraws++},
  raf:fn=>{smoothCallback=fn;return 1},
  caf:()=>{},
  renderIntervalMs:33,
});
smooth.play();
smoothCallback(0);
for(let t=7;t<=1000;t+=7)smoothCallback(t);
assert(smoothFraction>.97,'high-refresh playback should preserve elapsed progress');
assert(redraws<=31,`high-refresh playback should cap redraws near 30fps, got ${redraws}`);
assert(redraws>=27,'playback should still redraw smoothly near 30fps');

const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
assert.match(lifecycle,/installReplayPlayback/,'lifecycle must install replay playback after Replay Map');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(sw,/pour-lab-v17/,'service worker cache version must remain compatible');
assert.match(sw,/\.\/pour-replay-playback\.js/,'replay playback must be available offline');

console.log('replay playback throttle tests: PASS');
