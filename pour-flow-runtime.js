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
      const previousFlow = actualFlow;
      // Once the scale target has been reached the kettle input is latched off.
      // The existing stream still decays naturally, so the scene can show a
      // short physical tail without adding mass beyond the target reading.
      const effectivePouring = Boolean(inputPouring) && !targetReached;
      actualFlow = stepFlow(actualFlow, targetFlow, effectivePouring, dt);
      const integrated = integrateFlowSegment(water, previousFlow, actualFlow, dt, targetWater);
      water = integrated.water;
      if (water >= targetWater - 1e-9) targetReached = true;
      return makeState(inputPouring, integrated.added);
    },
    snapshot(inputPouring = false) {
      return makeState(inputPouring, 0);
    },
  };
}
