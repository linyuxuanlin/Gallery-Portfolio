#!/bin/bash

# 部署脚本 (Linux/macOS版本)
# 使用Wrangler部署到Cloudflare Pages
# 自动从R2生成图片索引

echo "========================================"
echo "Gallery Portfolio 部署脚本"
echo "========================================"

# 检查Node.js
echo "检查Node.js..."
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js"
    echo "请安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js 已安装"
node --version

# 检查npm
echo "检查npm..."
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm"
    exit 1
fi

echo "✓ npm 已安装"

# 安装依赖
echo "安装依赖..."
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖包..."
    npm install
else
    echo "依赖包已存在，跳过安装"
fi

# 检查环境变量
echo "检查环境变量..."
required_vars=("CLOUDFLARE_ACCOUNT_ID" "R2_ACCESS_KEY_ID" "R2_SECRET_ACCESS_KEY" "R2_BUCKET_NAME")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    else
        echo "✓ $var: ${!var}"
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "错误: 缺少必要的环境变量:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo
    echo "请设置以下环境变量:"
    echo "CLOUDFLARE_ACCOUNT_ID: Cloudflare账户ID"
    echo "R2_ACCESS_KEY_ID: R2访问密钥ID"
    echo "R2_SECRET_ACCESS_KEY: R2访问密钥"
    echo "R2_BUCKET_NAME: R2存储桶名称"
    echo "R2_ENDPOINT: R2端点URL (可选)"
    echo "R2_REGION: R2区域 (可选，默认auto)"
    echo "R2_IMAGE_BASE_URL: 图片基础URL (可选)"
    echo "R2_IMAGE_DIR: 图片目录 (可选，默认gallery)"
    exit 1
fi

echo "✓ 环境变量检查通过"

# 显示配置信息
echo "当前配置信息:"
echo "  - R2存储桶: ${R2_BUCKET_NAME}"
echo "  - R2端点: ${R2_ENDPOINT:-未设置}"
echo "  - R2区域: ${R2_REGION:-auto}"
echo "  - 图片基础URL: ${R2_IMAGE_BASE_URL:-未设置}"
echo "  - 图片目录: ${R2_IMAGE_DIR:-gallery}"

# 生成图片索引
echo "正在从R2生成图片索引..."
echo "开始时间: $(date)"
if npm run generate-index; then
    echo "✓ 图片索引生成成功"
    echo "结束时间: $(date)"
else
    echo "错误: 图片索引生成失败"
    exit 1
fi

# 检查生成的文件
if [ ! -f "gallery-index.json" ]; then
    echo "错误: gallery-index.json 生成失败"
    exit 1
fi

echo "✓ 必要文件检查通过"

# 显示生成的索引文件信息
echo "生成的索引文件信息:"
echo "  - 文件大小: $(du -h gallery-index.json | cut -f1)"
echo "  - 文件行数: $(wc -l < gallery-index.json)"
echo "  - 最后修改: $(stat -c %y gallery-index.json)"

# 检查Wrangler
echo "检查Wrangler..."
if command -v wrangler &> /dev/null; then
    echo "✓ Wrangler 已安装"
    wrangler --version
else
    echo "错误: 未找到 Wrangler"
    echo "请安装 Wrangler: npm install -g wrangler"
    echo "或者使用: npm install -g @cloudflare/wrangler"
    exit 1
fi

# 检查是否已登录
echo "检查Cloudflare登录状态..."
if ! wrangler whoami &> /dev/null; then
    echo "需要登录Cloudflare..."
    echo "请运行: wrangler login"
    exit 1
fi

echo "✓ 已登录Cloudflare"

# 显示部署信息
echo "部署信息:"
echo "  - 项目名称: gallery-portfolio-static"
echo "  - 部署时间: $(date)"
echo "  - 当前目录: $(pwd)"

# 开始部署
echo
echo "开始部署到Cloudflare Pages..."
echo "项目名称: gallery-portfolio-static"

if wrangler pages deploy . --project-name gallery-portfolio-static; then
    echo
    echo "========================================"
    echo "部署成功！"
    echo "部署时间: $(date)"
    echo "您的网站应该已经可以访问了"
    echo "注意: gallery-index.json 不会推送回仓库"
    echo "========================================"
else
    echo
    echo "========================================"
    echo "部署失败！"
    echo "失败时间: $(date)"
    echo "请检查错误信息并重试"
    echo "========================================"
    exit 1
fi 