import { stepFlow, flowToTilt, streamRadiusForFlow, integrateFlowSegment } from './pour-flow-physics.js';

export function createFlowRuntime({ controlFlow = 5, targetWater = 250 } = {}) {
  let actualFlow = 0;
  let targetFlow = Number(controlFlow) || 0;
  let water = 0;
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
      addedWater,
      inputPouring: Boolean(inputPouring),
      pouring: Boolean(inputPouring) && !targetReached,
      // Reaching the scale target and completing the physical pour are
      // intentionally separate. The scale can lock at targetWater while a
      // short residual stream is still visible. UI/recording should keep
      // updating until that tail has fully settled.
      complete: settled,
      targetReached,
      tailActive: targetReached && actualFlow > 0,
      settled,
    };
  }

  return {
    setControlFlow(value) {
      targetFlow = Math.max(0, Number(value) || 0);
      return targetFlow;
    },
    reset({ water: nextWater = 0, actualFlow: nextFlow = 0, controlFlow: nextControl = targetFlow } = {}) {
      water = Math.max(0, Math.min(targetWater, Number(nextWater) || 0));
      actualFlow = Math.max(0, Number(nextFlow) || 0);
      targetFlow = Math.max(0, Number(nextControl) || 0);
      targetReached = water >= targetWater - 1e-9;
      return makeState(false, 0);
    },
    step(dt, inputPouring) {
      const safeDt = Math.max(0, Number(dt) || 0);
      const previousFlow = actualFlow;
      const previousWater = water;
      const effectivePouring = Boolean(inputPouring) && !targetReached;

      if (!effectivePouring) {
        actualFlow = stepFlow(actualFlow, targetFlow, false, safeDt);
        const integrated = integrateFlowSegment(water, previousFlow, actualFlow, safeDt, targetWater);
        water = integrated.water;
        if (water >= targetWater - 1e-9) targetReached = true;
        return makeState(inputPouring, integrated.added);
      }

      const fullFrameFlow = stepFlow(actualFlow, targetFlow, true, safeDt);
      const fullFrame = integrateFlowSegment(water, previousFlow, fullFrameFlow, safeDt, targetWater);
      const remainingMass = Math.max(0, targetWater - water);

      if (fullFrame.added + 1e-12 < remainingMass) {
        actualFlow = fullFrameFlow;
        water = fullFrame.water;
        return makeState(inputPouring, fullFrame.added);
      }

      // The target can be crossed partway through a display frame. Solve for
      // that instant, latch kettle input off there, then spend the remainder of
      // the frame in release. This keeps target-tail momentum independent of
      // display frame boundaries instead of waiting until the next frame.
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
      water = targetWater;
      targetReached = true;
      return makeState(inputPouring, Math.max(0, targetWater - previousWater));
    },
    snapshot(inputPouring = false) {
      return makeState(inputPouring, 0);
    },
  };
}
