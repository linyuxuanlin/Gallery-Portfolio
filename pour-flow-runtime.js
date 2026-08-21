import { stepFlow, flowToTilt, integrateWater } from './pour-flow-physics.js';

export function createFlowRuntime({ controlFlow = 5, targetWater = 250 } = {}) {
  let actualFlow = 0;
  let targetFlow = Number(controlFlow) || 0;
  let water = 0;

  return {
    setControlFlow(value) {
      targetFlow = Math.max(0, Number(value) || 0);
      return targetFlow;
    },
    reset({ water: nextWater = 0, actualFlow: nextFlow = 0, controlFlow: nextControl = targetFlow } = {}) {
      water = Math.max(0, Number(nextWater) || 0);
      actualFlow = Math.max(0, Number(nextFlow) || 0);
      targetFlow = Math.max(0, Number(nextControl) || 0);
      return this.snapshot(false);
    },
    step(dt, pouring) {
      actualFlow = stepFlow(actualFlow, targetFlow, pouring, dt);
      const integrated = integrateWater(water, actualFlow, dt, targetWater);
      water = integrated.water;
      return {
        controlFlow: targetFlow,
        actualFlow,
        visibleFlow: actualFlow,
        tilt: flowToTilt(actualFlow),
        water,
        addedWater: integrated.added,
        pouring: Boolean(pouring),
        complete: water >= targetWater - 1e-9,
      };
    },
    snapshot(pouring = false) {
      return {
        controlFlow: targetFlow,
        actualFlow,
        visibleFlow: actualFlow,
        tilt: flowToTilt(actualFlow),
        water,
        addedWater: 0,
        pouring: Boolean(pouring),
        complete: water >= targetWater - 1e-9,
      };
    },
  };
}
