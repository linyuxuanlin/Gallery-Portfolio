import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { importPlan, prepareImportedPhotograph } from '../scripts/import-beta-library.js';

const retained = { category: 'Coast', name: 'old', original: 'https://media.wiki-power.com/gallery/Coast/old.JPG', preview: '/public/photos/Coast/old-960-existing.webp', largePreview: '/public/photos/Coast/old-1600-existing.webp', width: 6000, height: 4000 };
const previous = { gallery: { Coast: { images: [retained] } } };
const listing = { complete: true, objects: [{ key: 'gallery/Coast/old.JPG' }, { key: 'gallery/New Place/a.jpg' }, { key: 'gallery/0_preview/Coast/old.webp' }, { key: 'gallery/Coast/' }] };

test('a complete source import preserves existing responsive assets and adds encoded original URLs', () => {
  const plan = importPlan(listing, previous);
  assert.equal(plan.length, 2);
  assert.deepEqual(plan.find(entry => entry.id === 'Coast/old').image, retained);
  assert.equal(plan.find(entry => entry.id === 'Coast/old').needsPreview, false);
  const addition = plan.find(entry => entry.id === 'New Place/a');
  assert.equal(addition.needsPreview, true);
  assert.equal(addition.image.original, 'https://media.wiki-power.com/gallery/New%20Place/a.jpg');
  assert.equal(addition.image.sourcePreview, 'https://media.wiki-power.com/gallery/0_preview/New%20Place/a.webp');
  assert.equal(retained.preview, '/public/photos/Coast/old-960-existing.webp');
});

test('partial listings, lost existing photos and ambiguous extension identities cannot replace the library', () => {
  assert.throws(() => importPlan({ ...listing, complete: false }, previous), /fully paginated/);
  assert.throws(() => importPlan({ complete: true, objects: listing.objects.slice(1) }, previous), /Previous photographs are absent/);
  assert.throws(() => importPlan({ complete: true, objects: [...listing.objects, { key: 'gallery/Coast/old.png' }] }, previous), /Ambiguous photograph identity/);
  assert.throws(() => importPlan({ complete: true, objects: [...listing.objects, listing.objects[0]] }, previous), /Repeated source object/);
  assert.throws(() => importPlan({ complete: true, objects: [{ key: 'gallery/../outside.jpg' }] }, previous), /Invalid object key/);
});

test('a replacement under a stable photograph ID is reprocessed rather than reusing a stale preview', () => {
  const baseline = { generated_at: '2026-10-10T00:00:00Z', gallery: previous.gallery };
  const changed = structuredClone(listing);
  changed.objects[0].lastModified = '2026-10-12T00:00:00Z';
  const entry = importPlan(changed, baseline).find(image => image.id === 'Coast/old');
  assert.equal(entry.needsPreview, true);
  assert.equal(entry.image.preview, undefined);
  assert.equal(entry.image.sourceModified, '2026-10-12T00:00:00.000Z');
  changed.objects[0].lastModified = '2025-08-01T00:00:00Z';
  assert.equal(importPlan(changed, baseline).find(image => image.id === 'Coast/old').needsPreview, false);
});

test('imported previews respect orientation and never enlarge a smaller photograph', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gallery-import-'));
  try {
    const source = await sharp({ create: { width: 480, height: 320, channels: 3, background: '#4c6477' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const entry = { id: 'Test/small', key: 'gallery/Test/small.jpg', image: { category: 'Test', name: 'small', original: 'https://images.test/small.jpg' } };
    let reads = 0;
    const result = await prepareImportedPhotograph(entry, { cache: root, outputRoot: root, fetchOriginal: async () => { reads++; return source; } });
    assert.equal(reads, 1);
    assert.equal(result.original, 'https://images.test/small.jpg');
    for (const field of ['preview', 'largePreview']) {
      const metadata = await sharp(readFileSync(join(root, result[field].slice(1)))).metadata();
      assert.equal(metadata.width, 320); assert.equal(metadata.height, 480);
      assert.equal(result[field + 'Width'], metadata.width); assert.equal(result[field + 'Height'], metadata.height);
    }
    assert.match(result.originalContentSHA256, /^[a-f0-9]{64}$/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
