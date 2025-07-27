# Gallery Portfolio - R2 部署指南

## 概述

本项目已更新为支持从 Cloudflare R2 存储桶自动获取图片文件列表，并在部署时自动生成 `gallery-index.json` 文件。用户不再需要在本地维护图片文件，所有图片都存储在 R2 中。

## 新功能

- ✅ 从 R2 存储桶自动获取文件列表
- ✅ 部署时自动生成图片索引
- ✅ 支持环境变量配置
- ✅ 跨平台支持 (Windows/Linux/macOS)

## 环境要求

### 必需软件
- Node.js (v16 或更高版本)
- npm
- Wrangler CLI

### 安装步骤

1. **安装 Node.js**
   ```bash
   # 从 https://nodejs.org/ 下载并安装
   ```

2. **安装 Wrangler**
   ```bash
   npm install -g wrangler
   ```

3. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

## 配置步骤

### 1. 设置环境变量

创建 `.env` 文件或在系统环境变量中设置：

```bash
# Cloudflare 账户 ID
CLOUDFLARE_ACCOUNT_ID=your_account_id

# R2 访问密钥
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key

# R2 端点 (可选，如果不设置会使用默认值)
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

### 2. 获取 Cloudflare 账户 ID

1. 登录 Cloudflare 控制台
2. 在右侧边栏找到 "Account ID"
3. 复制该 ID 并设置为 `CLOUDFLARE_ACCOUNT_ID`

### 3. 创建 R2 访问密钥

1. 在 Cloudflare 控制台中，进入 "R2 Object Storage"
2. 创建新的 API 令牌或使用现有的
3. 获取 Access Key ID 和 Secret Access Key
4. 设置为环境变量

### 4. 配置 R2 存储桶

确保您的 R2 存储桶 `wiki-media` 中有以下目录结构：

```
wiki-media/
└── gallery/
    ├── category1/
    │   ├── image1.jpg
    │   └── image2.png
    ├── category2/
    │   ├── image3.jpg
    │   └── image4.png
    └── 0_preview/
        ├── category1/
        │   ├── image1.jpg
        │   └── image2.png
        └── category2/
            ├── image3.jpg
            └── image4.png
```

## 部署流程

### 自动部署 (推荐)

#### Windows
```cmd
deploy.bat
```

#### Linux/macOS
```bash
./deploy.sh
```

### 手动部署

1. **安装依赖**
   ```bash
   npm install
   ```

2. **生成图片索引**
   ```bash
   npm run generate-index
   ```

3. **部署到 Cloudflare Pages**
   ```bash
   wrangler pages deploy . --project-name gallery-portfolio-static
   ```

## 配置文件说明

### r2-config.js

```javascript
module.exports = {
    // R2存储桶配置
    r2: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucketName: 'wiki-media',
        endpoint: process.env.R2_ENDPOINT || 'https://your-account-id.r2.cloudflarestorage.com'
    },
    
    // 图片URL配置
    images: {
        baseUrl: 'https://media.wiki-power.com',
        galleryPath: 'gallery',
        previewPath: 'gallery/0_preview'
    },
    
    // 支持的图片格式
    supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
    
    // 目录结构配置
    directories: {
        scanPrefix: 'gallery/',
        skipDirectories: ['0_preview']
    }
};
```

### package.json

```json
{
  "scripts": {
    "generate-index": "node generate-gallery-index-r2.js",
    "deploy": "npm run generate-index && wrangler pages deploy . --project-name gallery-portfolio-static"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0"
  }
}
```

## 故障排除

### 常见问题

1. **环境变量未设置**
   ```
   错误: 缺少必要的环境变量
   ```
   解决：确保设置了所有必需的环境变量

2. **R2 连接失败**
   ```
   获取R2文件列表失败
   ```
   解决：检查 R2 访问密钥和端点配置

3. **Wrangler 未安装**
   ```
   错误: 未找到 Wrangler
   ```
   解决：运行 `npm install -g wrangler`

4. **未登录 Cloudflare**
   ```
   需要登录Cloudflare
   ```
   解决：运行 `wrangler login`

### 调试模式

启用详细日志输出：

```bash
# Windows
set DEBUG=1
deploy.bat

# Linux/macOS
DEBUG=1 ./deploy.sh
```

## 迁移指南

### 从本地文件系统迁移到 R2

1. **上传图片到 R2**
   - 将本地图片上传到 R2 存储桶
   - 确保目录结构与配置一致

2. **更新配置**
   - 设置环境变量
   - 修改 `r2-config.js` 中的 URL 配置

3. **测试部署**
   - 运行部署脚本
   - 验证图片索引生成正确

## 注意事项

- 确保 R2 存储桶中的图片文件可公开访问
- 预览图片应放在 `0_preview` 目录下
- 支持的图片格式：jpg, jpeg, png, gif, bmp, webp
- 部署前会自动生成 `gallery-index.json` 文件

## 技术支持

如果遇到问题，请检查：
1. 环境变量是否正确设置
2. R2 存储桶权限是否正确
3. 网络连接是否正常
4. Wrangler 是否已正确安装和登录 