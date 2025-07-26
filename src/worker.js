addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 模拟不同的路由
  if (path.startsWith('/config') || path.startsWith('/images') || path.startsWith('/exif') || path.startsWith('/thumbnail') || path.startsWith('/notifications')) {
    // 这里可以继续处理不同的动态请求，类似你在 Vercel 上的 server.js
    return new Response('Dynamic content from Cloudflare Worker', { status: 200 });
  }

  // 静态文件服务
  if (path.startsWith('/')) {
    return fetch(`https://gallery.wiki-power.com/${path}`);
  }

  return new Response('Not found', { status: 404 });
}
