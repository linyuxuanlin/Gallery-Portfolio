import assert from 'node:assert/strict';
import { createLifecycleClock, createPageLifecycleController } from '../pour-lifecycle.js';

{
  let t = 1000;
  const clock = createLifecycleClock(() => t);
  clock.start();
  t = 6000;
  assert.equal(clock.elapsed(), 5000);
  clock.pause();
  t = 66000;
  assert.equal(clock.elapsed(), 5000, 'background time must not advance training clock');
  clock.resume();
  t = 71000;
  assert.equal(clock.elapsed(), 10000, 'clock resumes from previous active elapsed time');
}

{
  let t = 0;
  let suspended = 0;
  let resumed = 0;
  let hiddenMs = 0;
  const clock = createLifecycleClock(() => t);
  clock.start();
  const lifecycle = createPageLifecycleController({
    clock,
    now: () => t,
    onSuspend: () => suspended++,
    onResume: e => { resumed++; hiddenMs = e.hiddenMs; },
  });
  t = 1000;
  assert.equal(lifecycle.suspend('hidden').changed, true);
  assert.equal(lifecycle.suspend('blur').changed, false, 'duplicate suspend must be idempotent');
  t = 61000;
  assert.equal(lifecycle.resume('visible').changed, true);
  assert.equal(lifecycle.resume('focus').changed, false, 'duplicate resume must be idempotent');
  assert.equal(suspended, 1);
  assert.equal(resumed, 1);
  assert.equal(hiddenMs, 60000);
  assert.equal(clock.elapsed(), 1000);
}

{
  const clock = createLifecycleClock(() => 0);
  clock.start(0);
  clock.pause(500);
  clock.resume(400); // defensive against non-monotonic timestamps
  assert.equal(clock.snapshot(400).pausedTotal, 0);
  assert.equal(clock.elapsed(1000), 1000);
}

console.log('lifecycle tests: PASS');
