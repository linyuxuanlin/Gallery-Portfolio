#!/bin/bash

# Cloudflare Workers 部署脚本
# 使用方法: ./deploy-cloudflare.sh

echo "🚀 开始部署到 Cloudflare Workers..."

# 检查是否安装了 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ 未找到 wrangler，请先安装: npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
if ! wrangler whoami &> /dev/null; then
    echo "🔐 请先登录 Cloudflare: wrangler login"
    exit 1
fi

# 检查 wrangler.toml 文件是否存在
if [ ! -f "wrangler.toml" ]; then
    echo "❌ 未找到 wrangler.toml 文件"
    exit 1
fi

# 检查环境变量是否配置
if ! grep -q "R2_ACCESS_KEY_ID" wrangler.toml; then
    echo "⚠️  警告: 请在 wrangler.toml 中配置环境变量"
    echo "   参考 CLOUDFLARE_DEPLOYMENT.md 文件"
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 部署到 Cloudflare Workers
echo "🌐 部署到 Cloudflare Workers..."
wrangler deploy

if [ $? -eq 0 ]; then
    echo "✅ 部署成功！"
    echo "🔗 你的网站应该已经可以访问了"
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi 