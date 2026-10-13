import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';

test('review sheets shrink with the available library without retaining previously reserved candidates', async () => {
  const root=mkdtempSync(join(tmpdir(),'gallery-review-sheets-'));
  try {
    mkdirSync(join(root,'public/photos/Test'),{recursive:true});mkdirSync(join(root,'.curation'));
    const preview=join(root,'public/photos/Test/sample.webp');
    await sharp({create:{width:40,height:30,channels:3,background:'#7c866e'}}).webp().toFile(preview);
    const photographs=Array.from({length:25},(_,i)=>({id:`Test/${i}`,preview:'/public/photos/Test/sample.webp',original:`https://images.test/${i}.jpg`,exhibition:null}));
    const save=()=>writeFileSync(join(root,'.curation/inventory.json'),JSON.stringify({libraryFingerprint:'test-library',photographs}));
    const run=()=>execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/curation-review.js',import.meta.url))],{cwd:root,maxBuffer:1024*1024});
    save();run();const output=join(root,'.curation/review/available');
    assert.equal(existsSync(join(output,'sheet-002.jpg')),true);
    writeFileSync(join(output,'curator-notes.md'),'Keep this note.');
    photographs.slice(0,24).forEach(photo=>photo.exhibition='new-show');save();run();
    assert.deepEqual(readdirSync(output).filter(name=>/^sheet-/.test(name)).sort(),['sheet-001.jpg','sheet-001.json']);
    assert.deepEqual(JSON.parse(readFileSync(join(output,'sheet-001.json'))).photographs.map(photo=>photo.id),['Test/24']);
    photographs[24].exhibition='last-show';save();run();
    assert.deepEqual(readdirSync(output),['curator-notes.md']);
    assert.equal(readFileSync(join(output,'curator-notes.md'),'utf8'),'Keep this note.');
    assert.equal(existsSync(preview),true);
  } finally {rmSync(root,{recursive:true,force:true});}
});
