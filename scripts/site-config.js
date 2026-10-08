import { readFileSync } from 'node:fs';

export const site = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const origin = new URL(site.url);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('site.config.json url must be an HTTPS origin without a path or credentials.');
}
site.url = origin.origin;
export const siteURL = path => new URL(path, site.url + '/').href;
