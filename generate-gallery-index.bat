@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 图片目录索引生成器
echo ========================================

:: 设置源目录路径
set "SOURCE_DIR=C:\Users\Power\Wiki-media\gallery"
set "OUTPUT_FILE=gallery-index.json"

echo 正在扫描目录: %SOURCE_DIR%
echo 输出文件: %OUTPUT_FILE%
echo.

:: 检查源目录是否存在
if not exist "%SOURCE_DIR%" (
    echo 错误: 源目录不存在: %SOURCE_DIR%
    echo 请修改脚本中的 SOURCE_DIR 变量为正确的路径
    pause
    exit /b 1
)

:: 创建输出文件并写入JSON开始标记
echo { > "%OUTPUT_FILE%"
echo   "gallery": { >> "%OUTPUT_FILE%"

:: 初始化变量
set "first_category=true"
set "total_images=0"

:: 遍历源目录下的所有子目录
for /d %%i in ("%SOURCE_DIR%\*") do (
    set "category_name=%%~ni"
    
    :: 跳过0_preview目录
    if not "!category_name!"=="0_preview" (
        echo 处理分类: !category_name!
        
        :: 如果不是第一个分类，添加逗号
        if "!first_category!"=="true" (
            set "first_category=false"
        ) else (
            echo , >> "%OUTPUT_FILE%"
        )
        
        :: 写入分类开始
        echo   "!category_name!": { >> "%OUTPUT_FILE%"
        echo     "name": "!category_name!", >> "%OUTPUT_FILE%"
        echo     "images": [ >> "%OUTPUT_FILE%"
        
        :: 初始化图片计数器
        set "image_count=0"
        set "first_image=true"
        
        :: 遍历该分类下的所有图片文件
        for %%j in ("%%i\*") do (
            set "file_ext=%%~xj"
            set "file_name=%%~nj"
            
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
                :: 如果不是第一张图片，添加逗号
                if "!first_image!"=="true" (
                    set "first_image=false"
                ) else (
                    echo , >> "%OUTPUT_FILE%"
                )
                
                :: 构建图片URL
                set "original_url=https://media.wiki-power.com/gallery/!category_name!/!file_name!!file_ext!"
                set "preview_url=https://media.wiki-power.com/gallery/0_preview/!category_name!/!file_name!!file_ext!"
                
                :: 写入图片信息
                echo       { >> "%OUTPUT_FILE%"
                echo         "name": "!file_name!", >> "%OUTPUT_FILE%"
                echo         "original": "!original_url!", >> "%OUTPUT_FILE%"
                echo         "preview": "!preview_url!", >> "%OUTPUT_FILE%"
                echo         "category": "!category_name!" >> "%OUTPUT_FILE%"
                echo       } >> "%OUTPUT_FILE%"
                
                set /a "image_count+=1"
                set /a "total_images+=1"
            )
        )
        
        :: 写入分类结束
        echo     ], >> "%OUTPUT_FILE%"
        echo     "count": !image_count! >> "%OUTPUT_FILE%"
        echo   } >> "%OUTPUT_FILE%"
        
        echo   完成: !category_name! (!image_count! 张图片)
    )
)

:: 写入JSON结束标记
echo   }, >> "%OUTPUT_FILE%"
echo   "total_images": !total_images!, >> "%OUTPUT_FILE%"
echo   "generated_at": "%date% %time%" >> "%OUTPUT_FILE%"
echo } >> "%OUTPUT_FILE%"

echo.
echo ========================================
echo 索引生成完成!
echo 总图片数: !total_images!
echo 输出文件: %OUTPUT_FILE%
echo ========================================

pause 