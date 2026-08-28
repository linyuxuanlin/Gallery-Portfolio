<h2 align="center">
<img width="27" src="./public/assets/favicon.svg">
Gallery-Portfolio 
</h2>

<p align="center">
  <a href="https://gallery-portfolio.wiki-power.com/"><img src="https://img.shields.io/badge/Demo-site-t?&style=flat-square" alt="Demo"></a>
  <a href="https://github.com/linyuxuanlin/Gallery-Portfolio/blob/main/LICENSE"><img src="https://img.shields.io/github/license/linyuxuanlin/Gallery-Portfolio?style=flat-square" alt="许可证"></a>
  <img src="https://img.shields.io/github/repo-size/linyuxuanlin/Gallery-Portfolio?style=flat-square&color=328657" alt="存储库大小">
</p>

<p align="center">
    <a href="https://gallery-portfolio.wiki-power.com/">
        <img src="https://media.wiki-power.com/img/mockup2.png" width="550" />
    </a>
</p>

**Gallery-Portfolio** 是一个风格简洁的 **摄影作品展示站**，你只需要将图片存放在免费的 **Cloudflare R2** 上（或其他任意图床），即可在这里展现你的大作。在这里你可以通过 **瀑布流** 的形式浏览图片，也可以 **点开大图** ，查看光圈 / 快门 / ISO 等 **EXIF** 信息。此静态网站基于 Node.js，使用 **Material Design** 风格的 **响应式设计**，支持 **日夜间模式** 切换，在不同的设备上都有不错的视觉效果。

<p align="center">
  <a href="https://dash.cloudflare.com/?to=https://dash.cloudflare.com/pages"><img src="https://img.shields.io/badge/Deploy%20to%20Cloudflare%20Pages-4285F4?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Deploy to Cloudflare Pages"/></a>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flinyuxuanlin%2FGallery-Portfolio"><img src="https://img.shields.io/badge/Deploy%20to%20Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Deploy to Vercel"/></a>
</p>

## ✨ 一些特性

- 🚀 **静态部署** - 零服务器成本，快速加载
- 🏷️ **作品分类** - 按摄影主题和地点进行分类展示
- 📱 **移动端优化** - 完美适配移动设备观片
- 🖼️ **响应式设计** - 自适应布局，支持多种屏幕尺寸
- 🌙 **深色/浅色主题** - 支持主题切换，优化观片体验
- ⚡ **懒加载** - 滚动时自动加载更多作品
- 🎯 **自动滚动** - 一键开启自动滚动浏览
- 🖼️ **预览图优化** - 先加载预览图，点击查看高清原图
- 🔄 **智能加载** - 预览图缺失时自动加载原图
- 📸 **EXIF 信息** - 显示光圈、快门、ISO 等摄影参数（未完成）
- 🌍 **跨平台支持** - 提供 Node.js 脚本，支持所有操作系统
- 🔗 **图床兼容** - 支持任意图床服务（Cloudflare R2、阿里云 OSS、腾讯云 COS 等）
- 🎲 **随机展示** - 图片以随机顺序展示，每次刷新都有不同的排列

## 🖼️ 示例站点

