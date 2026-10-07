import path from 'node:path';

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']);
export const normalizeDirectory = value => (value || '').replace(/^\/+|\/+$/g, '');

export function imagePaths(key, imageDirectory = '') {
    const directory = normalizeDirectory(imageDirectory);
    const prefix = directory ? `${directory}/` : '';
    if (!key.startsWith(prefix) || key.endsWith('/')) return null;
    const relative = key.slice(prefix.length);
    const parts = relative.split('/');
    if (parts.length < 2 || parts[0] === '0_preview' || !IMAGE_EXTENSIONS.has(path.extname(key).toLowerCase())) return null;
    const extension = path.extname(relative);
    const stem = relative.slice(0, -extension.length);
    return {
        category: parts[0],
        name: path.basename(relative, extension),
        originalKey: key,
        previewKey: `${prefix}0_preview/${stem}.webp`,
    };
}

export function publicObjectUrl(baseUrl, key) {
    return `${baseUrl.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
