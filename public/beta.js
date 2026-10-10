(() => {
  document.documentElement.classList.add('js');
  const language = document.documentElement.dataset.language || 'zh';
  const tr = (zh, en) => language === 'en' ? en : zh;
  const languageSwitch = document.querySelector('.language-switch');
  languageSwitch.addEventListener('click', () => {
    const target = new URL(languageSwitch.href);
    target.search = location.search;
    target.hash = location.hash;
    languageSwitch.href = target.href;
  });
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  const setMenu = open => { menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? tr('关闭导航', 'Close navigation') : tr('打开导航', 'Open navigation')); nav.classList.toggle('is-open', open); };
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) setMenu(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); } });
  matchMedia('(min-width: 701px)').addEventListener('change', () => setMenu(false));
  const filters = document.querySelector('.filters');
  const activeFilter = filters?.querySelector('[aria-current]');
  if (activeFilter && matchMedia('(max-width: 700px)').matches) {
    const reveal = () => filters.scrollTo({ left: activeFilter.offsetLeft - (filters.clientWidth - activeFilter.offsetWidth) / 2, behavior: 'instant' });
    reveal(); document.fonts.ready.then(reveal);
  }
  document.querySelectorAll('.photo-open img').forEach(img => { const fail = () => img.parentElement.classList.add('photo-failed'); img.addEventListener('error', fail); if (img.complete && !img.naturalWidth) fail(); });
  const dialog = document.getElementById('viewer');
  if (!dialog.showModal) return; // Photo links still open the original without dialog support.
  const image = document.getElementById('viewer-image');
  const status = document.getElementById('viewer-status');
  const load = document.getElementById('viewer-original');
  const zoom = document.getElementById('viewer-zoom');
  const stage = dialog.querySelector('.viewer-stage');
  const watermark = document.getElementById('viewer-watermark');
  const positionWatermark = () => {
    const photo = image.getBoundingClientRect(), area = stage.getBoundingClientRect();
    watermark.hidden = !dialog.open || !image.naturalWidth;
    watermark.style.left = `${Math.min(photo.right, area.right - 8) - 12}px`;
    watermark.style.top = `${Math.min(photo.bottom, area.bottom - 8) - 12}px`;
  };
  image.addEventListener('load', positionWatermark);
  new ResizeObserver(positionWatermark).observe(stage);
  new ResizeObserver(positionWatermark).observe(image);
  stage.addEventListener('scroll', positionWatermark, { passive: true });
  const close = document.getElementById('viewer-close');
  const previous = document.getElementById('viewer-previous');
  const next = document.getElementById('viewer-next');
  const share = document.getElementById('viewer-share');
  const photos = [...document.querySelectorAll('[data-photo]')];
  const legacyLinks = document.getElementById('legacy-photo-links');
  const legacyPhotoRoutes = legacyLinks ? JSON.parse(legacyLinks.textContent) : {};
  let archiveRoutes;
  const redirectPhoto = (path, hash) => {
    if (!path || location.hash !== hash) return;
    const target = new URL(path, location.origin);
    if (target.origin === location.origin && target.pathname !== location.pathname) {
      target.search = location.search; target.hash = hash;
      location.replace(target.href);
    }
  };
  let current = 0, request = 0, timer, pending, opener, scrollY = 0;
  const cancelLoad = () => { request++; clearTimeout(timer); if (pending) { pending.onload = pending.onerror = null; pending.removeAttribute('src'); pending = null; } };
  const resetZoom = () => { dialog.classList.remove('zoomed'); image.style.width = ''; zoom.textContent = tr('100% 查看', 'View at 100%'); stage.scrollTop = stage.scrollLeft = 0; };
  const show = index => {
    cancelLoad(); resetZoom(); current = index;
    const photo = photos[current];
    document.getElementById('viewer-title').textContent = photo.dataset.title;
    document.getElementById('viewer-place').textContent = `${photo.dataset.place} / ${String(current + 1).padStart(2, '0')} — ${photos.length}`;
    image.alt = photo.querySelector('img').alt;
    image.onload = null; image.onerror = () => { status.textContent = tr('预览暂不可用，可加载或打开原图。', 'Preview unavailable. Load or open the original photograph.'); };
    watermark.hidden = true; image.removeAttribute('src'); image.src = photo.dataset.preview;
    document.getElementById('viewer-link').href = photo.href;
    status.textContent = tr('预览图 · 原图可按需加载', 'Preview · Load the original when you choose');
    load.hidden = false; load.disabled = false; load.textContent = tr('加载原图', 'Load original'); zoom.hidden = true;
    previous.disabled = current === 0; next.disabled = current === photos.length - 1;
    if (!dialog.open) {
      opener = document.activeElement; scrollY = window.scrollY;
      document.body.classList.add('viewer-open'); dialog.showModal(); close.focus();
    }
  };
  const finishClose = () => { if (dialog.open) return; cancelLoad(); resetZoom(); image.onerror = image.onload = null; image.removeAttribute('src'); document.body.classList.remove('viewer-open'); window.scrollTo({ top: scrollY, behavior: 'instant' }); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  const photoHash = index => '#photo=' + encodeURIComponent(photos[index].dataset.photoId);
  const closeViewer = () => {
    if (history.state?.galleryViewer) history.back();
    else {
      history.replaceState(history.state, '', location.pathname + location.search);
      dialog.close();
    }
  };
  const navigatePhoto = index => {
    history.replaceState(history.state, '', photoHash(index));
    show(index);
  };
  const syncLocation = () => {
    let id;
    try { id = location.hash.startsWith('#photo=') ? decodeURIComponent(location.hash.slice(7)) : ''; } catch { id = ''; }
    const index = photos.findIndex(photo => photo.dataset.photoId === id);
    if (index >= 0) { setMenu(false); if (!dialog.open || current !== index) show(index); }
    else if (id && legacyPhotoRoutes[id]) {
      // Old homepage photo fragments now lead to the photograph's stable detail page.
      redirectPhoto(legacyPhotoRoutes[id], location.hash);
    }
    else if (id && /^\/(?:en\/)?works\//.test(location.pathname)) {
      const hash = location.hash, global = /^\/(?:en\/)?works\/(?:page\/\d+\/)?$/.test(location.pathname);
      // Load the small route index only when a shared photograph moved off this page.
      archiveRoutes ||= fetch('/public/archive-routes.json').then(response => {
        if (!response.ok) throw new Error('Archive route index unavailable.');
        return response.json();
      });
      archiveRoutes.then(routes => {
        const path = routes[id]?.[global ? 'all' : 'place'];
        if (path) redirectPhoto((language === 'en' ? '/en' : '') + path, hash);
      }).catch(() => {});
    }
    else if (dialog.open) dialog.close();
  };
  addEventListener('popstate', syncLocation); addEventListener('hashchange', syncLocation);
  photos.forEach((photo, index) => photo.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); setMenu(false);
    history.pushState({ ...history.state, galleryViewer: true }, '', photoHash(index)); show(index);
  }));
  close.addEventListener('click', closeViewer);
  dialog.addEventListener('close', finishClose);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeViewer(); });
  let touchStart, suppressClickUntil = 0;
  stage.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 && !dialog.classList.contains('zoomed') ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchend', event => {
    if (!touchStart || event.changedTouches.length !== 1 || event.touches.length) { touchStart = null; return; }
    const dx = event.changedTouches[0].clientX - touchStart.x, dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    suppressClickUntil = Date.now() + 500;
    const index = current + (dx < 0 ? 1 : -1);
    if (index >= 0 && index < photos.length) navigatePhoto(index);
  }, { passive: true });
  stage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  dialog.addEventListener('click', event => { if (event.target === stage && Date.now() > suppressClickUntil && !dialog.classList.contains('zoomed')) closeViewer(); });
  previous.addEventListener('click', () => { if (current > 0) navigatePhoto(current - 1); });
  next.addEventListener('click', () => { if (current < photos.length - 1) navigatePhoto(current + 1); });
  share.addEventListener('click', async () => {
    const url = photos[current].dataset.shareUrl || location.href;
    try { await navigator.clipboard.writeText(url); status.textContent = tr('作品链接已复制，可以分享这张照片。', 'Photograph link copied. Ready to share.'); }
    catch { status.textContent = tr('可复制地址栏中的链接，分享这张照片。', 'Copy the address bar link to share this photograph.'); }
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && !dialog.classList.contains('zoomed') && current > 0) { event.preventDefault(); navigatePhoto(current - 1); }
    if (event.key === 'ArrowRight' && !dialog.classList.contains('zoomed') && current < photos.length - 1) { event.preventDefault(); navigatePhoto(current + 1); }
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll('button,a[href]')].filter(control => !control.disabled && !control.hidden && control.getClientRects().length);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    }
  });
  load.addEventListener('click', () => {
    cancelLoad(); const id = request; const url = photos[current].href;
    load.disabled = true; load.textContent = tr('加载原图中…', 'Loading original…'); status.textContent = tr('正在加载原图，请稍候。', 'Loading the original photograph. Please wait.');
    const high = new Image(); pending = high;
    const fail = () => { if (id !== request || !dialog.open) return; clearTimeout(timer); high.onload = high.onerror = null; high.removeAttribute('src'); load.disabled = false; load.textContent = tr('重试加载原图', 'Retry original'); status.textContent = tr('原图加载失败或超时，可重试或通过链接打开。', 'Original failed to load or timed out. Retry or open its link.'); };
    timer = setTimeout(fail, 60000);
    high.onload = () => {
      if (id !== request || !dialog.open) return;
      clearTimeout(timer); high.onload = high.onerror = null;
      image.onerror = null; image.src = url;
      status.textContent = `${tr('原图', 'Original')} ${high.naturalWidth} × ${high.naturalHeight}`;
      const focused = document.activeElement === load; load.hidden = true; zoom.hidden = false; if (focused) zoom.focus();
    };
    high.onerror = fail; high.src = url;
  });
  zoom.addEventListener('click', () => {
    const zoomed = dialog.classList.toggle('zoomed');
    image.style.width = zoomed ? `${image.naturalWidth}px` : '';
    zoom.textContent = zoomed ? tr('适应屏幕', 'Fit to screen') : tr('100% 查看', 'View at 100%'); stage.scrollTop = stage.scrollLeft = 0;
  });
  syncLocation();
})();
