import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Cloudflare setup creates only the separate beta project/domain and preserves existing records', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gallery-cf-'));
  const preload = join(directory, 'mock.mjs'), log = join(directory, 'requests.json');
  writeFileSync(preload, `
    import {writeFileSync} from 'node:fs';
    const calls = []; let created = false, dnsCreated = false;
    const source = {type:'github',config:{owner:'linyuxuanlin',owner_id:'1',repo_name:'Gallery-Portfolio',repo_id:'2'}};
    const project = {production_branch:'gallery-beta',source,subdomain:'fixture-beta.pages.dev'};
    const record = {type:'CNAME',content:'fixture-beta.pages.dev'};
    globalThis.fetch = async (url, init) => {
      const path = new URL(url).pathname; const method = init.method; const body = init.body && JSON.parse(init.body);
      calls.push({path,method,body}); writeFileSync(process.env.CF_TEST_LOG,JSON.stringify(calls));
      let result, status = 200;
      if (path.endsWith('/projects/gallery-portfolio')) result = {source};
      else if (path.endsWith('/zones')) result = [{id:'zone-fixture'}];
      else if (path.endsWith('/dns_records')) {
        if (method === 'POST') { dnsCreated = true; result = record; }
        else result = process.env.CF_TEST_SCENARIO === 'conflict' ? [{type:'A',content:'192.0.2.1'}] : dnsCreated || process.env.CF_TEST_SCENARIO === 'existing' ? [record] : [];
      } else if (path.endsWith('/projects/gallery-beta')) {
        if (created || process.env.CF_TEST_SCENARIO === 'existing') result = project; else status = 404;
      } else if (path.endsWith('/projects') && method === 'POST') { created = true; result = project; }
      else if (path.endsWith('/domains')) result = method === 'POST' ? {name:'gallery-beta.wiki-power.com'} : process.env.CF_TEST_SCENARIO === 'existing' ? [{name:'gallery-beta.wiki-power.com'}] : [];
      else if (path.endsWith('/domains/gallery-beta.wiki-power.com')) result = {status:'active'};
      else throw new Error('Unexpected API path: ' + path);
      return {ok:status === 200,status,json:async () => ({success:status === 200,result})};
    };
  `);
  try {
    for (const scenario of ['new', 'existing', 'conflict']) {
      const run = spawnSync(process.execPath, ['--import', preload, 'scripts/setup-cloudflare-beta.js'], { encoding: 'utf8', env: { ...process.env, CLOUDFLARE_API_TOKEN: 'fixture-not-a-real-token', CF_TEST_LOG: log, CF_TEST_SCENARIO: scenario } });
      const calls = JSON.parse(readFileSync(log, 'utf8')), writes = calls.filter(call => call.method !== 'GET');
      if (scenario === 'new') {
        assert.equal(run.status, 0, run.stderr);
        assert.equal(writes.length, 3);
        assert.equal(writes[0].body.production_branch, 'gallery-beta');
        assert.equal(writes[0].body.source.config.production_branch, 'gallery-beta');
        assert.equal(writes[0].body.build_config.destination_dir, 'dist');
        assert.equal(writes[1].body.name, 'gallery-beta.wiki-power.com');
        assert.equal(writes[2].body.content, 'fixture-beta.pages.dev');
      } else {
        assert.equal(writes.length, 0, 'existing or conflicting records must not be overwritten');
        assert.equal(run.status, scenario === 'existing' ? 0 : 1);
      }
      assert.equal(calls.filter(call => call.path.endsWith('/projects/gallery-portfolio')).every(call => call.method === 'GET'), true);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
