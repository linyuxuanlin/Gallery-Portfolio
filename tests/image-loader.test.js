import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

function setup() {
    const dom = new JSDOM(`<header></header><div id="loading"></div><div id="gallery"></div><footer></footer><div id="myModal" tabindex="-1"><button class="close"></button><img id="img01"><div id="exif-info"></div><button id="load-original-btn"></button><button id="zoom-original-btn" hidden></button><a id="original-link"></a></div>`, { url: 'https://gallery.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    const { window } = dom;
    const requests = [];
    window.Image = function () {
        const image = window.document.createElement('img');
        Object.defineProperty(image, 'src', {
            get() { return image.getAttribute('src') || ''; },
            set(url) { image.setAttribute('src', url); requests.push({ image, url, onload: image.onload, onerror: image.onerror }); },
        });
        Object.defineProperties(image, { naturalWidth: { value: 7008 }, naturalHeight: { value: 4672 } });
        return image;
    };
    window.eval(readFileSync('public/data-loader.js', 'utf8'));
    window.eval(readFileSync('public/image-loader.js', 'utf8'));
    const data = new window.DataLoader();
    const images = Array.from({ length: 40 }, (_, i) => ({ name: `photo-${i}`, original: `https://media.test/original-${i}.jpg`, preview: `https://media.test/preview-${i}.webp` }));
    data.galleryData = { gallery: { A: { images }, B: { images: [{ name: 'B', original: 'https://media.test/B.jpg', preview: 'https://media.test/B.webp' }] } } };
    const loader = new window.ImageLoader(window.document.getElementById('gallery'), data);
    loader.setupModalEvents();
    return { dom, window, loader, requests, images };
}

test('loads all photos once with bounded parallel preview requests and no original requests', () => {
    const { dom, loader, requests, images } = setup();
    try {
        loader.filterImages('A');
        assert.equal(requests.length, 4);
        for (let i = 0; i < requests.length; i++) {
            assert.ok(loader.activeLoads <= 4);
            requests[i].onload();
        }
        assert.equal(requests.length, images.length);
        assert.equal(new Set(requests.map(r => r.url)).size, images.length);
        assert.equal(loader.galleryElement.querySelectorAll('img').length, images.length);
        assert.ok(requests.every(r => r.url.includes('preview-')));
    } finally { loader.filterImages('missing'); dom.window.close(); }
});

test('missing preview does not download original; stale category callbacks cannot insert old photos', () => {
    const { dom, loader, requests } = setup();
    try {
        loader.filterImages('A');
        const stale = requests[0];
        stale.onerror();
        assert.ok(!requests.some(r => r.url.includes('original-')));
        assert.equal(loader.galleryElement.querySelectorAll('.preview-error').length, 1);
        loader.filterImages('B');
        stale.onload();
        const current = requests.find(r => r.url.endsWith('/B.webp'));
        current.onload();
        assert.equal(loader.galleryElement.querySelectorAll('img').length, 1);
        assert.equal(loader.galleryElement.querySelector('img').alt, 'B');
    } finally { loader.filterImages('missing'); dom.window.close(); }
});

test('original is requested only on demand; an old modal callback cannot replace the new photo', () => {
    const { dom, window, loader, requests } = setup();
    try {
        loader.openModal('https://media.test/one.jpg', 'https://media.test/one.webp');
        assert.equal(requests.length, 0);
        loader.loadOriginalImage();
        const stale = requests[0];
        loader.openModal('https://media.test/two.jpg', 'https://media.test/two.webp');
        stale.onload();
        assert.ok(window.document.getElementById('img01').src.endsWith('/two.webp'));
        loader.loadOriginalImage();
        requests[1].onload();
        assert.ok(window.document.getElementById('img01').src.endsWith('/two.jpg'));
        Object.defineProperty(window.document.getElementById('img01'), 'naturalWidth', { value: 7008 });
        window.document.getElementById('zoom-original-btn').click();
        assert.ok(window.document.getElementById('myModal').classList.contains('original-size'));
        assert.equal(window.document.getElementById('img01').style.width, '7008px');
        assert.equal(window.document.getElementById('original-link').href, 'https://media.test/two.jpg');
        loader.closeModal();
        assert.equal(window.document.getElementById('myModal').style.display, 'none');
    } finally { loader.closeModal(); dom.window.close(); }
});
