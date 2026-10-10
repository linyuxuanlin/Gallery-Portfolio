import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { validateExhibitions, readExhibitions, exhibitionPhotoIds } from '../scripts/exhibitions.js';
import { archivePages, archivePath, pagination, ARCHIVE_PAGE_SIZE } from '../scripts/archive.js';
import { inventoryDiff, createInventory } from '../scripts/curation-inventory.js';
import { cleanStalePages } from '../scripts/generated-pages.js';

const images = ['a', 'b', 'c'].map(name => ({ category: 'Test', name, original: `https://images.test/${name}.jpg`, preview: `/public/photos/${name}.webp` }));
const exhibit = (slug, id, status = 'published') => ({
  slug, status, title: '展览', titleEn: 'Exhibition', cover: id,
  opening: [id], chapters: [], standfirst: '观看', standfirstEn: 'Looking',
  introduction: ['序言'], introductionEn: ['Introduction']
});

test('published, draft and archived exhibitions reserve distinct photographs; a cover may reuse its own work', () => {
  const registry = validateExhibitions([exhibit('first', 'Test/a'), exhibit('next', 'Test/b', 'draft'), exhibit('past', 'Test/c', 'archived')], images);
  assert.deepEqual(registry.publicExhibitions.map(item => item.slug), ['first', 'past']);
  assert.deepEqual([...registry.owners.values()], ['first', 'next', 'past']);
  for (const status of ['draft', 'published', 'archived']) {
    assert.throws(() => validateExhibitions([exhibit('first', 'Test/a'), exhibit('second', 'Test/a', status)], images), /reserved by two exhibitions/);
  }
  const repeated = exhibit('first', 'Test/a'); repeated.chapters = [{ id: 'part', title: '章', titleEn: 'Part', text: '文字', textEn: 'Text', works: ['Test/a'] }];
  assert.throws(() => validateExhibitions([repeated], images), /Repeated photograph inside/);
});

test('renaming a photograph or changing an original URL query cannot evade cross-exhibition checks', () => {
  const selections = [exhibit('first', 'Test/a'), exhibit('second', 'Test/b')];
  const aliases = structuredClone(images); aliases[1].original = aliases[0].original + '?download=1#photo';
  assert.throws(() => validateExhibitions(selections, aliases), /Duplicate photograph content/);
  assert.throws(() => validateExhibitions(selections, images, new Map([['Test/a', 'same-bytes'], ['Test/b', 'same-bytes']])), /Duplicate photograph content/);
});

test('incomplete drafts are allowed, but missing works, invalid covers and incomplete published text stop publication', () => {
  const draft = { slug: 'future', status: 'draft', title: '草稿', titleEn: 'Draft', opening: [], chapters: [] };
  assert.equal(validateExhibitions([draft], images).publicExhibitions.length, 0);
  assert.throws(() => validateExhibitions([{ ...draft, status: 'published' }], images), /Incomplete public exhibition/);
  assert.throws(() => validateExhibitions([exhibit('missing', 'Test/missing')], images), /Missing exhibition photograph/);
  assert.throws(() => validateExhibitions([{ ...exhibit('first', 'Test/a'), cover: 'Test/b' }], images), /cover is outside/);
  assert.throws(() => validateExhibitions([{ ...exhibit('first', 'Test/a'), introductionEn: [] }], images), /Incomplete bilingual introduction/);
});

test('large archives are lossless, bounded per page and navigable in both languages without JavaScript', () => {
  const library = Array.from({ length: 10003 }, (_, id) => ({ id }));
  const parts = archivePages(library);
  assert.equal(parts.length, 139);
  assert.ok(parts.every(part => part.images.length <= ARCHIVE_PAGE_SIZE));
  assert.deepEqual(parts.flatMap(part => part.images), library);
  assert.equal(new Set(parts.flatMap(part => part.images.map(image => image.id))).size, library.length);
  assert.equal(parts.at(-1).images.length, 67);
  assert.equal(archivePages([]).length, 1);
  for (const english of [false, true]) {
    const html = pagination({ page: 70, pages: parts.length, total: library.length, category: '海 边', t: (zh, en) => english ? en : zh, local: path => (english ? '/en' : '') + path });
    const dom = new JSDOM(html), doc = dom.window.document;
    assert.ok(doc.querySelectorAll('a').length <= 7);
    assert.equal(doc.querySelector('[aria-current]').textContent, '70');
    assert.equal(doc.querySelector('[rel=next]').getAttribute('href'), (english ? '/en' : '') + archivePath('海 边', 71));
    assert.equal(doc.querySelector('[rel=prev]').getAttribute('href'), (english ? '/en' : '') + archivePath('海 边', 69));
    dom.window.close();
  }
});

