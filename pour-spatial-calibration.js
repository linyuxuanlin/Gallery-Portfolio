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
});

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

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
    checks.push({target,...rel,valid:
      rel.clearance>=calibration.minNozzleClearance&&
      rel.clearance<=calibration.maxNozzleClearance&&
      rel.horizontal>=calibration.minHorizontalNozzleOffset&&
      rel.horizontal<=calibration.maxHorizontalNozzleOffset
    });
  }
  return {valid:checks.every(check=>check.valid),checks};
}