- **[DeepSeek酱语录](https://ai-meme.cdqyfdbymn.me/)** —— 基于本项目改造的 DeepSeek 娘化表情包瀑布流站：128 张台词级梗图、标签筛选、日夜间模式、分享卡片生成，图片托管 Cloudflare R2 + Supabase

## 🏗️ 项目结构

```
Gallery-Portfolio/
├── index.html                 # 主页面
├── gallery-index.json         # 图片索引文件（自动生成）
├── public/                    # 静态资源
│   ├── styles.css            # 主样式文件
│   ├── gallery.css           # 画廊样式
│   ├── layout.js             # 布局和主题切换
│   ├── gallery.js            # 主画廊逻辑
│   ├── data-loader.js        # 数据加载模块
│   ├── tag-filter.js         # 标签筛选模块
│   ├── image-loader.js       # 图片加载模块
│   ├── auto-scroll.js        # 自动滚动模块
│   └── assets/               # 图标资源
├── generate-gallery-index-r2.js   # Node.js图片索引生成脚本
├── generate-webp-thumbnail-r2.js      # 预览图生成脚本
├── deploy.bat                # Windows部署脚本
├── deploy.sh                 # Linux/macOS部署脚本
├── _headers                  # Cloudflare Pages 配置
└── package.json              # 项目配置
```

## 🚀 快速开始

### 1. 准备 Cloudflare R2 图床

#### 1.1 创建 Cloudflare R2 存储桶

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **R2 Object Storage** 页面
3. 点击 **Create bucket** 创建新的存储桶
4. 记录存储桶名称，例如：`my-gallery`

#### 1.2 配置自定义域名（可选）

为了获得更好的访问体验，建议配置自定义域名：

1. 在 R2 存储桶设置中找到 **Custom Domains**
2. 添加你的域名，例如：`cdn.yourdomain.com`
3. 配置 DNS 记录指向 R2 存储桶

#### 1.3 上传图片文件

将你的摄影作品按分类上传到 R2 存储桶：

```
my-gallery/
├── Hongkong/              # 分类文件夹
│   ├── DSC01475.JPG
│   └── DSC01476.JPG
├── Kyoto/
│   ├── DSC02580.JPG
│   └── DSC02581.JPG
└── 0_preview/            # 预览图目录（稍后生成）
    ├── Hongkong/
    └── Kyoto/
```

### 2. 配置项目

#### 2.1 配置图床域名

在项目根目录的 `.env` 中配置以下变量：

```
R2_IMAGE_BASE_URL=https://your-domain.com
R2_IMAGE_DIR=gallery
```

#### 2.2 配置 R2 访问凭证

在项目根目录创建 `.env` 文件（注意：不要提交到 Git）：

**方法一：从模板文件复制（推荐）**
```bash
cp .env_template .env
```

**方法二：手动创建**
```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=my-gallery
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_REGION=auto
R2_IMAGE_BASE_URL=https://your-domain.com
R2_IMAGE_DIR=gallery
IMAGE_COMPRESSION_QUALITY=100

### 3. 生成预览图

安装依赖并生成 WebP 格式的预览图：

```bash
npm run r2:generate-previews
```

这将从 R2 下载原图，生成缩略图后上传回 R2 的 `0_preview` 目录。

### 4. 生成作品索引

从 R2 获取文件列表并生成索引：

```bash
npm run r2:generate-index
```

这将生成 `gallery-index.json` 文件，包含所有摄影作品的信息。

### （可选）5. 本地测试

启动本地服务器预览效果：

```bash
npm run serve
```

或使用其他静态服务器：

```bash
npx serve .
```

### 6. 部署到 Cloudflare Pages

#### 自动部署（推荐）

点击下方按钮一键部署：

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy%20to%20Cloudflare%20Pages-4285F4?style=for-the-badge&logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=https://dash.cloudflare.com/pages)

#### （可选）手动部署

1. 安装 Wrangler CLI：

   ```bash
   npm install -g wrangler
   ```

2. 登录 Cloudflare：

   ```bash
   wrangler login
   ```

3. 部署项目：
   ```bash
   wrangler pages deploy . --project-name your-project-name
   ```

#### 使用部署脚本

**Windows 用户：**
```bash
deploy.bat
```

**Linux/macOS 用户：**
```bash
chmod +x deploy.sh
./deploy.sh
```

### 7. 更新图片

当你有新的摄影作品时：

1. 将新图片上传到 R2 存储桶的对应分类目录
2. 运行预览图生成脚本：`node generate-webp-thumbnail-r2.js`
3. 运行索引生成脚本：`node generate-gallery-index-r2.js`
4. 提交更新的 `gallery-index.json` 文件到 Git
5. 重新部署网站

## 📝 配置说明

### 作品 URL 格式

摄影作品 URL 使用以下格式：

- **原图**: `https://your-domain.com/gallery/{分类}/{文件名}`
- **预览图**: `https://your-domain.com/gallery/0_preview/{分类}/{文件名}`

### 预览图缺失检测

系统具备智能预览图检测功能：

- 如果预览图加载失败，会自动尝试加载原图
- 确保即使预览图缺失，用户仍能正常浏览作品
- 提供友好的错误提示和降级处理

### 修改作品源

编辑 `generate-gallery-index-r2.js` 文件中的 R2 配置，或直接修改 `.env` 文件：

```javascript
// 配置 R2 存储桶信息
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'my-gallery';
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_REGION = process.env.R2_REGION || 'auto';
const R2_IMAGE_BASE_URL = process.env.R2_IMAGE_BASE_URL;
const R2_IMAGE_DIR = process.env.R2_IMAGE_DIR || 'gallery';
const IMAGE_COMPRESSION_QUALITY = process.env.IMAGE_COMPRESSION_QUALITY || 100;
```

### 自定义图床域名

编辑 `generate-gallery-index-r2.js` 文件中的 `buildImageUrls` 函数：

```javascript
function buildImageUrls(categoryName, fileName, fileExt) {
  // 使用自定义域名
  const originalUrl = `https://cdn.yourdomain.com/gallery/${categoryName}/${fileName}.${fileExt}`;
  const previewUrl = `https://cdn.yourdomain.com/gallery/0_preview/${categoryName}/${fileName}.webp`;
  
  // 或使用 R2 默认域名
  // const originalUrl = `https://your-bucket.your-subdomain.r2.cloudflarestorage.com/gallery/${categoryName}/${fileName}.${fileExt}`;
  // const previewUrl = `https://your-bucket.your-subdomain.r2.cloudflarestorage.com/gallery/0_preview/${categoryName}/${fileName}.webp`;
  
  return { originalUrl, previewUrl };
}