test('inventory records the entire library, reservations, identical previews and changes under stable IDs', () => {
  const metadata = new Map(images.map((image, index) => [image.preview, { width: 960, height: 640, sha256: index < 2 ? 'same' : 'different' }]));
  const inventory = createInventory(images, [exhibit('first', 'Test/a')], metadata);
  assert.equal(inventory.total, 3); assert.equal(inventory.reserved, 1); assert.equal(inventory.available, 2);
  assert.deepEqual(inventory.duplicatePreviews, [['Test/a', 'Test/b']]);
  const next = structuredClone(inventory);
  next.photographs = next.photographs.filter(image => image.id !== 'Test/c');
  next.photographs[1].sha256 = 'changed';
  next.photographs.push({ id: 'Test/new', sha256: 'new', original: 'https://images.test/new.jpg' });
  assert.deepEqual(inventoryDiff(inventory, next), { added: ['Test/new'], removed: ['Test/c'], changed: ['Test/b'] });
  assert.equal(createInventory(images, [], metadata).libraryFingerprint, inventory.libraryFingerprint);
});

test('retired generated routes disappear from root deployment without deleting source manifests or current pages', () => {
  const root = mkdtempSync(join(tmpdir(), 'gallery-retired-'));
  try {
    for (const name of ['old', 'current']) {
      mkdirSync(join(root, 'exhibitions', name), { recursive: true });
      writeFileSync(join(root, 'exhibitions', name, 'index.html'), 'generated');
      writeFileSync(join(root, 'exhibitions', name + '.json'), '{}');
    }
    cleanStalePages(['/exhibitions/old/', '/exhibitions/current/'], ['/exhibitions/current/'], root);
    assert.equal(existsSync(join(root, 'exhibitions/old/index.html')), false);
    assert.equal(existsSync(join(root, 'exhibitions/current/index.html')), true);
    assert.equal(existsSync(join(root, 'exhibitions/old.json')), true);
    assert.throws(() => cleanStalePages(['/works/%2e%2e/%2e%2e/outside/'], [], root), /Unsafe generated route/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the published index links to distinct exhibition pages; complete bilingual archives contain every photo exactly once', () => {
  const publicExhibitions = readExhibitions().filter(exhibition => exhibition.status !== 'draft');
  const data = JSON.parse(readFileSync('gallery-index.json', 'utf8'));
  const libraryIds = Object.values(data.gallery).flatMap(album => album.images.map(image => image.category + '/' + image.name)).sort();
  const routes = JSON.parse(readFileSync('dist/public/archive-routes.json', 'utf8'));
  assert.deepEqual(Object.keys(routes).sort(), libraryIds);
  for (const prefix of ['', '/en']) {
    const doc = new JSDOM(readFileSync(`dist${prefix}/index.html`, 'utf8')).window.document;
    assert.equal(doc.querySelectorAll('[data-photo]').length, 0);
    assert.deepEqual([...doc.querySelectorAll('.exhibition-card')].map(link => link.getAttribute('href')), publicExhibitions.map(exhibition => `${prefix}/exhibitions/${exhibition.slug}/`));
    const selected = [];
    for (const exhibition of publicExhibitions) {
      const page = new JSDOM(readFileSync(`dist${prefix}/exhibitions/${exhibition.slug}/index.html`, 'utf8')).window.document;
      const ids = [...page.querySelectorAll('[data-photo-id]')].map(photo => photo.dataset.photoId);
      assert.deepEqual(ids, exhibitionPhotoIds(exhibition)); selected.push(...ids);
    }
    assert.equal(new Set(selected).size, selected.length);
    const archiveIds = archivePages(libraryIds).flatMap(part => {
      const page = new JSDOM(readFileSync('dist' + prefix + archivePath('', part.number) + 'index.html', 'utf8')).window.document;
      const ids = [...page.querySelectorAll('[data-photo-id]')].map(photo => photo.dataset.photoId);
      for (const id of ids) assert.equal(routes[id].all, archivePath('', part.number));
      return ids;
    });
    assert.deepEqual(archiveIds.sort(), libraryIds);
  }
});
