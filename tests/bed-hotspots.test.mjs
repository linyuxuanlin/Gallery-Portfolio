import assert from 'node:assert/strict';
import { buildBedHotspotMap, detectBedHotspots, hotspotSummary } from '../pour-bed-hotspots.js';
function line(points){let water=0;return points.map((p,i)=>{water+=i?1:0;return{t:i*100,x:p[0],z:p[1],flow:i?5:0,water,pouring:i>0}})}
const model=buildBedHotspotMap(line(Array.from({length:60},()=>[.05,.02])),{size:36});
assert(Math.abs(model.total-model.activeWater)<1e-8,'hotspot deposition must conserve replay water');
const hotspots=detectBedHotspots(model);assert(hotspots.length>=1);assert(hotspots[0].radiusRatio<.2);assert(hotspotSummary(model,hotspots).headline.includes('热点'));
const edge=buildBedHotspotMap(line(Array.from({length:70},()=>[.60,0])),{size:36});
assert.equal(hotspotSummary(edge,detectBedHotspots(edge)).headline,'外圈存在明显冲刷热点');
const broken=[{t:0,x:0,z:0,flow:0,water:0,pouring:false},{t:100,x:0,z:0,flow:5,water:5,pouring:true},{t:200,x:.6,z:0,flow:5,water:10,pouring:true,breakBefore:true}];
assert.equal(Math.round(buildBedHotspotMap(broken).activeWater),5,'lifecycle break crossing must not be deposited');
assert.equal(hotspotSummary(buildBedHotspotMap([])).valid,false);
console.log('bed hotspot tests: PASS');
