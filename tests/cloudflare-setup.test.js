import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Cloudflare binds the beta branch alias without changing main or conflicting DNS', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gallery-cf-'));
  const preload = join(directory, 'mock.mjs'), log = join(directory, 'requests.json');
  writeFileSync(preload, `
    import {writeFileSync} from 'node:fs';
    const calls = []; let bound = false, configured = false;
    const scenario = process.env.CF_TEST_SCENARIO;
    const base = 'gallery-portfolio.pages.dev', target = 'gallery-beta.' + base;
    const source = {type:'github',config:{owner:'linyuxuanlin',repo_name:'Gallery-Portfolio'}};
    const project = {production_branch:'main',source,subdomain:base};
    const record = {id:'new-domain-record',type:'CNAME',content:target,proxied:true};
    globalThis.fetch = async (url, init) => {
      const path = new URL(url).pathname; const method = init.method; const body = init.body && JSON.parse(init.body);
      calls.push({path,method,body}); writeFileSync(process.env.CF_TEST_LOG,JSON.stringify(calls));
      let result;
      if (path.endsWith('/projects/gallery-portfolio')) result = project;
      else if (path.endsWith('/deployments')) result = [{deployment_trigger:{metadata:{branch:scenario === 'wrong-branch' ? 'main' : 'gallery-beta'}},latest_stage:{status:'success'},aliases:[target]}];
      else if (path.endsWith('/zones')) result = [{id:'zone-fixture'}];
      else if (path.endsWith('/dns_records/new-domain-record')) { configured = true; result = record; }
      else if (path.endsWith('/dns_records')) {
        if (method === 'POST') { configured = true; result = record; }
        else if (scenario === 'conflict') result = [{type:'A',content:'192.0.2.1'}];
        else if (scenario === 'existing' || configured) result = [record];
        else if (scenario === 'unproxied') result = [{...record,proxied:false}];
        else if (bound && scenario === 'auto') result = [{...record,content:base}];
        else result = [];
      } else if (path.endsWith('/domains')) {
        if (method === 'POST') { bound = true; result = {name:'photo-gallery.wiki-power.com'}; }
        else result = scenario === 'existing' || scenario === 'unproxied' ? [{name:'photo-gallery.wiki-power.com'}] : [];
      } else if (path.endsWith('/domains/photo-gallery.wiki-power.com')) result = {status:'active'};
      else throw new Error('Unexpected API path: ' + path);
      return {ok:true,status:200,json:async () => ({success:true,result})};
    };
  `);
  try {
    for (const scenario of ['new', 'auto', 'existing', 'unproxied', 'conflict', 'wrong-branch']) {
      const run = spawnSync(process.execPath, ['--import', preload, 'scripts/setup-cloudflare-beta.js'], { encoding: 'utf8', env: { ...process.env, CLOUDFLARE_API_TOKEN: 'fixture-not-a-real-token', CF_TEST_LOG: log, CF_TEST_SCENARIO: scenario } });
      const calls = JSON.parse(readFileSync(log, 'utf8')), writes = calls.filter(call => call.method !== 'GET');
      assert.equal(calls.filter(call => call.path.endsWith('/projects/gallery-portfolio')).every(call => call.method === 'GET'), true);
      assert.equal(writes.every(call => /\/domains$|\/dns_records(?:\/new-domain-record)?$/.test(call.path)), true);
      if (scenario === 'new' || scenario === 'auto') {
        assert.equal(run.status, 0, run.stderr);
        assert.equal(writes.length, 2);
        assert.deepEqual(writes[0].body, {name:'photo-gallery.wiki-power.com'});
        assert.equal(writes[1].body.content, 'gallery-beta.gallery-portfolio.pages.dev');
        assert.equal(writes[1].body.proxied, true);
        assert.equal(writes[1].method, scenario === 'auto' ? 'PATCH' : 'POST');
      } else if (scenario === 'unproxied') {
        assert.equal(run.status, 0, run.stderr);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].body.proxied, true);
      } else {
        assert.equal(writes.length, 0);
        assert.equal(run.status, scenario === 'existing' ? 0 : 1);
      }
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
