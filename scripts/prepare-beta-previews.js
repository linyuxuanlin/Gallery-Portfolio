import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Reproducible optional preparation; Pages builds use the committed public assets.
// The cache contains the existing R2 preview files, never the full JPEG originals.
const cache = process.env.GALLERY_SOURCE_CACHE;
if (!cache) throw new Error('Set GALLERY_SOURCE_CACHE to your downloaded R2 preview directory.');
sharp.concurrency(1); sharp.cache(false);
const data = JSON.parse(readFileSync('gallery-index.json', 'utf8'));
const curation = JSON.parse(readFileSync('curation.json', 'utf8'));
const larger = new Set([...curation.hero, curation.about].map(item => `${item.category}/${item.name}`));
let total = 0, sourceTotal = 0, count = 0;
for (const category of Object.values(data.gallery)) {
  for (const image of category.images) {
    const source = join(cache, `${image.category}_${image.name}.webp`);
    const bytes = readFileSync(source); sourceTotal += bytes.length;
    const metadata = await sharp(bytes).metadata();
    image.width = metadata.width; image.height = metadata.height;
    image.sourcePreview ||= image.preview;
    for (const edge of larger.has(`${image.category}/${image.name}`) ? [960, 1600] : [960]) {
      const buffer = await sharp(bytes).rotate().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).webp({ quality: edge === 1600 ? 86 : 80, effort: 4 }).toBuffer();
      const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
      const relative = `public/photos/${image.category}/${image.name}-${edge}-${hash}.webp`;
      mkdirSync(join('public/photos', image.category), { recursive: true }); writeFileSync(relative, buffer);
      if (edge === 960) image.preview = '/' + relative;
      else image.largePreview = '/' + relative;
      total += buffer.length;
    }
    count++; if (count % 50 === 0) console.log(`${count} previews prepared`);
  }
}
writeFileSync('gallery-index.json', JSON.stringify(data, null, 2) + '\n');
console.log(`${count} photos: ${(sourceTotal / 1048576).toFixed(1)} MB → ${(total / 1048576).toFixed(1)} MB; originals unchanged.`);
