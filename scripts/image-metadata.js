import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

export async function previewMetadata(images) {
  const files = [...new Set(images.flatMap(image => [image.preview, image.largePreview].filter(Boolean)))];
  const entries = await Promise.all(files.map(async url => {
    const path = resolve(url.replace(/^\//, ''));
    if (!url.startsWith('/public/photos/') || relative(resolve('public/photos'), path).startsWith('..')) {
      throw new Error(`Prepare beta previews before building: ${url}`);
    }
    const info = await sharp(await readFile(path)).metadata();
    if (!info.width || !info.height) throw new Error(`Invalid preview dimensions: ${url}`);
    return [url, { width: info.width, height: info.height }];
  }));
  return new Map(entries);
}
