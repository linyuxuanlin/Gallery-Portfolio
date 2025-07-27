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
- 📸 **EXIF信息** - 自动从R2提取并显示光圈、快门、ISO等摄影参数
- ☁️ **R2自动部署** - 从Cloudflare R2自动获取文件列表并生成索引
- 🔧 **环境变量配置** - 支持灵活的环境变量配置
- 🌍 **跨平台支持** - 提供Windows、Linux和MacOS部署脚本

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
├── generate-gallery-index-r2.js # R2图片索引生成脚本
├── r2-config.js              # R2配置文件
├── deploy.bat                # Windows部署脚本
├── deploy.sh                 # Linux/macOS部署脚本
├── _headers                  # Cloudflare Pages 配置
├── package.json              # 项目配置
└── env.example               # 环境变量示例文件
```

## 🚀 快速开始

### 1. 配置环境变量

复制 `env.example` 为 `.env` 并填入您的配置：

```bash
# Cloudflare 账户 ID
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# R2 访问密钥
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here

# R2 存储桶配置
R2_BUCKET_NAME=your_bucket_name_here
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_REGION=APAC

# 图片URL配置
R2_IMAGE_BASE_URL=https://your-domain.com
R2_IMAGE_DIR=gallery
```

### 2. 准备 R2 存储桶

将您的摄影作品上传到 R2 存储桶，按以下结构组织：

```
your-bucket-name/
└── gallery/
    ├── Hongkong/
    │   ├── DSC01475.JPG
    │   └── DSC01476.JPG
    ├── Kyoto/
    │   ├── DSC02580.JPG
    │   └── DSC02581.JPG
    └── 0_preview/          # 预览图目录
        ├── Hongkong/
        └── Kyoto/
```

### 3. 自动部署

#### Windows 用户
```cmd
deploy.bat
```

#### Linux/macOS 用户
```bash
./deploy.sh
```

**注意**: 
- 部署时生成的 `gallery-index.json` 文件不会推送回仓库，这是正常行为
- 每次部署都会从R2重新生成最新的索引文件
- Cloudflare Pages会自动运行构建命令生成索引文件

### 4. Cloudflare Pages 环境变量设置

如果您使用Cloudflare Pages控制台部署，需要在Pages项目中设置环境变量：

1. 进入Cloudflare Pages控制台
2. 选择您的项目 "gallery-portfolio-static"
3. 进入 "Settings" → "Environment variables"
4. 添加所有必需的环境变量（详见 `CLOUDFLARE_PAGES_SETUP.md`）

**重要**: 如果环境变量未设置，构建会失败且不会生成 `gallery-index.json` 文件。

## 📝 配置说明

### 环境变量配置

所有配置都通过环境变量进行，主要配置项包括：

- **CLOUDFLARE_ACCOUNT_ID**: Cloudflare账户ID
- **R2_ACCESS_KEY_ID**: R2访问密钥ID  
- **R2_SECRET_ACCESS_KEY**: R2访问密钥
- **R2_BUCKET_NAME**: R2存储桶名称
- **R2_IMAGE_BASE_URL**: 图片基础URL
- **R2_IMAGE_DIR**: 图片目录名（默认为gallery）

### 作品URL格式

摄影作品URL使用以下格式：

- **原图**: `{R2_IMAGE_BASE_URL}/{R2_IMAGE_DIR}/{分类}/{文件名}`
- **预览图**: `{R2_IMAGE_BASE_URL}/{R2_IMAGE_DIR}/0_preview/{分类}/{文件名}`

### 预览图缺失检测

系统具备智能预览图检测功能：
- 如果预览图加载失败，会自动尝试加载原图
- 确保即使预览图缺失，用户仍能正常浏览作品
- 提供友好的错误提示和降级处理

### EXIF信息提取

系统会自动从R2下载图片并提取EXIF信息，包括：
- 光圈、快门速度、ISO
- 焦距、相机型号、镜头信息
- GPS坐标、拍摄时间

## 🛠️ 开发

### 项目依赖

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "node-exiftool": "^2.3.0"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
```

### 可用脚本

- `npm run generate-index` - 从R2生成作品索引
- `npm run deploy` - 自动生成索引并部署

### 模块化架构

项目采用模块化设计，主要模块包括：

- **DataLoader** - 负责从JSON文件加载摄影作品数据
- **TagFilter** - 处理作品分类筛选功能
- **ImageLoader** - 管理作品加载和布局
- **AutoScroll** - 自动滚动功能
- **Gallery** - 主画廊控制器

## 🎨 自定义样式

### 主题颜色

在 `public/styles.css` 中修改CSS变量：

```css
:root {
  --primary-color: #4CAF50;    /* 主色调 */
  --background-color: #ffffff;  /* 背景色 */
  --text-color: #333333;       /* 文字颜色 */
}
```

### 画廊布局

在 `public/gallery.css` 中调整：

```css
.gallery {
  gap: 0.8em;           /* 作品间距 */
  width: 80%;           /* 画廊宽度 */
  max-width: 1200px;    /* 最大宽度 */
}
```

## 📱 响应式设计

网站支持以下断点：

- **移动端** (< 600px): 2列布局
- **平板** (600px - 900px): 3列布局
- **桌面** (900px - 1200px): 4列布局
- **大屏** (1200px - 1500px): 5列布局
- **超大屏** (> 1500px): 6列布局

## 🔧 故障排除

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

5. **EXIF信息获取失败**
   ```
   EXIF获取失败
   ```
   解决：检查图片文件是否包含EXIF信息，或检查网络连接

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
