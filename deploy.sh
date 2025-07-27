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
    npm install
else
    npm install --silent
fi

# 检查环境变量
echo "检查环境变量..."
required_vars=("CLOUDFLARE_ACCOUNT_ID" "R2_ACCESS_KEY_ID" "R2_SECRET_ACCESS_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
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
    echo "R2_ENDPOINT: R2端点URL (可选)"
    exit 1
fi

echo "✓ 环境变量检查通过"

# 生成图片索引
echo "正在从R2生成图片索引..."
if npm run generate-index; then
    echo "✓ 图片索引生成成功"
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

# 开始部署
echo
echo "开始部署到Cloudflare Pages..."
echo "项目名称: gallery-portfolio-static"

if wrangler pages deploy . --project-name gallery-portfolio-static; then
    echo
    echo "========================================"
    echo "部署成功！"
    echo "您的网站应该已经可以访问了"
    echo "========================================"
else
    echo
    echo "========================================"
    echo "部署失败！"
    echo "请检查错误信息并重试"
    echo "========================================"
    exit 1
fi 