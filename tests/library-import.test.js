import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync, cpSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import { importPlan, prepareImportedPhotograph } from '../scripts/import-beta-library.js';

const retained = { category: 'Coast', name: 'old', original: 'https://media.wiki-power.com/gallery/Coast/old.JPG', preview: '/public/photos/Coast/old-960-existing.webp', largePreview: '/public/photos/Coast/old-1600-existing.webp', width: 6000, height: 4000, sourceModified: '2020-01-01T00:00:00.000Z' };
const previous = { gallery: { Coast: { images: [retained] } } };
const listing = { complete: true, objects: [{ key: 'gallery/Coast/old.JPG', lastModified: retained.sourceModified }, { key: 'gallery/New Place/a.jpg', lastModified: '2026-10-12T00:00:00.000Z' }, { key: 'gallery/0_preview/Coast/old.webp' }, { key: 'gallery/Coast/' }, { key: 'gallery/0_preview/New Place/a.webp' }] };

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
  assert.throws(() => importPlan({ complete: true, objects: [...listing.objects, { key: 'gallery/Coast/old.png', lastModified: retained.sourceModified }] }, previous), /Ambiguous photograph identity/);
  assert.throws(() => importPlan({ complete: true, objects: [...listing.objects, listing.objects[0]] }, previous), /Repeated source object/);
  assert.throws(() => importPlan({ complete: true, objects: [{ key: 'gallery/../outside.jpg' }] }, previous), /Invalid object key/);
});

test('a replacement under a stable photograph ID is reprocessed rather than reusing a stale preview', () => {
  const baseline = structuredClone({ generated_at: '2026-10-10T00:00:00Z', gallery: previous.gallery });
  delete baseline.gallery.Coast.images[0].sourceModified;
  const changed = structuredClone(listing);
  changed.objects[0].lastModified = '2026-10-12T00:00:00Z';
  const entry = importPlan(changed, baseline).find(image => image.id === 'Coast/old');
  assert.equal(entry.needsPreview, true);
  assert.equal(entry.image.preview, undefined);
  assert.equal(entry.image.sourceModified, '2026-10-12T00:00:00.000Z');
  changed.objects[0].lastModified = '2025-08-01T00:00:00Z';
  assert.equal(importPlan(changed, baseline).find(image => image.id === 'Coast/old').needsPreview, false);
});

test('a key-only listing cannot silently reuse a replaced original or bypass completeness', () => {
  const missingVersion = structuredClone(listing);
  delete missingVersion.objects[0].lastModified;
  assert.throws(() => importPlan(missingVersion, previous), /modification date is required/);
  assert.throws(() => importPlan({ ...listing, complete: 'false' }, previous), /fully paginated/);
});

