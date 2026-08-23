import { stepFlow, flowToTilt, streamRadiusForFlow, integrateFlowSegment } from './pour-flow-physics.js';

const activeFlowRuntimes = new Set();

export function activeFlowSnapshot() {
  for (const runtime of activeFlowRuntimes) {
    try {
      return runtime.snapshot(false);
    } catch {}
  }
  return null;
}

export function activeFlowTilt() {
  return Number(activeFlowSnapshot()?.tilt) || 0;
}

export function setActiveFlowTargetWater(value) {
  const states = [];
  for (const runtime of activeFlowRuntimes) {
    try {
      states.push(runtime.setTargetWater(value));
    } catch {}
  }
  return states;
}

export function suspendAllFlowRuntimes() {
  const states = [];
  for (const runtime of activeFlowRuntimes) {
    try {
      states.push(runtime.suspend());
    } catch {}
  }
  return states;
}

export function createFlowRuntime({ controlFlow = 5, targetWater = 250 } = {}) {
  let actualFlow = 0;
  let targetFlow = Number(controlFlow) || 0;
  let water = 0;
  let waterTarget = Math.max(1, Number(targetWater) || 250);
  let targetReached = false;

  function makeState(inputPouring = false, addedWater = 0) {
    const settled = targetReached && actualFlow <= 0;
    return {
      controlFlow: targetFlow,
      actualFlow,
      visibleFlow: actualFlow,
      streamRadius: streamRadiusForFlow(actualFlow),
      tilt: flowToTilt(actualFlow),
      water,
      targetWater: waterTarget,
      progress: Math.min(1, water / waterTarget),
      addedWater,
      inputPouring: Boolean(inputPouring),
      pouring: Boolean(inputPouring) && !targetReached,
      complete: settled,
      targetReached,
      tailActive: targetReached && actualFlow > 0,
      settled,
    };
  }

  const runtime = {
    setControlFlow(value) {
      targetFlow = Math.max(0, Number(value) || 0);
      return targetFlow;
    },
    setTargetWater(value) {
      const next = Math.max(1, Number(value) || waterTarget);
      waterTarget = next;
      if (water >= waterTarget - 1e-9) {
        water = waterTarget;
        targetReached = true;
      } else {
        targetReached = false;
      }
      return makeState(false, 0);
    },
    reset({ water: nextWater = 0, actualFlow: nextFlow = 0, controlFlow: nextControl = targetFlow } = {}) {
      water = Math.max(0, Math.min(waterTarget, Number(nextWater) || 0));
      actualFlow = Math.max(0, Number(nextFlow) || 0);
      targetFlow = Math.max(0, Number(nextControl) || 0);
      targetReached = water >= waterTarget - 1e-9;
      return makeState(false, 0);
    },
    suspend() {
      actualFlow = 0;
      return makeState(false, 0);
    },
    step(dt, inputPouring) {
      const safeDt = Math.max(0, Number(dt) || 0);
      const previousFlow = actualFlow;
      const previousWater = water;
      const effectivePouring = Boolean(inputPouring) && !targetReached;

      if (!effectivePouring) {
        actualFlow = stepFlow(actualFlow, targetFlow, false, safeDt);
        const integrated = integrateFlowSegment(water, previousFlow, actualFlow, safeDt, waterTarget);
        water = integrated.water;
        if (water >= waterTarget - 1e-9) targetReached = true;
        return makeState(inputPouring, integrated.added);
      }

      const fullFrameFlow = stepFlow(actualFlow, targetFlow, true, safeDt);
      const fullFrame = integrateFlowSegment(water, previousFlow, fullFrameFlow, safeDt, waterTarget);
      const remainingMass = Math.max(0, waterTarget - water);

      if (fullFrame.added + 1e-12 < remainingMass) {
        actualFlow = fullFrameFlow;
        water = fullFrame.water;
        return makeState(inputPouring, fullFrame.added);
      }

      let lo = 0;
      let hi = safeDt;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) * 0.5;
        const midFlow = stepFlow(previousFlow, targetFlow, true, mid);
        const midMass = (previousFlow + midFlow) * 0.5 * mid;
        if (midMass < remainingMass) lo = mid;
        else hi = mid;
      }
      const crossingDt = hi;
      const releaseDt = safeDt - crossingDt;
      const flowAtCrossing = stepFlow(previousFlow, targetFlow, true, crossingDt);
      actualFlow = stepFlow(flowAtCrossing, targetFlow, false, releaseDt);
      water = waterTarget;
      targetReached = true;
      return makeState(inputPouring, Math.max(0, waterTarget - previousWater));
    },
    snapshot(inputPouring = false) {
      return makeState(inputPouring, 0);
    },
    dispose() {
      activeFlowRuntimes.delete(runtime);
    },
  };

  activeFlowRuntimes.add(runtime);
  return runtime;
}
