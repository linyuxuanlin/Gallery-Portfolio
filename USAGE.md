# Gallery Portfolio 使用说明

## 📋 使用步骤

### 第一步：准备图片目录

1. 在您的电脑上创建一个图片目录，例如：`C:\Users\Power\Wiki-media\gallery`
2. 在该目录下创建子文件夹来分类您的图片，例如：
   ```
   C:\Users\Power\Wiki-media\gallery\
   ├── Hongkong\
   │   ├── DSC01475.JPG
   │   └── DSC01476.JPG
   ├── Kyoto\
   │   ├── DSC02580.JPG
   │   └── DSC02581.JPG
   └── Tokyo\
       ├── DSC03000.JPG
       └── DSC03001.JPG
   ```

### 第二步：安装必要工具

1. **安装 ImageMagick**（用于生成预览图）
   - 访问：https://imagemagick.org/script/download.php#windows
   - 下载并安装 Windows 版本
   - 确保安装后可以在命令行中使用 `magick` 命令

2. **安装 Node.js**（用于本地测试）
   - 访问：https://nodejs.org/
   - 下载并安装 LTS 版本

### 第三步：生成预览图

1. 双击运行 `generate-previews.bat`
2. 脚本会自动：
   - 扫描您的图片目录
   - 为每张图片生成压缩的预览图
   - 将预览图保存到 `0_preview` 目录下

### 第四步：生成图片索引

1. 双击运行 `generate-gallery-index.bat`
2. 脚本会：
   - 扫描所有图片文件
   - 生成 `gallery-index.json` 文件
   - 包含所有图片的URL信息

### 第五步：本地测试

1. 打开命令行，进入项目目录
2. 运行：`npm run serve`
3. 在浏览器中访问：`http://localhost:3000`

### 第六步：部署到 Cloudflare Pages

#### 方法一：使用部署脚本
1. 安装 Wrangler CLI：`npm install -g wrangler`
2. 登录 Cloudflare：`wrangler login`
3. 双击运行 `deploy.bat`

#### 方法二：手动部署
1. 在 Cloudflare Dashboard 中创建新的 Pages 项目
2. 连接您的 GitHub 仓库
3. 设置构建命令：`echo "静态网站，无需构建"`
4. 设置输出目录：`/`
5. 点击部署

## 🔧 自定义配置

### 修改图片源路径

编辑 `generate-gallery-index.bat` 文件中的这一行：
```batch
set "SOURCE_DIR=C:\Users\Power\Wiki-media\gallery"
```

### 修改图床域名

编辑 `generate-gallery-index.bat` 文件中的这两行：
```batch
set "original_url=https://your-domain.com/gallery/!category_name!/!file_name!!file_ext!"
set "preview_url=https://your-domain.com/gallery/0_preview/!category_name!/!file_name!!file_ext!"
```

### 修改预览图质量

编辑 `generate-previews.bat` 文件中的这一行：
```batch
magick "!source_file!" -resize 800x800^ -quality 85 "!preview_file!"
```
- `800x800^`：最大尺寸（像素）
- `85`：压缩质量（0-100）

## 📁 文件说明

### 核心文件
- `index.html` - 主页面
- `gallery-index.json` - 图片索引（自动生成）
- `public/` - 静态资源目录

### 脚本文件
- `generate-gallery-index.bat` - 生成图片索引
- `generate-previews.bat` - 生成预览图
- `deploy.bat` - 部署脚本

### 配置文件
- `_headers` - Cloudflare Pages 缓存配置
- `package.json` - 项目配置

## 🎨 自定义样式

### 修改主题颜色

编辑 `public/styles.css` 文件：
```css
:root {
  --primary-color: #4CAF50;    /* 主色调 */
  --background-color: #ffffff;  /* 背景色 */
  --text-color: #333333;       /* 文字颜色 */
}
```

### 修改画廊布局

编辑 `public/gallery.css` 文件：
```css
.gallery {
  gap: 0.8em;           /* 图片间距 */
  width: 80%;           /* 画廊宽度 */
  max-width: 1200px;    /* 最大宽度 */
}
```

## 🔍 故障排除

### 常见问题

1. **预览图生成失败**
   - 确认已安装 ImageMagick
   - 检查源图片路径是否正确
   - 确认图片格式支持（JPG、PNG、GIF、BMP、WebP）

2. **图片索引生成失败**
   - 检查源目录路径是否正确
   - 确认目录中有图片文件
   - 检查文件权限

3. **本地测试失败**
   - 确认已安装 Node.js
   - 运行 `npm install` 安装依赖
   - 检查端口是否被占用

4. **部署失败**
   - 确认已安装并登录 Wrangler
   - 检查项目名称是否可用
   - 确认 `gallery-index.json` 文件存在

### 调试技巧

1. **查看控制台日志**
   - 按 F12 打开开发者工具
   - 查看 Console 标签页的错误信息

2. **检查网络请求**
   - 在开发者工具的 Network 标签页
   - 查看图片加载是否成功

3. **验证JSON文件**
   - 用文本编辑器打开 `gallery-index.json`
   - 确认JSON格式正确

## 📞 获取帮助

如果遇到问题，请：

1. 检查本文档的故障排除部分
2. 查看浏览器控制台的错误信息
3. 提交 GitHub Issue 描述问题
4. 联系项目维护者

---

**祝您使用愉快！** 🎉 