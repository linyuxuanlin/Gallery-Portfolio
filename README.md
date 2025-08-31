<h1 align="center">
<img width="27" src="./public/assets/favicon.svg">
Gallery-Portfolio 
</h1>

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

**Gallery-Portfolio** 是一个简单的 **摄影作品展示站**，你只需要将图片存放在免费的 **Cloudflare R2** 上（或其他任意图床），即可在这里展现你的大作。在这里你可以通过 **瀑布流** 的形式浏览图片，也可以 **点开大图** ，查看光圈 / 快门 / ISO 等 **EXIF** 信息。网站基于 Node.js，使用 **Material Design** 风格的 **响应式设计**，支持 **日夜间模式** 切换，在不同的设备上都有不错的视觉效果。

<p align="center">
  <a href="https://dash.cloudflare.com/?to=https://dash.cloudflare.com/pages"><img src="https://img.shields.io/badge/Deploy%20to%20Cloudflare%20Pages-4285F4?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Deploy to Cloudflare Pages"/></a>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flinyuxuanlin%2FGallery-Portfolio"><img src="https://img.shields.io/badge/Deploy%20to%20Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Deploy to Vercel"/></a>
</p>

## ✨ 特性

- 🖼️ **响应式摄影画廊** - 自适应布局，支持多种屏幕尺寸
- 🏷️ **作品分类** - 按摄影主题和地点进行分类展示
- 🌙 **深色/浅色主题** - 支持主题切换，优化观片体验
- ⚡ **懒加载** - 滚动时自动加载更多作品
- 🎯 **自动滚动** - 一键开启自动滚动浏览
- 📱 **移动端优化** - 完美适配移动设备观片
- 🚀 **静态部署** - 零服务器成本，快速加载
- 🖼️ **预览图优化** - 先加载预览图，点击查看高清原图
- 🔄 **智能加载** - 预览图缺失时自动加载原图
- 📸 **EXIF 信息** - 显示光圈、快门、ISO 等摄影参数
- 🌍 **跨平台支持** - 提供 Node.js 脚本，支持所有操作系统
- 🔗 **图床兼容** - 支持任意图床服务（Cloudflare R2、阿里云 OSS、腾讯云 COS 等）
- 🎲 **随机展示** - 图片以随机顺序展示，每次刷新都有不同的排列

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
├── generate-gallery-index-local.js   # Node.js图片索引生成脚本
├── generate-webp-thumbnail-local.js      # 预览图生成脚本
├── deploy.bat                # Windows部署脚本
├── deploy.sh                 # Linux/macOS部署脚本
├── _headers                  # Cloudflare Pages 配置
└── package.json              # 项目配置
```

## 🚀 快速开始

### 1. 配置本地摄影作品目录

**重要说明：** 本项目的工作原理是读取本地目录生成远程图床的文件列表。你需要 **手动配置本地目录与远程图床的同步**。

#### 1.1 创建本地摄影作品目录

将你的图片按以下结构组织到本地目录：

```
本地目录路径/
├── Hongkong\              # 分类文件夹
│   ├── DSC01475.JPG
│   └── DSC01476.JPG
├── Kyoto\
│   ├── DSC02580.JPG
│   └── DSC02581.JPG
└── 0_preview\            # 预览图目录（自动生成）
    ├── Hongkong\
    └── Kyoto\
```

#### 1.2 配置本地目录路径

编辑 `generate-gallery-index-local.js` 文件中的 `SOURCE_DIR` 变量：

```javascript
const SOURCE_DIR = "/home/user/Wiki-media/gallery"; // 请修改为您的图片目录路径
```

#### 1.3 配置图床域名

编辑 `generate-gallery-index-local.js` 文件中的 `buildImageUrls` 函数：

```javascript
function buildImageUrls(categoryName, fileName, fileExt) {
  const originalUrl = `https://your-domain.com/gallery/${categoryName}/${fileName}.${fileExt}`;
  const previewUrl = `https://your-domain.com/gallery/0_preview/${categoryName}/${fileName}.webp`;
  return { originalUrl, previewUrl };
}
```

**注意：** 预览图统一使用 `.webp` 格式，无论原图是什么格式。

**支持的图床服务示例：**

- Cloudflare R2: `https://your-bucket.your-subdomain.r2.cloudflarestorage.com/gallery/`
- 阿里云 OSS: `https://your-bucket.oss-cn-region.aliyuncs.com/gallery/`
- 腾讯云 COS: `https://your-bucket.cos.region.myqcloud.com/gallery/`
- 七牛云: `https://your-domain.com/gallery/`

### 2. 同步本地目录到远程图床

**重要：** 你需要手动将本地目录中的图片文件同步到你的图床服务。

### 3. 生成预览图

```bash
npm install sharp
node generate-webp-thumbnail-local.js
```

### 3.1 安装 EXIF 工具（可选）

为了提取图片的 EXIF 信息（光圈、快门、ISO 等），建议安装 ExifTool：

#### Windows

1. 下载 ExifTool: https://exiftool.org/
2. 解压到任意目录
3. 将 exiftool.exe 添加到系统 PATH

#### macOS

```bash
brew install exiftool
```

#### Ubuntu/Debian

```bash
sudo apt-get install exiftool
```

#### CentOS/RHEL

```bash
sudo yum install exiftool
```

### 4. 生成作品索引

直接从 Cloudflare R2 获取列表，生成索引：

```bash
node generate-gallery-index-r2.js
```

（备用）本地生成索引：

```bash
# 使用 npm 脚本
npm run local:generate-index

# 或直接运行
node generate-gallery-index-local.js
```

这将生成 `gallery-index.json` 文件，包含所有摄影作品的信息。

### 5. 本地测试

使用本地服务器运行：

```bash
npm run serve
```

或使用其他静态服务器：

```bash
npx serve .
```

### 6. 部署到 Cloudflare Pages

**重要说明：** 以下脚本仅在本地执行，Cloudflare Pages 部署时不会执行这些脚本：

- `npm run local:generate-index` - 生成图片索引
- `npm run local:generate-previews` - 生成预览图

这些脚本需要在本地执行后，将生成的文件（如 `gallery-index.json`）提交到仓库中。

#### Windows 用户

```bash
deploy.bat
```

#### Linux/macOS 用户

```bash
chmod +x deploy.sh
./deploy.sh
```

#### 手动部署

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

编辑 `generate-gallery-index-local.js` 文件中的以下变量：

```javascript
const SOURCE_DIR = "/home/user/Wiki-media/gallery"; // 请修改为您的图片目录路径
```

### 自定义图床域名

编辑 `generate-gallery-index-local.js` 文件中的 `buildImageUrls` 函数：

```javascript
function buildImageUrls(categoryName, fileName, fileExt) {
  const originalUrl = `https://your-domain.com/gallery/${categoryName}/${fileName}.${fileExt}`;
  const previewUrl = `https://your-domain.com/gallery/0_preview/${categoryName}/${fileName}.webp`;
  return { originalUrl, previewUrl };
}
```

**注意：** 预览图统一使用 `.webp` 格式，无论原图是什么格式。

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
