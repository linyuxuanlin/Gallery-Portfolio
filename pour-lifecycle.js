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
} = {}) {
  let suspended = false;
  let suspendedAt = 0;

  function suspend(reason = 'hidden', at = now()) {
    if (suspended) return { changed: false, suspended, reason, at: suspendedAt };
    suspended = true;
    suspendedAt = at;
    clock?.pause?.(at);
    onSuspend({ reason, at });
    return { changed: true, suspended, reason, at };
  }

  function resume(reason = 'visible', at = now()) {
    if (!suspended) return { changed: false, suspended, reason, at };
    const hiddenMs = Math.max(0, at - suspendedAt);
    suspended = false;
    clock?.resume?.(at);
    onResume({ reason, at, hiddenMs });
    return { changed: true, suspended, reason, at, hiddenMs };
  }

  function isSuspended() {
    return suspended;
  }

  return { suspend, resume, isSuspended };
}
