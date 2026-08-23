import assert from 'node:assert/strict';
import {
  recordTrainingTransition,
  readTrainingHistory,
  summarizeTrainingHistory,
  trainingHistorySummary,
} from '../pour-training-history.js';

const memory=()=>{
  const map=new Map();
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),map};
};

const transition=(id,pass,status='continue',challenge='flow-stability')=>({
  status,
  challenge:{id:challenge,title:challenge==='flow-stability'?'流速稳定专项':'粉床覆盖专项'},
  evaluation:{
    applicable:true,
    replayId:id,
    passed:pass,
    value:pass?.8:.6,
    target:.75,
    challenge:{id:challenge,title:challenge==='flow-stability'?'流速稳定专项':'粉床覆盖专项'},
  },
});

const storage=memory();
assert.equal(recordTrainingTransition(storage,transition('a',true),{recordedAt:'2026-08-20T10:00:00Z'}).recorded,true);
assert.equal(recordTrainingTransition(storage,transition('a',true),{recordedAt:'2026-08-20T10:00:01Z'}).duplicate,true);
recordTrainingTransition(storage,transition('b',true,'graduated-next'),{recordedAt:'2026-08-20T11:00:00Z'});
recordTrainingTransition(storage,transition('c',false,'continue','bed-coverage'),{recordedAt:'2026-08-21T09:00:00Z'});
recordTrainingTransition(storage,transition('d',true,'continue','bed-coverage'),{recordedAt:'2026-08-21T10:00:00Z'});
recordTrainingTransition(storage,transition('e',true,'graduated-maintain','bed-coverage'),{recordedAt:'2026-08-22T10:00:00Z'});

const events=readTrainingHistory(storage);
assert.equal(events.length,5);
const summary=summarizeTrainingHistory(events);
assert.equal(summary.attempts,5);
assert.equal(summary.passes,4);
assert.equal(summary.passRate,.8);
assert.equal(summary.currentStreak,2);
assert.equal(summary.bestStreak,2);
assert.equal(summary.graduates,2);
assert.equal(summary.activeDays,3);
assert.equal(summary.challenges.length,2);
assert.equal(summary.challenges.find(item=>item.id==='flow-stability').passRate,1);
assert.equal(summary.challenges.find(item=>item.id==='bed-coverage').passRate,2/3);
assert.equal(trainingHistorySummary(storage).attempts,5);

const noEvaluation=recordTrainingTransition(storage,{status:'start',evaluation:null});
assert.equal(noEvaluation.recorded,false);
assert.equal(trainingHistorySummary(storage).attempts,5);

const brokenStorage={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')}};
assert.deepEqual(readTrainingHistory(brokenStorage),[]);
assert.equal(recordTrainingTransition(brokenStorage,transition('x',true)).recorded,true);

console.log('training history tests: PASS');
