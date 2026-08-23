import assert from 'node:assert/strict';
import { auditStreamCalibration } from '../pour-stream-calibration.js';
import { POUR_SPATIAL_CALIBRATION } from '../pour-spatial-calibration.js';

const audit = auditStreamCalibration();
assert.equal(audit.valid,true);
assert.deepEqual(audit.rows.map(row=>row.flow),[2,4,6,8]);
assert(audit.rows[0].flightTime > audit.rows.at(-1).flightTime);
assert(audit.rows[0].sag > audit.rows.at(-1).sag);
assert(audit.rows.every(row=>row.endError<1e-9));

const clearanceSpread=Math.max(...audit.rows.map(r=>r.clearance))-Math.min(...audit.rows.map(r=>r.clearance));
assert(clearanceSpread<1e-9);

const tooHigh={...POUR_SPATIAL_CALIBRATION,kettleBodyY:4.4};
assert.equal(auditStreamCalibration({calibration:tooHigh}).valid,false);

const tooLow={...POUR_SPATIAL_CALIBRATION,kettleBodyY:2.1};
assert.equal(auditStreamCalibration({calibration:tooLow}).valid,false);

console.log('stream calibration audit: PASS');
