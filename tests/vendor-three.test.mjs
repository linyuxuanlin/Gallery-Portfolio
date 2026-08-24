import assert from 'node:assert/strict';
import { gitBlobSha, verifyBlob, patchIndexForVendoredThree, patchServiceWorkerForVendoredThree } from '../scripts/vendor-three.mjs';

const hello = Buffer.from('hello\n');
assert.equal(gitBlobSha(hello), 'ce013625030ba8dba906f756967f9e9ca394464a');
assert.equal(verifyBlob(hello, 'ce013625030ba8dba906f756967f9e9ca394464a'), 'ce013625030ba8dba906f756967f9e9ca394464a');
assert.throws(() => verifyBlob(hello, '0000000000000000000000000000000000000000'), /integrity mismatch/);

const oldIndex = "<script type=\"module\">\nimport * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';\n</script>";
const patchedIndex = patchIndexForVendoredThree(oldIndex);
assert(patchedIndex.includes("import * as THREE from './vendor/three/three.module.min.js';"));
assert(!patchedIndex.includes('cdn.jsdelivr.net/npm/three'));
assert.equal(patchIndexForVendoredThree(patchedIndex), patchedIndex, 'index patch must be idempotent');

const oldSw = `const CACHE_VERSION = 'pour-lab-v41';\nconst APP_SHELL = [\n  './pour-input-guard.js',\n];`;
const patchedSw = patchServiceWorkerForVendoredThree(oldSw);
assert(patchedSw.includes("const CACHE_VERSION = 'pour-lab-v42';"));
assert(patchedSw.includes("'./vendor/three/three.module.min.js'"));
assert(patchedSw.includes("'./vendor/three/three.core.min.js'"));
assert.equal((patchServiceWorkerForVendoredThree(patchedSw).match(/vendor\/three\/three\.module\.min\.js/g)||[]).length, 1);

console.log('vendor Three.js tests: PASS');
