import { rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';

// The existing Pages preview also uses prebuilt root files. Retired routes must
// disappear there as well as from dist, without removing source JSON manifests.
export function cleanStalePages(previousPaths, currentPaths, root = '.') {
  const current = new Set(currentPaths), base = resolve(root);
  for (const path of previousPaths) {
    if (current.has(path) || !/^\/(?:en\/)?(?:works|places|about|photography|photographs|exhibitions)\//.test(path) || !path.endsWith('/')) continue;
    const relative = decodeURIComponent(path.slice(1));
    if (relative.split(/[\\/]/).includes('..')) throw new Error(`Unsafe generated route: ${path}`);
    const filename = resolve(base, relative, 'index.html');
    if (!filename.startsWith(base + sep)) throw new Error(`Unsafe generated route: ${path}`);
    rmSync(filename, { force: true });
  }
}
