#!/bin/bash

# 图片目录索引生成器 (Linux/macOS版本)
# 支持EXIF信息提取

echo "========================================"
echo "图片目录索引生成器 (Linux/macOS版本)"
echo "========================================"

# 设置源目录路径
SOURCE_DIR="/home/user/Wiki-media/gallery"
OUTPUT_FILE="gallery-index.json"

echo "正在扫描目录: $SOURCE_DIR"
echo "输出文件: $OUTPUT_FILE"
echo

# 检查源目录是否存在
if [ ! -d "$SOURCE_DIR" ]; then
    echo "错误: 源目录不存在: $SOURCE_DIR"
    echo "请修改脚本中的 SOURCE_DIR 变量为正确的路径"
    exit 1
fi

# 检查是否安装了exiftool
echo "检查EXIF工具..."
if command -v exiftool &> /dev/null; then
    echo "✓ 找到exiftool，将提取EXIF信息"
    EXIF_AVAILABLE=true
else
    echo "警告: 未找到exiftool，将跳过EXIF信息提取"
    echo "请安装exiftool: https://exiftool.org/"
    echo "Ubuntu/Debian: sudo apt-get install exiftool"
    echo "macOS: brew install exiftool"
    EXIF_AVAILABLE=false
fi

# 创建输出文件并写入JSON开始标记
echo "{" > "$OUTPUT_FILE"
echo "  \"gallery\": {" >> "$OUTPUT_FILE"

# 初始化变量
first_category=true
total_images=0

