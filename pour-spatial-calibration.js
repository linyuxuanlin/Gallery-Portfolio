export const POUR_SPATIAL_CALIBRATION = Object.freeze({
  bedY: 1.18,
  bedRadius: 0.70,
  kettleBodyY: 3.15,
  kettleTargetOffsetX: 1.72,
  kettleTargetOffsetZ: 0.08,
  nozzleLocalX: -1.30,
  nozzleLocalY: 0.20,
  nozzleLocalZ: 0,
  minNozzleClearance: 1.65,
  maxNozzleClearance: 2.45,
  minHorizontalNozzleOffset: 0.18,
  maxHorizontalNozzleOffset: 0.65,
  maxPourTilt: -0.27,
});

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function rotatedNozzleLocal(tilt=0, calibration=POUR_SPATIAL_CALIBRATION){
  const angle=finite(tilt);
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const x=calibration.nozzleLocalX,y=calibration.nozzleLocalY;
  return {
    x:x*cos-y*sin,
    y:x*sin+y*cos,
    z:calibration.nozzleLocalZ,
  };
}

export function kettlePositionForTarget(target, calibration=POUR_SPATIAL_CALIBRATION){
  return {
    x: finite(target?.x)+calibration.kettleTargetOffsetX,
    y: calibration.kettleBodyY,
    z: finite(target?.z)+calibration.kettleTargetOffsetZ,
  };
}

export function nozzlePositionForTarget(target, calibration=POUR_SPATIAL_CALIBRATION){
  const kettle=kettlePositionForTarget(target,calibration);
  return {
    x:kettle.x+calibration.nozzleLocalX,
    y:kettle.y+calibration.nozzleLocalY,
    z:kettle.z+calibration.nozzleLocalZ,
  };
}

// Keep the nozzle tip spatially anchored while the kettle body rotates around Z.
// Without this compensation the current long gooseneck can rise by >0.4 scene
// units at high flow, making the stream origin visibly drift even though the
// user's target has not changed.
export function kettlePositionForTargetAtTilt(target, tilt=0, calibration=POUR_SPATIAL_CALIBRATION){
  const desiredNozzle=nozzlePositionForTarget(target,calibration);
  const rotated=rotatedNozzleLocal(tilt,calibration);
  return {
    x:desiredNozzle.x-rotated.x,
    y:desiredNozzle.y-rotated.y,
    z:desiredNozzle.z-rotated.z,
  };
}

export function nozzlePositionForTargetAtTilt(target, tilt=0, calibration=POUR_SPATIAL_CALIBRATION){
  const kettle=kettlePositionForTargetAtTilt(target,tilt,calibration);
  const rotated=rotatedNozzleLocal(tilt,calibration);
  return {
    x:kettle.x+rotated.x,
    y:kettle.y+rotated.y,
    z:kettle.z+rotated.z,
  };
}

export function uncompensatedTiltDrift(tilt=0, calibration=POUR_SPATIAL_CALIBRATION){
  const neutral=rotatedNozzleLocal(0,calibration);
  const rotated=rotatedNozzleLocal(tilt,calibration);
  const dx=rotated.x-neutral.x,dy=rotated.y-neutral.y,dz=rotated.z-neutral.z;
  return {dx,dy,dz,distance:Math.hypot(dx,dy,dz)};
}

export function spatialRelationship(target, calibration=POUR_SPATIAL_CALIBRATION){
  const nozzle=nozzlePositionForTarget(target,calibration);
  const tx=finite(target?.x),ty=finite(target?.y,calibration.bedY),tz=finite(target?.z);
  const dx=nozzle.x-tx,dz=nozzle.z-tz;
  const horizontal=Math.hypot(dx,dz);
  const clearance=nozzle.y-ty;
  return {nozzle,dx,dz,horizontal,clearance};
}

export function validateSpatialCalibration(calibration=POUR_SPATIAL_CALIBRATION){
  const checks=[];
  const sampleTargets=[
    {x:0,y:calibration.bedY,z:0},
    {x:calibration.bedRadius,y:calibration.bedY,z:0},
    {x:-calibration.bedRadius,y:calibration.bedY,z:0},
    {x:0,y:calibration.bedY,z:calibration.bedRadius},
    {x:0,y:calibration.bedY,z:-calibration.bedRadius},
  ];
  for(const target of sampleTargets){
    const rel=spatialRelationship(target,calibration);
    const neutral=nozzlePositionForTarget(target,calibration);
    const tilted=nozzlePositionForTargetAtTilt(target,calibration.maxPourTilt,calibration);
    const compensatedTiltError=Math.hypot(tilted.x-neutral.x,tilted.y-neutral.y,tilted.z-neutral.z);
    checks.push({target,...rel,compensatedTiltError,valid:
      rel.clearance>=calibration.minNozzleClearance&&
      rel.clearance<=calibration.maxNozzleClearance&&
      rel.horizontal>=calibration.minHorizontalNozzleOffset&&
      rel.horizontal<=calibration.maxHorizontalNozzleOffset&&
      compensatedTiltError<1e-9
    });
  }
  return {valid:checks.every(check=>check.valid),checks};
}
