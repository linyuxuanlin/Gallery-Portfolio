# 从 Vercel 迁移到 Cloudflare Workers 指南

本指南将帮助你快速将 Gallery-Portfolio 项目从 Vercel 部署迁移到 Cloudflare Workers。

## 迁移前准备

### 1. 备份当前配置

在开始迁移之前，请备份以下文件：
- `vercel.json` (Vercel 配置)
- `.env` (环境变量)
- 当前的环境变量设置

### 2. 安装 Cloudflare 工具

```bash
npm install -g wrangler
```

### 3. 登录 Cloudflare

```bash
wrangler login
```

## 迁移步骤

### 步骤 1: 配置环境变量

将你的 Vercel 环境变量迁移到 `wrangler.toml`：

**Vercel 环境变量** → **wrangler.toml 配置**

```toml
[vars]
R2_REGION = "auto"
R2_ENDPOINT = "你的R2端点"
R2_ACCESS_KEY_ID = "你的访问密钥ID"
R2_SECRET_ACCESS_KEY = "你的访问密钥"
R2_BUCKET_NAME = "你的存储桶名称"
R2_IMAGE_BASE_URL = "你的图片基础URL"
IMAGE_DIR = "gallery"
IMAGE_COMPRESSION_QUALITY = "100"
```

### 步骤 2: 配置自定义域名（可选）

如果你有自定义域名，在 `wrangler.toml` 中添加：

```toml
[[env.production.routes]]
pattern = "your-domain.com/*"
zone_name = "your-domain.com"
```

### 步骤 3: 部署到 Cloudflare Workers

```bash
# 安装依赖
npm install

# 部署到生产环境
npm run deploy

# 或者使用部署脚本
./deploy-cloudflare.sh  # Linux/Mac
deploy-cloudflare.bat   # Windows
```

### 步骤 4: 验证部署

1. 检查网站是否正常访问
2. 测试图片加载功能
3. 测试 EXIF 信息显示
4. 测试缩略图生成

## 主要差异对比

| 功能 | Vercel | Cloudflare Workers |
|------|--------|-------------------|
| 配置文件 | `vercel.json` | `wrangler.toml` |
| 服务器文件 | `server.js` | `worker.js` |
| 环境变量 | Dashboard 配置 | `wrangler.toml` 配置 |
| 部署命令 | `vercel deploy` | `wrangler deploy` |
| 本地开发 | `vercel dev` | `wrangler dev` |

## 性能优势

迁移到 Cloudflare Workers 后，你将获得以下优势：

1. **更快的全球访问速度**：Cloudflare 的全球边缘网络
2. **更好的缓存性能**：内置的 CDN 缓存
3. **更低的延迟**：边缘计算减少延迟
4. **更高的可用性**：99.9% 的可用性保证

## 故障排除

### 常见问题

1. **环境变量未找到**
   - 检查 `wrangler.toml` 中的 `[vars]` 配置
   - 确保所有必需的变量都已配置

2. **部署失败**
   - 检查是否已登录：`wrangler whoami`
   - 检查网络连接
   - 查看错误日志：`wrangler tail`

3. **图片无法加载**
   - 检查 R2 配置是否正确
   - 确认图片路径和权限设置

4. **Sharp 库问题**
   - Cloudflare Workers 对 Sharp 支持有限
   - 考虑使用 Cloudflare 的图片优化服务

### 调试命令

```bash
# 查看部署状态
wrangler whoami

# 本地开发
wrangler dev

# 查看日志
wrangler tail

# 查看配置
wrangler config
```

## 迁移检查清单

- [ ] 安装 Wrangler CLI
- [ ] 登录 Cloudflare 账户
- [ ] 配置 `wrangler.toml` 环境变量
- [ ] 测试本地开发环境
- [ ] 部署到 Cloudflare Workers
- [ ] 验证所有功能正常
- [ ] 配置自定义域名（如需要）
- [ ] 更新 DNS 记录
- [ ] 测试性能表现

## 回滚方案

如果迁移后遇到问题，可以：

1. **保留 Vercel 部署**：在迁移期间保持 Vercel 部署运行
2. **使用不同域名**：Cloudflare 和 Vercel 使用不同域名
3. **快速回滚**：如果问题严重，可以快速切换回 Vercel

## 后续优化

迁移完成后，可以考虑以下优化：

1. **启用 Cloudflare 图片优化**
2. **配置缓存策略**
3. **启用 Cloudflare Analytics**
4. **配置安全规则**

## 支持

如果在迁移过程中遇到问题：

1. 查看 [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)
2. 查看 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
3. 在 GitHub 上提交 Issue

---

**注意**：迁移过程中建议先在测试环境验证，确认无误后再迁移生产环境。 