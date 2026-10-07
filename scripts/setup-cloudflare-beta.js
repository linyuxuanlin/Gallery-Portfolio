// Node 22+. Credentials are read privately; never written into the repository.
import { readFileSync } from 'node:fs';

const account = process.env.CLOUDFLARE_ACCOUNT_ID || '264358695bf65a3cb883dfd59b42fe7f';
const projectName = 'gallery-beta';
const domain = 'gallery-beta.wiki-power.com';
const base = `/accounts/${account}/pages/projects`;
if (process.argv.includes('--plan')) {
  console.log(JSON.stringify({ account, project: projectName, productionBranch: 'gallery-beta', repository: 'linyuxuanlin/Gallery-Portfolio', build: 'npm run build', output: 'dist', domain, permissions: ['Account: Cloudflare Pages Edit', 'Zone: Zone Read', 'Zone: DNS Edit (wiki-power.com only)'] }, null, 2));
  process.exit(0);
}
const token = process.env.CLOUDFLARE_API_TOKEN || (process.env.CF_TOKEN_FILE ? readFileSync(process.env.CF_TOKEN_FILE, 'utf8').trim() : '');
if (!token) throw new Error('Provide CLOUDFLARE_API_TOKEN or CF_TOKEN_FILE through a private environment/file. Do not commit credentials.');
async function api(path, method = 'GET', body, allowMissing = false) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  if (allowMissing && response.status === 404) return null;
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare ${method} failed (${response.status}): ${(data.errors || []).map(error => error.message).join('; ')}`);
  return data.result;
}
const original = await api(`${base}/gallery-portfolio`);
const source = original.source;
if (source?.type !== 'github' || source.config.owner !== 'linyuxuanlin' || source.config.repo_name !== 'Gallery-Portfolio') throw new Error('The original Pages GitHub integration does not match the expected repository.');
const zones = await api(`/zones?name=wiki-power.com&account.id=${account}`);
if (zones.length !== 1) throw new Error('Cannot identify wiki-power.com in this account.');
const dnsPath = `/zones/${zones[0].id}/dns_records`;
// Inspect conflicts before creating anything. Never replace existing DNS records.
const records = await api(`${dnsPath}?name=${domain}`);
let project = await api(`${base}/${projectName}`, 'GET', undefined, true);
if (project && (project.production_branch !== 'gallery-beta' || project.source?.config.owner !== 'linyuxuanlin' || project.source?.config.repo_name !== 'Gallery-Portfolio')) throw new Error('An existing gallery-beta project has different settings; it was left unchanged.');
if (records.some(record => record.type !== 'CNAME') || (records.length && !project)) throw new Error('An existing DNS record needs review; it was left unchanged.');
if (!project) {
  const git = source.config;
  project = await api(base, 'POST', {
    name: projectName, production_branch: 'gallery-beta',
    build_config: { build_command: 'npm run build', destination_dir: 'dist', root_dir: '' },
    source: { type: 'github', config: { owner: git.owner, owner_id: git.owner_id, repo_name: git.repo_name, repo_id: git.repo_id, production_branch: 'gallery-beta', production_deployments_enabled: true, preview_deployment_setting: 'none' } },
    deployment_configs: { production: { env_vars: { NODE_VERSION: { type: 'plain_text', value: '22' } } }, preview: { env_vars: { NODE_VERSION: { type: 'plain_text', value: '22' } } } },
  });
  console.log('Created the separate gallery-beta Pages project.');
}
const target = project.subdomain || project.domains?.find(name => name.endsWith('.pages.dev'));
if (!target || !target.endsWith('.pages.dev')) throw new Error('Pages did not return its actual hostname; no DNS record was written.');
if (records.some(record => record.content.replace(/\.$/, '') !== target)) throw new Error('Existing CNAME points elsewhere; it was left unchanged.');
const domains = await api(`${base}/${projectName}/domains`);
if (!domains.some(item => item.name === domain)) await api(`${base}/${projectName}/domains`, 'POST', { name: domain });
// Re-read because Pages may have created the CNAME automatically.
const current = await api(`${dnsPath}?name=${domain}`);
if (!current.length) await api(dnsPath, 'POST', { type: 'CNAME', name: domain, content: target, proxied: true, ttl: 1 });
else if (current.some(record => record.type !== 'CNAME' || record.content.replace(/\.$/, '') !== target)) throw new Error('DNS changed during setup; no record was overwritten.');
const state = await api(`${base}/${projectName}/domains/${domain}`);
console.log(JSON.stringify({ project: projectName, hostname: target, domain, domainStatus: state.status, nextStep: 'Verify the production build and HTTPS after certificate validation.' }, null, 2));
