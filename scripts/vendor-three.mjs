import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const VERSION = 'r180';
const FILES = [
  {
    path: 'vendor/three/three.module.min.js',
    url: `https://raw.githubusercontent.com/mrdoob/three.js/${VERSION}/build/three.module.min.js`,
    gitBlobSha: '20d3c112761a519c7780a5ccc9f72a40937fa83b',
  },
  {
    path: 'vendor/three/three.core.min.js',
    url: `https://raw.githubusercontent.com/mrdoob/three.js/${VERSION}/build/three.core.min.js`,
    gitBlobSha: '70c40977daa0f6e1e312c6b58e9bfe49cb5a87a4',
  },
];

export function gitBlobSha(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

export function verifyBlob(buffer, expectedSha, label = 'blob') {
  const actual = gitBlobSha(buffer);
  if (actual !== expectedSha) {
    throw new Error(`${label} integrity mismatch: expected ${expectedSha}, got ${actual}`);
  }
  return actual;
}

async function fetchPinned(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export function patchIndexForVendoredThree(source) {
  const cdn = /import \* as THREE from ['"]https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.180\.0\/build\/three\.module(?:\.min)?\.js['"];?/;
  if (source.includes("import * as THREE from './vendor/three/three.module.min.js';")) return source;
  if (!cdn.test(source)) throw new Error('Three.js CDN import not found in index.html');
  return source.replace(cdn, "import * as THREE from './vendor/three/three.module.min.js';");
}

function removeFunction(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  if (start < 0) return source;
  const brace = source.indexOf('{', start);
  if (brace < 0) return source;
  let depth = 0;
  for (let index = brace; index < source.length; index++) {
    if (source[index] === '{') depth++;
    else if (source[index] === '}') {
      depth--;
      if (depth === 0) {
        let end = index + 1;
        while (source[end] === '\r' || source[end] === '\n') end++;
        return source.slice(0, start) + source.slice(end);
      }
    }
  }
  throw new Error(`Unable to remove ${name} from sw.js`);
}

export function patchServiceWorkerForVendoredThree(source) {
  let next = source.replace(/const CACHE_VERSION = 'pour-lab-v\d+';/, "const CACHE_VERSION = 'pour-lab-v42';");

  next = next
    .replace(/^const RUNTIME_CACHE = .*\n/m, '')
    .replace(/^const THREE_URL = .*\n/m, '')
    .replace(/const THREE_SOURCES = \[[\s\S]*?\];\n/m, '')
    .replace(/^const DEPENDENCY_TIMEOUT_MS = .*\n/m, '');

  for (const name of ['fetchWithTimeout', 'fetchFirstAvailable', 'warmThreeCache', 'threeCacheFirst']) {
    next = removeFunction(next, name);
  }

  next = next
    .replace(/^\s*try \{ await warmThreeCache\(\); \} catch \{\}\n/m, '')
    .replace("const keep = new Set([APP_CACHE, RUNTIME_CACHE]);", 'const keep = new Set([APP_CACHE]);')
    .replace(/^\s*if \(url\.href === THREE_URL\) \{ event\.respondWith\(threeCacheFirst\(\)\); return; \}\n/m, '');

  const marker = "'./pour-stage-priority.js',";
  if (!next.includes("'./vendor/three/three.module.min.js'")) {
    if (!next.includes(marker)) throw new Error('APP_SHELL marker not found in sw.js');
    next = next.replace(marker, `${marker} './vendor/three/three.module.min.js', './vendor/three/three.core.min.js',`);
  }

  if (/cdn\.jsdelivr\.net\/npm\/three|unpkg\.com\/three|cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js|THREE_SOURCES|THREE_URL|warmThreeCache|threeCacheFirst/.test(next)) {
    throw new Error('Three.js external runtime remained in sw.js after patch');
  }
  return next;
}

export async function vendorThree({ root = ROOT, fetcher = fetchPinned } = {}) {
  const written = [];
  for (const file of FILES) {
    const bytes = await fetcher(file.url);
    verifyBlob(bytes, file.gitBlobSha, file.path);
    const target = resolve(root, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    written.push({ ...file, bytes: bytes.length });
  }

  const indexPath = resolve(root, 'index.html');
  const swPath = resolve(root, 'sw.js');
  const index = await readFile(indexPath, 'utf8');
  const sw = await readFile(swPath, 'utf8');
  await writeFile(indexPath, patchIndexForVendoredThree(index));
  await writeFile(swPath, patchServiceWorkerForVendoredThree(sw));

  const provenance = [
    '# Vendored Three.js provenance',
    '',
    `Version: ${VERSION}`,
    'Source repository: mrdoob/three.js',
    'License: MIT (SPDX headers retained in vendored build files)',
    '',
    ...written.map(file => `- ${file.path}: ${file.gitBlobSha} (${file.bytes} bytes)`),
    '',
    'Regenerate with: `node scripts/vendor-three.mjs`',
    '',
  ].join('\n');
  await writeFile(resolve(root, 'vendor/three/README.md'), provenance);
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  vendorThree()
    .then(files => {
      for (const file of files) console.log(`verified ${file.path} ${file.gitBlobSha}`);
      console.log('Three.js r180 vendoring complete.');
    })
    .catch(error => {
      console.error(error?.stack || error);
      process.exitCode = 1;
    });
}
