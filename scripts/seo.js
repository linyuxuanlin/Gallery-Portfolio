import { site, siteURL } from './site-config.js';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const jsonScript = value => JSON.stringify(value).replace(/</g, '\\u003c');

export function imageObject(image, language, metadata) {
  const preview = image.largePreview || image.preview;
  return {
    '@type': 'ImageObject', '@id': siteURL(preview) + '#image',
    contentUrl: siteURL(preview), thumbnailUrl: siteURL(image.preview),
    name: (language === 'en' ? image.titleEn : image.title) || image.name,
    ...(image.description ? { description: language === 'en' ? image.descriptionEn : image.description } : {}),
    width: metadata.get(preview).width, height: metadata.get(preview).height,
    creator: { '@id': siteURL('/#photographer') }, creditText: site.name,
    copyrightNotice: `© ${site.photographer}. All rights reserved.`,
    license: siteURL((language === 'en' ? '/en' : '') + '/about/#copyright-heading'),
    acquireLicensePage: siteURL((language === 'en' ? '/en' : '') + '/photography/#licensing')
  };
}

export function seoHead({ title, description, path, language, image, metadata, type = 'WebPage', breadcrumbs = [], mainEntity, noindex = false }) {
  const local = url => (language === 'en' ? '/en' : '') + url;
  const url = siteURL(local(path)), label = language === 'en' ? 'en' : 'zh-CN';
  const primary = imageObject(image, language, metadata);
  const person = {
    '@type': 'Person', '@id': siteURL('/#photographer'), name: site.photographer,
    jobTitle: language === 'en' ? 'Photographer' : '摄影师',
    url: siteURL(local('/about/')), email: site.email, sameAs: site.sameAs,
    homeLocation: { '@type': 'Place', name: site.city[language] },
    knowsAbout: site.services.map(service => service[language]),
    contactPoint: { '@type': 'ContactPoint', email: site.email, contactType: 'Photography commissions and licensing', availableLanguage: ['Chinese', 'English'] }
  };
  const graph = [person, { '@type': 'WebSite', '@id': siteURL('/#website'), url: siteURL('/'), name: site.name, inLanguage: ['zh-CN', 'en'], publisher: { '@id': person['@id'] } }, primary];
  const page = { '@type': type, '@id': url + '#webpage', url, name: title, description, inLanguage: label, isPartOf: { '@id': siteURL('/#website') }, primaryImageOfPage: { '@id': primary['@id'] }, ...(mainEntity ? { mainEntity } : {}) };
  if (breadcrumbs.length) {
    const trail = { '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: siteURL(local(item.path)) })) };
    page.breadcrumb = { '@id': trail['@id'] }; graph.push(trail);
  }
  graph.push(page);
  const esc = escapeHTML, ogLocale = language === 'en' ? 'en_US' : 'zh_CN';
  return `<title>${esc(title)} · ${esc(site.name)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}"><link rel="canonical" href="${esc(url)}"><link rel="alternate" hreflang="zh-CN" href="${siteURL(path)}"><link rel="alternate" hreflang="en" href="${siteURL('/en' + path)}"><link rel="alternate" hreflang="x-default" href="${siteURL(path)}"><meta property="og:title" content="${esc(title)} · ${esc(site.name)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="${esc(site.name)}"><meta property="og:url" content="${esc(url)}"><meta property="og:locale" content="${ogLocale}"><meta property="og:locale:alternate" content="${language === 'en' ? 'zh_CN' : 'en_US'}"><meta property="og:image" content="${primary.contentUrl}"><meta property="og:image:width" content="${primary.width}"><meta property="og:image:height" content="${primary.height}"><meta property="og:image:alt" content="${esc(primary.description || primary.name)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)} · ${esc(site.name)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${primary.contentUrl}"><script type="application/ld+json">${jsonScript({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

export function sitemap(routes) {
  const esc = escapeHTML;
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">${routes.map(route => `<url><loc>${esc(siteURL(route.path))}</loc><xhtml:link rel="alternate" hreflang="zh-CN" href="${esc(siteURL(route.basePath))}"/><xhtml:link rel="alternate" hreflang="en" href="${esc(siteURL('/en' + route.basePath))}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(siteURL(route.basePath))}"/>${[...new Set((route.images || []).map(image => image.largePreview || image.preview))].map(image => `<image:image><image:loc>${esc(siteURL(image))}</image:loc></image:image>`).join('')}</url>`).join('')}</urlset>`;
}
