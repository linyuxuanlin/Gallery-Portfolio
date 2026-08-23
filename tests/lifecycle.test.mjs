import assert from 'node:assert/strict';
import { createLifecycleClock, createPageLifecycleController } from '../pour-lifecycle.js';
import { createFlowRuntime } from '../pour-flow-runtime.js';

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

{
  let t = 0;
  const flow = createFlowRuntime({ controlFlow: 6, targetWater: 250 });
  let state;
  for (let i = 0; i < 90; i++) state = flow.step(1 / 60, true);
  assert.ok(state.actualFlow > 5, 'precondition: active stream before lifecycle suspend');
  const waterBefore = state.water;

  const clock = createLifecycleClock(() => t);
  clock.start();
  const lifecycle = createPageLifecycleController({ clock, now: () => t });
  t = 1500;
  const suspended = lifecycle.suspend('hidden');
  assert.equal(suspended.changed, true);
  assert.ok(suspended.flowStates.length >= 1, 'lifecycle should settle registered flow runtimes');
  state = flow.snapshot(false);
  assert.equal(state.actualFlow, 0, 'lifecycle suspend must clear residual flow');
  assert.equal(state.streamRadius, 0, 'lifecycle suspend must hide stream geometry input');
  assert.equal(state.tilt, 0, 'lifecycle suspend must return kettle tilt to neutral');
  assert.equal(state.water, waterBefore, 'lifecycle suspend must not integrate hidden-time water');

  t = 61500;
  lifecycle.resume('visible');
  const resumedIdle = flow.step(1 / 60, false);
  assert.equal(resumedIdle.actualFlow, 0, 'first visible idle frame must not resurrect old tail');
  assert.equal(resumedIdle.water, waterBefore, 'resume must preserve scale water');
  flow.dispose();
}

console.log('lifecycle tests: PASS');
