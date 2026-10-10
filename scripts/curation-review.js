import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { escapeHTML } from './seo.js';

const args = process.argv.slice(2), all = args.includes('--all');
if (args.some(arg => arg !== '--all' && !/^--page=\d+$/.test(arg))) throw new Error('Usage: npm run curate:review -- [--all] [--page=1]');
const chosenPage = args.find(arg => arg.startsWith('--page='));
const inventory = JSON.parse(readFileSync('.curation/inventory.json', 'utf8'));
const images = inventory.photographs.filter(image => all || !image.exhibition);
const pageSize = 24, pages = Math.ceil(images.length / pageSize), requested = chosenPage ? Number(chosenPage.split('=')[1]) : null;
if (requested !== null && (requested < 1 || requested > pages)) throw new Error(`Review page must be between 1 and ${pages}.`);
const output = join('.curation', 'review', all ? 'all' : 'available');
mkdirSync(output, { recursive: true }); sharp.concurrency(1); sharp.cache(false);
const cellWidth = 280, cellHeight = 245, columns = 4, imageHeight = 190;
for (let page = 1; page <= pages; page++) {
  if (requested !== null && requested !== page) continue;
  const group = images.slice((page - 1) * pageSize, page * pageSize), composites = [], labels = [];
  // A sheet never decodes the entire library at once, and uses local previews only.
  for (const [index, image] of group.entries()) {
    if (!image.preview.startsWith('/public/photos/')) throw new Error(`Prepare local previews before reviewing: ${image.id}`);
    const left = index % columns * cellWidth, top = Math.floor(index / columns) * cellHeight;
    const { data, info } = await sharp(readFileSync(resolve(image.preview.slice(1)))).rotate().resize({ width: cellWidth - 24, height: imageHeight, fit: 'inside' }).toBuffer({ resolveWithObject: true });
    composites.push({ input: data, left: left + Math.floor((cellWidth - info.width) / 2), top: top + Math.floor((imageHeight - info.height) / 2) });
    const number = (page - 1) * pageSize + index + 1;
    labels.push(`<text x="${left + 12}" y="${top + imageHeight + 20}" font-size="11">${number}. ${escapeHTML(image.id)}</text><text x="${left + 12}" y="${top + imageHeight + 38}" font-size="10" fill="#64675f">${escapeHTML(image.exhibition || 'AVAILABLE')}</text>`);
  }
  const width = cellWidth * columns, height = cellHeight * Math.ceil(group.length / columns);
  composites.push({ input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g font-family="Arial, sans-serif" fill="#20221f">${labels.join('')}</g></svg>`), left: 0, top: 0 });
  const filename = `sheet-${String(page).padStart(3, '0')}.jpg`;
  await sharp({ create: { width, height, channels: 3, background: '#f7f6f2' } }).composite(composites).jpeg({ quality: 88 }).toFile(join(output, filename));
  writeFileSync(join(output, filename.replace('.jpg', '.json')), JSON.stringify({ libraryFingerprint: inventory.libraryFingerprint, page, photographs: group.map(image => ({ id: image.id, exhibition: image.exhibition, preview: image.preview, original: image.original })) }, null, 2) + '\n');
  console.log(`${page}/${pages}: ${join(output, filename)}`);
}
