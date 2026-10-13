# 照片点击兼容性与 HDR 核查 · 2026-10-13

## 点击照片直接下载

作者收到其他访客报告，普通点击照片却直接下载。尚未获得对方的设备、浏览器及具体操作，不能断言已识别该次访问的唯一原因。复查确认旧代码存在可触发同类结果的路径：

- 直接调用 `MediaQueryList.addEventListener`、`ResizeObserver` 或字体接口，缺少接口时会在绑定照片点击之前停止初始化。
- 不支持原生 `dialog.showModal` 的浏览器直接退出查看器初始化。
- 照片的 HTML 链接指向 R2 原图。抽查的原图响应为 `application/octet-stream`，点击未被脚本接管时，部分浏览器会下载文件。
- Cloudflare Rocket Loader 可延后脚本执行，增加图片已显示、交互尚未就绪的时间窗口。

修正后，照片 HTML 链接指向本站具有 `image/webp` 响应类型的大图预览，原图单独存于 `data-original`。普通点击正常进入查看器，原图只在访客主动加载时请求。脚本被拦截、禁用或尚未就绪时，照片也可以作为图片打开，不导航到通用文件类型的原图。

支持旧式媒体查询监听；字体、尺寸观察接口缺少时不会阻断初始化。没有原生弹窗时使用同样的全屏查看器，保留关闭、键盘、前后翻页、焦点管理及原图加载。对底层原图响应为通用文件类型的情况也在浏览器回归中验证，原图作为图像资源仍能解码。

查看器脚本按 Cloudflare 的官方机制设置 `data-cfasync="false"`，保留 `defer`，避免 Rocket Loader 重排这段交互脚本；未改动整站 Cloudflare 设置。[Cloudflare 文档](https://developers.cloudflare.com/speed/optimization/content/rocket-loader/ignore-javascripts/)

回归新增两组真实浏览器场景：同时移除原生弹窗、ResizeObserver、字体及新版媒体查询监听后仍可浏览大图；拦截查看器脚本后照片打开为图片。此前页面、双语、缩放、历史、分享、失败重试及无 JavaScript 检查继续保留。对方具体设备仍需补充后才能确认同一环境。

## 实际 HDR 结果

核查的是已发布图库的全部 429 个 JPEG 源文件的完整主图头、ICC 色彩配置与多图容器类型；127 个来源版本匹配的本地完整原文件另用 ExifTool 核查，其余302个通过原图字节范围读取并核对修改时间。未将元数据检查称作逐幅鉴定429张完整原图的视觉质量。

| 项目 | 结果 |
| --- | --- |
| JPEG 主图 | 429 张，均8 bit／通道 |
| 可用于 HDR 显示的 Adobe／ISO／Apple 增益图信息或 HDR 传递信息 | 未发现 |
| 多图容器辅助图 | 226 个，均标为 Full HD 大缩略图；没有增益图或未分类辅助图 |
| 内嵌 Display P3 色彩配置 | 45 张，属于广色域 |
| 当前发布的 WebP 预览 | 572 个，均为8 bit sRGB，无内嵌色彩配置；包括保留的旧预览版本 |

结论：当前这批发布文件没有发现可供网页使用的真实 HDR 显示数据。Display P3 是广色域，不能作为 HDR 增益图；相机的 HDR 拍摄设置、合并曝光或照片看起来反差较大，也不等于文件保存了可用于 HDR 屏幕的显示信息。8 bit JPEG 可以通过附加增益图成为 HDR，不能只凭位深判断；本次同时检查了增益图及辅助图结构。

网页当前展示的是 SDR WebP。主动加载原图保留源文件的原始 JPEG 与 ICC，45 张 P3 原图的广色域信息仍在；普通 WebP 生成流程转换到 sRGB。此次不改变作品内容、色调、原图及 R2 对象。

若作者希望提供真正的 HDR 版本，应从支持 HDR 编辑的原始素材导出带有效增益图的 JPEG，建议同时包含 Ultra HDR 与 ISO 21496-1 信息。支持的屏幕与浏览器使用增益图，不支持的环境显示同一文件内的 SDR 主图；Safari 从26加入网页 HDR 图像支持，但仍需设备、系统与有效图片数据配合。[Android 格式规范](https://developer.android.com/media/platform/hdr-image-format)，[Apple 发布说明](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes)

后续接收 HDR 导出后，应分别保存完整增益图、ICC 及 SDR 兼容版本，重新验证缩放处理不会丢失 HDR 数据。仅将现有 WebP 加亮或复制 XMP 不会恢复真实增益图。

逐文件来源与元数据底稿保存于本地 `.curation/hdr-compat-2026-10-13/`，不随网站发布。
