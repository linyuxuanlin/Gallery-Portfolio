import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const photographId = image => `${image.category}/${image.name}`;
export const exhibitionPath = exhibition => `/exhibitions/${exhibition.slug}/`;
export const exhibitionPhotoIds = exhibition => [...(exhibition.opening || []), ...(exhibition.chapters || []).flatMap(chapter => chapter.works || [])];

export function readExhibitions(directory = 'exhibitions') {
  const index = JSON.parse(readFileSync(join(directory, 'index.json'), 'utf8'));
  if (index.schemaVersion !== 1 || !Array.isArray(index.exhibitions) || new Set(index.exhibitions).size !== index.exhibitions.length) throw new Error('Invalid exhibition registry.');
  return index.exhibitions.map(slug => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid exhibition slug: ${slug}`);
    const exhibition = JSON.parse(readFileSync(join(directory, slug + '.json'), 'utf8'));
    if (exhibition.slug !== slug) throw new Error(`Exhibition filename and slug disagree: ${slug}`);
    return exhibition;
  });
}

// Every registered selection reserves its photographs, including unpublished drafts.
// Covers reuse a photograph within that exhibition; they do not reserve a second work.
export function validateExhibitions(exhibitions, images, fingerprints = new Map()) {
  const library = new Map(), owners = new Map(), identities = new Map(), slugs = new Set();
  const fail = message => { throw new Error(message); };
  const nonempty = value => typeof value === 'string' && value.trim().length > 0;
  for (const image of images) {
    const id = photographId(image);
    if (library.has(id)) fail(`Duplicate photograph ID in the library: ${id}`);
    library.set(id, image);
  }
  for (const exhibition of exhibitions) {
    const { slug, status } = exhibition;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) fail(`Invalid or duplicate exhibition slug: ${slug}`);
    slugs.add(slug);
    if (!['draft', 'published', 'archived'].includes(status)) fail(`Invalid exhibition status: ${slug}`);
    if (!nonempty(exhibition.title) || !nonempty(exhibition.titleEn)) fail(`Missing bilingual exhibition title: ${slug}`);
    if (!Array.isArray(exhibition.opening) || !Array.isArray(exhibition.chapters) || exhibition.opening.length > 2) fail(`Invalid exhibition sequence: ${slug}`);
    const chapterIds = new Set();
    for (const chapter of exhibition.chapters) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapter.id) || chapterIds.has(chapter.id) || !Array.isArray(chapter.works)) fail(`Invalid or duplicate chapter: ${slug}/${chapter.id}`);
      chapterIds.add(chapter.id);
      if (status !== 'draft' && (![chapter.title, chapter.titleEn, chapter.text, chapter.textEn].every(nonempty) || chapter.works.length === 0)) fail(`Incomplete bilingual chapter: ${slug}/${chapter.id}`);
    }
    const ids = exhibitionPhotoIds(exhibition), unique = new Set();
    for (const id of ids) {
      if (!library.has(id)) fail(`Missing exhibition photograph: ${slug}: ${id}`);
      if (unique.has(id)) fail(`Repeated photograph inside exhibition: ${slug}: ${id}`);
      unique.add(id);
      if (owners.has(id)) fail(`Photograph reserved by two exhibitions: ${id}: ${owners.get(id)} and ${slug}`);
      owners.set(id, slug);
      const image = library.get(id);
      const keys = [image.original && 'original:' + new URL(image.original).origin + new URL(image.original).pathname, fingerprints.get(id) && 'preview:' + fingerprints.get(id)].filter(Boolean);
      for (const key of keys) {
        if (identities.has(key)) fail(`Duplicate photograph content: ${id} (${slug}) and ${identities.get(key)}`);
        identities.set(key, `${id} (${slug})`);
      }
    }
    if (exhibition.cover && !unique.has(exhibition.cover)) fail(`Exhibition cover is outside its selection: ${slug}`);
    if (status !== 'draft') {
      if (!ids.length || !exhibition.cover || !nonempty(exhibition.standfirst) || !nonempty(exhibition.standfirstEn)) fail(`Incomplete public exhibition: ${slug}`);
      if (![exhibition.introduction, exhibition.introductionEn].every(value => Array.isArray(value) && value.length && value.every(nonempty)) || exhibition.introduction.length !== exhibition.introductionEn.length) fail(`Incomplete bilingual introduction: ${slug}`);
    }
  }
  return { library, owners, publicExhibitions: exhibitions.filter(exhibition => exhibition.status !== 'draft') };
}
