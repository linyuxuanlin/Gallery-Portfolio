# Cloudflare Pages 设置指南

## 环境变量配置

在Cloudflare Pages控制台中，您需要设置以下环境变量：

### 必需环境变量
- `CLOUDFLARE_ACCOUNT_ID` - 您的Cloudflare账户ID
- `R2_ACCESS_KEY_ID` - R2访问密钥ID
- `R2_SECRET_ACCESS_KEY` - R2访问密钥
- `R2_BUCKET_NAME` - R2存储桶名称

### 可选环境变量
- `R2_ENDPOINT` - R2端点URL
- `R2_REGION` - R2区域（默认为auto）
- `R2_IMAGE_BASE_URL` - 图片基础URL
- `R2_IMAGE_DIR` - 图片目录（默认为gallery）

## 设置步骤

1. **登录Cloudflare控制台**
   - 访问 https://dash.cloudflare.com/
   - 登录您的账户

2. **进入Pages项目**
   - 在左侧菜单选择 "Pages"
   - 找到您的项目 "gallery-portfolio-static"

3. **设置环境变量**
   - 点击项目进入详情页
   - 选择 "Settings" 标签
   - 在左侧菜单选择 "Environment variables"
   - 点击 "Add variable" 添加每个环境变量

4. **重新部署**
   - 设置完环境变量后，重新部署项目
   - 在 "Deployments" 标签中点击 "Retry deployment"

## 构建配置

项目已配置 `wrangler.toml` 文件，Cloudflare Pages会自动：

1. 运行 `npm install` 安装依赖
2. 运行 `npm run generate-index` 生成索引文件
3. 部署所有文件到CDN

**注意**: 如果构建失败，请在Cloudflare Pages控制台中设置Node.js版本为18或更高版本。

## 故障排除

### 构建失败
- 检查所有必需的环境变量是否已设置
- 确认R2访问密钥是否正确
- 检查R2存储桶是否存在且有访问权限

### 索引文件未生成
- 检查构建日志中的错误信息
- 确认R2存储桶中有图片文件
- 验证图片目录结构是否正确

### 环境变量问题
- 确保环境变量名称完全正确（区分大小写）
- 检查环境变量值是否包含多余的空格
- 确认环境变量已应用到正确的环境（Production/Preview）

## 构建日志查看

在Cloudflare Pages控制台中：
1. 进入项目详情页
2. 选择 "Deployments" 标签
3. 点击最新的部署
4. 查看构建日志，寻找错误信息

构建日志会显示：
- 环境变量检查结果
- R2连接状态
- 文件列表获取情况
- EXIF信息提取进度
- 索引文件生成结果 