test('a missing R2 preview is never invented and removed remote previews lose their stale references', () => {
  const withoutPreviews = { ...listing, objects: listing.objects.filter(object => !object.key.startsWith('gallery/0_preview/')) };
  const stale = structuredClone(previous);
  stale.gallery.Coast.images[0].sourcePreview = 'https://media.wiki-power.com/gallery/0_preview/Coast/old.webp';
  const plan = importPlan(withoutPreviews, stale);
  assert.equal(plan.find(entry => entry.id === 'New Place/a').image.sourcePreview, undefined);
  assert.equal(plan.find(entry => entry.id === 'Coast/old').image.sourcePreview, undefined);
  assert.equal(plan.find(entry => entry.id === 'Coast/old').image.preview, retained.preview);
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

test('reserved URL characters survive import, review sheets and built bilingual photograph routes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gallery-encoded-import-'));
  const repository = fileURLToPath(new URL('../', import.meta.url));
  try {
    const category = '新 地点#?';
    const entries = importPlan({ complete: true, objects: ['photo#1', 'photo?2', 'photo%3'].map(name => ({ key: `gallery/${category}/${name}.JPG`, lastModified: '2026-10-13T00:00:00Z' })) }, { gallery: {} });
    const bytes = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#648080' } }).jpeg().toBuffer();
    for (const entry of entries) await prepareImportedPhotograph(entry, { cache: join(root, 'cache'), outputRoot: root, fetchOriginal: async () => bytes });
    cpSync(join(repository, 'scripts'), join(root, 'scripts'), { recursive: true });
    cpSync(join(repository, 'public/assets'), join(root, 'public/assets'), { recursive: true });
    for (const file of ['site.config.json', 'artist.json', '_headers', 'public/beta.css', 'public/beta.js']) cpSync(join(repository, file), join(root, file));
    symlinkSync(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    mkdirSync(join(root, 'exhibitions')); mkdirSync(join(root, '.curation'));
    writeFileSync(join(root, 'exhibitions/index.json'), JSON.stringify({ schemaVersion: 1, title: '测试', titleEn: 'Test', exhibitions: [] }));
    const images = entries.map(entry => entry.image);
    const captions = images.map(image => ({ category, name: image.name, title: image.name, titleEn: image.name, description: '测试图片', descriptionEn: 'Test photograph' }));
    writeFileSync(join(root, 'gallery-index.json'), JSON.stringify({ gallery: { [category]: { name: category, count: images.length, images } } }));
    writeFileSync(join(root, 'curation.json'), JSON.stringify({ photographs: captions, about: captions[0], commission: [captions[0]], covers: {} }));
    writeFileSync(join(root, '.curation/inventory.json'), JSON.stringify({ libraryFingerprint: 'encoded-test', photographs: images.map(image => ({ ...image, id: `${category}/${image.name}`, exhibition: null })) }));
    execFileSync(process.execPath, ['scripts/curation-review.js'], { cwd: root });
    assert.ok(existsSync(join(root, '.curation/review/available/sheet-001.jpg')));
    execFileSync(process.execPath, ['scripts/build-beta.js'], { cwd: root });
    const cache = join(root, 'preview-cache'); mkdirSync(cache);
    for (const image of images) await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#648080' } }).webp().toFile(join(cache, `${category}_${image.name}.webp`));
    execFileSync(process.execPath, ['scripts/prepare-beta-previews.js'], { cwd: root, env: { ...process.env, GALLERY_SOURCE_CACHE: cache } });
    const prepared = JSON.parse(readFileSync(join(root, 'gallery-index.json'), 'utf8')).gallery[category].images;
    for (const image of prepared) {
      assert.equal(image.sourcePreview, undefined, 'local previews must not be advertised as a remote source');
      assert.equal(image.width, 40); assert.equal(image.height, 30);
      assert.equal(new URL(image.preview, 'https://photo-gallery.wiki-power.com').hash, '');
      assert.equal(new URL(image.preview, 'https://photo-gallery.wiki-power.com').search, '');
    }
    for (const image of images) {
      for (const field of ['preview', 'largePreview']) {
        const url = new URL(image[field], 'https://photo-gallery.wiki-power.com');
        assert.equal(url.search, ''); assert.equal(url.hash, '');
        assert.ok(existsSync(join(root, 'dist', decodeURIComponent(url.pathname).slice(1))));
      }
      for (const language of ['', 'en']) {
        const directory = join(root, 'dist', language, 'photographs', category, image.name);
        const dom = new JSDOM(readFileSync(join(directory, 'index.html'), 'utf8'));
        const canonical = dom.window.document.querySelector('link[rel="canonical"]').href;
        assert.equal(new URL(canonical).hash, ''); assert.equal(new URL(canonical).search, '');
        for (const element of dom.window.document.querySelectorAll('a[href],img[src]')) {
          const url = new URL(element.getAttribute('href') || element.getAttribute('src'), canonical);
          if (url.origin !== new URL(canonical).origin) continue;
          const relative = decodeURIComponent(url.pathname).slice(1);
          assert.ok(existsSync(join(root, 'dist', relative.endsWith('/') || !relative ? relative + 'index.html' : relative)), url.href);
        }
        dom.window.close();
      }
    }
    assert.throws(() => importPlan({ complete: true, objects: [{ key: 'gallery/Coast/...JPG', lastModified: '2026-10-13T00:00:00Z' }] }, { gallery: {} }), /Invalid photograph name/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
