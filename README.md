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
- 📸 **EXIF信息** - 显示光圈、快门、ISO等摄影参数
- 🌍 **跨平台支持** - 提供Windows、Linux和MacOS脚本

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
├── generate-gallery-index.bat # Windows图片索引生成脚本
├── generate-gallery-index.sh  # Linux/macOS图片索引生成脚本
├── generate-previews.bat      # Windows预览图生成脚本
├── generate-previews.sh       # Linux/macOS预览图生成脚本
├── deploy.bat                # Windows部署脚本
├── deploy.sh                 # Linux/macOS部署脚本
├── _headers                  # Cloudflare Pages 配置
└── package.json              # 项目配置
```

## 🚀 快速开始

### 1. 准备摄影作品目录

将您的摄影作品按以下结构组织：

```
C:\Users\Power\Wiki-media\gallery\
├── Hongkong\
│   ├── DSC01475.JPG
│   └── DSC01476.JPG
├── Kyoto\
│   ├── DSC02580.JPG
│   └── DSC02581.JPG
└── 0_preview\              # 预览图目录（自动生成）
    ├── Hongkong\
    └── Kyoto\
```

### 2. 生成预览图

#### Windows 用户
```bash
generate-previews.bat
```

#### Linux/macOS 用户
```bash
chmod +x generate-previews.sh
./generate-previews.sh
```

**注意：** 需要先安装 [ImageMagick](https://imagemagick.org/script/download.php#windows)

### 3. 生成作品索引

#### Windows 用户
```bash
generate-gallery-index.bat
```

#### Linux/macOS 用户
```bash
chmod +x generate-gallery-index.sh
./generate-gallery-index.sh
```

这将生成 `gallery-index.json` 文件，包含所有摄影作品的信息。

### 4. 本地测试

使用本地服务器运行：

```bash
npm run serve
```

或使用其他静态服务器：

```bash
npx serve .
```

### 5. 部署到 Cloudflare Pages

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

### 作品URL格式

摄影作品URL使用以下格式：

- **原图**: `https://media.wiki-power.com/gallery/{分类}/{文件名}`
- **预览图**: `https://media.wiki-power.com/gallery/0_preview/{分类}/{文件名}`

### 预览图缺失检测

系统具备智能预览图检测功能：
- 如果预览图加载失败，会自动尝试加载原图
- 确保即使预览图缺失，用户仍能正常浏览作品
- 提供友好的错误提示和降级处理

### 修改作品源

#### Windows 用户
编辑 `generate-gallery-index.bat` 文件中的以下变量：

```batch
set "SOURCE_DIR=C:\Users\Power\Wiki-media\gallery"
```

#### Linux/macOS 用户
编辑 `generate-gallery-index.sh` 文件中的以下变量：

```bash
SOURCE_DIR="/home/user/Wiki-media/gallery"
```

### 自定义图床域名

修改脚本中的域名部分：

#### Windows 用户
```batch
set "original_url=https://your-domain.com/gallery/!category_name!/!file_name!!file_ext!"
set "preview_url=https://your-domain.com/gallery/0_preview/!category_name!/!file_name!!file_ext!"
```

#### Linux/macOS 用户
```bash
original_url="https://your-domain.com/gallery/$category_name/$file_name.$file_ext"
preview_url="https://your-domain.com/gallery/0_preview/$category_name/$file_name.$file_ext"
```

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

- `npm run serve` - 启动本地服务器
- `npm run generate-index` - 生成作品索引
- `npm run generate-previews` - 生成预览图

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

1. **作品不显示**
   - 检查 `gallery-index.json` 文件是否存在
   - 确认作品URL是否正确
   - 检查网络连接

2. **预览图生成失败**
   - 确认已安装 ImageMagick
   - 检查源作品路径是否正确
   - 确认有足够的磁盘空间

3. **部署失败**
   - 确认已安装并登录 Wrangler
   - 检查项目名称是否可用
   - 确认文件权限正确

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
