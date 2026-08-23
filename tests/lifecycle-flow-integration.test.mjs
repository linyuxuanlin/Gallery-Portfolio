import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const lifecycleSource = fs.readFileSync(path.join(here, '..', 'pour-lifecycle.js'), 'utf8');
const flowSource = fs.readFileSync(path.join(here, '..', 'pour-flow-runtime.js'), 'utf8');

assert.match(
  lifecycleSource,
  /import\s*\{[^}]*suspendAllFlowRuntimes[^}]*\}\s*from\s*['"]\.\/pour-flow-runtime\.js['"]/,
  'lifecycle must import the flow settlement registry',
);
assert.match(
  lifecycleSource,
  /const\s+flowStates\s*=\s*suspendAllFlowRuntimes\(\)/,
  'lifecycle suspend must settle active flow runtimes',
);
assert.match(
  lifecycleSource,
  /onSuspend\(\{\s*reason,\s*at,\s*flowStates\s*\}\)/,
  'suspend callback should receive settled flow state for UI synchronization',
);
assert.match(flowSource, /const\s+activeFlowRuntimes\s*=\s*new Set\(\)/);
assert.match(flowSource, /activeFlowRuntimes\.add\(runtime\)/);
assert.match(flowSource, /dispose\(\)\s*\{\s*activeFlowRuntimes\.delete\(runtime\)/);
assert.doesNotMatch(
  flowSource,
  /suspend\(\)[\s\S]{0,250}water\s*\+=/,
  'suspend must never integrate hidden-time water',
);

console.log('lifecycle-flow integration tests: PASS');
