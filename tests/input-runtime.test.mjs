import assert from 'node:assert/strict';
import { createPointerInputRuntime } from '../pour-input-runtime.js';

const input = createPointerInputRuntime();

let r = input.pointerDown({ pointerId: 1, pointerType: 'touch', isPrimary: true });
assert.equal(r.accepted, true);
assert.equal(r.shouldCapture, true);
assert.equal(input.snapshot().pouring, true);

// A second finger must never steal the active pour pointer.
r = input.pointerDown({ pointerId: 2, pointerType: 'touch', isPrimary: false });
assert.equal(r.accepted, false);
assert.equal(input.snapshot().activePointerId, 1);

r = input.pointerMove({ pointerId: 2 });
assert.equal(r.accepted, false);
r = input.pointerMove({ pointerId: 1 });
assert.equal(r.accepted, true);

// Releasing a non-active finger must not stop the pour.
r = input.pointerUp({ pointerId: 2 });
assert.equal(r.stopped, false);
assert.equal(input.snapshot().pouring, true);

// Capture loss from the active finger must always stop pouring.
r = input.lostPointerCapture({ pointerId: 1 });
assert.equal(r.stopped, true);
assert.equal(r.reason, 'lost-capture');
assert.equal(input.snapshot().pouring, false);
assert.equal(input.snapshot().activePointerId, null);

// Right click should never start a mouse pour.
r = input.pointerDown({ pointerId: 3, pointerType: 'mouse', isPrimary: true, button: 2 });
assert.equal(r.accepted, false);

// Primary mouse press is valid.
r = input.pointerDown({ pointerId: 4, pointerType: 'mouse', isPrimary: true, button: 0 });
assert.equal(r.accepted, true);
assert.equal(input.snapshot().pouring, true);

// Page/system suspension must clear all pointer state even without pointerup.
r = input.suspend('blur');
assert.equal(r.stopped, true);
assert.equal(r.releasedPointerId, 4);
assert.equal(input.snapshot().pouring, false);
assert.equal(input.snapshot().activePointerId, null);

// Duplicate suspend is idempotent.
r = input.suspend('hidden');
assert.equal(r.stopped, false);

// pointercancel has the same fail-safe semantics.
input.pointerDown({ pointerId: 5, pointerType: 'pen', isPrimary: true });
r = input.pointerCancel({ pointerId: 5 });
assert.equal(r.stopped, true);
assert.equal(r.reason, 'cancel');
assert.equal(input.snapshot().pouring, false);

console.log('input runtime tests: PASS');
