import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { previewMetadata } from './image-metadata.js';
import { readExhibitions, validateExhibitions, photographId } from './exhibitions.js';

export function inventoryDiff(previous, next) {
  const before = new Map((previous?.photographs || []).map(image => [image.id, image]));
  const after = new Map(next.photographs.map(image => [image.id, image]));
  return {
    added: [...after.keys()].filter(id => !before.has(id)),
    removed: [...before.keys()].filter(id => !after.has(id)),
    changed: [...after.keys()].filter(id => before.has(id) && (before.get(id).sha256 !== after.get(id).sha256 || before.get(id).original !== after.get(id).original))
  };
}

export function createInventory(images, exhibitions, metadata) {
  const fingerprints = new Map(images.map(image => [photographId(image), metadata.get(image.preview).sha256]));
  const { owners } = validateExhibitions(exhibitions, images, fingerprints);
  const groups = new Map();
  const photographs = images.map(image => {
    const id = photographId(image), dimensions = metadata.get(image.preview), sha256 = fingerprints.get(id);
    if (!groups.has(sha256)) groups.set(sha256, []);
    groups.get(sha256).push(id);
    return { id, original: image.original, preview: image.preview, width: dimensions.width, height: dimensions.height, sha256, exhibition: owners.get(id) || null };
  });
  return {
    schemaVersion: 1,
    libraryFingerprint: createHash('sha256').update(JSON.stringify(photographs.map(({ id, original, preview, sha256 }) => ({ id, original, preview, sha256 })))).digest('hex'),
    total: photographs.length, reserved: owners.size, available: photographs.filter(image => !image.exhibition).length,
    duplicatePreviews: [...groups.values()].filter(group => group.length > 1), photographs
  };
}

async function main() {
  const data = JSON.parse(readFileSync('gallery-index.json', 'utf8'));
  const images = Object.values(data.gallery).flatMap(album => album.images);
  const next = createInventory(images, readExhibitions(), await previewMetadata(images));
  const previous = existsSync('.curation/inventory.json') ? JSON.parse(readFileSync('.curation/inventory.json', 'utf8')) : null;
  const changes = inventoryDiff(previous, next);
  mkdirSync('.curation', { recursive: true });
  writeFileSync('.curation/inventory.json', JSON.stringify(next, null, 2) + '\n');
  writeFileSync('.curation/changes.json', JSON.stringify(changes, null, 2) + '\n');
  console.log(`${next.total} photographs · ${next.reserved} reserved · ${next.available} available`);
  console.log(`Changes: ${changes.added.length} added, ${changes.changed.length} changed, ${changes.removed.length} removed. ${next.duplicatePreviews.length} groups of identical previews need review.`);
  console.log('Local inventory: .curation/inventory.json; no photographs are selected automatically.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
