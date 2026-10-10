import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { site, siteURL } from './site-config.js';
import { previewMetadata } from './image-metadata.js';
import { seoHead, sitemap, imageObject, escapeHTML } from './seo.js';
import { commissionBody } from './commission.js';
import { exhibitionIndexBody, exhibitionBody } from './exhibition.js';
import { readExhibitions, validateExhibitions, exhibitionPhotoIds, exhibitionPath, photographId } from './exhibitions.js';
import { archivePages, archivePath, pagination } from './archive.js';
import { cleanStalePages } from './generated-pages.js';

const data = JSON.parse(readFileSync('gallery-index.json', 'utf8'));
const selection = JSON.parse(readFileSync('curation.json', 'utf8'));
const artist = JSON.parse(readFileSync('artist.json', 'utf8'));
const exhibitions = readExhibitions();
const names = { Australia: ['澳大利亚', 'Australia'], Bankok: ['曼谷', 'Bangkok'], Chaozhou: ['潮州', 'Chaozhou'], Hongkong: ['香港', 'Hong Kong'], Jeju: ['济州岛', 'Jeju'], Kyoto: ['京都', 'Kyoto'], Macau: ['澳门', 'Macau'], Nanjing: ['南京', 'Nanjing'], Osaka: ['大阪', 'Osaka'], Other: ['途中', 'Elsewhere'], Shanghai: ['上海', 'Shanghai'], Singapore: ['新加坡', 'Singapore'], Tokyo: ['东京', 'Tokyo'], Vietnam: ['越南', 'Vietnam'], Xiamen: ['厦门', 'Xiamen'], exhibition: ['展览现场', 'Exhibitions'] };
const all = Object.values(data.gallery).flatMap(category => category.images);
const esc = escapeHTML;
const metadata = await previewMetadata(all);
const assetVersion = createHash('sha256').update(readFileSync('public/beta.css')).update(readFileSync('public/beta.js')).digest('hex').slice(0, 12);
const allById = new Map(all.map(image => [photographId(image), image]));
const captions = new Map(selection.photographs.map(image => [photographId(image), image]));
const registry = validateExhibitions(exhibitions, all, new Map(all.map(image => [photographId(image), metadata.get(image.preview).sha256])));
const publicExhibitions = registry.publicExhibitions;
const find = pick => {
  const id = photographId(pick), image = allById.get(id);
  if (!image) throw new Error(`Missing photograph: ${id}`);
  return { ...image, ...captions.get(id), ...pick };
};
const findId = id => {
  const image = allById.get(id);
  if (!image) throw new Error(`Missing photograph: ${id}`);
  return find(image);
};
const publicIds = publicExhibitions.flatMap(exhibitionPhotoIds);
for (const id of publicIds) {
  const caption = captions.get(id);
  if (!caption || !['title', 'titleEn', 'description', 'descriptionEn'].every(field => typeof caption[field] === 'string' && caption[field].trim())) throw new Error(`Public exhibition photograph needs a bilingual caption: ${id}`);
}
// Published caption records retain stable detail URLs even after a selection is revised.
const featured = [...new Set([...publicIds, ...selection.photographs.map(photographId)])].filter(id => allById.has(id)).map(findId);
const featuredIds = new Set(featured.map(photographId));
const primaryImage = publicExhibitions.length ? findId(publicExhibitions[0].cover) : findId(photographId(all[0]));
let language = 'zh';
const t = (zh, en) => language === 'en' ? en : zh;
const local = path => language === 'en' ? '/en' + path : path;
const english = category => names[category]?.[1] || category;
const place = category => t(names[category]?.[0] || category, english(category));
const categoryPath = category => local(`/works/${encodeURIComponent(category)}/`);
const detailPath = image => `/photographs/${encodeURIComponent(image.category)}/${encodeURIComponent(image.name)}/`;
const emailHref = () => `mailto:${site.email}?subject=${encodeURIComponent(t('摄影合作与作品咨询', 'Photography commission and licensing enquiry'))}&body=${encodeURIComponent(t('项目类型：\n拍摄地点：\n日期与时长：\n参考作品链接：\n交付与使用需求：\n预算：\n联系方式：\n', 'Project type:\nLocation:\nDate and duration:\nReference photograph links:\nDeliverables and usage:\nBudget:\nContact details:\n'))}`;
const photo = (image, index = 0, large = false, priority = false, sizes = '(max-width: 700px) calc(100vw - 40px), (max-width: 1560px) 45vw, 650px') => {
  const label = t(image.title, image.titleEn) || `${place(image.category)} · ${image.name}`;
  const full = large && image.largePreview ? image.largePreview : image.preview;
  const preview = metadata.get(image.preview), fullSize = metadata.get(full);
  const hasDetail = featuredIds.has(image.category + '/' + image.name);
  return `<figure class="photo${large ? ' photo-large' : ''}"><a class="photo-open" href="${esc(image.original)}" target="_blank" rel="noopener noreferrer" data-photo data-photo-id="${esc(image.category + '/' + image.name)}" ${hasDetail ? `data-share-url="${esc(siteURL(local(detailPath(image))))}"` : ''} data-preview="${esc(full)}" data-title="${esc(label)}" data-place="${esc(place(image.category))}" aria-label="${t('查看作品：', 'View photograph: ')}${esc(label)}"><img src="${esc(image.preview)}" ${full !== image.preview ? `srcset="${esc(image.preview)} ${preview.width}w, ${esc(full)} ${fullSize.width}w" sizes="${esc(sizes)}"` : ''} width="${preview.width}" height="${preview.height}" alt="${esc(t(image.description, image.descriptionEn) || label)}" loading="${priority ? 'eager' : 'lazy'}" ${priority ? 'fetchpriority="high"' : ''} decoding="async"></a><figcaption>${hasDetail ? `<a class="photo-title" href="${local(detailPath(image))}">${esc(label)}</a>` : `<span>${esc(label)}</span>`}<span class="photo-index">${String(index + 1).padStart(2, '0')} / ${esc(english(image.category))}</span></figcaption></figure>`;
};
const nav = (active, path) => `<a class="skip" href="#main">${t('跳到作品', 'Skip to content')}</a><header class="site-header"><a class="wordmark" href="${local('/')}" aria-label="${t('Power’s Gallery 首页', 'Power’s Gallery home')}">Power’s Gallery<span>PHOTOGRAPHY</span></a><div class="header-controls"><a class="language-switch" href="${language === 'en' ? path : '/en' + path}" data-language="${t('en', 'zh')}" lang="${t('en', 'zh-CN')}" aria-label="${t('Switch to English', '切换为中文')}">${t('EN', '中')}</a><button class="menu-toggle" type="button" aria-label="${t('打开导航', 'Open navigation')}" aria-expanded="false" aria-controls="site-nav"><span></span><span></span></button></div><nav id="site-nav" aria-label="${t('主导航', 'Main navigation')}">${[['exhibitions', '/', '展览', 'Exhibitions'], ['works', '/works/', '作品', 'Works'], ['places', '/places/', '地点', 'Places'], ['about', '/about/', '关于', 'About']].map(([key, href, zh, en]) => `<a href="${local(href)}" ${active === key ? 'aria-current="page"' : ''}>${t(zh, en)}<span>${t(en.toUpperCase(), { exhibitions: 'SELECTED WORKS', works: 'PHOTOGRAPHS', places: 'JOURNEYS', about: 'ARTIST' }[key])}</span></a>`).join('')}</nav></header>`;
const footer = () => `<footer class="site-footer"><a class="footer-name" href="${local('/')}">Power’s Gallery</a><p>${t('作品选辑与影像档案', 'Selected works & photographic archive')}<span>PHOTOGRAPHS BY POWER</span></p><a href="https://gallery.wiki-power.com/" target="_blank" rel="noopener noreferrer">${t('原版相册', 'Original gallery')} ↗</a><span class="copyright">© ${new Date().getFullYear()} Power’s Gallery</span></footer>`;
const viewer = () => `<dialog id="viewer" aria-label="${t('作品大图', 'Photograph viewer')}" aria-labelledby="viewer-title"><div class="viewer-top"><span id="viewer-place"></span><button id="viewer-close" type="button" aria-label="${t('关闭大图', 'Close photograph')}">✕</button></div><div class="viewer-stage"><img id="viewer-image" alt=""><span id="viewer-watermark" aria-hidden="true">© Power’s Gallery</span></div><div class="viewer-footer"><div><span id="viewer-title"></span><p id="viewer-status" role="status" aria-live="polite"></p></div><div class="viewer-actions"><button id="viewer-previous" type="button" aria-label="${t('上一张作品', 'Previous photograph')}">←</button><button id="viewer-next" type="button" aria-label="${t('下一张作品', 'Next photograph')}">→</button><button id="viewer-share" type="button">${t('复制链接', 'Copy link')}</button><button id="viewer-original" type="button">${t('加载原图', 'Load original')}</button><button id="viewer-zoom" type="button" hidden>${t('100% 查看', 'View at 100%')}</button><a id="viewer-link" target="_blank" rel="noopener noreferrer">${t('打开原图', 'Open original')} ↗</a></div></div></dialog>`;
const page = (title, description, body, active = '', path = '/', options = {}) => {
  const breadcrumbs = options.breadcrumbs || (path === '/' ? [] : [{ name: site.name, path: '/' }, { name: title, path }]);
  const head = seoHead({ title, description, path, language, metadata, image: options.image || primaryImage, breadcrumbs, type: options.type || 'WebPage', mainEntity: options.mainEntity, noindex: options.noindex });
  return `<!doctype html><html lang="${t('zh-CN', 'en')}" data-language="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f7f6f2">${head}<link rel="icon" href="/public/assets/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://media.wiki-power.com"><link rel="stylesheet" href="/public/beta.css?v=${assetVersion}"><script src="/public/beta.js?v=${assetVersion}" defer></script></head><body>${nav(active, path)}<main id="main"${path === '/photography/' ? ' class="commission-page"' : path === '/' ? ' class="exhibition-index"' : path.startsWith('/exhibitions/') ? ' class="exhibition-home"' : ''}>${body}</main>${footer()}${viewer()}</body></html>`;
};
const heading = (kicker, title, text) => `<div class="page-heading"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${text}</p></div>`;
const filters = current => `<nav class="filters" aria-label="${t('作品地点', 'Photograph locations')}"><a href="${local('/works/')}" ${!current ? 'aria-current="page"' : ''}>${t('全部', 'All')}<span>${all.length}</span></a>${Object.keys(data.gallery).map(category => `<a href="${categoryPath(category)}" ${current === category ? 'aria-current="page"' : ''}>${esc(place(category))}<span>${data.gallery[category].images.length}</span></a>`).join('')}</nav>`;
const cover = category => find(selection.covers[category] || { category, name: data.gallery[category].images[0].name });
const placeCard = category => `<a class="place-card" href="${categoryPath(category)}"><div class="place-image"><img src="${esc(cover(category).preview)}" alt="${esc(place(category))} ${t('摄影作品', 'photographs')}" width="${cover(category).width}" height="${cover(category).height}" loading="lazy" decoding="async"></div><div class="place-caption"><h3>${esc(place(category))}<span>${t(esc(english(category)), 'PHOTOGRAPHIC JOURNEY')}</span></h3><span>${data.gallery[category].images.length} ${t('件作品', 'works')} ↗</span></div></a>`;

