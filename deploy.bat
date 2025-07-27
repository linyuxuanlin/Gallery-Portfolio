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
    echo 正在安装依赖包...
    npm install
) else (
    echo 依赖包已存在，跳过安装
)

REM 检查环境变量
echo 检查环境变量...
set missing_vars=0

if "%CLOUDFLARE_ACCOUNT_ID%"=="" (
    echo   - CLOUDFLARE_ACCOUNT_ID
    set missing_vars=1
) else (
    echo ✓ CLOUDFLARE_ACCOUNT_ID: %CLOUDFLARE_ACCOUNT_ID%
)

if "%R2_ACCESS_KEY_ID%"=="" (
    echo   - R2_ACCESS_KEY_ID
    set missing_vars=1
) else (
    echo ✓ R2_ACCESS_KEY_ID: %R2_ACCESS_KEY_ID%
)

if "%R2_SECRET_ACCESS_KEY%"=="" (
    echo   - R2_SECRET_ACCESS_KEY
    set missing_vars=1
) else (
    echo ✓ R2_SECRET_ACCESS_KEY: 已设置
)

if "%R2_BUCKET_NAME%"=="" (
    echo   - R2_BUCKET_NAME
    set missing_vars=1
) else (
    echo ✓ R2_BUCKET_NAME: %R2_BUCKET_NAME%
)

if %missing_vars%==1 (
    echo 错误: 缺少必要的环境变量
    echo.
    echo 请设置以下环境变量:
    echo CLOUDFLARE_ACCOUNT_ID: Cloudflare账户ID
    echo R2_ACCESS_KEY_ID: R2访问密钥ID
    echo R2_SECRET_ACCESS_KEY: R2访问密钥
    echo R2_BUCKET_NAME: R2存储桶名称
    echo R2_ENDPOINT: R2端点URL (可选)
    echo R2_REGION: R2区域 (可选，默认auto)
    echo R2_IMAGE_BASE_URL: 图片基础URL (可选)
    echo R2_IMAGE_DIR: 图片目录 (可选，默认gallery)
    pause
    exit /b 1
)

echo ✓ 环境变量检查通过

REM 显示配置信息
echo 当前配置信息:
echo   - R2存储桶: %R2_BUCKET_NAME%
if "%R2_ENDPOINT%"=="" (
    echo   - R2端点: 未设置
) else (
    echo   - R2端点: %R2_ENDPOINT%
)
if "%R2_REGION%"=="" (
    echo   - R2区域: auto
) else (
    echo   - R2区域: %R2_REGION%
)
if "%R2_IMAGE_BASE_URL%"=="" (
    echo   - 图片基础URL: 未设置
) else (
    echo   - 图片基础URL: %R2_IMAGE_BASE_URL%
)
if "%R2_IMAGE_DIR%"=="" (
    echo   - 图片目录: gallery
) else (
    echo   - 图片目录: %R2_IMAGE_DIR%
)

REM 生成图片索引
echo 正在从R2生成图片索引...
echo 开始时间: %date% %time%
npm run generate-index
if errorlevel 1 (
    echo 错误: 图片索引生成失败
    pause
    exit /b 1
)

echo ✓ 图片索引生成成功
echo 结束时间: %date% %time%

REM 检查生成的文件
if not exist "gallery-index.json" (
    echo 错误: gallery-index.json 生成失败
    pause
    exit /b 1
)

echo ✓ 必要文件检查通过

REM 显示生成的索引文件信息
echo 生成的索引文件信息:
for %%A in (gallery-index.json) do echo   - 文件大小: %%~zA 字节
echo   - 最后修改: %date% %time%

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

REM 显示部署信息
echo 部署信息:
echo   - 项目名称: gallery-portfolio-static
echo   - 部署时间: %date% %time%
echo   - 当前目录: %cd%

REM 开始部署
echo.
echo 开始部署到Cloudflare Pages...
echo 项目名称: gallery-portfolio-static

wrangler pages deploy . --project-name gallery-portfolio-static
if errorlevel 1 (
    echo.
    echo ========================================
    echo 部署失败！
    echo 失败时间: %date% %time%
    echo 请检查错误信息并重试
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo 部署成功！
echo 部署时间: %date% %time%
echo 您的网站应该已经可以访问了
echo 注意: gallery-index.json 不会推送回仓库
echo ========================================
pause 