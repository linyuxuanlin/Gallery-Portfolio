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
// 70% rewards timing accuracy of matched pauses; 30% rewards reproducing the right pause count.
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
