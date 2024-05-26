<h1 align="center">
<img width="27" src="./public/favicon.svg">
Gallery-Portfolio
</h1>

<p align="center">
  <a href="https://gallery-portfolio.wiki-power.com/"><img src="https://img.shields.io/badge/Demo-site-t?&style=flat-square" alt="Demo"></a>
  <a href="https://github.com/linyuxuanlin/Gallery-Portfolio/blob/main/LICENSE"><img src="https://img.shields.io/github/license/linyuxuanlin/Gallery-Portfolio?style=flat-square" alt="许可证"></a>
  <img src="https://img.shields.io/github/repo-size/linyuxuanlin/Gallery-Portfolio?style=flat-square&color=328657" alt="存储库大小">
</p>

<p align="center">
    <a href="https://gallery-portfolio.wiki-power.com/">
        <img src="https://github.com/linyuxuanlin/Gallery-Portfolio/assets/13746617/386088ef-3317-4624-9e63-593f3660c2f2" width="550" />
    </a>
</p>

**Gallery-Portfolio** 是一个简单的 **摄影作品展示站**，你只需要将图片存放在免费的 **Cloudflare R2** 上（或其他支持 **AWS S3** 的对象存储），即可在这里展现你的精选图片。在这里你可以通过 **瀑布流** 的形式浏览图片，也可以 **点开大图** ，查看光圈 / 快门 / ISO 等 **EXIF** 信息。网站基于 Node.js，使用 **Material Design** 风格的 **响应式设计**，支持 **日夜间模式** 切换，在不同的设备上都有不错的视觉效果。

<a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%linyuxuanlin%2FGallery-Portfolio&env=R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_BUCKET_NAME,R2_ENDPOINT,IMAGE_BASE_URL"><img src="https://vercel.com/button" alt="Deploy with Vercel"/></a>

## 功能特性

