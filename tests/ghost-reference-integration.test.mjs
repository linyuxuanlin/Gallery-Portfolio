import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const history=await readFile(new URL('../pour-brew-history.js',import.meta.url),'utf8');
const lifecycle=await readFile(new URL('../pour-lifecycle.js',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');

assert.match(history,/const GHOST_REF_KEY='pourLabGhostReferenceId'/);
assert.match(history,/setItem\?\.\(GHOST_REF_KEY,resolved\.id\)/);
assert.match(history,/removeItem\?\.\(LAST_BREW_KEY\)/);
assert.match(history,/export function prepareGhostReferenceForBoot/);
assert.match(history,/getItem\?\.\(LAST_BREW_KEY\)===injected/,'cleanup must only remove its own injected replay');
assert.doesNotMatch(history,/setItem\?\.\(LAST_BREW_KEY,JSON\.stringify\(replay\)\)/,'Ghost selection must not persist a duplicate replay');

assert.match(lifecycle,/prepareGhostReferenceForBoot/);
assert.match(lifecycle,/const bootGhostReference/);
assert.match(lifecycle,/queueMicrotask\(\(\) => bootGhostReference\.cleanup\(\)\)/);
assert.match(index,/localStorage\.getItem\('pourLabLastBrew'\)/,'main page compatibility reader should remain supported');

console.log('ghost reference integration tests: PASS');
