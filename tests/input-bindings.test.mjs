import assert from 'node:assert/strict';
import { bindPourPointerInput } from '../pour-input-bindings.js';

class FakeElement {
  constructor(){ this.listeners=new Map(); this.captured=[]; }
  addEventListener(type,fn){ if(!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type,fn){ this.listeners.get(type)?.delete(fn); }
  emit(type,event){ for(const fn of this.listeners.get(type)||[]) fn(event); }
  setPointerCapture(id){ this.captured.push(id); }
}

const element=new FakeElement();
const starts=[],moves=[],stops=[];
const binding=bindPourPointerInput(element,{
  canStart:()=>true,
  onStart:(e,s)=>starts.push([e.pointerId,s.pouring]),
  onMove:(e)=>moves.push(e.pointerId),
  onStop:(e,s,reason)=>stops.push([e?.pointerId??null,s.pouring,reason]),
});

const touch1={pointerId:1,pointerType:'touch',isPrimary:true};
const touch2={pointerId:2,pointerType:'touch',isPrimary:false};
element.emit('pointerdown',touch1);
assert.deepEqual(starts,[[1,true]]);
assert.deepEqual(element.captured,[1]);

element.emit('pointermove',touch2);
assert.equal(moves.length,0,'secondary pointer must not move target');
element.emit('pointerdown',touch2);
assert.equal(starts.length,1,'secondary pointer must not steal control');
element.emit('pointerup',touch2);
assert.equal(stops.length,0,'wrong pointer up must not stop pour');

element.emit('pointermove',touch1);
assert.deepEqual(moves,[1]);
element.emit('lostpointercapture',touch1);
assert.deepEqual(stops.at(-1),[1,false,'lost-capture']);
assert.equal(binding.runtime.snapshot().hasActivePointer,false);

element.emit('pointerdown',{pointerId:3,pointerType:'mouse',isPrimary:true,button:2});
assert.equal(starts.length,1,'right mouse button must not start pour');

element.emit('pointerdown',{pointerId:4,pointerType:'mouse',isPrimary:true,button:0});
assert.equal(starts.length,2);
binding.suspend('hidden');
assert.deepEqual(stops.at(-1),[null,false,'hidden']);
assert.equal(binding.runtime.snapshot().hasActivePointer,false);

binding.destroy();
assert.equal(binding.runtime.snapshot().pouring,false);
console.log('input bindings tests: PASS');
