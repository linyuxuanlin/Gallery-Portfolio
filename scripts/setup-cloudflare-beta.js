// Optional API equivalent of the Cloudflare dashboard workflow. Never log credentials.
import { readFileSync } from 'node:fs';
import { site } from './site-config.js';

const account = process.env.CLOUDFLARE_ACCOUNT_ID || '264358695bf65a3cb883dfd59b42fe7f';
const projectName = 'gallery-portfolio';
const branch = 'gallery-beta';
const domain = new URL(site.url).hostname;
const projectPath = `/accounts/${account}/pages/projects/${projectName}`;
if (process.argv.includes('--plan')) {
  console.log(JSON.stringify({ account, project: projectName, previewBranch: branch, productionBranch: 'main (unchanged)', repository: 'linyuxuanlin/Gallery-Portfolio', domain, dns: 'Proxied CNAME to the successful beta deployment branch alias', permissions: ['Account: Cloudflare Pages Edit', 'Zone: Zone Read', 'Zone: DNS Edit (wiki-power.com only)'] }, null, 2));
  process.exit(0);
}
const token = process.env.CLOUDFLARE_API_TOKEN || (process.env.CF_TOKEN_FILE ? readFileSync(process.env.CF_TOKEN_FILE, 'utf8').trim() : '');
if (!token) throw new Error('Provide CLOUDFLARE_API_TOKEN or CF_TOKEN_FILE through a private environment/file. Do not commit credentials.');
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare ${method} failed (${response.status}): ${(data.errors || []).map(error => error.message).join('; ')}`);
  return data.result;
}
const project = await api(projectPath);
if (project.source?.type !== 'github' || project.source.config.owner !== 'linyuxuanlin' || project.source.config.repo_name !== 'Gallery-Portfolio' || project.production_branch !== 'main') throw new Error('The Pages integration does not match the expected repository and main production branch; settings were left unchanged.');
const baseHostname = project.subdomain;
const deployments = await api(`${projectPath}/deployments?env=preview&per_page=100`);
const deployment = deployments.find(item => item.deployment_trigger?.metadata?.branch === branch && item.latest_stage?.status === 'success');
const target = deployment?.aliases?.find(host => host === `${branch}.${baseHostname}`);
if (!baseHostname?.endsWith('.pages.dev') || !target) throw new Error('A successful beta deployment and its actual branch alias are required; no configuration was changed.');
const zones = await api(`/zones?name=wiki-power.com&account.id=${account}`);
if (zones.length !== 1) throw new Error('Cannot identify wiki-power.com in this account.');
const dnsPath = `/zones/${zones[0].id}/dns_records`;
const domains = await api(`${projectPath}/domains`);
const bound = domains.some(item => item.name === domain);
const hostname = record => record.content.replace(/\.$/, '');
function validate(records, allowBase) {
  if (records.length > 1 || records.some(record => record.type !== 'CNAME' || (hostname(record) !== target && !(allowBase && hostname(record) === baseHostname)))) throw new Error('An existing or concurrently changed DNS record points elsewhere; it was left unchanged.');
}
// Preflight before registering a domain. Only its own Pages-generated CNAME may be repointed.
validate(await api(`${dnsPath}?name=${domain}`), bound);
if (!bound) await api(`${projectPath}/domains`, 'POST', { name: domain });
const current = await api(`${dnsPath}?name=${domain}`);
validate(current, true);
if (!current.length) await api(dnsPath, 'POST', { type: 'CNAME', name: domain, content: target, proxied: true, ttl: 1 });
else if (hostname(current[0]) !== target || !current[0].proxied) await api(`${dnsPath}/${current[0].id}`, 'PATCH', { content: target, proxied: true });
const state = await api(`${projectPath}/domains/${domain}`);
console.log(JSON.stringify({ project: projectName, branch, hostname: target, domain, domainStatus: state.status, nextStep: 'Verify HTTPS and beta page content after domain and certificate activation.' }, null, 2));
