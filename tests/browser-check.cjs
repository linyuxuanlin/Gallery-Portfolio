const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const engines=require('playwright');
const browserName=process.env.GALLERY_BROWSER || 'chromium';
const engine=engines[browserName];
if(!engine || !['chromium','webkit'].includes(browserName))throw new Error('Use GALLERY_BROWSER=chromium or webkit');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
const preview=await sharp({create:{width:960,height:1440,channels:3,background:'#377f91'}}).webp().toBuffer();
const original=await sharp({create:{width:2160,height:3240,channels:3,background:'#326b86'}}).jpeg().toBuffer();
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;let f=path.join(root,p);if(!path.extname(p))f=path.join(root,'index.html');if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type', f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':f.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(f));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await engine.launch(browserName==='chromium'?{executablePath:process.env.GALLERY_CHROMIUM_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true}:{headless:true}).catch(error=>{server.close();throw error;});
try {
const data=JSON.parse(fs.readFileSync(path.join(root,'gallery-index.json'))); const categories=Object.keys(data.gallery);
for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:768,height:1024},{width:1440,height:900}]) {
 const ctx=await browser.newContext({viewport,isMobile:viewport.width<=844,hasTouch:viewport.width<=844});
 let originalRequests=0; await ctx.route('https://media.wiki-power.com/**',r=>{const isPreview=r.request().url().includes('/0_preview/');if(!isPreview)originalRequests++;return r.fulfill({contentType:isPreview?'image/webp':'image/jpeg',body:isPreview?preview:original});});
 const page=await ctx.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.locator('.gallery img').first().waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
 await page.locator('.gallery img').first().click();
 const close=await page.locator('.close').boundingBox();assert.equal(close.width,44);assert.equal(close.height,44);
 const inside=async selector=>{const b=await page.locator(selector).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,selector+' offscreen');};
 await inside('#img01');await inside('.close');await inside('#original-link');await inside('#load-original-btn');
 if(process.env.GALLERY_SCREENSHOT_DIR){fs.mkdirSync(process.env.GALLERY_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.GALLERY_SCREENSHOT_DIR,`modal-${viewport.width}.png`)});}
 assert.equal(originalRequests,0,'original loaded automatically');
 await page.locator('#load-original-btn').click();await page.locator('#exif-info').getByText('原图 2160 × 3240',{exact:true}).waitFor();
 await inside('#zoom-original-btn');await page.locator('#zoom-original-btn').click();assert.equal(Math.round((await page.locator('#img01').boundingBox()).width),2160);
 await inside('.close');await inside('#original-link');await inside('#zoom-original-btn');
 await page.locator('#zoom-original-btn').click();await inside('#img01');await page.keyboard.press('Escape');assert.equal(await page.locator('#myModal').isVisible(),false);
 await page.locator('#theme-toggle').click();assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('dark')));await page.reload();assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('dark')));
 await page.getByRole('button',{name:'Kyoto',exact:true}).click();await page.waitForURL('**/Kyoto');await page.getByRole('button',{name:'Tokyo',exact:true}).click();await page.waitForURL('**/Tokyo');await page.goBack();await page.waitForURL('**/Kyoto');await page.goBack();await page.waitForURL(origin+'/');await page.goForward();await page.waitForURL('**/Kyoto');
 await page.goto(origin+'/%E6%9C%AA%E7%9F%A5');await page.locator('.gallery img').first().waitFor();assert.equal(await page.locator('[data-tag="all"]').getAttribute('aria-pressed'),'true');
 if(viewport.width<=390||viewport.width===1440){
  for(const category of ['all',...categories]){
   await page.goto(origin+'/'+(category==='all'?'':encodeURIComponent(category)));await page.locator('.gallery img').first().waitFor();
   const expected=category==='all'?Object.values(data.gallery).reduce((sum,c)=>sum+c.images.length,0):data.gallery[category].images.length;
   for(let i=0;i<70&&await page.locator('.gallery img').count()<expected;i++){await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(40);}
   assert.equal(await page.locator('.gallery img').count(),expected,category+' missing pictures');assert.equal(await page.locator('.preview-error').count(),0);
   assert.equal(await page.locator(`[data-tag="${category}"]`).getAttribute('aria-pressed'),'true');
   if(viewport.width<=390){
    const selected=page.locator(`[data-tag="${category}"]`);
    assert.equal(await page.locator('.tag[aria-pressed="true"]').count(),1,'multiple selected categories');
    const nextName=category==='all'?categories[0]:'all';
    const next=page.locator(`[data-tag="${nextName}"]`);
    await next.hover({force:true});
    const nextStyle=await next.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
    assert.notEqual(nextStyle.background,'rgb(76, 175, 80)','touch hover looks selected');
    assert.notEqual(nextStyle.color,'rgb(0, 122, 255)','Safari native blue label');
    await next.tap();await selected.tap();
    assert.equal(await page.locator('.tag[aria-pressed="true"]').count(),1);
    await page.locator('.gallery img').first().waitFor();
    await page.locator('.gallery img').first().tap();await inside('.close');await inside('#load-original-btn');await inside('#original-link');
    await page.locator('#load-original-btn').tap();await page.locator('#zoom-original-btn').waitFor();await inside('#zoom-original-btn');
    await page.locator('#zoom-original-btn').tap();assert.equal(Math.round((await page.locator('#img01').boundingBox()).width),2160);
    await page.locator('#zoom-original-btn').tap();await inside('#img01');await page.locator('.close').tap();
    assert.equal(await page.locator('#myModal').isVisible(),false);
   }

   console.log(browserName+' '+viewport.width+'px '+category+': '+expected+' photos and mobile functions passed');
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS viewport '+viewport.width+'×'+viewport.height+' modal, original, zoom, theme, routes, history');await ctx.close();
}

// Failure paths use controlled media so no large originals are downloaded by the test.
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await ctx.newPage();
let indexFails=true, originalFails=true, originalRequests=0;
const category='风光 #1';
const fixture={gallery:{[category]:{images:[{name:'失败预览',preview:'https://media.wiki-power.com/fixture.webp',original:'https://media.wiki-power.com/fixture.jpg'}]}}};
await ctx.route('**/gallery-index.json',r=>r.fulfill({status:indexFails?503:200,contentType:'application/json',body:JSON.stringify(fixture)}));
await ctx.route('https://media.wiki-power.com/**',r=>{
 if(r.request().url().endsWith('.webp'))return r.fulfill({status:404});
 originalRequests++;
 return r.fulfill(originalFails?{status:503}:{contentType:'image/jpeg',body:original});
});
await page.goto(origin);
await page.getByRole('button',{name:'重新加载',exact:true}).waitFor();
indexFails=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();
await page.locator('.preview-error').waitFor();assert.equal(originalRequests,0);
await page.getByRole('button',{name:category,exact:true}).click();await page.waitForURL(origin+'/'+encodeURIComponent(category));
await page.reload();await page.locator('.preview-error').click();
await page.locator('#load-original-btn').click();await page.getByRole('button',{name:'重试加载原图',exact:true}).waitFor();
originalFails=false;await page.getByRole('button',{name:'重试加载原图',exact:true}).click();await page.locator('#zoom-original-btn').waitFor();
await page.locator('#zoom-original-btn').press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'original-link');
await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'close');
const popupPromise=ctx.waitForEvent('page');await page.locator('#original-link').click();const popup=await popupPromise;await popup.waitForLoadState();assert.ok(popup.url().endsWith('/fixture.jpg'));await popup.close();
await page.keyboard.press('Escape');assert.equal(await page.locator('header').evaluate(el=>el.inert),false);
await page.locator('.preview-error').click();await page.locator('.modal-stage').click({position:{x:1,y:1}});assert.equal(await page.locator('#myModal').isVisible(),false);
// A hanging original must become retryable, rather than leaving a disabled button forever.
await ctx.unroute('https://media.wiki-power.com/**');
await ctx.route('https://media.wiki-power.com/**',r=>r.request().url().endsWith('.webp')?r.fulfill({status:404}):undefined);
await page.locator('.preview-error').click();await page.clock.install();await page.locator('#load-original-btn').click();await page.clock.fastForward(61000);await page.getByRole('button',{name:'重试加载原图',exact:true}).waitFor();await page.keyboard.press('Escape');
console.log('PASS index retry, encoded routes, missing preview, original retry/timeout, focus trap, original link, background close');
await ctx.close();
// Auto scrolling stops on touch, photo opening, category selection and the final image.
const scrollCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const scrollPage=await scrollCtx.newPage();
await scrollCtx.route('https://media.wiki-power.com/**',r=>r.fulfill({contentType:'image/webp',body:preview}));
await scrollPage.goto(origin+'/Shanghai');await scrollPage.locator('.gallery img').first().waitFor();
await scrollPage.evaluate(()=>window.scrollTo(0,1000));await scrollPage.getByRole('button',{name:'开始自动滚动',exact:true}).click();
assert.equal(await scrollPage.getByRole('button',{name:'停止自动滚动',exact:true}).getAttribute('aria-pressed'),'true');
await scrollPage.locator('#gallery').dispatchEvent('touchstart');assert.equal(await scrollPage.locator('.scroll-to-bottom').getAttribute('aria-pressed'),'false');
await scrollPage.getByRole('button',{name:'开始自动滚动',exact:true}).click();await scrollPage.locator('.gallery img').first().dispatchEvent('click');assert.equal(await scrollPage.locator('.scroll-to-bottom').getAttribute('aria-pressed'),'false');await scrollPage.keyboard.press('Escape');
await scrollPage.evaluate(()=>window.scrollTo(0,1000));await scrollPage.getByRole('button',{name:'开始自动滚动',exact:true}).click();await scrollPage.getByRole('button',{name:'Kyoto',exact:true}).click();assert.equal(await scrollPage.locator('.scroll-to-bottom').getAttribute('aria-pressed'),'false');
for(let i=0;i<20&&await scrollPage.locator('.gallery img').count()<17;i++){await scrollPage.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await scrollPage.waitForTimeout(40);}
await scrollPage.locator('.gallery img').nth(16).waitFor();await scrollPage.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await scrollPage.getByRole('button',{name:'开始自动滚动',exact:true}).click();await scrollPage.waitForFunction(()=>document.querySelector('.scroll-to-bottom').getAttribute('aria-pressed')==='false');
console.log('PASS auto-scroll touch, modal, category and end-of-gallery stop');await scrollCtx.close();
const landscape=await sharp({create:{width:1440,height:960,channels:3,background:'#377f91'}}).webp().toBuffer();
for(const viewport of [{width:320,height:568},{width:844,height:390}]){
 const ctx=await browser.newContext({viewport});const page=await ctx.newPage();
 await ctx.route('**/gallery-index.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(fixture)}));
 await ctx.route('https://media.wiki-power.com/**',r=>r.fulfill({contentType:'image/webp',body:landscape}));
 await page.goto(origin);await page.locator('.gallery img').first().click();
 const rect=await page.locator('#img01').boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width+1&&rect.y+rect.height<=viewport.height+1);
 assert.ok(Math.abs(rect.width/rect.height-1.5)<0.01,'landscape aspect ratio distorted');
 await page.locator('.close').click();assert.equal(await page.locator('#myModal').isVisible(),false);await ctx.close();
 console.log('PASS landscape photo '+viewport.width+'×'+viewport.height);
}

}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
