@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 图片目录索引生成器 (含EXIF信息)
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

:: 检查是否安装了exiftool
echo 检查EXIF工具...
exiftool -ver >nul 2>&1
if errorlevel 1 (
    echo 警告: 未找到exiftool，将跳过EXIF信息提取
    echo 请安装exiftool: https://exiftool.org/
    echo 或者下载Windows版本: https://exiftool.org/exiftool-13.33_64.zip
    set "EXIF_AVAILABLE=false"
) else (
    echo ✓ 找到exiftool，将提取EXIF信息
    set "EXIF_AVAILABLE=true"
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
                
                :: 写入图片信息开始
                echo       { >> "%OUTPUT_FILE%"
                echo         "name": "!file_name!", >> "%OUTPUT_FILE%"
                echo         "original": "!original_url!", >> "%OUTPUT_FILE%"
                echo         "preview": "!preview_url!", >> "%OUTPUT_FILE%"
                echo         "category": "!category_name!", >> "%OUTPUT_FILE%"
                
                :: 提取EXIF信息
                if "!EXIF_AVAILABLE!"=="true" (
                    echo 提取EXIF信息: !file_name!!file_ext!
                    
                    :: 创建临时文件存储EXIF信息
                    set "temp_exif=temp_exif.txt"
                    exiftool -Aperture -ShutterSpeed -ISO -FocalLength -Model -LensModel -GPSLatitude -GPSLongitude -DateTimeOriginal "%%j" > "!temp_exif!" 2>nul
                    
                    :: 读取EXIF信息
                    set "aperture="
                    set "shutter_speed="
                    set "iso="
                    set "focal_length="
                    set "camera="
                    set "lens="
                    set "gps_lat="
                    set "gps_lon="
                    set "date_time="
                    
                    for /f "tokens=1,* delims=:" %%a in (!temp_exif!) do (
                        set "line=%%a:%%b"
                        set "line=!line: =!"
                        
                        if "!line!"=="Aperture:" (
                            set "aperture=%%b"
                        ) else if "!line!"=="ShutterSpeed:" (
                            set "shutter_speed=%%b"
                        ) else if "!line!"=="ISO:" (
                            set "iso=%%b"
                        ) else if "!line!"=="FocalLength:" (
                            set "focal_length=%%b"
                        ) else if "!line!"=="Model:" (
                            set "camera=%%b"
                        ) else if "!line!"=="LensModel:" (
                            set "lens=%%b"
                        ) else if "!line!"=="GPSLatitude:" (
                            set "gps_lat=%%b"
                        ) else if "!line!"=="GPSLongitude:" (
                            set "gps_lon=%%b"
                        ) else if "!line!"=="DateTimeOriginal:" (
                            set "date_time=%%b"
                        )
                    )
                    
                    :: 清理临时文件
                    if exist "!temp_exif!" del "!temp_exif!"
                    
                    :: 写入EXIF信息
                    echo         "exif": { >> "%OUTPUT_FILE%"
                    
                    if defined aperture (
                        echo           "aperture": "!aperture!", >> "%OUTPUT_FILE%"
                    )
                    if defined shutter_speed (
                        echo           "shutterSpeed": "!shutter_speed!", >> "%OUTPUT_FILE%"
                    )
                    if defined iso (
                        echo           "iso": "!iso!", >> "%OUTPUT_FILE%"
                    )
                    if defined focal_length (
                        echo           "focalLength": "!focal_length!", >> "%OUTPUT_FILE%"
                    )
                    if defined camera (
                        echo           "camera": "!camera!", >> "%OUTPUT_FILE%"
                    )
                    if defined lens (
                        echo           "lens": "!lens!", >> "%OUTPUT_FILE%"
                    )
                    if defined gps_lat (
                        if defined gps_lon (
                            echo           "gps": "!gps_lat!, !gps_lon!", >> "%OUTPUT_FILE%"
                        )
                    )
                    if defined date_time (
                        echo           "dateTime": "!date_time!" >> "%OUTPUT_FILE%"
                    )
                    
                    echo         } >> "%OUTPUT_FILE%"
                )
                
                echo       } >> "%OUTPUT_FILE%"
                
                set /a "image_count+=1"
                set /a "total_images+=1"
            )
        )
        
        :: 写入分类结束
        echo     ], >> "%OUTPUT_FILE%"
        echo     "count": !image_count! >> "%OUTPUT_FILE%"
        echo   } >> "%OUTPUT_FILE%"
        
        echo   完成分类 !category_name!，共 !image_count! 张图片
    )
)

:: 写入JSON结束标记
echo   }, >> "%OUTPUT_FILE%"
echo   "total": !total_images! >> "%OUTPUT_FILE%"
echo } >> "%OUTPUT_FILE%"

echo.
echo ========================================
echo 索引生成完成！
echo 总图片数: !total_images!
echo 输出文件: %OUTPUT_FILE%
if "!EXIF_AVAILABLE!"=="true" (
    echo ✓ 已提取EXIF信息
) else (
    echo ⚠ 未提取EXIF信息 (需要安装exiftool)
)
echo ========================================

pause 