@echo off
chcp 65001 >nul
echo ========================================
echo Gallery Portfolio 部署脚本
echo ========================================

:: 检查是否存在gallery-index.json文件
if not exist "gallery-index.json" (
    echo 错误: 未找到 gallery-index.json 文件
    echo 请先运行 generate-gallery-index.bat 生成图片索引
    pause
    exit /b 1
)

echo 正在准备部署文件...

:: 检查是否安装了wrangler
wrangler --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 wrangler
    echo 请先安装 wrangler: npm install -g wrangler
    echo 然后运行: wrangler login
    pause
    exit /b 1
)

echo 开始部署到 Cloudflare Pages...
echo.

:: 使用wrangler部署
wrangler pages deploy . --project-name gallery-portfolio-static

if errorlevel 1 (
    echo.
    echo 部署失败，请检查错误信息
    pause
    exit /b 1
)

echo.
echo ========================================
echo 部署完成!
echo 请访问您的 Cloudflare Pages 域名查看效果
echo ========================================
pause 