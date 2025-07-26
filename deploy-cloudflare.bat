@echo off
chcp 65001 >nul

REM Cloudflare Workers 部署脚本 (Windows)
REM 使用方法: deploy-cloudflare.bat

echo 🚀 开始部署到 Cloudflare Workers...

REM 检查是否安装了 wrangler
wrangler --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 wrangler，请先安装: npm install -g wrangler
    pause
    exit /b 1
)

REM 检查是否已登录
wrangler whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔐 请先登录 Cloudflare: wrangler login
    pause
    exit /b 1
)

REM 检查 wrangler.toml 文件是否存在
if not exist "wrangler.toml" (
    echo ❌ 未找到 wrangler.toml 文件
    pause
    exit /b 1
)

REM 检查环境变量是否配置
findstr "R2_ACCESS_KEY_ID" wrangler.toml >nul
if %errorlevel% neq 0 (
    echo ⚠️  警告: 请在 wrangler.toml 中配置环境变量
    echo    参考 CLOUDFLARE_DEPLOYMENT.md 文件
)

REM 安装依赖
echo 📦 安装依赖...
npm install

REM 部署到 Cloudflare Workers
echo 🌐 部署到 Cloudflare Workers...
wrangler deploy

if %errorlevel% equ 0 (
    echo ✅ 部署成功！
    echo 🔗 你的网站应该已经可以访问了
) else (
    echo ❌ 部署失败，请检查错误信息
    pause
    exit /b 1
)

pause 