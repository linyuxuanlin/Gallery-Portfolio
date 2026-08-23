import assert from 'node:assert/strict';
import {createBrewExportBundle,serializeBrewExportBundle,parseBrewImport,importBrewBundle,validatePortableReplay} from '../pour-brew-portability.js';

const sample=i=>({t:i*100,x:i*.01,z:-i*.01,flow:5,water:i*.5,pouring:i%4!==0});
const brew=(id,score=80)=>({id,createdAt:`2026-08-23T00:00:0${id}.000Z`,duration:1000,score,samples:Array.from({length:12},(_,i)=>sample(i))});
function memoryStorage(){const map=new Map();return{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map}}

const storage=memoryStorage();
storage.setItem('pourLabBrewHistory',JSON.stringify([brew('1',91),brew('2',85)]));
storage.setItem('pourLabGhostReferenceId','1');
const bundle=createBrewExportBundle(storage,{exportedAt:'2026-08-23T12:00:00.000Z'});
assert.equal(bundle.format,'pour-lab-brew-history');assert.equal(bundle.version,1);assert.equal(bundle.brewCount,2);assert.equal(bundle.ghostReferenceId,'1');
const serialized=serializeBrewExportBundle(bundle);const parsed=parseBrewImport(serialized);assert.equal(parsed.ok,true);assert.equal(parsed.brews.length,2);assert.equal(parsed.ghostReferenceId,'1');
assert.equal(parseBrewImport('{broken').reason,'invalid-json');assert.equal(parseBrewImport('{"foo":"bar"}').reason,'unsupported-format');assert.equal(parseBrewImport('[]').reason,'no-valid-brews');assert.equal(validatePortableReplay({samples:[{t:'x'}]}),null);
const target=memoryStorage();target.setItem('pourLabBrewHistory',JSON.stringify([brew('9',70)]));const imported=importBrewBundle(target,serialized,{mode:'merge'});assert.equal(imported.ok,true);assert.equal(imported.imported,2);assert.equal(imported.history.length,3);assert.equal(target.getItem('pourLabGhostReferenceId'),'1');
const giant={id:'giant',createdAt:'2026-08-23T00:00:00.000Z',duration:999999,samples:Array.from({length:7000},(_,i)=>sample(i))};assert.equal(parseBrewImport(JSON.stringify(giant)).brews[0].samples.length,5000);
console.log('brew portability tests: PASS');
