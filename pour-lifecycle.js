import { installBrewInsights } from './pour-brew-insights.js';
import { installBrewHistory, prepareGhostReferenceForBoot } from './pour-brew-history.js';
import { installBrewTrend } from './pour-brew-trend-panel.js';
import { installTrainingPlan } from './pour-training-plan-panel.js';
import { installReplayVisualization } from './pour-replay-visualization.js';
import { installGhostDeviation } from './pour-ghost-deviation.js';
import { suspendAllFlowRuntimes } from './pour-flow-runtime.js';
import { clearPendingLifecycleBreaks, recordLifecycleBreak } from './pour-replay-breaks.js';
import { installReplayBreakPersistence } from './pour-replay-break-persistence.js';

export function createLifecycleClock(now = () => performance.now()) {
  let startedAt = 0;
  let pausedAt = 0;
  let pausedTotal = 0;
  let running = false;

  function start(at = now()) {
    startedAt = at;
    pausedAt = 0;
    pausedTotal = 0;
    running = true;
    return snapshot(at);
  }

  function pause(at = now()) {
    if (!running || pausedAt) return snapshot(at);
    pausedAt = at;
    return snapshot(at);
  }

  function resume(at = now()) {
    if (!running || !pausedAt) return snapshot(at);
    pausedTotal += Math.max(0, at - pausedAt);
    pausedAt = 0;
    return snapshot(at);
  }

  function elapsed(at = now()) {
    if (!running) return 0;
    const effectiveNow = pausedAt || at;
    return Math.max(0, effectiveNow - startedAt - pausedTotal);
  }

  function snapshot(at = now()) {
    return {
      running,
      paused: !!pausedAt,
      startedAt,
      pausedAt,
      pausedTotal,
      elapsed: elapsed(at),
    };
  }

  function reset() {
    startedAt = 0;
    pausedAt = 0;
    pausedTotal = 0;
    running = false;
    return snapshot(0);
  }

  return { start, pause, resume, elapsed, snapshot, reset };
}

export function createPageLifecycleController({
  clock,
  onSuspend = () => {},
  onResume = () => {},
  now = () => performance.now(),
  breakStorage = globalThis.sessionStorage,
} = {}) {
  let suspended = false;
  let suspendedAt = 0;
  let suspendedElapsed = null;
  let suspendReason = 'hidden';
  clearPendingLifecycleBreaks(breakStorage);

  function suspend(reason = 'hidden', at = now()) {
    if (suspended) return { changed: false, suspended, reason, at: suspendedAt };
    const before = clock?.snapshot?.(at);
    suspendedElapsed = before?.running ? before.elapsed : null;
    suspendReason = reason;
    suspended = true;
    suspendedAt = at;
    clock?.pause?.(at);
    const flowStates = suspendAllFlowRuntimes();
    onSuspend({ reason, at, flowStates });
    return { changed: true, suspended, reason, at, flowStates };
  }

  function resume(reason = 'visible', at = now()) {
    if (!suspended) return { changed: false, suspended, reason, at };
    const hiddenMs = Math.max(0, at - suspendedAt);
    suspended = false;
    clock?.resume?.(at);
    if (suspendedElapsed !== null) {
      recordLifecycleBreak({
        t: suspendedElapsed,
        hiddenMs,
        reason: suspendReason,
        recordedAt: Date.now(),
      }, breakStorage);
    }
    suspendedElapsed = null;
    onResume({ reason, at, hiddenMs });
    return { changed: true, suspended, reason, at, hiddenMs };
  }

  function isSuspended() {
    return suspended;
  }

  return { suspend, resume, isSuspended };
}

export async function registerPourServiceWorker(navigatorLike = globalThis.navigator) {
  const serviceWorker = navigatorLike?.serviceWorker;
  if (!serviceWorker?.register) return { supported: false, registration: null };
  try {
    const registration = await serviceWorker.register('./sw.js', { scope: './' });
    return { supported: true, registration };
  } catch (error) {
    console.warn('POUR Lab service worker registration failed', error);
    return { supported: true, registration: null, error };
  }
}

const bootGhostReference = typeof globalThis.localStorage !== 'undefined'
  ? prepareGhostReferenceForBoot(globalThis.localStorage)
  : { prepared: false, cleanup: () => false };
if (bootGhostReference.prepared) queueMicrotask(() => bootGhostReference.cleanup());

if (typeof document !== 'undefined') {
  queueMicrotask(() => {
    installReplayBreakPersistence(document, globalThis.localStorage, globalThis.sessionStorage);
    installBrewHistory(document, globalThis.localStorage);
    installBrewInsights(document, globalThis.localStorage);
    installReplayVisualization(document, globalThis.localStorage);
    installGhostDeviation(document, globalThis.localStorage);
    installBrewTrend(document, globalThis.localStorage);
    installTrainingPlan(document, globalThis.localStorage);
  });
  if (document.readyState === 'complete') {
    registerPourServiceWorker();
  } else {
    addEventListener('load', () => registerPourServiceWorker(), { once: true });
  }
}
