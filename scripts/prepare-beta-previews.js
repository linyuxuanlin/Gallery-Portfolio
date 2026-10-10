import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readExhibitions, photographId } from './exhibitions.js';

// Reproducible optional preparation; Pages builds use the committed public assets.
// Use previews from a sufficiently large source cache; original files are never modified.
const cache = process.env.GALLERY_SOURCE_CACHE;
if (!cache) throw new Error('Set GALLERY_SOURCE_CACHE to your downloaded R2 preview directory.');
sharp.concurrency(1); sharp.cache(false);
const data = JSON.parse(readFileSync('gallery-index.json', 'utf8'));
const curation = JSON.parse(readFileSync('curation.json', 'utf8'));
const larger = new Set([photographId(curation.about), ...readExhibitions().flatMap(exhibition => [exhibition.cover, ...exhibition.opening].filter(Boolean))]);
// Validate the whole cache before writing any previews or changing the index.
for (const category of Object.values(data.gallery)) {
  for (const image of category.images) {
    const source = join(cache, `${image.category}_${image.name}.webp`);
    const metadata = await sharp(readFileSync(source)).metadata();
    if (larger.has(`${image.category}/${image.name}`) && Math.max(metadata.width || 0, metadata.height || 0) < 1600) {
      throw new Error(`Cover/about preview source is smaller than 1600px: ${source}. Supply a larger source instead of relabelling a 960px preview.`);
    }
  }
}
let total = 0, sourceTotal = 0, count = 0;
for (const category of Object.values(data.gallery)) {
  for (const image of category.images) {
    const source = join(cache, `${image.category}_${image.name}.webp`);
    const bytes = readFileSync(source); sourceTotal += bytes.length;
    const metadata = await sharp(bytes).metadata();
    image.width = metadata.width; image.height = metadata.height;
    image.sourcePreview ||= image.preview;
    for (const edge of larger.has(`${image.category}/${image.name}`) ? [960, 1600] : [960]) {
      const { data: buffer, info } = await sharp(bytes).rotate().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).webp({ quality: edge === 1600 ? 86 : 80, effort: 4 }).toBuffer({ resolveWithObject: true });
      const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
      const relative = `public/photos/${image.category}/${image.name}-${edge}-${hash}.webp`;
      mkdirSync(join('public/photos', image.category), { recursive: true }); writeFileSync(relative, buffer);
      if (edge === 960) { image.preview = '/' + relative; image.previewWidth = info.width; image.previewHeight = info.height; }
      else { image.largePreview = '/' + relative; image.largePreviewWidth = info.width; image.largePreviewHeight = info.height; }
      total += buffer.length;
    }
    count++; if (count % 50 === 0) console.log(`${count} previews prepared`);
  }
}
writeFileSync('gallery-index.json', JSON.stringify(data, null, 2) + '\n');
console.log(`${count} photos: ${(sourceTotal / 1048576).toFixed(1)} MB → ${(total / 1048576).toFixed(1)} MB; originals unchanged.`);
