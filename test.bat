@echo off
chcp 65001 >nul
echo ========================================
echo Gallery Portfolio 测试脚本
echo ========================================

echo 正在检查项目文件...

:: 检查必要文件是否存在
set "missing_files="

if not exist "index.html" (
    set "missing_files=!missing_files! index.html"
)

if not exist "gallery-index.json" (
    set "missing_files=!missing_files! gallery-index.json"
)

if not exist "public\styles.css" (
    set "missing_files=!missing_files! public\styles.css"
)

if not exist "public\gallery.css" (
    set "missing_files=!missing_files! public\gallery.css"
)

if not exist "public\layout.js" (
    set "missing_files=!missing_files! public\layout.js"
)

if not exist "public\gallery.js" (
    set "missing_files=!missing_files! public\gallery.js"
)

if not exist "public\data-loader.js" (
    set "missing_files=!missing_files! public\data-loader.js"
)

if not exist "public\tag-filter.js" (
    set "missing_files=!missing_files! public\tag-filter.js"
)

if not exist "public\image-loader.js" (
    set "missing_files=!missing_files! public\image-loader.js"
)

if not exist "public\auto-scroll.js" (
    set "missing_files=!missing_files! public\auto-scroll.js"
)

if not exist "package.json" (
    set "missing_files=!missing_files! package.json"
)

:: 检查图标文件
if not exist "public\assets\brightness_4.svg" (
    set "missing_files=!missing_files! public\assets\brightness_4.svg"
)

if not exist "public\assets\brightness_7.svg" (
    set "missing_files=!missing_files! public\assets\brightness_7.svg"
)

if not exist "public\assets\github.svg" (
    set "missing_files=!missing_files! public\assets\github.svg"
)

if not exist "public\assets\favicon.svg" (
    set "missing_files=!missing_files! public\assets\favicon.svg"
)

if defined missing_files (
    echo 错误: 缺少以下文件:
    echo !missing_files!
    echo.
    echo 请确保所有必要文件都存在。
    pause
    exit /b 1
)

echo ✓ 所有必要文件都存在

:: 检查gallery-index.json格式
echo.
echo 正在检查 gallery-index.json 格式...

powershell -Command "try { $json = Get-Content 'gallery-index.json' -Raw | ConvertFrom-Json; Write-Host '✓ JSON 格式正确' } catch { Write-Host '✗ JSON 格式错误: ' + $_.Exception.Message }"

if errorlevel 1 (
    echo 错误: gallery-index.json 格式不正确
    pause
    exit /b 1
)

:: 检查图片数量
echo.
echo 正在统计摄影作品数量...

powershell -Command "$json = Get-Content 'gallery-index.json' -Raw | ConvertFrom-Json; $total = 0; foreach($category in $json.gallery.PSObject.Properties) { $total += $category.Value.count }; Write-Host '✓ 总作品数: ' + $total"

:: 检查Node.js
echo.
echo 正在检查 Node.js...

node --version >nul 2>&1
if errorlevel 1 (
    echo 警告: 未找到 Node.js，无法进行本地测试
    echo 请安装 Node.js: https://nodejs.org/
) else (
    echo ✓ Node.js 已安装
    node --version
)

:: 检查ImageMagick
echo.
echo 正在检查 ImageMagick...

magick --version >nul 2>&1
if errorlevel 1 (
    echo 警告: 未找到 ImageMagick
    echo 请安装 ImageMagick: https://imagemagick.org/script/download.php#windows
) else (
    echo ✓ ImageMagick 已安装
)

:: 检查Wrangler
echo.
echo 正在检查 Wrangler...

wrangler --version >nul 2>&1
if errorlevel 1 (
    echo 警告: 未找到 Wrangler
    echo 请安装 Wrangler: npm install -g wrangler
) else (
    echo ✓ Wrangler 已安装
    wrangler --version
)

:: 检查图标文件内容
echo.
echo 正在检查图标文件...

powershell -Command "try { $content = Get-Content 'public\assets\brightness_4.svg' -Raw; if($content -match '<svg') { Write-Host '✓ brightness_4.svg 格式正确' } else { Write-Host '✗ brightness_4.svg 格式错误' } } catch { Write-Host '✗ 无法读取 brightness_4.svg' }"

powershell -Command "try { $content = Get-Content 'public\assets\brightness_7.svg' -Raw; if($content -match '<svg') { Write-Host '✓ brightness_7.svg 格式正确' } else { Write-Host '✗ brightness_7.svg 格式错误' } } catch { Write-Host '✗ 无法读取 brightness_7.svg' }"

echo.
echo ========================================
echo 测试完成!
echo.
echo 如果所有检查都通过，您可以:
echo 1. 运行 npm run serve 进行本地测试
echo 2. 访问 test-icons.html 测试图标加载
echo 3. 访问 debug-icons.html 进行详细调试
echo 4. 运行 deploy.bat 部署到 Cloudflare Pages
echo ========================================

pause 