// POUR Lab Ghost synchronization helpers.
// Pure functions: browser/Three.js independent so they can be unit-tested cheaply.

export function detectPauseSegments(samples, options = {}) {
  const minPauseMs = options.minPauseMs ?? 700;
  const waterEpsilon = options.waterEpsilon ?? 0.35;
  if (!Array.isArray(samples) || samples.length < 2) return [];

  const pauses = [];
  let start = null;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    const paused = !a.pouring && !b.pouring && Math.abs((b.water ?? 0) - (a.water ?? 0)) <= waterEpsilon;
    if (paused && start === null) start = i - 1;
    const ends = start !== null && (!paused || i === samples.length - 1);
    if (ends) {
      const end = paused && i === samples.length - 1 ? i : i - 1;
      const duration = samples[end].t - samples[start].t;
      if (duration >= minPauseMs) pauses.push({
        startT: samples[start].t,
        endT: samples[end].t,
        duration,
        water: (samples[start].water + samples[end].water) / 2,
        x: samples[start].x,
        z: samples[start].z
      });
      start = null;
    }
  }
  return pauses;
}

export function activePauseAtWater(pauses, water, tolerance = 1.2) {
  if (!Array.isArray(pauses)) return null;
  let best = null, bestDelta = Infinity;
  for (const pause of pauses) {
    const delta = Math.abs(pause.water - water);
    if (delta <= tolerance && delta < bestDelta) { best = pause; bestDelta = delta; }
  }
  return best;
}

// Hysteretic pause selection for live UI. Enter with a tight window, but keep the
// current pause active until a wider exit window is crossed. This prevents PAUSE
// HUD flicker when cumulative water jitters around a boundary.
export function stablePauseAtWater(pauses, water, currentPause = null, options = {}) {
  const enterTolerance = options.enterTolerance ?? 1.2;
  const exitTolerance = Math.max(enterTolerance, options.exitTolerance ?? 2.0);
  if (currentPause && Math.abs((currentPause.water ?? 0) - water) <= exitTolerance) return currentPause;
  return activePauseAtWater(pauses, water, enterTolerance);
}

export function pauseProgress(pause, currentPauseMs) {
  if (!pause || pause.duration <= 0) return 1;
  return Math.max(0, Math.min(1, currentPauseMs / pause.duration));
}

export function pauseTimingScore(referenceMs, actualMs) {
  if (!Number.isFinite(referenceMs) || referenceMs <= 0 || !Number.isFinite(actualMs)) return 0;
  const relativeError = Math.abs(actualMs - referenceMs) / referenceMs;
  return Math.max(0, 1 - relativeError / 0.65);
}

// Converts a reference pause and the trainee's live state into a UI-safe cue.
// `actualPauseMs` should count only time spent not pouring while inside the pause water window.
export function evaluatePauseCue(pause, actualPauseMs, isPouring) {
  if (!pause) return { state: 'none', progress: 0, remainingMs: 0, score: null };
  const elapsed = Math.max(0, Number(actualPauseMs) || 0);
  const remainingMs = Math.max(0, pause.duration - elapsed);
  const progress = pauseProgress(pause, elapsed);

  if (isPouring && elapsed === 0) {
    return { state: 'pause-now', progress: 0, remainingMs: pause.duration, score: null };
  }
  if (!isPouring && remainingMs > 0) {
    return { state: 'holding', progress, remainingMs, score: null };
  }
  if (!isPouring && remainingMs === 0) {
    return { state: 'ready', progress: 1, remainingMs: 0, score: pauseTimingScore(pause.duration, elapsed) };
  }
  const score = pauseTimingScore(pause.duration, elapsed);
  return {
    state: elapsed < pause.duration * 0.78 ? 'resumed-early' : elapsed > pause.duration * 1.35 ? 'resumed-late' : 'matched',
    progress,
    remainingMs,
    score
  };
}

export function summarizePauses(pauses) {
  const safe = Array.isArray(pauses) ? pauses : [];
  const totalPauseMs = safe.reduce((sum, p) => sum + p.duration, 0);
  return { count: safe.length, totalPauseMs, longestPauseMs: safe.reduce((m, p) => Math.max(m, p.duration), 0) };
}

