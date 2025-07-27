#!/bin/bash

# 部署脚本 (Linux/macOS版本)
# 使用Wrangler部署到Cloudflare Pages

echo "========================================"
echo "Gallery Portfolio 部署脚本"
echo "========================================"

# 检查必要文件
echo "检查必要文件..."

if [ ! -f "gallery-index.json" ]; then
    echo "错误: gallery-index.json 不存在"
    echo "请先运行 generate-gallery-index.sh 生成图片索引"
    exit 1
fi

if [ ! -f "index.html" ]; then
    echo "错误: index.html 不存在"
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