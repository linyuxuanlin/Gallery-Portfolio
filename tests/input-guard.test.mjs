import assert from 'node:assert/strict';
import { bindLegacyPointerGuard, installLegacyPointerGuard } from '../pour-input-guard.js';

class MockEventTarget {
  constructor(){ this.listeners = new Map(); this.captured = new Set(); this.released = []; }
  addEventListener(type, fn, capture=false){
    const list=this.listeners.get(type)||[]; list.push({fn,capture:!!capture}); this.listeners.set(type,list);
  }
  removeEventListener(type, fn, capture=false){
    const list=this.listeners.get(type)||[]; this.listeners.set(type,list.filter(x=>x.fn!==fn||x.capture!==!!capture));
  }
  dispatchEvent(event){ return this.emit(event.type,event); }
  hasPointerCapture(id){ return this.captured.has(id); }
  releasePointerCapture(id){ this.captured.delete(id); this.released.push(id); }
  emit(type,event={}){
    try { event.type=type; } catch {}
    event.__stopped=false; event.__prevented=false;
    if (!event.preventDefault) event.preventDefault=()=>{event.__prevented=true};
    if (!event.stopImmediatePropagation) event.stopImmediatePropagation=()=>{event.__stopped=true};
    const list=this.listeners.get(type)||[];
    for(const phase of [true,false]) for(const {fn,capture} of list){
      if(capture!==phase||event.__stopped) continue;
      fn(event);
    }
    return true;
  }
}
class MockRoot extends MockEventTarget {
  constructor(canvas,view){ super(); this.canvas=canvas; this.defaultView=view; this.hidden=false; }
  querySelector(selector){ return selector==='canvas'?this.canvas:null; }
}

const view=new MockEventTarget(),el=new MockEventTarget();
let legacyDown=0,legacyMove=0,legacyUp=0,legacyCancel=0;
el.addEventListener('pointerdown',()=>legacyDown++);
el.addEventListener('pointermove',()=>legacyMove++);
el.addEventListener('pointerup',()=>legacyUp++);
el.addEventListener('pointercancel',()=>legacyCancel++);
const guard=bindLegacyPointerGuard(el,{view});

el.emit('pointerdown',{pointerId:1,pointerType:'touch',button:0});
assert.equal(legacyDown,1,'primary pointer should reach page handler');
assert.deepEqual(guard.snapshot(),{activePointerId:1,activePointerType:'touch',active:true});

el.emit('pointerdown',{pointerId:2,pointerType:'touch',button:0});
assert.equal(legacyDown,1,'secondary pointer must be blocked before legacy handler');
el.emit('pointermove',{pointerId:2,pointerType:'touch'});
assert.equal(legacyMove,0,'secondary pointer move must be blocked');
el.emit('pointermove',{pointerId:1,pointerType:'touch'});
assert.equal(legacyMove,1,'primary pointer move should pass');

el.emit('lostpointercapture',{pointerId:1,pointerType:'touch'});
assert.equal(legacyCancel,1,'lost capture must synthesize pointercancel for legacy stopPour');
assert.equal(guard.snapshot().active,false);

el.emit('pointerdown',{pointerId:3,pointerType:'mouse',button:2});
assert.equal(legacyDown,1,'right click must not start pouring');
assert.equal(guard.snapshot().active,false);

// A normal release that will reach canvas must NOT be converted to pointercancel
// by the window capture fallback.
el.emit('pointerdown',{pointerId:4,pointerType:'touch',button:0});
const normalRelease={pointerId:4,pointerType:'touch',target:el,composedPath:()=>[el,view]};
view.emit('pointerup',normalRelease);
assert.equal(guard.snapshot().active,true,'window capture must leave normal canvas release alone');
assert.equal(legacyCancel,1,'normal canvas release must not synthesize cancel');
el.emit('pointerup',normalRelease);
assert.equal(guard.snapshot().active,false);
assert.equal(legacyUp,1,'normal pointerup should retain pointerup semantics');

// A release that really lands outside canvas should still synthesize cancel.
el.emit('pointerdown',{pointerId:5,pointerType:'touch',button:0});
view.emit('pointerup',{pointerId:5,pointerType:'touch',target:view,composedPath:()=>[view]});
assert.equal(guard.snapshot().active,false,'off-canvas window pointerup must clear pointer');
assert.equal(legacyCancel,2,'off-canvas fallback must synthesize canvas pointercancel');

el.emit('pointerdown',{pointerId:6,pointerType:'touch',button:0});
el.emit('pointerleave',{pointerId:6,pointerType:'touch'});
assert.equal(guard.snapshot().active,false,'touch leaving without capture must cancel');
assert.equal(legacyCancel,3);

el.emit('pointerdown',{pointerId:7,pointerType:'touch',button:0});
el.captured.add(7);
el.emit('pointerleave',{pointerId:7,pointerType:'touch'});
assert.equal(guard.snapshot().active,true,'touch leaving with capture should stay active');
assert.equal(guard.suspend(),true,'suspend should cancel active pointer');
assert.equal(legacyCancel,4,'suspend must reach legacy pointercancel handler');
assert.deepEqual(el.released,[7],'suspend should release active browser pointer capture');
assert.equal(guard.suspend(),false,'repeated suspend should be idempotent');

for (const type of ['contextmenu','dragstart','selectstart']) {
  const event={}; el.emit(type,event);
  assert.equal(event.__prevented,true,`${type} should be prevented on brew canvas`);
}
guard.destroy();

const canvas=new MockEventTarget(),installView=new MockEventTarget(),root=new MockRoot(canvas,installView);
let installCancels=0;
canvas.addEventListener('pointercancel',()=>installCancels++);
const installed=installLegacyPointerGuard(root);
canvas.emit('pointerdown',{pointerId:10,pointerType:'touch',button:0});
assert.equal(installed.snapshot().active,true);
installView.emit('blur',{});
assert.equal(installed.snapshot().active,false,'window blur must clear active pointer');
assert.equal(installCancels,1,'blur should synthesize cancel');
canvas.emit('pointerdown',{pointerId:11,pointerType:'touch',button:0});
root.hidden=true; root.emit('visibilitychange',{});
assert.equal(installed.snapshot().active,false,'hidden document must clear active pointer');
assert.equal(installCancels,2,'hidden should synthesize cancel');
assert.equal(installLegacyPointerGuard(root),installed,'installer must be idempotent');
installed.destroy();

console.log('input guard tests: PASS');