- 瀑布流布局展示照片
- 支持 Cloudflare R2 或其他兼容 AWS S3 存储
- 响应式设计，根据屏幕宽度自适应列数
- 图片自动生成缩略图并缓存，减少预览页加载时间
- 图片懒加载，每次加载固定数量的图片，划到底自动加载下一页
- 点击图片查看原图，以及光圈 / 快门 / ISO 等 EXIF 信息
- 支持日夜间模式切换
- 支持 [本地运行](#本地运行) ，也支持 [部署到 Vercel](#部署到-vercel)

## 本地运行

1. 克隆仓库：

```sh
git clone https://github.com/linyuxuanlin/Gallery-Portfolio.git
cd Gallery-Portfolio
```

2. 确保你已经安装了 Node.js，然后安装依赖：

```sh
npm install
```

3. 创建 `.env` 文件

在项目根目录下,，将 `.env_template` 文件改名为 `.env`，并根据你的实际配置修改环境变量：

```dotenv
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT=https://your-endpoint.r2.cloudflarestorage.com
R2_REGION=auto
IMAGE_BASE_URL=https://your-image-base-url.com
```

4. 运行本地服务器：

```sh
node server.js
```

服务器启动后，打开浏览器访问 http://localhost:3000 即可访问网站。

## 部署到 Vercel

1. 首先，在 GitHub 上 [fork 此仓库](https://github.com/linyuxuanlin/Gallery-Portfolio/fork) 。

2. 在 Vercel 上新建项目，选择已经 fork 的 GitHub 仓库进行部署。

3. 在 Vercel 项目的设置中，添加以下环境变量：

   - R2_ACCESS_KEY_ID
   - R2_SECRET_ACCESS_KEY
   - R2_BUCKET_NAME
   - R2_ENDPOINT
   - R2_REGION
   - IMAGE_BASE_URL

   环境变量的模板可以参考 [环境变量](#环境变量) 。

4. 完成上述步骤后，Vercel 将自动进行部署。  
   部署完成后，即可通过 Vercel 提供的域名访问网站，也可以绑定你自己的域名。

## 代码解释

本项目的目录结构如下：

```
Gallery-Portfolio/
├── server.js
├── public/
│ ├── favicon.svg
│ ├── index.html
│ ├── styles.css
│ ├── gallery.css
│ ├── layout.js
│ ├── gallery.js
│ ├── exif.js
├── .env
├── vercel.json
├── package.json
```

### server.js

server.js 是项目的后端服务器代码，负责处理图片的获取、缩略图生成以及 EXIF 信息的读取。

- 依赖库：
  - express：用于搭建 Web 服务器
  - @aws-sdk/client-s3：用于与 Cloudflare R2 进行交互
  - sharp：用于生成图片缩略图
  - exif-parser：用于解析图片的 EXIF 信息
  - dotenv：用于加载环境变量

### public/ 目录

public/ 目录包含前端代码，包括 HTML、CSS 和 JavaScript 文件。

- index.html：网页的主要结构，包含标题、加载按钮、相册展示区以及模态窗口等页面结构，以及引用的 CSS、JS 文件。
- styles.css：全局样式文件，定义了页面的基本样式。
- gallery.css：瀑布流布局样式文件，定义了图片展示和动画效果。
- layout.js、gallery.js、exif.js：前端 JavaScript 文件，分别处理页面布局、图片加载及 EXIF 信息的展示逻辑。

### 环境变量

项目使用 `.env` 文件或 Vercel 环境变量来配置 Cloudflare R2 相关信息：

- R2_ACCESS_KEY_ID：对象存储的访问密钥 ID
- R2_SECRET_ACCESS_KEY：对象存储的访问密钥
- R2_BUCKET_NAME：存储桶名称
- R2_ENDPOINT：Cloudflare R2 端点，格式例如 `https://your-endpoint.r2.cloudflarestorage.com`
- R2_REGION：区域，默认为 auto
- IMAGE_BASE_URL：图片公开访问的 URL，格式例如 `https://media.wiki-power.com`

### vercel.json

vercel.json 文件是供 Vercel 部署的配置文件，在其中配置了路由和具体的构建设置。

## 注意事项

- 确保 `.env` 文件中包含所有必需的环境变量。如部署至 Vercel，请确保这些变量在 Vercel 项目的设置中也已正确配置。
- 如果遇到图片无法加载：请检查 `.env` 文件中的环境变量是否配置正确，并确保 S3 存储桶和图片路径正确。
- EXIF 信息加载错误：请确保 S3 图片中包含 EXIF 数据。

## 贡献

欢迎贡献代码！您可以通过 fork 项目并提交 pull request 的方式来贡献代码。在提交之前，请确保所有更改都经过了充分的测试。

## 许可

本项目基于 MIT 许可证开源。

## 参考与致谢

本项目灵感来源是 [**besscroft/PicImpact**](https://github.com/besscroft/PicImpact)，这是一个完成度更高的项目，需要准备一个数据库，支持 AWS S3 API、Cloudflare R2、AList API，也支持在线上传图片。网站设计的风格稍有不同，你也可以去尝试一下~

## 结束语

通过上述步骤，你可以轻松地在本地开发或部署到 Vercel，享受简单优质的照片展示体验。  
如果你遇到任何问题，请随时在 GitHub 上提交 issue，我会尽快回复并解决你的问题。

---

## TODO

- [ ] 优化项目 README，加入套壳图等。写详细的说明文档
- [x] 正常显示 Cloudflare R2 bucket 某个路径下的所有图片
- [x] 点击图片展示大图
- [x] 日夜间模式切换按钮
- [x] 大图显示对应的 exif 信息
- [x] 每页底部有点击加载的按钮，加载下一页的图片，并保留显示之前的所有图片
- [x] 在底栏增加版权信息和外链
- [x] 页面标题栏美化，改名并加顶栏，以便后续放标签等信息
- [x] 每页最少显示 2 列图片，并随着页面宽度的增加，逐步增加显示的列数，最多显示 6 列图片，在页面宽度增加的时候保持列宽不变；如果显示到 6 列之后屏幕宽度仍然继续增加，则在页面左右两侧增加空白。
- [x] 根据显示列数动态调整每页加载的图片数量
- [x] 创建缩略图以供预览加载
- [ ] 加入标签系统，使用标签筛选图片
- [x] 压缩图片的过程中保留原图的 metadata 信息，使图片的旋转方向正常
- [x] 在 R2 目录下所有图片都加载完成后，把“加载更多”按钮的文字替换为“已全部加载”，并变成灰色不可点的状态
- [ ] 在顶栏 GitHub 按钮左侧，加入一个按钮，可以切换页面滚动到底部自动点击“加载更多”按钮或不自动点击。
- [ ] 在代码上优化，加快 exif 信息的加载速度。比如让图片和 EXIF 信息并行加载；仅加载需要显示的 exif 信息
- [ ] 加入 i18n
