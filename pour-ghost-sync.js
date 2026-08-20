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

export function summarizePauses(pauses) {
  const totalPauseMs = pauses.reduce((sum, p) => sum + p.duration, 0);
  return { count: pauses.length, totalPauseMs, longestPauseMs: pauses.reduce((m, p) => Math.max(m, p.duration), 0) };
}
