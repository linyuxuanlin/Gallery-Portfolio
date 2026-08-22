import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const lifecycle = fs.readFileSync(new URL('../pour-lifecycle.js', import.meta.url), 'utf8');

assert.match(index, /import\s*\{bindPourPointerInput\}\s*from\s*['"]\.\/pour-input-bindings\.js['"]/,
  'index must import unified pointer bindings');
assert.match(index, /const inputBinding=bindPourPointerInput\(renderer\.domElement,/,
  'canvas must be controlled by unified binding');
assert.match(index, /onHover:e=>\{if\(!replaying\)targetFromEvent\(e\)\}/,
  'desktop/pen hover must continue to position the target');
assert.match(index, /onStop:\(\)=>\{pouring=false\}/,
  'all unified stop paths must end user pouring');
assert.match(index, /inputBinding\.suspend\(reason\|\|'lifecycle'\)/,
  'page lifecycle must clear the active pointer state');

assert.doesNotMatch(index, /renderer\.domElement\.addEventListener\(['"]pointerdown['"]/,
  'legacy pointerdown handler must not return');
assert.doesNotMatch(index, /renderer\.domElement\.addEventListener\(['"]pointermove['"]/,
  'legacy pointermove handler must not return');
assert.doesNotMatch(index, /renderer\.domElement\.addEventListener\(['"]pointerup['"]/,
  'legacy pointerup handler must not return');
assert.doesNotMatch(index, /renderer\.domElement\.addEventListener\(['"]pointercancel['"]/,
  'legacy pointercancel handler must not return');
assert.doesNotMatch(index, /renderer\.domElement\.setPointerCapture\(/,
  'pointer capture belongs to the binding layer only');

assert.doesNotMatch(lifecycle, /installLegacyPointerGuard/,
  'legacy guard must not be bootstrapped once unified input owns the page');
assert.match(index, /version:11/,
  'replay schema should identify unified-pointer input generation');
assert.match(index, /unified-pointer-binding/,
  'physics/input provenance should record unified pointer binding');

console.log('index input integration tests: PASS');
