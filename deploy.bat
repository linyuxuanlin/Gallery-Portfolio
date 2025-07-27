@echo off
chcp 65001 >nul

REM 部署脚本 (Windows版本)
REM 使用Wrangler部署到Cloudflare Pages
REM 自动从R2生成图片索引

echo ========================================
echo Gallery Portfolio 部署脚本
echo ========================================

REM 检查Node.js
echo 检查Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Node.js
    echo 请安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js 已安装
node --version

REM 检查npm
echo 检查npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 npm
    pause
    exit /b 1
)

echo ✓ npm 已安装

REM 安装依赖
echo 安装依赖...
if not exist "node_modules" (
    npm install
) else (
    npm install --silent
)

REM 检查环境变量
echo 检查环境变量...
set missing_vars=0

if "%CLOUDFLARE_ACCOUNT_ID%"=="" (
    echo   - CLOUDFLARE_ACCOUNT_ID
    set missing_vars=1
)

if "%R2_ACCESS_KEY_ID%"=="" (
    echo   - R2_ACCESS_KEY_ID
    set missing_vars=1
)

if "%R2_SECRET_ACCESS_KEY%"=="" (
    echo   - R2_SECRET_ACCESS_KEY
    set missing_vars=1
)

if %missing_vars%==1 (
    echo 错误: 缺少必要的环境变量
    echo.
    echo 请设置以下环境变量:
    echo CLOUDFLARE_ACCOUNT_ID: Cloudflare账户ID
    echo R2_ACCESS_KEY_ID: R2访问密钥ID
    echo R2_SECRET_ACCESS_KEY: R2访问密钥
    echo R2_ENDPOINT: R2端点URL (可选)
    pause
    exit /b 1
)

echo ✓ 环境变量检查通过

REM 生成图片索引
echo 正在从R2生成图片索引...
npm run generate-index
if errorlevel 1 (
    echo 错误: 图片索引生成失败
    pause
    exit /b 1
)

echo ✓ 图片索引生成成功

REM 检查生成的文件
if not exist "gallery-index.json" (
    echo 错误: gallery-index.json 生成失败
    pause
    exit /b 1
)

echo ✓ 必要文件检查通过

REM 检查Wrangler
echo 检查Wrangler...
wrangler --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Wrangler
    echo 请安装 Wrangler: npm install -g wrangler
    echo 或者使用: npm install -g @cloudflare/wrangler
    pause
    exit /b 1
)

echo ✓ Wrangler 已安装
wrangler --version

REM 检查是否已登录
echo 检查Cloudflare登录状态...
wrangler whoami >nul 2>&1
if errorlevel 1 (
    echo 需要登录Cloudflare...
    echo 请运行: wrangler login
    pause
    exit /b 1
)

echo ✓ 已登录Cloudflare

REM 开始部署
echo.
echo 开始部署到Cloudflare Pages...
echo 项目名称: gallery-portfolio-static

wrangler pages deploy . --project-name gallery-portfolio-static
if errorlevel 1 (
    echo.
    echo ========================================
    echo 部署失败！
    echo 请检查错误信息并重试
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo 部署成功！
echo 您的网站应该已经可以访问了
echo ========================================
pause 