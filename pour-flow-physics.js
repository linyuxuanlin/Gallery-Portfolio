export const DEFAULT_FLOW_PHYSICS = Object.freeze({
  attackTau: 0.32,
  releaseTau: 0.18,
  maxSlewUp: 9.0,
  maxSlewDown: 14.0,
  minVisibleFlow: 0.08,
});

export function exponentialStep(current, target, dt, tau) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return 0;
  if (!Number.isFinite(dt) || dt <= 0) return current;
  if (!Number.isFinite(tau) || tau <= 0) return target;
  const alpha = 1 - Math.exp(-dt / tau);
  return current + (target - current) * alpha;
}

export function slewLimit(current, desired, dt, upPerSec, downPerSec) {
  if (!Number.isFinite(dt) || dt <= 0) return current;
  const delta = desired - current;
  const limit = delta >= 0 ? upPerSec * dt : downPerSec * dt;
  if (!Number.isFinite(limit) || limit < 0) return desired;
  if (Math.abs(delta) <= limit) return desired;
  return current + Math.sign(delta) * limit;
}

export function stepFlow(currentFlow, controlFlow, pouring, dt, options = {}) {
  const cfg = { ...DEFAULT_FLOW_PHYSICS, ...options };
  const target = pouring ? Math.max(0, Number(controlFlow) || 0) : 0;
  const tau = target > currentFlow ? cfg.attackTau : cfg.releaseTau;
  const desired = exponentialStep(Math.max(0, currentFlow || 0), target, dt, tau);
  const next = slewLimit(
    Math.max(0, currentFlow || 0),
    desired,
    dt,
    cfg.maxSlewUp,
    cfg.maxSlewDown,
  );
  return Math.max(0, next < cfg.minVisibleFlow && !pouring ? 0 : next);
}

export function flowToTilt(flow, minFlow = 2, maxFlow = 8) {
  const f = Math.min(maxFlow, Math.max(0, Number(flow) || 0));
  if (f <= 0) return 0;
  if (f < minFlow) return -0.085 * (f / Math.max(0.001, minFlow));
  const u = Math.min(1, Math.max(0, (f - minFlow) / Math.max(0.001, maxFlow - minFlow)));
  return -(0.085 + u * 0.185);
}

// Approximate visible stream radius from volumetric flow. At similar exit
// velocity, flow is proportional to cross-sectional area, so radius should
// grow roughly with sqrt(flow) instead of linearly. The clamp keeps tiny tail
// flow visible without letting high flow become cartoonishly thick.
export function streamRadiusForFlow(flow, {
  minVisibleFlow = DEFAULT_FLOW_PHYSICS.minVisibleFlow,
  referenceFlow = 5,
  referenceRadius = 0.0205,
  minRadius = 0.0085,
  maxRadius = 0.0265,
} = {}) {
  const f = Math.max(0, Number(flow) || 0);
  if (f < minVisibleFlow) return 0;
  const safeRefFlow = Math.max(0.001, Number(referenceFlow) || 5);
  const safeRefRadius = Math.max(0, Number(referenceRadius) || 0);
  const radius = safeRefRadius * Math.sqrt(f / safeRefFlow);
  return Math.min(maxRadius, Math.max(minRadius, radius));
}

export function integrateWater(water, flow, dt, target = Infinity) {
  const safeWater = Math.max(0, Number(water) || 0);
  const safeFlow = Math.max(0, Number(flow) || 0);
  const safeDt = Math.max(0, Number(dt) || 0);
  const added = Math.min(safeFlow * safeDt, Math.max(0, target - safeWater));
  return { water: safeWater + added, added };
}

// Integrate a frame whose flow changes from startFlow to endFlow.
// Using the trapezoidal average prevents startup/release water from depending
// materially on display refresh rate while retaining the same flow response.
export function integrateFlowSegment(water, startFlow, endFlow, dt, target = Infinity) {
  const a = Math.max(0, Number(startFlow) || 0);
  const b = Math.max(0, Number(endFlow) || 0);
  return integrateWater(water, (a + b) * 0.5, dt, target);
}
