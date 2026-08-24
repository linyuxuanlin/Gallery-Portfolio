# Vendored Three.js provenance

POUR Lab pins Three.js to upstream tag **r180**. The vendoring tool writes the official minified ESM build into this directory and refuses any payload whose Git blob SHA does not match the upstream repository.

| File | Upstream Git blob SHA | Size |
| --- | --- | ---: |
| `three.module.min.js` | `20d3c112761a519c7780a5ccc9f72a40937fa83b` | 338,908 bytes |
| `three.core.min.js` | `70c40977daa0f6e1e312c6b58e9bfe49cb5a87a4` | 381,124 bytes |

Source repository: `mrdoob/three.js`, tag `r180`.

License: MIT. The official build files retain their SPDX / copyright headers.

Regenerate and atomically patch the app to the local import with:

```sh
node scripts/vendor-three.mjs
```

The script also adds both vendor files to the Service Worker application shell and bumps the POUR Lab cache version. Do not hand-copy or partially paste these minified files: integrity verification is intentionally required before the app switches away from the CDN import.