# 遍历源目录下的所有子目录
for category_dir in "$SOURCE_DIR"/*/; do
    if [ -d "$category_dir" ]; then
        category_name=$(basename "$category_dir")
        
        # 跳过0_preview目录
        if [ "$category_name" != "0_preview" ]; then
            echo "处理分类: $category_name"
            
            # 如果不是第一个分类，添加逗号
            if [ "$first_category" = true ]; then
                first_category=false
            else
                echo "," >> "$OUTPUT_FILE"
            fi
            
            # 写入分类开始
            echo "  \"$category_name\": {" >> "$OUTPUT_FILE"
            echo "    \"name\": \"$category_name\"," >> "$OUTPUT_FILE"
            echo "    \"images\": [" >> "$OUTPUT_FILE"
            
            # 初始化图片计数器
            image_count=0
            first_image=true
            
            # 遍历该分类下的所有图片文件
            for image_file in "$category_dir"*; do
                if [ -f "$image_file" ]; then
                    file_ext="${image_file##*.}"
                    file_name=$(basename "$image_file" ".$file_ext")
                    
                    # 检查是否为图片文件
                    case "${file_ext,,}" in
                        jpg|jpeg|png|gif|bmp|webp)
                            # 如果不是第一张图片，添加逗号
                            if [ "$first_image" = true ]; then
                                first_image=false
                            else
                                echo "," >> "$OUTPUT_FILE"
                            fi
                            
                            # 构建图片URL
                            original_url="https://media.wiki-power.com/gallery/$category_name/$file_name.$file_ext"
                            preview_url="https://media.wiki-power.com/gallery/0_preview/$category_name/$file_name.$file_ext"
                            
                            # 写入图片信息开始
                            echo "      {" >> "$OUTPUT_FILE"
                            echo "        \"name\": \"$file_name\"," >> "$OUTPUT_FILE"
                            echo "        \"original\": \"$original_url\"," >> "$OUTPUT_FILE"
                            echo "        \"preview\": \"$preview_url\"," >> "$OUTPUT_FILE"
                            echo "        \"category\": \"$category_name\"," >> "$OUTPUT_FILE"
                            
                            # 提取EXIF信息
                            if [ "$EXIF_AVAILABLE" = true ]; then
                                echo "提取EXIF信息: $file_name.$file_ext"
                                
                                # 创建临时文件存储EXIF信息
                                temp_exif=$(mktemp)
                                exiftool -Aperture -ShutterSpeed -ISO -FocalLength -Model -LensModel -GPSLatitude -GPSLongitude -DateTimeOriginal "$image_file" > "$temp_exif" 2>/dev/null
                                
                                # 读取EXIF信息
                                aperture=""
                                shutter_speed=""
                                iso=""
                                focal_length=""
                                camera=""
                                lens=""
                                gps_lat=""
                                gps_lon=""
                                date_time=""
                                
                                while IFS= read -r line; do
                                    if [[ $line =~ ^Aperture[[:space:]]*:[[:space:]]*(.+)$ ]]; then
                                        aperture="${BASH_REMATCH[1]}"
                                    elif [[ $line =~ ^ShutterSpeed[[:space:]]*:[[:space:]]*(.+)$ ]]; then
                                        shutter_speed="${BASH_REMATCH[1]}"
                                    elif [[ $line =~ ^ISO[[:space:]]*:[[:space:]]*(.+)$ ]]; then
                                        iso="${BASH_REMATCH[1]}"
                                    elif [[ $line =~ ^FocalLength[[:space:]]*:[[:space:]]*(.+)$ ]]; then
                                        focal_length="${BASH_REMATCH[1]}"
                                    elif [[ $line =~ ^Model[[:space:]]*:[[:space:]]*(.+)$ ]]; then
                                        camera="${BASH_REMATCH[1]}"
                                    elif [[ $line =~ ^LensModel[[:space:]]*:[[:space:]]*(.+)$ ]]; then
                                        lens="${BASH_REMATCH[1]}"
                                    elif [[ $line =~ ^GPSLatitude[[:space:]]*:[[:space:]]*(.+)$ ]]; then
                                        gps_lat="${BASH_REMATCH[1]}"
                                    elif [[ $line =~ ^GPSLongitude[[:space:]]*:[[:space:]]*(.+)$ ]]; then
                                        gps_lon="${BASH_REMATCH[1]}"
                                    elif [[ $line =~ ^DateTimeOriginal[[:space:]]*:[[:space:]]*(.+)$ ]]; then
                                        date_time="${BASH_REMATCH[1]}"
                                    fi
                                done < "$temp_exif"
                                
                                # 清理临时文件
                                rm -f "$temp_exif"
                                
                                # 写入EXIF信息
                                echo "        \"exif\": {" >> "$OUTPUT_FILE"
                                
                                # 使用临时变量跟踪是否已写入属性
                                first_exif_property=true
                                
                                if [ -n "$aperture" ]; then
                                    if [ "$first_exif_property" = true ]; then
                                        first_exif_property=false
                                    else
                                        echo "," >> "$OUTPUT_FILE"
                                    fi
                                    echo "          \"aperture\": \"$aperture\"" >> "$OUTPUT_FILE"
                                fi
                                if [ -n "$shutter_speed" ]; then
                                    if [ "$first_exif_property" = true ]; then
                                        first_exif_property=false
                                    else
                                        echo "," >> "$OUTPUT_FILE"
                                    fi
                                    echo "          \"shutterSpeed\": \"$shutter_speed\"" >> "$OUTPUT_FILE"
                                fi
                                if [ -n "$iso" ]; then
                                    if [ "$first_exif_property" = true ]; then
                                        first_exif_property=false
                                    else
                                        echo "," >> "$OUTPUT_FILE"
                                    fi
                                    echo "          \"iso\": \"$iso\"" >> "$OUTPUT_FILE"
                                fi
                                if [ -n "$focal_length" ]; then
                                    if [ "$first_exif_property" = true ]; then
                                        first_exif_property=false
                                    else
                                        echo "," >> "$OUTPUT_FILE"
                                    fi
                                    echo "          \"focalLength\": \"$focal_length\"" >> "$OUTPUT_FILE"
                                fi
                                if [ -n "$camera" ]; then
                                    if [ "$first_exif_property" = true ]; then
                                        first_exif_property=false
                                    else
                                        echo "," >> "$OUTPUT_FILE"
                                    fi
                                    echo "          \"camera\": \"$camera\"" >> "$OUTPUT_FILE"
                                fi
                                if [ -n "$lens" ]; then
                                    if [ "$first_exif_property" = true ]; then
                                        first_exif_property=false
                                    else
                                        echo "," >> "$OUTPUT_FILE"
                                    fi
                                    echo "          \"lens\": \"$lens\"" >> "$OUTPUT_FILE"
                                fi
                                if [ -n "$gps_lat" ] && [ -n "$gps_lon" ]; then
                                    if [ "$first_exif_property" = true ]; then
                                        first_exif_property=false
                                    else
                                        echo "," >> "$OUTPUT_FILE"
                                    fi
                                    echo "          \"gps\": \"$gps_lat, $gps_lon\"" >> "$OUTPUT_FILE"
                                fi
                                if [ -n "$date_time" ]; then
                                    if [ "$first_exif_property" = true ]; then
                                        first_exif_property=false
                                    else
                                        echo "," >> "$OUTPUT_FILE"
                                    fi
                                    echo "          \"dateTime\": \"$date_time\"" >> "$OUTPUT_FILE"
                                fi
                                
                                echo "        }" >> "$OUTPUT_FILE"
                            fi
                            
                            echo "      }" >> "$OUTPUT_FILE"
                            
                            ((image_count++))
                            ((total_images++))
                        fi
                    esac
                fi
            done
            
            # 写入分类结束
            echo "    ]," >> "$OUTPUT_FILE"
            echo "    \"count\": $image_count" >> "$OUTPUT_FILE"
            echo "  }" >> "$OUTPUT_FILE"
            
            echo "  完成分类 $category_name，共 $image_count 张图片"
        fi
    fi
done

# 写入JSON结束标记
echo "  }," >> "$OUTPUT_FILE"
echo "  \"total\": $total_images" >> "$OUTPUT_FILE"
echo "}" >> "$OUTPUT_FILE"

echo
echo "========================================"
echo "索引生成完成！"
echo "总图片数: $total_images"
echo "输出文件: $OUTPUT_FILE"
if [ "$EXIF_AVAILABLE" = true ]; then
    echo "✓ 已提取EXIF信息"
else
    echo "⚠ 未提取EXIF信息 (需要安装exiftool)"
fi
echo "========================================" 