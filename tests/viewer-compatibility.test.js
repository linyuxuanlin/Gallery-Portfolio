import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';

test('the viewer can be parsed by an ES2015 browser', () => {
  parse(readFileSync('public/beta.js', 'utf8'), { ecmaVersion: 2015 });
});

test('every photograph has an in-page large-view fallback rather than a file navigation', () => {
  let photographs = 0;
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('.html')) {
        const html = readFileSync(file, 'utf8');
        for (const [anchor] of html.matchAll(/<a\b[^>]*\bdata-photo\s[^>]*>/g)) {
          const fragment = anchor.match(/\bhref="#(preview-[a-f0-9]{16})"/);
          assert.ok(fragment, file + ' has a file link instead of a photo fragment');
          assert.ok(!/\btarget=/.test(anchor), file + ' opens another tab');
          assert.ok(html.includes(`<figure id="${fragment[1]}"`), file + ' has no fallback photograph');
          assert.ok(html.includes(`href="#return-${fragment[1]}"`), file + ' has no return link');
          photographs++;
        }
      }
    }
  };
  visit('dist');
  assert.ok(photographs > 0);
});
