export const ARCHIVE_PAGE_SIZE = 72;

export const archivePath = (category = '', page = 1) => `/works/${category ? encodeURIComponent(category) + '/' : ''}${page > 1 ? `page/${page}/` : ''}`;

export function archivePages(images, size = ARCHIVE_PAGE_SIZE) {
  if (!Number.isInteger(size) || size < 1) throw new Error('Invalid archive page size.');
  return Array.from({ length: Math.max(1, Math.ceil(images.length / size)) }, (_, index) => ({ number: index + 1, offset: index * size, images: images.slice(index * size, (index + 1) * size) }));
}

export function pagination({ page, pages, total, category = '', t, local }) {
  if (pages === 1) return '';
  // Bounded navigation stays readable even for thousands of photographs.
  const numbers = [...new Set([1, pages, page - 1, page, page + 1].filter(number => number >= 1 && number <= pages))].sort((a, b) => a - b);
  let previous = 0;
  const links = numbers.map(number => {
    const gap = previous && number - previous > 1 ? '<span aria-hidden="true">…</span>' : '';
    previous = number;
    return gap + `<a href="${local(archivePath(category, number))}" ${number === page ? 'aria-current="page"' : ''} aria-label="${t('第 ' + number + ' 页', 'Page ' + number)}">${number}</a>`;
  }).join('');
  return `<nav class="pagination" aria-label="${t('作品档案分页', 'Archive pages')}"><span class="pagination-status">${t(`第 ${page} / ${pages} 页 · 共 ${total} 幅作品`, `Page ${page} of ${pages} · ${total} photographs`)}</span><div>${page > 1 ? `<a rel="prev" href="${local(archivePath(category, page - 1))}">${t('上一页', 'Previous')} ←</a>` : ''}${links}${page < pages ? `<a rel="next" href="${local(archivePath(category, page + 1))}">${t('下一页', 'Next')} →</a>` : ''}</div></nav>`;
}
