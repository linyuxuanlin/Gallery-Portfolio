import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import { site } from '../scripts/site-config.js';

const root = new URL('../', import.meta.url).pathname;
function pages(directory = 'dist') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() && entry.name !== 'public' ? pages(path) : entry.name === 'index.html' || entry.name === '404.html' ? [path] : [];
  });
}

test('published pages have distinct metadata, matching bilingual canonicals, valid structured data and reachable links', () => {
  const titles = new Set(); let count = 0;
  for (const file of pages()) {
    const urlPath = '/' + file.replace(/^dist\//, '').replace(/index\.html$/, '');
    const dom = new JSDOM(readFileSync(file, 'utf8'), { url: site.url + urlPath });
    const doc = dom.window.document, english = urlPath.startsWith('/en/');
    assert.equal(doc.querySelectorAll('h1').length, 1, file);
    const canonical = doc.querySelector('link[rel="canonical"]').href;
    assert.equal(canonical, site.url + urlPath, file);
    assert.equal(doc.querySelector('meta[property="og:url"]').content, canonical);
    const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
    const page = graph.find(item => item['@id'] === canonical + '#webpage');
    assert.equal(page.inLanguage, english ? 'en' : 'zh-CN');
    if (file.endsWith('404.html')) {
      assert.match(doc.querySelector('meta[name="robots"]').content, /noindex/);
    } else {
      count++;
      assert.ok(!titles.has(doc.title), 'duplicate page title: ' + doc.title); titles.add(doc.title);
      assert.match(doc.querySelector('meta[name="robots"]').content, /max-image-preview:large/);
      const basePath = english ? urlPath.slice(3) : urlPath;
      assert.equal(doc.querySelector('link[hreflang="zh-CN"]').href, site.url + basePath);
      assert.equal(doc.querySelector('link[hreflang="en"]').href, site.url + '/en' + basePath);
      assert.equal(doc.querySelector('link[hreflang="x-default"]').href, site.url + basePath);
      const person = graph.find(item => item['@type'] === 'Person');
      assert.equal(person.email, site.email);
      assert.equal(person.homeLocation.name, site.city[english ? 'en' : 'zh']);
    }
    for (const element of doc.querySelectorAll('a[href], img[src], link[rel="stylesheet"], script[src]')) {
      const url = new URL(element.getAttribute('href') || element.getAttribute('src'), canonical);
      if (url.origin !== site.url) continue;
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
      const target = join('dist', relative.endsWith('/') || !relative ? relative + 'index.html' : relative);
      assert.ok(existsSync(target), `${file} links to missing ${url.pathname}`);
      if (url.hash && element.tagName === 'A' && target.endsWith('.html')) {
        const destination = new JSDOM(readFileSync(target, 'utf8')).window.document;
        assert.ok(destination.getElementById(url.hash.slice(1)), 'missing anchor: ' + url.href);
      }
    }
    dom.window.close();
  }
  assert.equal(count, 70);
  assert.ok(readFileSync('dist/index.html', 'utf8').includes('上海摄影师'));
  assert.ok(!readFileSync('dist/index.html', 'utf8').includes('location.replace'));
});

test('image srcset describes actual pixel widths and page-specific social images are available', async () => {
  const cache = new Map();
  const info = async url => {
    if (!cache.has(url)) cache.set(url, await sharp(readFileSync(join(root, url.replace(/^\//, '')))).metadata());
    return cache.get(url);
  };
  for (const file of pages()) {
    const dom = new JSDOM(readFileSync(file, 'utf8'));
    for (const image of dom.window.document.querySelectorAll('img[srcset]')) {
      for (const source of image.getAttribute('srcset').split(',')) {
        const [url, descriptor] = source.trim().split(/\s+/);
        assert.equal(Number(descriptor.slice(0, -1)), (await info(url)).width, file + ' ' + url);
      }
    }
    const doc = dom.window.document, image = new URL(doc.querySelector('meta[property="og:image"]').content);
    assert.equal(image.origin, site.url);
    const dimensions = await info(image.pathname);
    assert.equal(Number(doc.querySelector('meta[property="og:image:width"]').content), dimensions.width);
    assert.equal(Number(doc.querySelector('meta[property="og:image:height"]').content), dimensions.height);
    dom.window.close();
  }
});

test('sitemap lists only published pages, reciprocal language variants and a preferred preview for every photograph', () => {
  const doc = new JSDOM(readFileSync('dist/sitemap.xml', 'utf8'), { contentType: 'application/xml' }).window.document;
  const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
  const entries = [...doc.getElementsByTagNameNS(ns, 'url')], images = new Set();
  assert.equal(entries.length, 70);
  const paths = new Set();
  for (const entry of entries) {
    const url = new URL(entry.getElementsByTagNameNS(ns, 'loc')[0].textContent);
    assert.equal(url.origin, site.url); assert.ok(!url.pathname.endsWith('404.html'));
    assert.ok(!paths.has(url.pathname)); paths.add(url.pathname);
    assert.ok(existsSync(join('dist', decodeURIComponent(url.pathname).slice(1), 'index.html')));
    assert.equal(entry.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link').length, 3);
    for (const image of entry.getElementsByTagNameNS('http://www.google.com/schemas/sitemap-image/1.1', 'loc')) images.add(image.textContent);
  }
  const data = JSON.parse(readFileSync('gallery-index.json', 'utf8'));
  const expected = new Set(Object.values(data.gallery).flatMap(album => album.images.map(image => site.url + (image.largePreview || image.preview))));
  assert.deepEqual(images, expected);
  assert.equal(images.size, 318);
  assert.ok(readFileSync('dist/robots.txt', 'utf8').includes(site.url + '/sitemap.xml'));
});

test('commission pages describe the real service area and preserve direct enquiry and licensing paths', () => {
  for (const prefix of ['', 'en/']) {
    const doc = new JSDOM(readFileSync(`dist/${prefix}photography/index.html`, 'utf8')).window.document;
    const english = prefix === 'en/';
    const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
    const service = graph.find(item => item['@type'] === 'WebPage').mainEntity;
    assert.equal(service.areaServed.name, site.city[english ? 'en' : 'zh']);
    assert.deepEqual(service.serviceType, site.services.map(item => item[english ? 'en' : 'zh']));
    assert.ok(doc.getElementById('licensing'));
    const mail = doc.querySelector('a[href^="mailto:"]').getAttribute('href');
    assert.ok(mail.startsWith('mailto:' + site.email)); assert.ok(new URL(mail).searchParams.get('body').length > 40);
  }
});
