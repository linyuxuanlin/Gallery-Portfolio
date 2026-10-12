// Import a complete R2 object listing without overwriting originals or losing local previews.
// The listing can be an exported S3 result or a saved, fully paginated dashboard inventory.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { imagePaths, publicObjectUrl } from './image-paths.js';

const run = promisify(execFile);
const id = image => `${image.category}/${image.name}`;

export function importPlan(listing, previous, { directory = 'gallery', baseUrl = 'https://media.wiki-power.com' } = {}) {
  if (!listing.complete || !Array.isArray(listing.objects)) throw new Error('A complete, fully paginated source inventory is required.');
  const originalKeys = new Set(), identities = new Map(), photographs = [];
  const previousImages = new Map(Object.values(previous.gallery).flatMap(category => category.images).map(image => [id(image), image]));
  for (const object of listing.objects) {
    const key = object.Key || object.key;
    if (typeof key !== 'string' || key.split('/').some(part => part === '.' || part === '..') || /[\u0000-\u001f]/.test(key)) throw new Error('Invalid object key.');
    if (originalKeys.has(key)) throw new Error(`Repeated source object: ${key}`);
    originalKeys.add(key);
    const paths = imagePaths(key, directory);
    if (!paths) continue;
    const photoId = `${paths.category}/${paths.name}`;
    if (identities.has(photoId)) throw new Error(`Ambiguous photograph identity: ${photoId}`);
    identities.set(photoId, key);
    const original = publicObjectUrl(baseUrl, key), old = previousImages.get(photoId);
    const modified = object.LastModified || object.lastModified;
    if (modified && !Number.isFinite(Date.parse(modified))) throw new Error(`Invalid source modification date: ${key}`);
    const previousModified = old?.sourceModified || previous.generated_at;
    const changed = !!old && !!modified && !!previousModified && Date.parse(modified) > Date.parse(previousModified);
    const unchanged = !!old && old.original === original && !changed;
    const image = unchanged ? { ...old } : { name: paths.name, category: paths.category, original, sourcePreview: publicObjectUrl(baseUrl, paths.previewKey) };
    if (modified) image.sourceModified = new Date(modified).toISOString();
    photographs.push({ key, id: photoId, image, needsPreview: !unchanged, sourceObject: object });
  }
  const missing = [...previousImages.keys()].filter(photoId => !identities.has(photoId));
  if (missing.length) throw new Error(`Previous photographs are absent from the source inventory: ${missing.join(', ')}`);
  if (!photographs.length) throw new Error('No photographs in the complete source inventory.');
  return photographs.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

export async function prepareImportedPhotograph(entry, { cache, fetchOriginal, outputRoot = '.', sizes = [960, 1600] }) {
  const version = entry.image.sourceModified ? createHash('sha256').update(entry.image.sourceModified).digest('hex').slice(0, 12) : '';
  const source = join(cache, version, entry.key), bytes = await fetchOriginal(entry.image.original, source);
  const sourceMetadata = await sharp(bytes).metadata();
  if (!sourceMetadata.width || !sourceMetadata.height) throw new Error(`Unreadable photograph: ${entry.id}`);
  entry.image.width = sourceMetadata.width; entry.image.height = sourceMetadata.height;
  entry.image.originalContentSHA256 = createHash('sha256').update(bytes).digest('hex');
  for (const edge of sizes) {
    const { data, info } = await sharp(bytes).rotate().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).webp({ quality: edge === 1600 ? 86 : 80, effort: 4 }).toBuffer({ resolveWithObject: true });
    const fingerprint = createHash('sha256').update(data).digest('hex').slice(0, 12);
    const relative = `public/photos/${entry.image.category}/${entry.image.name}-${edge}-${fingerprint}.webp`;
    mkdirSync(dirname(join(outputRoot, relative)), { recursive: true }); writeFileSync(join(outputRoot, relative), data);
    const field = edge === 960 ? 'preview' : 'largePreview';
    entry.image[field] = '/' + relative;
    entry.image[field + 'Width'] = info.width; entry.image[field + 'Height'] = info.height;
  }
  return entry.image;
}

async function main() {
  const args = process.argv.slice(2);
  const source = args.find(argument => argument.startsWith('--source='))?.slice(9);
  const cache = args.find(argument => argument.startsWith('--cache='))?.slice(8) || '.curation/source-originals';
  if (!source || args.some(argument => !/^--(source|cache)=/.test(argument))) throw new Error('Usage: node scripts/import-beta-library.js --source=/path/to/complete-inventory.json [--cache=/path/to/original-cache]');
  const previous = JSON.parse(readFileSync('gallery-index.json', 'utf8'));
  const listing = JSON.parse(readFileSync(source, 'utf8')), plan = importPlan(listing, previous);
  const additions = plan.filter(entry => entry.needsPreview);
  // Preserve the previous source and curation baseline before replacing the public index.
  mkdirSync('.curation', { recursive: true });
  const baseline = '.curation/library-before-import.json';
  if (!existsSync(baseline)) writeFileSync(baseline, JSON.stringify(previous, null, 2) + '\n');
  sharp.concurrency(1); sharp.cache(false);
  let cursor = 0, completed = 0, failed = [];
  const fetchOriginal = async (url, destination) => {
    if (existsSync(destination)) return readFileSync(destination);
    mkdirSync(dirname(destination), { recursive: true });
    const partial = destination + '.partial';
    await run('curl', ['--noproxy', '*', '--fail', '--location', '--silent', '--show-error', '--retry', '2', '--connect-timeout', '20', '--max-time', '240', '--output', partial, url], { maxBuffer: 1024 * 1024 });
    const bytes = readFileSync(partial); await sharp(bytes).metadata(); renameSync(partial, destination);
    return bytes;
  };
  console.log(`${plan.length} photographs; ${additions.length} new photographs to prepare, with four concurrent downloads.`);
  await Promise.all(Array.from({ length: Math.min(4, additions.length) }, async () => {
    while (cursor < additions.length) {
      const entry = additions[cursor++];
      try { await prepareImportedPhotograph(entry, { cache, fetchOriginal }); completed++; if (completed % 10 === 0 || completed === additions.length) console.log(`${completed}/${additions.length} new photographs prepared`); }
      catch (error) { failed.push({ id: entry.id, message: error.message }); }
    }
  }));
  if (failed.length) { writeFileSync('.curation/import-failures.json', JSON.stringify(failed, null, 2) + '\n'); throw new Error(`${failed.length} source photographs could not be prepared; public index has not been replaced.`); }
  const gallery = {};
  for (const entry of plan) {
    for (const field of ['preview', 'largePreview']) if (entry.image[field] && !existsSync(resolve(entry.image[field].slice(1)))) throw new Error(`Missing local asset: ${entry.id} ${field}`);
    const category = gallery[entry.image.category] ||= { name: entry.image.category, images: [], count: 0 };
    category.images.push(entry.image); category.count++;
  }
  const output = { gallery, total_images: plan.length, generated_at: new Date().toISOString() };
  writeFileSync('gallery-index.json', JSON.stringify(output, null, 2) + '\n');
  writeFileSync('.curation/import-report.json', JSON.stringify({ source, complete: true, photographs: plan.length, additions: additions.map(entry => entry.id), preserved: plan.length - additions.length, categories: Object.keys(gallery), originalsModified: false }, null, 2) + '\n');
  console.log(`${plan.length} photographs imported. Existing local previews and all R2 originals preserved.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
