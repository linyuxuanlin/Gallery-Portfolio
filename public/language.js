(() => {
  // Explicit English URLs remain shareable regardless of browser preference.
  if (location.pathname === '/en' || location.pathname.startsWith('/en/')) return;
  let preferred;
  try { preferred = localStorage.getItem('power-gallery-language'); } catch {}
  if (!['zh', 'en'].includes(preferred)) preferred = (navigator.languages?.[0] || navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  if (preferred === 'en') location.replace('/en' + location.pathname + location.search + location.hash);
})();
