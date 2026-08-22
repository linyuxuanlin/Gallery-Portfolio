import assert from 'node:assert/strict';
import { bindPourPointerInput } from '../pour-input-bindings.js';

class FakeTarget {
  constructor(){ this.listeners=new Map(); }
  addEventListener(type,fn){ if(!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type,fn){ this.listeners.get(type)?.delete(fn); }
  emit(type,event={}){ event.target ??= this; event.composedPath ??= ()=>[event.target]; for(const fn of this.listeners.get(type)||[]) fn(event); }
}
class FakeElement extends FakeTarget {
  constructor(){ super(); this.captured=[]; this.released=[]; this.captureSet=new Set(); }
  setPointerCapture(id){ this.captured.push(id); this.captureSet.add(id); }
  releasePointerCapture(id){ this.released.push(id); this.captureSet.delete(id); }
  hasPointerCapture(id){ return this.captureSet.has(id); }
}

const element=new FakeElement(),windowTarget=new FakeTarget();
const starts=[],moves=[],hovers=[],stops=[];
const binding=bindPourPointerInput(element,{
  windowTarget,
  canStart:()=>true,
  onStart:(e,s)=>starts.push([e.pointerId,s.pouring]),
  onMove:(e)=>moves.push(e.pointerId),
  onHover:(e)=>hovers.push([e.pointerId,e.pointerType]),
  onStop:(e,s,reason)=>stops.push([e?.pointerId??null,s.pouring,reason]),
});

element.emit('pointermove',{pointerId:90,pointerType:'mouse',isPrimary:true});
element.emit('pointermove',{pointerId:91,pointerType:'pen',isPrimary:true});
element.emit('pointermove',{pointerId:92,pointerType:'touch',isPrimary:true});
assert.deepEqual(hovers,[[90,'mouse'],[91,'pen']], 'desktop/pen hover should work without accepting passive touch movement');

const touch1={pointerId:1,pointerType:'touch',isPrimary:true};
const touch2={pointerId:2,pointerType:'touch',isPrimary:false};
element.emit('pointerdown',touch1);
assert.deepEqual(starts,[[1,true]]);
assert.deepEqual(element.captured,[1]);

element.emit('pointermove',touch2);
assert.equal(moves.length,0,'secondary pointer must not move target');
assert.equal(hovers.length,2,'secondary touch must not be treated as hover');
element.emit('pointerdown',touch2);
assert.equal(starts.length,1,'secondary pointer must not steal control');
element.emit('pointerup',touch2);
assert.equal(stops.length,0,'wrong pointer up must not stop pour');

element.emit('pointermove',touch1);
assert.deepEqual(moves,[1]);
windowTarget.emit('pointerup',{pointerId:1,pointerType:'touch',target:{}});
assert.deepEqual(stops.at(-1),[1,false,'off-canvas']);
assert.deepEqual(element.released,[1]);
assert.equal(binding.runtime.snapshot().hasActivePointer,false);

const touch3={pointerId:3,pointerType:'touch',isPrimary:true};
element.emit('pointerdown',touch3);
windowTarget.emit('pointerup',{pointerId:3,pointerType:'touch',target:element,composedPath:()=>[element,windowTarget]});
assert.equal(binding.runtime.snapshot().hasActivePointer,true,'normal canvas release must not be intercepted by window fallback');
element.emit('pointerup',touch3);
assert.deepEqual(stops.at(-1),[3,false,'up']);
assert.deepEqual(element.released,[1,3]);

element.emit('pointerdown',{pointerId:4,pointerType:'mouse',isPrimary:true,button:2});
assert.equal(starts.length,2,'right mouse button must not start pour');

element.emit('pointerdown',{pointerId:5,pointerType:'mouse',isPrimary:true,button:0});
assert.equal(starts.length,3);
binding.suspend('hidden');
assert.deepEqual(stops.at(-1),[null,false,'hidden']);
assert.deepEqual(element.released,[1,3,5]);
assert.equal(binding.runtime.snapshot().hasActivePointer,false);

const stopCount=stops.length;
binding.suspend('hidden');
assert.equal(stops.length,stopCount,'repeated suspend must be idempotent');

binding.destroy();
assert.equal(binding.runtime.snapshot().pouring,false);
console.log('input bindings tests: PASS');