const previousPaths = existsSync('sitemap.xml') ? [...readFileSync('sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname) : [];
rmSync('dist', { recursive: true, force: true }); mkdirSync('dist', { recursive: true });
cpSync('public', 'dist/public', { recursive: true }); cpSync('_headers', 'dist/_headers');
const routes = [], redirects = [];
const write = (path, html, images = []) => {
  const relative = local('/' + path).slice(1), dir = join('dist', relative);
  mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'index.html'), html);
  const basePath = '/' + (path ? path + '/' : '');
  routes.push({ path: local(basePath), basePath, images });
};
const selected = publicIds.map(findId);
const selectedIds = new Set(publicIds);
const ordered = [...selected, ...all.filter(image => !selectedIds.has(photographId(image))).map(find)];
const archiveRoutes = {};
const legacyLinks = () => `<script type="application/json" id="legacy-photo-links">${JSON.stringify(Object.fromEntries(featured.map(image => [photographId(image), local(detailPath(image))]))).replace(/</g, '\\u003c')}</script>`;
for (language of ['zh', 'en']) {
  const homepage = exhibitionIndexBody({ exhibitions: publicExhibitions, findId, metadata, t, local, esc, allCount: all.length });
  const exhibitionList = { '@type': 'ItemList', itemListElement: publicExhibitions.map((exhibition, index) => ({ '@type': 'ListItem', position: index + 1, name: t(exhibition.title, exhibition.titleEn), url: siteURL(local(exhibitionPath(exhibition))) })) };
  write('', page(t('观看的几种方式 · Power 摄影作品 · 上海摄影师', 'Ways of Looking · Photographs by Power · Shanghai'), t('Power 的摄影作品选辑。水面、街巷、人的身影与光，在不同的编排中重新相邻。走进各场展览，或沿地点浏览完整影像档案。摄影师生活和工作在上海。', 'An index of photographic exhibitions by Shanghai-based photographer Power. Explore themed selections, or browse the full archive by place.'), homepage + legacyLinks(), 'exhibitions', '/', { type: 'CollectionPage', mainEntity: exhibitionList }), publicExhibitions.map(exhibition => findId(exhibition.cover)));
  redirects.push(`${local('/exhibitions/')} ${local('/')} 301`);
  for (const [index, exhibition] of publicExhibitions.entries()) {
    const path = exhibitionPath(exhibition), images = exhibitionPhotoIds(exhibition).map(findId);
    const body = exhibitionBody({ exhibition, t, local, esc, photo, findId, allCount: all.length, related: publicExhibitions.length > 1 ? publicExhibitions[(index + 1) % publicExhibitions.length] : null });
    write(path.slice(1, -1), page(t(`${exhibition.title} · Power 作品选辑`, `${exhibition.titleEn} · A Photographic Exhibition by Power`), t(exhibition.standfirst, exhibition.standfirstEn), body, 'exhibitions', path, { type: 'CollectionPage', image: findId(exhibition.cover), breadcrumbs: [{ name: t('展览目录', 'Exhibition index'), path: '/' }, { name: t(exhibition.title, exhibition.titleEn), path }], mainEntity: { '@type': 'ItemList', itemListElement: images.map((image, index) => ({ '@type': 'ListItem', position: index + 1, item: imageObject(image, language, metadata) })) } }), images);
  }
  for (const category of ['', ...Object.keys(data.gallery)]) {
    const images = category ? [...selected.filter(image => image.category === category), ...data.gallery[category].images.filter(image => !selectedIds.has(photographId(image))).map(find)] : ordered;
    const paged = archivePages(images), label = category ? place(category) : t('作品档案', 'The archive');
    for (const part of paged) {
      const path = archivePath(category, part.number), suffix = part.number > 1 ? t(` · 第 ${part.number} 页`, ` · Page ${part.number}`) : '';
      for (const image of part.images) (archiveRoutes[photographId(image)] ||= {})[category ? 'place' : 'all'] = path;
      const title = (category ? t(`${label}摄影作品`, `${label} Photography`) : t('全部作品', 'All photographs')) + suffix;
      const description = category ? t(`${label}的摄影记录，共 ${images.length} 幅作品。`, `${images.length} photographs from ${label}.`) : t('Power 的摄影作品档案：沿地点查看完整影像记录与原图。', 'Power’s photographic archive. Explore by place and view the original photographs.');
      const controls = pagination({ page: part.number, pages: paged.length, total: images.length, category, t, local });
      const body = `${heading(category ? esc(english(category).toUpperCase()) : 'THE PHOTOGRAPHIC ARCHIVE', esc(label) + suffix, t(`${images.length} 幅作品 · 第 ${part.number} / ${paged.length} 页`, `${images.length} photographs · Page ${part.number} of ${paged.length}`))}${filters(category)}${controls}<div class="archive-grid">${part.images.map((image, index) => photo(image, part.offset + index)).join('')}</div>${controls}`;
      write(path.slice(1, -1), page(title, description + suffix, body, 'works', path, { type: 'CollectionPage', image: category ? cover(category) : primaryImage }), part.images);
    }
    if (category) redirects.push(`${local('/' + category)} ${categoryPath(category)} 301`);
  }
  write('places', page(t('地点', 'Places'), t('沿地点浏览 Power’s Gallery 的摄影旅程。', 'Explore the photographic journeys in Power’s Gallery.'), `${heading('PLACES & JOURNEYS', t('沿途所见', 'Places & journeys'), t('从一个地方，走进一组照片。', 'A place, a collection, a different way of seeing.'))}<div class="place-grid all-places">${Object.keys(data.gallery).map(placeCard).join('')}</div>`, 'places', '/places/', { type: 'CollectionPage' }), Object.keys(data.gallery).map(cover));
  const statement = t(artist.statement, artist.statementEn).map(text => `<p>${esc(text)}</p>`).join('');
  const about = `<section class="about-layout"><div>${heading('POWER / ARTIST STATEMENT', t('关于观看', 'On looking'), t('摄影作品与创作自述', 'Photographs & artist statement'))}<h2>${t('相遇之后，<br>仍可回望。', 'After an encounter,<br>we can look again.')}</h2>${statement}<section class="contact-note" aria-labelledby="contact-heading"><span class="eyebrow">CONTACT / COMMISSIONS / COLLECTING</span><h2 id="contact-heading">${t('来信', 'Correspondence')}</h2><p>${t('拍摄委托、品牌合作、作品授权与收藏，可通过下方邮箱联系。我在上海，拍摄旅行人文、活动纪实、风景与品牌商业项目。', 'For photographic commissions, brand projects, image licensing or collecting, please write to the address below. Based in Shanghai, I work in travel, documentary, events, landscapes and brand photography.')}</p><a class="contact-email" href="${emailHref()}">${esc(site.email)} <span>↗</span></a><p class="contact-details">${t('项目来信可附拍摄地点、日期、使用需求与预算；作品咨询请附照片链接。', 'For a project, include the location, dates, intended use and budget; for a photograph, include its link.')}</p></section><section class="copyright-note" aria-labelledby="copyright-heading"><h2 id="copyright-heading">${t('版权与使用', 'Copyright & use')}</h2><p>${t('本站摄影作品版权归 Power 所有。浏览与下载原图不代表取得作品使用授权。转载、出版与商业使用，请事先来信取得许可。', 'All photographs are copyright © Power. Viewing or downloading an original does not grant a licence. Please obtain permission before reproduction, publication or commercial use.')}</p></section><div class="about-links"><a class="text-link" href="${local('/photography/')}">${t('拍摄委托与作品授权', 'Commissions & image licensing')} ↗</a><a class="text-link" href="${local('/works/')}">${t('作品档案', 'Photographic archive')} ↗</a><a class="text-link" href="https://wiki-power.com/" target="_blank" rel="noopener noreferrer">${t('个人网站', 'Personal website')} ↗</a><a class="text-link" href="https://github.com/linyuxuanlin" target="_blank" rel="noopener noreferrer">GitHub ↗</a></div></div>${photo(find(selection.about), 0, true, true)}</section>`;
  write('about', page(t('Power · 创作自述与联系 · 上海摄影师', 'Power · Artist Statement & Contact · Shanghai Photographer'), t('上海摄影师 Power 的创作自述：人与环境之间的距离，光如何改变一个地方的样子。联系摄影委托、作品授权与收藏。', 'Power’s artist statement: the distance between people and their surroundings, and how light changes a place. Based in Shanghai. Contact for commissions, image licensing and collecting.'), about, 'about', '/about/', { type: 'AboutPage', image: find(selection.about), mainEntity: { '@id': siteURL('/#photographer') } }), [find(selection.about)]);
  const commissionImages = selection.commission.map(find);
  const commission = commissionBody({ t, local, photo, images: commissionImages, heading, esc, site, emailHref });
  write('photography', page(t('上海摄影师 · 品牌商业、活动纪实与旅行人文拍摄', 'Shanghai Photography Services · Brands, Events & Travel'), t('在上海的摄影师 Power，承接旅行人文、活动纪实、风景和品牌商业摄影。了解拍摄方向与合作流程，发送项目需求并咨询报价、作品授权。', 'Commission Shanghai-based photographer Power for travel, documentary, events, landscapes and brand projects. Share your brief for a quote or enquire about image licensing.'), commission, '', '/photography/', { image: commissionImages[0], mainEntity: { '@type': 'Service', name: t('摄影拍摄与作品授权', 'Photography commissions and image licensing'), provider: { '@id': siteURL('/#photographer') }, areaServed: { '@type': 'City', name: site.city[language] }, serviceType: site.services.map(service => service[language]) } }), commissionImages);
  for (const image of featured) {
    const path = detailPath(image), title = t(image.title, image.titleEn), description = t(image.description, image.descriptionEn);
    const crumbs = [{ name: site.name, path: '/' }, { name: t('作品', 'Photographs'), path: '/works/' }, { name: place(image.category), path: `/works/${image.category}/` }, { name: title, path }];
    const owner = publicExhibitions.find(exhibition => exhibitionPhotoIds(exhibition).includes(photographId(image)));
    const exhibitionLink = owner ? `<a class="text-link" href="${local(exhibitionPath(owner))}">${t('所属展览：', 'In the exhibition: ')}${esc(t(owner.title, owner.titleEn))} ↗</a>` : '';
    const body = `<nav class="breadcrumbs" aria-label="${t('当前位置', 'Breadcrumbs')}">${crumbs.slice(0, -1).map(crumb => `<a href="${local(crumb.path)}">${esc(crumb.name)}</a>`).join('<span aria-hidden="true">/</span>')}</nav>${heading(esc(english(image.category).toUpperCase()), esc(title), esc(description))}<section class="photograph-detail">${photo(image, 0, true, true, '(max-width: 700px) calc(100vw - 40px), (max-width: 1560px) 82vw, 1200px')}<div class="photograph-context">${exhibitionLink}${image.note ? `<p class="photograph-reading">${esc(t(image.note, image.noteEn))}</p>` : ''}<p>${t(`摄影：${site.photographer} · 地点：${place(image.category)}。作品版权归摄影师所有。`, `Photograph by ${site.photographer} · ${place(image.category)}. Copyright remains with the photographer.`)}</p><p>${t('如需授权、收藏，或希望合作拍摄，请附上本页链接与用途来信。', 'For licensing, collecting or a photographic commission, include this page link and your intended use in an enquiry.')}</p><a class="text-link" href="${local('/photography/#licensing')}">${t('咨询作品授权与摄影合作', 'Enquire about licensing & commissions')} ↗</a><a class="text-link" href="${categoryPath(image.category)}">${t('更多' + place(image.category) + '作品', 'More photographs from ' + place(image.category))} ↗</a></div></section>`;
    write(path.slice(1, -1), page(t(`${title} · ${place(image.category)}摄影`, `${title} · ${place(image.category)} Photography`), `${description} ${t('Power 的摄影作品，可咨询授权与拍摄合作。', 'A photograph by Power. Enquire about image licensing or a commission.')}`, body, 'works', path, { image, breadcrumbs: crumbs, mainEntity: imageObject(image, language, metadata) }), [image]);
  }
  const missing = page(t('这一页尚未抵达', 'Off the map'), t('找不到这个页面。', 'This page could not be found.'), `${heading('404 / OFF THE MAP', t('这一页尚未抵达。', 'This page is off the map.'), t('回到作品，继续看见。', 'Return to the archive and keep exploring.'))}<a class="text-link" href="${local('/works/')}">${t('返回作品档案', 'Return to the archive')} ↗</a>`, '', '/404.html', { noindex: true });
  writeFileSync(join('dist', language === 'en' ? 'en/404.html' : '404.html'), missing);
}
writeFileSync('dist/_redirects', redirects.join('\n') + '\n');
writeFileSync('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteURL('/sitemap.xml')}\n`);
writeFileSync('dist/sitemap.xml', sitemap(routes));
// Resolve old archive fragments after pagination or a later selection changes a photo's page.
const archiveRouteJSON = JSON.stringify(archiveRoutes) + '\n';
writeFileSync('public/archive-routes.json', archiveRouteJSON);
writeFileSync('dist/public/archive-routes.json', archiveRouteJSON);
// Prebuilt root supports the existing Pages project's static branch previews.
cleanStalePages(previousPaths, routes.map(route => route.path));
for (const route of routes) {
  const relative = route.path.slice(1); mkdirSync(relative || '.', { recursive: true });
  cpSync(join('dist', relative, 'index.html'), join(relative, 'index.html'));
}
for (const file of ['404.html', 'en/404.html', '_redirects', 'robots.txt', 'sitemap.xml']) cpSync(join('dist', file), file);
console.log(`Built ${routes.length} bilingual pages, ${all.length} photos, ${publicExhibitions.length} exhibitions, ${publicIds.length} exhibited photographs.`);
