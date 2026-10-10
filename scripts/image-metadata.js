import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';

export async function previewMetadata(images) {
  const files = [...new Set(images.flatMap(image => [image.preview, image.largePreview].filter(Boolean)))];
  const entries = new Array(files.length);
  let cursor = 0;
  const inspect = async url => {
    const path = resolve(url.replace(/^\//, ''));
    if (!url.startsWith('/public/photos/') || relative(resolve('public/photos'), path).startsWith('..')) {
      throw new Error(`Prepare beta previews before building: ${url}`);
    }
    const bytes = await readFile(path);
    const info = await sharp(bytes).metadata();
    if (!info.width || !info.height) throw new Error(`Invalid preview dimensions: ${url}`);
    return [url, { width: info.width, height: info.height, sha256: createHash('sha256').update(bytes).digest('hex') }];
  };
  await Promise.all(Array.from({ length: Math.min(8, files.length) }, async () => {
    while (cursor < files.length) {
      const index = cursor++;
      entries[index] = await inspect(files[index]);
    }
  }));
  return new Map(entries);
}
