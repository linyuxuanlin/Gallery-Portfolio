import assert from 'node:assert/strict';
import {
  addBrewToHistory,
  persistHistory,
  selectGhostReference,
  readGhostReferenceId,
  resolveGhostReference,
  prepareGhostReferenceForBoot,
} from '../pour-brew-history.js';

const brew=id=>({
  id,
  createdAt:`2026-08-23T00:00:0${id}.000Z`,
  duration:1000,
  score:80+Number(id),
  samples:[
    {t:0,x:0,z:0,flow:5,water:0,pouring:true},
    {t:100,x:.1,z:0,flow:5,water:.5,pouring:true},
  ],
});

const map=new Map();
const storage={
  getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>map.set(key,value),
  removeItem:key=>map.delete(key),
};

let history=[];
history=addBrewToHistory(history,brew('1'));
history=addBrewToHistory(history,brew('2'));
persistHistory(storage,history);

assert.equal(selectGhostReference(storage,history[1]),true);
assert.equal(readGhostReferenceId(storage),'1');
assert.equal(storage.getItem('pourLabLastBrew'),null,'Ghost selection must not persist a duplicate replay');
assert.equal(resolveGhostReference(storage).id,'1');

const boot=prepareGhostReferenceForBoot(storage);
assert.equal(boot.prepared,true);
assert.equal(JSON.parse(storage.getItem('pourLabLastBrew')).id,'1');
assert.equal(boot.cleanup(),true);
assert.equal(storage.getItem('pourLabLastBrew'),null);

const bootWithNewerReplay=prepareGhostReferenceForBoot(storage);
storage.setItem('pourLabLastBrew',JSON.stringify(brew('9')));
assert.equal(bootWithNewerReplay.cleanup(),false,'Boot cleanup must not delete a newer replay');
assert.equal(JSON.parse(storage.getItem('pourLabLastBrew')).id,'9');

map.set('pourLabGhostReferenceId','missing');
assert.equal(resolveGhostReference(storage),null);

console.log('ghost reference storage tests: PASS');
