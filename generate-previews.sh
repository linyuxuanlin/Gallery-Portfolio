#!/bin/bash

# 预览图生成脚本 (Linux/macOS版本)
# 使用ImageMagick生成压缩的预览图

echo "========================================"
echo "预览图生成脚本 (Linux/macOS版本)"
echo "========================================"

# 设置源目录路径
SOURCE_DIR="/home/user/Wiki-media/gallery"
PREVIEW_DIR="$SOURCE_DIR/0_preview"

echo "正在扫描目录: $SOURCE_DIR"
echo "预览图目录: $PREVIEW_DIR"
echo

# 检查源目录是否存在
if [ ! -d "$SOURCE_DIR" ]; then
    echo "错误: 源目录不存在: $SOURCE_DIR"
    echo "请修改脚本中的 SOURCE_DIR 变量为正确的路径"
    exit 1
fi

# 检查ImageMagick
echo "检查ImageMagick..."
if command -v magick &> /dev/null; then
    echo "✓ 找到ImageMagick"
    IMAGEMAGICK_CMD="magick"
elif command -v convert &> /dev/null; then
    echo "✓ 找到ImageMagick (convert命令)"
    IMAGEMAGICK_CMD="convert"
else
    echo "错误: 未找到ImageMagick"
    echo "请安装ImageMagick:"
    echo "Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "macOS: brew install imagemagick"
    echo "CentOS/RHEL: sudo yum install ImageMagick"
    exit 1
fi

# 创建预览图目录
if [ ! -d "$PREVIEW_DIR" ]; then
    echo "创建预览图目录: $PREVIEW_DIR"
    mkdir -p "$PREVIEW_DIR"
fi

# 统计变量
total_processed=0
total_skipped=0
total_errors=0

# 遍历源目录下的所有子目录
for category_dir in "$SOURCE_DIR"/*/; do
    if [ -d "$category_dir" ]; then
        category_name=$(basename "$category_dir")
        
        # 跳过0_preview目录
        if [ "$category_name" != "0_preview" ]; then
            echo "处理分类: $category_name"
            
            # 创建对应的预览图目录
            preview_category_dir="$PREVIEW_DIR/$category_name"
            if [ ! -d "$preview_category_dir" ]; then
                mkdir -p "$preview_category_dir"
            fi
            
            # 遍历该分类下的所有图片文件
            for image_file in "$category_dir"*; do
                if [ -f "$image_file" ]; then
                    file_ext="${image_file##*.}"
                    file_name=$(basename "$image_file" ".$file_ext")
                    
                    # 检查是否为图片文件
                    case "${file_ext,,}" in
                        jpg|jpeg|png|gif|bmp|webp)
                            preview_file="$preview_category_dir/$file_name.$file_ext"
                            
                            # 检查预览图是否已存在且比原图新
                            if [ -f "$preview_file" ] && [ "$preview_file" -nt "$image_file" ]; then
                                echo "  跳过 $file_name.$file_ext (预览图已是最新)"
                                ((total_skipped++))
                            else
                                echo "  生成预览图: $file_name.$file_ext"
                                
                                # 使用ImageMagick生成预览图
                                if [ "$IMAGEMAGICK_CMD" = "magick" ]; then
                                    if magick "$image_file" -resize 800x800^ -quality 85 "$preview_file" 2>/dev/null; then
                                        echo "    ✓ 预览图生成成功"
                                        ((total_processed++))
                                    else
                                        echo "    ✗ 预览图生成失败"
                                        ((total_errors++))
                                    fi
                                else
                                    if convert "$image_file" -resize 800x800^ -quality 85 "$preview_file" 2>/dev/null; then
                                        echo "    ✓ 预览图生成成功"
                                        ((total_processed++))
                                    else
                                        echo "    ✗ 预览图生成失败"
                                        ((total_errors++))
                                    fi
                                fi
                            fi
                        fi
                    esac
                fi
            done
            
            echo "  完成分类 $category_name"
        fi
    fi
done

echo
echo "========================================"
echo "预览图生成完成！"
echo "处理文件数: $total_processed"
echo "跳过文件数: $total_skipped"
echo "错误文件数: $total_errors"
echo "预览图目录: $PREVIEW_DIR"
echo "========================================" 