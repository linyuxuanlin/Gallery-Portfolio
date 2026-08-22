import assert from 'node:assert/strict';
import { bindLegacyPointerGuard } from '../pour-input-guard.js';

class MockElement {
  constructor(){ this.listeners = new Map(); }
  addEventListener(type, fn, capture=false){
    const list=this.listeners.get(type)||[]; list.push({fn,capture:!!capture}); this.listeners.set(type,list);
  }
  removeEventListener(type, fn, capture=false){
    const list=this.listeners.get(type)||[]; this.listeners.set(type,list.filter(x=>x.fn!==fn||x.capture!==!!capture));
  }
  dispatchEvent(event){ return this.emit(event.type,event); }
  emit(type,event={}){
    event.type=type; event.defaultPrevented=false; event.__stopped=false;
    event.preventDefault ??= ()=>{event.defaultPrevented=true};
    event.stopImmediatePropagation ??= ()=>{event.__stopped=true};
    const list=this.listeners.get(type)||[];
    for(const phase of [true,false]) for(const {fn,capture} of list){
      if(capture!==phase||event.__stopped) continue;
      fn(event);
    }
    return !event.defaultPrevented;
  }
}

const el=new MockElement();
let legacyDown=0,legacyMove=0,legacyCancel=0;
el.addEventListener('pointerdown',()=>legacyDown++);
el.addEventListener('pointermove',()=>legacyMove++);
el.addEventListener('pointercancel',()=>legacyCancel++);
const guard=bindLegacyPointerGuard(el);

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

el.emit('pointerdown',{pointerId:4,pointerType:'touch',button:0});
assert.equal(legacyDown,2);
assert.equal(guard.suspend(),true,'suspend should cancel active pointer');
assert.equal(legacyCancel,2,'suspend must reach legacy pointercancel handler');
assert.equal(guard.suspend(),false,'repeated suspend should be idempotent');

guard.destroy();
console.log('input guard tests: PASS');
