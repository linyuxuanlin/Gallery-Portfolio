import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';
import { importPlan } from '../scripts/import-beta-library.js';

const data = JSON.parse(readFileSync('gallery-index.json', 'utf8'));
const photographs = Object.values(data.gallery).flatMap(album => album.images);
const releasePath = 'photo-edits/2026-10-14-v1.json';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('every displayed photograph has traceable conventional edits and preserved source versions', async () => {
  assert.ok(existsSync(releasePath), 'A complete retouch manifest must accompany the gallery release');
  const manifest = JSON.parse(readFileSync(releasePath, 'utf8'));
  const edits = new Map(manifest.photographs.map(photo => [photo.id, photo]));
  assert.equal(edits.size, photographs.length);
  assert.equal(manifest.newHDRInformation, false);
  for (const photo of photographs) {
    const id = photo.category + '/' + photo.name, edit = edits.get(id);
    assert.equal(edit.sourceURL, photo.original, id);
    assert.match(photo.original, /^https:\/\/media\.wiki-power\.com\/gallery\//);
    assert.equal(edit.sourceSHA256, photo.originalContentSHA256);
    assert.equal(edit.editedFull.url, photo.editedOriginal);
    assert.equal(edit.editedFull.sha256, photo.editedContentSHA256);
    assert.match(photo.editedOriginal, /^https:\/\/media\.wiki-power\.com\/gallery-edits\/2026-10-14\/v1\//);
    assert.notEqual(photo.editedOriginal, photo.original);
    assert.deepEqual(edit.displayDimensions, [photo.width, photo.height]);
    assert.equal(edit.visualQA.wholeFrame, true); assert.equal(edit.visualQA.nativePixelCrop, true);
    assert.ok(edit.recipe.note.trim() && edit.recipe.masks.length && edit.recipe.visualReview.sourceFrameReviewed);
    for (const [size, field] of [[960, 'preview'], [1600, 'largePreview']]) {
      const preview = edit.previews[size], bytes = readFileSync(decodeURIComponent(photo[field].slice(1)));
      assert.equal(digest(bytes), preview.sha256);
      const info = await sharp(bytes).metadata();
      assert.equal(info.width, preview.width); assert.equal(info.height, preview.height);
      assert.equal(info.hasProfile, true, id + ' must have a tagged sRGB preview');
      assert.ok(Math.abs(info.width / info.height - photo.width / photo.height) < .004);
      if (edit.previousPreviews[field]) {
        assert.ok(existsSync(decodeURIComponent(edit.previousPreviews[field].slice(1))), 'Earlier previews must remain available');
      }
    }
  }
});

test('viewer opens retouched full size and fragment fallback stays on the photograph page', () => {
  const photo = photographs.find(image => image.category === 'Kyoto' && image.name === 'DSC02777');
  const dom = new JSDOM(readFileSync('dist/photographs/Kyoto/DSC02777/index.html', 'utf8'));
  const trigger = dom.window.document.querySelector('[data-photo]');
  assert.equal(trigger.getAttribute('data-original'), photo.editedOriginal);
  assert.ok(trigger.getAttribute('href').startsWith('#preview-'));
  assert.equal(trigger.hasAttribute('download'), false);
  assert.equal(dom.window.document.querySelector('#viewer-original').textContent, '加载大图');
  dom.window.close();
});

test('reimport retains current edits and invalidates them when the author replaces a source', () => {
  const photo = photographs[0], key = decodeURIComponent(new URL(photo.original).pathname.slice(1));
  const previous = { gallery: { [photo.category]: { images: [photo] } } };
  const original = { complete: true, objects: [{ Key: key, LastModified: photo.sourceModified }] };
  assert.equal(importPlan(original, previous)[0].image.editedOriginal, photo.editedOriginal);
  const replacement = { complete: true, objects: [{ Key: key, LastModified: new Date(Date.parse(photo.sourceModified) + 1000).toISOString() }] };
  const imported = importPlan(replacement, previous)[0];
  assert.equal(imported.needsPreview, true); assert.equal(imported.image.editedOriginal, undefined);
  assert.equal(imported.image.editVersion, undefined);
});
