import assert from 'node:assert/strict';
import {aggregateTrainingPeriods,trainingPeriodTrend} from '../pour-training-period.js';
const ev=(date,passed=true,grad=false,id='flow')=>({replayId:date+id,recordedAt:date,passed,graduated:grad,challengeId:id});
const events=[
  ev('2026-07-28T10:00:00Z'),ev('2026-07-29T10:00:00Z',false),
  ev('2026-08-04T10:00:00Z',true,true),ev('2026-08-05T10:00:00Z'),ev('2026-08-06T10:00:00Z'),
  ev('2026-08-11T10:00:00Z'),ev('2026-08-12T10:00:00Z',true,true),ev('2026-08-13T10:00:00Z'),ev('2026-08-14T10:00:00Z'),
];
const weeks=aggregateTrainingPeriods(events,{mode:'week',limit:8});
assert.deepEqual(weeks.map(x=>x.attempts),[2,3,4]);
assert.equal(weeks[1].graduates,1);
assert.equal(weeks[2].activeDays,4);
assert.equal(trainingPeriodTrend(events,{mode:'week'}).headline,'训练频率正在提升');
const falling=[
  ev('2026-08-03T10:00:00Z'),ev('2026-08-04T10:00:00Z'),ev('2026-08-05T10:00:00Z'),ev('2026-08-06T10:00:00Z'),
  ev('2026-08-10T10:00:00Z'),ev('2026-08-11T10:00:00Z'),ev('2026-08-12T10:00:00Z'),
  ev('2026-08-17T10:00:00Z'),
];
assert.equal(trainingPeriodTrend(falling).headline,'最近训练频率下降');
const months=aggregateTrainingPeriods(events,{mode:'month'});
assert.equal(months.length,2);
assert.equal(months[0].label,'2026-07');
assert.equal(months[1].label,'2026-08');
assert.equal(trainingPeriodTrend([events[0]]).valid,false);
console.log('training period tests: PASS');