## 🛠️ 开发

### 项目依赖

```json
{
  "devDependencies": {
    "serve": "^14.2.1"
  }
}
```

### 可用脚本

#### 部署脚本（Cloudflare Pages 会自动执行）

- `npm run build` - 构建脚本（静态网站无需构建）

#### 本地开发脚本（仅在本地执行）

- `npm run serve` - 启动本地服务器
- `npm run local:generate-index` - 生成作品索引
- `npm run local:generate-previews` - 生成预览图

### 模块化架构

项目采用模块化设计，主要模块包括：

- **DataLoader** - 负责从 JSON 文件加载摄影作品数据
- **TagFilter** - 处理作品分类筛选功能
- **ImageLoader** - 管理作品加载和布局
- **AutoScroll** - 自动滚动功能
- **Gallery** - 主画廊控制器

## 🎲 随机展示功能

项目支持图片随机展示，提供更好的浏览体验：

### 功能特点

- **完全随机** - 每次刷新页面或切换分类时，图片都会重新随机排列
- **分类内随机** - 单个分类内的图片也会随机展示
- **全局随机** - "全部"标签下的图片会从所有分类中随机混合展示

### 技术实现

- 使用 JavaScript 的 `sort()` 方法配合 `Math.random()` 实现随机排序
- 每次调用数据加载方法时都会重新随机排序
- 保持原有的去重逻辑，避免重复图片出现

## 🎨 自定义样式

### 主题颜色

在 `public/styles.css` 中修改 CSS 变量：

```css
:root {
  --primary-color: #4caf50; /* 主色调 */
  --background-color: #ffffff; /* 背景色 */
  --text-color: #333333; /* 文字颜色 */
}
```

### 画廊布局

在 `public/gallery.css` 中调整：

```css
.gallery {
  gap: 0.8em; /* 作品间距 */
  width: 80%; /* 画廊宽度 */
  max-width: 1200px; /* 最大宽度 */
}
```

## 📱 响应式设计

网站支持以下断点：

- **移动端** (< 600px): 2 列布局
- **平板** (600px - 900px): 3 列布局
- **桌面** (900px - 1200px): 4 列布局
- **大屏** (1200px - 1500px): 5 列布局
- **超大屏** (> 1500px): 6 列布局

## 🔧 故障排除

### 常见问题

1. **作品不显示**

   - 检查 `gallery-index.json` 文件是否存在
   - 确认作品 URL 是否正确
   - 检查网络连接
   - 确认本地目录与远程图床已同步

2. **预览图生成失败**

   - 确认已安装 ImageMagick
   - 检查源作品路径是否正确
   - 确认有足够的磁盘空间

3. **部署失败**

   - 确认已安装并登录 Wrangler
   - 检查项目名称是否可用
   - 确认文件权限正确

4. **图片无法加载**
   - 检查图床域名配置是否正确
   - 确认图片文件已上传到图床
   - 检查图床服务的访问权限设置

### 调试模式

在浏览器控制台中查看详细日志：

```javascript
// 查看加载的作品数据
console.log(window.gallery.dataLoader.galleryData);

// 查看当前选中的分类
console.log(window.gallery.tagFilter.getCurrentTag());
```

## 📄 许可证

ISC License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请提交 GitHub Issue.

---

**Enjoy your own Gallery!** 🎉
