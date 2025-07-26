# Cloudflare 部署指南

本指南将帮助你将 Gallery-Portfolio 项目从 Vercel 部署迁移到 Cloudflare Workers。

## 准备工作

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

## 环境变量配置

### 方法一：使用 wrangler.toml 配置

在 `wrangler.toml` 文件中添加你的环境变量：

```toml
[vars]
R2_REGION = "auto"
R2_ENDPOINT = "https://your-endpoint.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID = "your-access-key-id"
R2_SECRET_ACCESS_KEY = "your-secret-access-key"
R2_BUCKET_NAME = "your-bucket-name"
R2_IMAGE_BASE_URL = "https://your-image-base-url.com"
IMAGE_DIR = "gallery"
IMAGE_COMPRESSION_QUALITY = "100"
```

### 方法二：使用 Cloudflare Dashboard

1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages
3. 选择你的项目
4. 在 Settings > Variables 中添加环境变量

## 部署步骤

### 1. 本地开发测试

```bash
npm run dev
```

### 2. 部署到生产环境

```bash
npm run deploy
```

### 3. 部署到测试环境

```bash
npm run deploy:staging
```

## 配置自定义域名

### 1. 在 wrangler.toml 中配置路由

```toml
[[env.production.routes]]
pattern = "your-domain.com/*"
zone_name = "your-domain.com"
```

### 2. 在 Cloudflare Dashboard 中配置

1. 进入 Cloudflare Dashboard
2. 选择你的域名
3. 在 DNS 设置中添加 CNAME 记录
4. 指向你的 Workers 域名

## 与 Vercel 的主要区别

### 1. 文件结构
- Vercel: 使用 `vercel.json` 配置
- Cloudflare: 使用 `wrangler.toml` 配置

### 2. 服务器代码
- Vercel: 使用 Express.js (`server.js`)
- Cloudflare: 使用 Workers API (`worker.js`)

### 3. 环境变量
- Vercel: 在 Dashboard 中配置
- Cloudflare: 可在 `wrangler.toml` 或 Dashboard 中配置

### 4. 静态文件服务
- Vercel: 自动处理 `public` 目录
- Cloudflare: 需要手动配置静态文件服务

## 性能优化建议

### 1. 使用 Cloudflare R2 绑定

如果使用 Cloudflare R2，可以在 `wrangler.toml` 中配置绑定：

```toml
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "your-bucket-name"
```

然后在 `worker.js` 中使用：

```javascript
const bucket = env.MY_BUCKET;
```

### 2. 缓存配置

在 `worker.js` 中添加缓存头：

```javascript
const cacheHeaders = {
  'Cache-Control': 'public, max-age=3600',
  'CDN-Cache-Control': 'public, max-age=86400',
};
```

### 3. 图片优化

利用 Cloudflare 的图片优化服务：

```javascript
// 在返回图片时添加优化参数
const optimizedUrl = `${IMAGE_BASE_URL}/${key}?format=webp&quality=85`;
```

## 故障排除

### 1. 常见错误

- **Module not found**: 确保所有依赖都正确安装
- **Environment variables not found**: 检查 `wrangler.toml` 配置
- **CORS errors**: 确保设置了正确的 CORS 头

### 2. 调试技巧

```bash
# 查看日志
wrangler tail

# 本地调试
wrangler dev --local

# 查看部署状态
wrangler whoami
```

## 迁移检查清单

- [ ] 安装 Wrangler CLI
- [ ] 配置环境变量
- [ ] 测试本地开发环境
- [ ] 部署到测试环境
- [ ] 配置自定义域名
- [ ] 测试所有功能
- [ ] 更新 DNS 记录
- [ ] 监控性能指标

## 注意事项

1. **Sharp 库限制**: Cloudflare Workers 对 Sharp 库的支持有限，可能需要使用替代方案
2. **文件大小限制**: Workers 有 1MB 的代码大小限制
3. **执行时间限制**: Workers 有 30 秒的执行时间限制
4. **内存限制**: Workers 有 128MB 的内存限制

## 支持

如果遇到问题，可以：

1. 查看 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
2. 查看 [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
3. 在 GitHub 上提交 Issue 