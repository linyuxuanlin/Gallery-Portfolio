import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { createPreview, ensurePreviewExists } from '../generate-webp-thumbnail-r2.js';
import { imagePaths, publicObjectUrl } from '../scripts/image-paths.js';

test('preview bounds both portrait and landscape, preserves small images and EXIF orientation', async () => {
    for (const [width, height, expected] of [[2400, 1600, [960, 640]], [1600, 2400, [640, 960]], [120, 80, [120, 80]]]) {
        const source = await sharp({ create: { width, height, channels: 3, background: '#dd8833' } }).jpeg().toBuffer();
        const { data, info } = await createPreview(source);
        assert.deepEqual([info.width, info.height], expected);
        assert.equal((await sharp(data).metadata()).format, 'webp');
    }
    const rotated = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#dd8833' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const { info } = await createPreview(rotated);
    assert.deepEqual([info.width, info.height], [640, 960]);
});

test('old full-size previews migrate; matching previews skip; changed sources regenerate without modifying originals', async () => {
    const buffer = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#33bb66' } }).jpeg().toBuffer();
    let metadata = {};
    const commands = [];
    const client = { send: async command => {
        commands.push(command);
        switch (command.constructor.name) {
            case 'HeadObjectCommand': return { Metadata: metadata };
            case 'GetObjectCommand': return { Body: Readable.from([buffer]) };
            case 'PutObjectCommand': metadata = command.input.Metadata; return {};
            default: throw new Error('Unexpected S3 write');
        }
    } };
    const options = { client, bucket: 'test', imageDirectory: 'gallery', quality: 80, maxEdge: 960 };
    const source = { Key: 'gallery/风光/河流.JPG', ETag: 'first' };
    await ensurePreviewExists(source, options);
    assert.equal(commands.filter(c => c.constructor.name === 'PutObjectCommand').length, 1);
    const put = commands.find(c => c.constructor.name === 'PutObjectCommand');
    assert.equal(put.input.Key, 'gallery/0_preview/风光/河流.webp');
    await ensurePreviewExists(source, options);
    assert.equal(commands.filter(c => c.constructor.name === 'GetObjectCommand').length, 1);
    await ensurePreviewExists({ ...source, ETag: 'updated' }, options);
    assert.equal(commands.filter(c => c.constructor.name === 'PutObjectCommand').length, 2);
    assert.ok(commands.filter(c => c.constructor.name === 'PutObjectCommand').every(c => c.input.Key.includes('/0_preview/')));
});

test('preview listing excludes preview trees, preserves nested paths and encodes object names', () => {
    assert.equal(imagePaths('0_preview/China/a.webp'), null);
    assert.equal(imagePaths('gallery/0_preview/China/a.webp', 'gallery'), null);
    assert.equal(imagePaths('gallery-other/China/a.JPG', 'gallery'), null);
    assert.equal(imagePaths('gallery/China/a.RAW', 'gallery'), null);
    assert.equal(imagePaths('gallery/China/trip/a.JPG', 'gallery').previewKey, 'gallery/0_preview/China/trip/a.webp');
    assert.equal(publicObjectUrl('https://example.test/', 'gallery/风光/a #1.JPG'), 'https://example.test/gallery/%E9%A3%8E%E5%85%89/a%20%231.JPG');
});

test('category shuffle does not mutate the source index or drop photos', () => {
    const window = {};
    vm.runInNewContext(readFileSync('public/data-loader.js', 'utf8'), { window });
    const loader = new window.DataLoader();
    const images = Array.from({ length: 100 }, (_, i) => ({ original: `photo-${i}` }));
    loader.galleryData = { gallery: { test: { images } } };
    const shuffled = loader.getImagesByCategory('test');
    assert.deepEqual(images.map(x => x.original), Array.from({ length: 100 }, (_, i) => `photo-${i}`));
    assert.equal(new Set(shuffled.map(x => x.original)).size, 100);
    assert.notEqual(shuffled, images);
});

test('build includes only public assets, independent of local credentials or scripts', () => {
    execFileSync(process.execPath, ['scripts/build-beta.js']);
    assert.deepEqual(readdirSync('dist').sort(), ['404.html', '_headers', '_redirects', 'about', 'en', 'index.html', 'photographs', 'photography', 'places', 'public', 'robots.txt', 'sitemap.xml', 'works']);
    assert.equal(existsSync('dist/works/Australia/index.html'), true);
    assert.equal(existsSync('dist/en/works/Australia/index.html'), true);
    assert.equal(existsSync('dist/.env'), false);
    assert.equal(existsSync('dist/node_modules'), false);
    assert.equal(existsSync('dist/generate-webp-thumbnail-r2.js'), false);
});
