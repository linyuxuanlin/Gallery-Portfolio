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

const lifecycle=fs.readFileSync(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
assert.match(lifecycle,/installReplayPlayback/,'lifecycle must install replay playback after Replay Map');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(sw,/pour-lab-v17/,'service worker cache version must be bumped');
assert.match(sw,/\.\/pour-replay-playback\.js/,'replay playback must be available offline');

console.log('replay playback tests: PASS');
