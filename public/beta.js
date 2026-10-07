(() => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  const setMenu = open => { menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? '关闭导航' : '打开导航'); nav.classList.toggle('is-open', open); };
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) setMenu(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); } });
  document.querySelectorAll('.photo-open img').forEach(img => { const fail = () => img.parentElement.classList.add('photo-failed'); img.addEventListener('error', fail); if (img.complete && !img.naturalWidth) fail(); });
  const dialog = document.getElementById('viewer');
  if (!dialog.showModal) return; // Photo links still open the original without dialog support.
  const image = document.getElementById('viewer-image');
  const status = document.getElementById('viewer-status');
  const load = document.getElementById('viewer-original');
  const zoom = document.getElementById('viewer-zoom');
  const stage = dialog.querySelector('.viewer-stage');
  const close = document.getElementById('viewer-close');
  const previous = document.getElementById('viewer-previous');
  const next = document.getElementById('viewer-next');
  const photos = [...document.querySelectorAll('[data-photo]')];
  let current = 0, request = 0, timer, pending, opener, scrollY = 0;
  const cancelLoad = () => { request++; clearTimeout(timer); if (pending) { pending.onload = pending.onerror = null; pending.removeAttribute('src'); pending = null; } };
  const resetZoom = () => { dialog.classList.remove('zoomed'); image.style.width = ''; zoom.textContent = '100% 查看'; stage.scrollTop = stage.scrollLeft = 0; };
  const show = index => {
    cancelLoad(); resetZoom(); current = index;
    const photo = photos[current];
    document.getElementById('viewer-title').textContent = photo.dataset.title;
    document.getElementById('viewer-place').textContent = `${photo.dataset.place} / ${String(current + 1).padStart(2, '0')} — ${photos.length}`;
    image.alt = photo.querySelector('img').alt;
    image.onload = null; image.onerror = () => { status.textContent = '预览暂不可用，可加载或打开原图。'; };
    image.src = photo.dataset.preview;
    document.getElementById('viewer-link').href = photo.href;
    status.textContent = '预览图 · 原图可按需加载';
    load.hidden = false; load.disabled = false; load.textContent = '加载原图'; zoom.hidden = true;
    previous.disabled = current === 0; next.disabled = current === photos.length - 1;
    if (!dialog.open) {
      opener = document.activeElement; scrollY = window.scrollY;
      document.body.classList.add('viewer-open'); dialog.showModal(); close.focus();
    }
  };
  const finishClose = () => { cancelLoad(); resetZoom(); image.onerror = image.onload = null; image.removeAttribute('src'); document.body.classList.remove('viewer-open'); window.scrollTo({ top: scrollY, behavior: 'instant' }); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  const closeViewer = () => dialog.close();
  photos.forEach((photo, index) => photo.addEventListener('click', event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); setMenu(false); show(index); }));
  close.addEventListener('click', closeViewer);
  dialog.addEventListener('close', finishClose);
  dialog.addEventListener('click', event => { if (event.target === stage && !dialog.classList.contains('zoomed')) closeViewer(); });
  previous.addEventListener('click', () => { if (current > 0) show(current - 1); });
  next.addEventListener('click', () => { if (current < photos.length - 1) show(current + 1); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && !dialog.classList.contains('zoomed') && current > 0) { event.preventDefault(); show(current - 1); }
    if (event.key === 'ArrowRight' && !dialog.classList.contains('zoomed') && current < photos.length - 1) { event.preventDefault(); show(current + 1); }
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll('button,a[href]')].filter(control => !control.disabled && !control.hidden && control.getClientRects().length);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    }
  });
  load.addEventListener('click', () => {
    cancelLoad(); const id = request; const url = photos[current].href;
    load.disabled = true; load.textContent = '加载原图中…'; status.textContent = '正在加载原图，请稍候。';
    const high = new Image(); pending = high;
    const fail = () => { if (id !== request || !dialog.open) return; clearTimeout(timer); high.onload = high.onerror = null; high.removeAttribute('src'); load.disabled = false; load.textContent = '重试加载原图'; status.textContent = '原图加载失败或超时，可重试或通过链接打开。'; };
    timer = setTimeout(fail, 60000);
    high.onload = () => {
      if (id !== request || !dialog.open) return;
      clearTimeout(timer); high.onload = high.onerror = null;
      image.onerror = null; image.src = url;
      status.textContent = `原图 ${high.naturalWidth} × ${high.naturalHeight}`;
      const focused = document.activeElement === load; load.hidden = true; zoom.hidden = false; if (focused) zoom.focus();
    };
    high.onerror = fail; high.src = url;
  });
  zoom.addEventListener('click', () => {
    const zoomed = dialog.classList.toggle('zoomed');
    image.style.width = zoomed ? `${image.naturalWidth}px` : '';
    zoom.textContent = zoomed ? '适应屏幕' : '100% 查看'; stage.scrollTop = stage.scrollLeft = 0;
  });
})();
