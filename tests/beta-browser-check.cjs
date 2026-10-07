const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { chromium, webkit } = require('playwright');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'dist');
const data = JSON.parse(fs.readFileSync(path.join(root, 'gallery-index.json')));
const selection = JSON.parse(fs.readFileSync(path.join(root, 'curation.json')));
const name = process.env.GALLERY_BROWSER || 'webkit';
const originalURL = 'https://media.wiki-power.com/';
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
(async () => {
  const original = await sharp({ create: { width: 2160, height: 3240, channels: 3, background: '#477887' } }).jpeg().toBuffer();
  const server = http.createServer((req, res) => {
    let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end(fs.readFileSync(path.join(dist, '404.html'))); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await (name === 'webkit' ? webkit : chromium).launch(name === 'webkit' ? { headless: true } : { headless: true, executablePath: process.env.GALLERY_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] }).catch(error => { server.close(); throw error; });
  const inside = async (page, selector, viewport) => {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${selector} outside ${viewport.width}×${viewport.height}`);
  };
  const routes = ['/', '/works/', '/places/', '/about/', ...Object.keys(data.gallery).map(category => `/works/${category}/`)];
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900 });
      let originals = 0;
      await context.route(originalURL + '**', route => { originals++; return route.fulfill({ contentType: 'image/jpeg', body: original }); });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const route of routes) {
        await page.goto(origin + route);
        assert.equal(await page.locator('h1').count(), 1, route + ' missing heading');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, route + ' horizontal overflow');
        const expected = route === '/works/' ? 318 : route.startsWith('/works/') ? data.gallery[route.split('/')[2]].images.length : route === '/' ? selection.hero.length + selection.selected.length : route === '/about/' ? 1 : 0;
        assert.equal(await page.locator('[data-photo]').count(), expected, route + ' photo count');
        if (route === '/places/') assert.equal(await page.locator('.place-card').count(), 16);
        if (viewport.width <= 390) {
          await page.getByRole('button', { name: '打开导航', exact: true }).click();
          assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
          for (const link of await page.locator('#site-nav a').all()) assert.equal(await link.isVisible(), true);
          await page.keyboard.press('Escape'); assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
        }
        if (expected) {
          const before = originals;
          await page.locator('[data-photo]').first().click();
          await page.locator('#viewer[open]').waitFor();
          await page.waitForFunction(() => document.querySelector('#viewer-image').naturalWidth > 0);
          assert.equal(originals, before, 'original requested before user action');
          await inside(page, '#viewer-image', viewport); await inside(page, '#viewer-close', viewport);
          await inside(page, '#viewer-original', viewport); await inside(page, '#viewer-link', viewport);
          await page.locator('#viewer-original').click(); await page.getByText('原图 2160 × 3240', { exact: true }).waitFor();
          await page.waitForFunction(() => document.querySelector('#viewer-image').naturalWidth === 2160);
          await page.locator('#viewer-zoom').click();
          assert.equal(Math.round((await page.locator('#viewer-image').boundingBox()).width), 2160);
          await inside(page, '#viewer-close', viewport); await inside(page, '#viewer-link', viewport);
          await page.locator('#viewer-zoom').click(); await inside(page, '#viewer-image', viewport);
          if (expected > 1) {
            await page.getByRole('button', { name: '下一张作品' }).click();
            assert.equal(await page.locator('#viewer-original').isVisible(), true, 'original state leaked into next photo');
            await page.getByRole('button', { name: '上一张作品' }).click();
            assert.equal(await page.getByRole('button', { name: '上一张作品' }).isEnabled(), false);
          }
          await page.keyboard.press('Escape'); await page.locator('#viewer').waitFor({ state: 'hidden' });
          await page.waitForFunction(() => !document.body.classList.contains('viewer-open'));
          assert.equal(await page.locator('body').evaluate(body => body.classList.contains('viewer-open')), false);
        }
        console.log(`${name} ${viewport.width}px ${route}: layout, navigation, ${expected} photos and viewer passed`);
      }
      await page.goto(origin + '/places/'); await page.locator('.place-card').first().click(); await page.waitForURL(origin + '/works/Australia/');
      await page.reload(); assert.equal(await page.locator('[data-photo]').count(), 38);
      await page.goBack(); await page.waitForURL(origin + '/places/'); await page.goForward(); await page.waitForURL(origin + '/works/Australia/');
      await page.goto(origin + '/missing-page/'); assert.ok((await page.locator('h1').innerText()).includes('尚未抵达'));
      if (process.env.GALLERY_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.GALLERY_SCREENSHOT_DIR, { recursive: true });
        await page.goto(origin); await page.waitForFunction(() => [...document.querySelectorAll('.hero-pair img')].every(img => img.complete && img.naturalWidth > 0));
        await page.screenshot({ path: path.join(process.env.GALLERY_SCREENSHOT_DIR, `beta-home-${viewport.width}.png`), fullPage: viewport.width >= 1440 });
        await page.locator('[data-photo]').first().click(); await page.waitForFunction(() => document.querySelector('#viewer-image').naturalWidth > 0);
        await page.screenshot({ path: path.join(process.env.GALLERY_SCREENSHOT_DIR, `beta-viewer-${viewport.width}.png`) });
      }
      assert.deepEqual(errors, []); await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const page = await context.newPage();
    let fail = true;
    await context.route(originalURL + '**', route => route.fulfill(fail ? { status: 503 } : { contentType: 'image/jpeg', body: original }));
    await page.goto(origin); await page.locator('[data-photo]').first().click();
    await page.locator('#viewer-original').click(); await page.getByRole('button', { name: '重试加载原图' }).waitFor();
    fail = false; await page.getByRole('button', { name: '重试加载原图' }).click(); await page.locator('#viewer-zoom').waitFor();
    await page.locator('#viewer-link').focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'viewer-close');
    await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'viewer-link');
    const popupPromise = context.waitForEvent('page'); await page.locator('#viewer-link').click(); const popup = await popupPromise; assert.ok(popup.url().startsWith(originalURL)); await popup.close();
    await page.keyboard.press('Escape'); await page.locator('#viewer').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !document.body.classList.contains('viewer-open'));
    await page.locator('[data-photo]').first().click();
    await context.unroute(originalURL + '**'); await context.route(originalURL + '**', () => {});
    await page.clock.install(); await page.locator('#viewer-original').click(); await page.clock.fastForward(61000); await page.getByRole('button', { name: '重试加载原图' }).waitFor();
    await page.keyboard.press('Escape');
    console.log('PASS retry, timeout, original link, focus trap and close'); await context.close();
    const noJS = await browser.newContext({ javaScriptEnabled: false }); const staticPage = await noJS.newPage();
    await staticPage.goto(origin + '/works/'); assert.equal(await staticPage.locator('[data-photo]').count(), 318); assert.ok((await staticPage.locator('[data-photo]').first().getAttribute('href')).startsWith(originalURL));
    await noJS.close(); console.log('PASS photos and navigation without JavaScript');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
