@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 图片预览图生成器
echo ========================================

:: 设置源目录路径
set "SOURCE_DIR=C:\Users\Power\Wiki-media\gallery"
set "PREVIEW_DIR=%SOURCE_DIR%\0_preview"

echo 源目录: %SOURCE_DIR%
echo 预览图目录: %PREVIEW_DIR%
echo.

:: 检查源目录是否存在
if not exist "%SOURCE_DIR%" (
    echo 错误: 源目录不存在: %SOURCE_DIR%
    echo 请修改脚本中的 SOURCE_DIR 变量为正确的路径
    pause
    exit /b 1
)

:: 创建预览图根目录
if not exist "%PREVIEW_DIR%" (
    echo 创建预览图根目录: %PREVIEW_DIR%
    mkdir "%PREVIEW_DIR%"
)

:: 检查是否安装了ImageMagick
magick --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到ImageMagick
    echo 请先安装ImageMagick: https://imagemagick.org/script/download.php#windows
    echo 安装后请确保magick命令可以在命令行中使用
    pause
    exit /b 1
)

echo ImageMagick已安装，开始处理图片...
echo.

:: 初始化计数器
set "total_processed=0"
set "total_skipped=0"

:: 遍历源目录下的所有子目录
for /d %%i in ("%SOURCE_DIR%\*") do (
    set "category_name=%%~ni"
    
    :: 跳过0_preview目录
    if not "!category_name!"=="0_preview" (
        echo 处理分类: !category_name!
        
        :: 创建对应的预览图目录
        set "category_preview_dir=%PREVIEW_DIR%\!category_name!"
        if not exist "!category_preview_dir!" (
            mkdir "!category_preview_dir!"
            echo   创建预览图目录: !category_preview_dir!
        )
        
        :: 初始化分类计数器
        set "category_processed=0"
        set "category_skipped=0"
        
        :: 遍历该分类下的所有图片文件
        for %%j in ("%%i\*") do (
            set "file_ext=%%~xj"
            set "file_name=%%~nj"
            set "source_file=%%j"
            set "preview_file=!category_preview_dir!\!file_name!!file_ext!"
            
            :: 检查是否为图片文件
            if /i "!file_ext!"==".jpg" (
                set "is_image=true"
            ) else if /i "!file_ext!"==".jpeg" (
                set "is_image=true"
            ) else if /i "!file_ext!"==".png" (
                set "is_image=true"
            ) else if /i "!file_ext!"==".gif" (
                set "is_image=true"
            ) else if /i "!file_ext!"==".bmp" (
                set "is_image=true"
            ) else if /i "!file_ext!"==".webp" (
                set "is_image=true"
            ) else (
                set "is_image=false"
            )
            
            if "!is_image!"=="true" (
                :: 检查预览图是否已存在且比原图新
                if exist "!preview_file!" (
                    for %%s in ("!source_file!") do set "source_time=%%~ts"
                    for %%p in ("!preview_file!") do set "preview_time=%%~tp"
                    
                    if "!preview_time!" gtr "!source_time!" (
                        echo   跳过: !file_name!!file_ext! (预览图已是最新)
                        set /a "category_skipped+=1"
                        set /a "total_skipped+=1"
                        goto :continue
                    )
                )
                
                :: 生成预览图
                echo   处理: !file_name!!file_ext!
                
                :: 使用ImageMagick生成预览图
                :: 设置最大宽度为800像素，保持宽高比，质量为85%
                magick "!source_file!" -resize 800x800^ -quality 85 "!preview_file!"
                
                if errorlevel 1 (
                    echo   错误: 无法处理 !file_name!!file_ext!
                    set /a "category_skipped+=1"
                    set /a "total_skipped+=1"
                ) else (
                    echo   完成: !file_name!!file_ext!
                    set /a "category_processed+=1"
                    set /a "total_processed+=1"
                )
            )
            
            :continue
        )
        
        echo   分类完成: !category_name! (处理: !category_processed!, 跳过: !category_skipped!)
        echo.
    )
)

echo ========================================
echo 预览图生成完成!
echo 总处理数: !total_processed!
echo 总跳过数: !total_skipped!
echo ========================================

pause 