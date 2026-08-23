import { POUR_SPATIAL_CALIBRATION, nozzlePositionForTargetAtTilt } from './pour-spatial-calibration.js';
import { flowToTilt } from './pour-flow-physics.js';
import { ballisticFlight, sampleBallisticArc, arcSagFromChord } from './pour-stream-physics.js';

export const STREAM_CALIBRATION_FLOWS = Object.freeze([2,4,6,8]);

export function auditStreamCalibration({
  flows = STREAM_CALIBRATION_FLOWS,
  calibration = POUR_SPATIAL_CALIBRATION,
  target = {x:0,y:POUR_SPATIAL_CALIBRATION.bedY,z:0},
} = {}) {
  const rows = flows.map(flow => {
    const tilt = flowToTilt(flow);
    const nozzle = nozzlePositionForTargetAtTilt(target, tilt, calibration);
    const flight = ballisticFlight({startY:nozzle.y,endY:target.y,flow});
    const arc = sampleBallisticArc(nozzle,target,flow,{segments:24});
    return {
      flow,
      tilt,
      nozzle,
      clearance:nozzle.y-target.y,
      horizontal:Math.hypot(nozzle.x-target.x,nozzle.z-target.z),
      flightTime:flight.time,
      sag:arcSagFromChord(arc),
      endError:Math.hypot(
        arc.at(-1).x-target.x,
        arc.at(-1).y-target.y,
        arc.at(-1).z-target.z,
      ),
    };
  });

  const monotonicFlight = rows.every((row,index) => index===0 || row.flightTime < rows[index-1].flightTime);
  const monotonicSag = rows.every((row,index) => index===0 || row.sag < rows[index-1].sag);
  const stableClearance = Math.max(...rows.map(row=>row.clearance)) - Math.min(...rows.map(row=>row.clearance)) < 1e-9;
  const stableHorizontal = Math.max(...rows.map(row=>row.horizontal)) - Math.min(...rows.map(row=>row.horizontal)) < 1e-9;
  const allHitTarget = rows.every(row=>row.endError < 1e-9);
  const flightRangeOk = rows.every(row=>row.flightTime>=0.72 && row.flightTime<=0.95);
  const sagRangeOk = rows.every(row=>row.sag>=0.40 && row.sag<=0.58);

  return {
    valid: monotonicFlight && monotonicSag && stableClearance && stableHorizontal && allHitTarget && flightRangeOk && sagRangeOk,
    rows,
    checks:{
      monotonicFlight,
      monotonicSag,
      stableClearance,
      stableHorizontal,
      allHitTarget,
      flightRangeOk,
      sagRangeOk,
    },
  };
}
