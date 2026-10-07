import { cpSync, mkdirSync, rmSync } from 'node:fs';

// 只允许公开的网站资源进入产物；不发布 .env、依赖、归档和脚本。
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
for (const file of ['index.html', 'gallery-index.json', '_headers', 'public']) {
    cpSync(file, `dist/${file}`, { recursive: true });
}
console.log('静态网站已生成至 dist/');