// One-to-one, monotonic matching of pause sequences by cumulative water.
// This avoids a long actual pause accidentally satisfying two nearby reference pauses.
export function matchPauseSequences(referencePauses, actualPauses, options = {}) {
  const refs = Array.isArray(referencePauses) ? referencePauses : [];
  const acts = Array.isArray(actualPauses) ? actualPauses : [];
  const waterTolerance = options.waterTolerance ?? 3;
  const matches = [];
  const missed = [];
  let actualIndex = 0;

  for (let refIndex = 0; refIndex < refs.length; refIndex++) {
    const ref = refs[refIndex];
    let bestIndex = -1, bestDelta = Infinity;
    for (let i = actualIndex; i < acts.length; i++) {
      const delta = Math.abs((acts[i].water ?? 0) - (ref.water ?? 0));
      if (delta <= waterTolerance && delta < bestDelta) {
        bestIndex = i;
        bestDelta = delta;
      }
      // Pauses are water-ordered; once we are clearly past the reference window, stop scanning.
      if ((acts[i].water ?? 0) > (ref.water ?? 0) + waterTolerance) break;
    }

    if (bestIndex < 0) {
      missed.push({ refIndex, reference: ref });
      continue;
    }

    const actual = acts[bestIndex];
    matches.push({
      refIndex,
      actualIndex: bestIndex,
      reference: ref,
      actual,
      waterDelta: Math.abs((actual.water ?? 0) - (ref.water ?? 0)),
      timingScore: pauseTimingScore(ref.duration, actual.duration)
    });
    actualIndex = bestIndex + 1;
  }

  const used = new Set(matches.map(m => m.actualIndex));
  const extra = acts.map((actual, index) => ({ actualIndex: index, actual })).filter(x => !used.has(x.actualIndex));
  return { matches, missed, extra };
}

// Returns a normalized 0..1 score for the complete pause pattern.
// Kept for callers that explicitly want a numeric score even when the reference has no pauses.
export function pauseSequenceScore(referencePauses, actualPauses, options = {}) {
  const refs = Array.isArray(referencePauses) ? referencePauses : [];
  const acts = Array.isArray(actualPauses) ? actualPauses : [];
  if (!refs.length) return acts.length ? 0.7 : 1;

  const result = matchPauseSequences(refs, acts, options);
  const timing = result.matches.length
    ? result.matches.reduce((sum, m) => sum + m.timingScore, 0) / result.matches.length
    : 0;
  const countPenalty = (result.missed.length + result.extra.length) / Math.max(refs.length, acts.length, 1);
  const structure = Math.max(0, 1 - countPenalty);
  return Math.max(0, Math.min(1, timing * 0.7 + structure * 0.3));
}

// Product-facing rhythm result. A reference cup with no meaningful pauses is
// "not applicable", not a perfect 100. This prevents misleading result cards and
// lets the overall Ghost score renormalize around path/flow instead.
export function rhythmAssessment(referencePauses, actualPauses, options = {}) {
  const refs = Array.isArray(referencePauses) ? referencePauses : [];
  const acts = Array.isArray(actualPauses) ? actualPauses : [];
  if (!refs.length) {
    return {
      applicable: false,
      score: null,
      reason: 'no-reference-pauses',
      referenceCount: 0,
      actualCount: acts.length,
      matches: [],
      missed: [],
      extra: acts.map((actual, actualIndex) => ({ actualIndex, actual }))
    };
  }
  const detail = matchPauseSequences(refs, acts, options);
  return {
    applicable: true,
    score: pauseSequenceScore(refs, acts, options),
    reason: null,
    referenceCount: refs.length,
    actualCount: acts.length,
    ...detail
  };
}

// Weighted average that ignores unavailable metrics instead of silently treating
// them as perfect. Useful for Ghost result scoring where rhythm may be N/A.
export function weightedAvailableScore(metrics) {
  const items = Array.isArray(metrics) ? metrics : [];
  let weighted = 0, totalWeight = 0;
  for (const item of items) {
    const value = item?.value;
    const weight = Number(item?.weight) || 0;
    if (!Number.isFinite(value) || weight <= 0) continue;
    weighted += Math.max(0, Math.min(1, value)) * weight;
    totalWeight += weight;
  }
  return totalWeight ? weighted / totalWeight : null;
}
