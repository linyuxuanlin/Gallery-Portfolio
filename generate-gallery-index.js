#!/usr/bin/env node

/**
 * 图片目录索引生成器 (Node.js版本)
 * 支持EXIF信息提取
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("========================================");
console.log("图片目录索引生成器 (Node.js版本)");
console.log("========================================");

// 配置
const SOURCE_DIR = "C:\\Users\\Power\\Wiki-media\\gallery"; // 请修改为您的图片目录路径
const OUTPUT_FILE = "gallery-index.json";

console.log(`正在扫描目录: ${SOURCE_DIR}`);
console.log(`输出文件: ${OUTPUT_FILE}`);
console.log();

// 检查源目录是否存在
if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`错误: 源目录不存在: ${SOURCE_DIR}`);
    console.error("请修改脚本中的 SOURCE_DIR 变量为正确的路径");
    process.exit(1);
}

// 检查是否安装了exiftool
let exifAvailable = false;
try {
    execSync('exiftool -ver', { stdio: 'ignore' });
    console.log("✓ 找到exiftool，将提取EXIF信息");
    exifAvailable = true;
} catch (error) {
    console.log("警告: 未找到exiftool，将跳过EXIF信息提取");
    console.log("请安装exiftool: https://exiftool.org/");
    console.log("Ubuntu/Debian: sudo apt-get install exiftool");
    console.log("macOS: brew install exiftool");
    console.log("Windows: 下载并安装 ExifTool");
}

// 支持的图片格式
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

// 提取EXIF信息
function extractExifInfo(imagePath) {
    if (!exifAvailable) return null;
    
    try {
        const result = execSync(`exiftool -Aperture -ShutterSpeed -ISO -FocalLength -Model -LensModel -GPSLatitude -GPSLongitude -DateTimeOriginal "${imagePath}"`, { encoding: 'utf8' });
        
        const exif = {};
        const lines = result.split('\n');
        
        for (const line of lines) {
            if (line.includes('Aperture')) {
                exif.aperture = line.split(':')[1]?.trim();
            } else if (line.includes('ShutterSpeed')) {
                exif.shutterSpeed = line.split(':')[1]?.trim();
            } else if (line.includes('ISO')) {
                exif.iso = line.split(':')[1]?.trim();
            } else if (line.includes('FocalLength')) {
                exif.focalLength = line.split(':')[1]?.trim();
            } else if (line.includes('Model')) {
                exif.camera = line.split(':')[1]?.trim();
            } else if (line.includes('LensModel')) {
                exif.lens = line.split(':')[1]?.trim();
            } else if (line.includes('GPSLatitude') && line.includes('GPSLongitude')) {
                const latMatch = line.match(/GPSLatitude\s*:\s*(.+?)\s*GPSLongitude/);
                const lonMatch = line.match(/GPSLongitude\s*:\s*(.+)/);
                if (latMatch && lonMatch) {
                    exif.gps = `${latMatch[1].trim()}, ${lonMatch[1].trim()}`;
                }
            } else if (line.includes('DateTimeOriginal')) {
                exif.dateTime = line.split(':')[1]?.trim();
            }
        }
        
        // 只返回有值的属性
        const filteredExif = {};
        Object.keys(exif).forEach(key => {
            if (exif[key]) {
                filteredExif[key] = exif[key];
            }
        });
        
        return Object.keys(filteredExif).length > 0 ? filteredExif : null;
    } catch (error) {
        console.warn(`提取EXIF信息失败: ${imagePath}`);
        return null;
    }
}

// 构建图片URL
function buildImageUrls(categoryName, fileName, fileExt) {
    const originalUrl = `https://media.wiki-power.com/gallery/${categoryName}/${fileName}.${fileExt}`;
    const previewUrl = `https://media.wiki-power.com/gallery/0_preview/${categoryName}/${fileName}.${fileExt}`;
    return { originalUrl, previewUrl };
}

// 主函数
function generateGalleryIndex() {
    const gallery = {};
    let totalImages = 0;
    
    // 读取源目录
    const categories = fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => name !== '0_preview'); // 跳过预览目录
    
    for (const categoryName of categories) {
        console.log(`处理分类: ${categoryName}`);
        
        const categoryPath = path.join(SOURCE_DIR, categoryName);
        const images = [];
        
        // 读取分类目录下的所有文件
        const files = fs.readdirSync(categoryPath);
        
        for (const file of files) {
            const filePath = path.join(categoryPath, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isFile()) {
                const ext = path.extname(file).toLowerCase();
                
                if (IMAGE_EXTENSIONS.includes(ext)) {
                    const fileName = path.basename(file, ext);
                    const { originalUrl, previewUrl } = buildImageUrls(categoryName, fileName, ext.substring(1));
                    
                    const imageInfo = {
                        name: fileName,
                        original: originalUrl,
                        preview: previewUrl,
                        category: categoryName
                    };
                    
                    // 提取EXIF信息
                    if (exifAvailable) {
                        console.log(`提取EXIF信息: ${file}`);
                        const exifInfo = extractExifInfo(filePath);
                        if (exifInfo) {
                            imageInfo.exif = exifInfo;
                        }
                    }
                    
                    images.push(imageInfo);
                    totalImages++;
                }
            }
        }
        
        // 按文件名排序
        images.sort((a, b) => a.name.localeCompare(b.name));
        
        gallery[categoryName] = {
            name: categoryName,
            images: images,
            count: images.length
        };
        
        console.log(`  完成分类 ${categoryName}，共 ${images.length} 张图片`);
    }
    
    // 生成最终的JSON结构
    const output = {
        gallery: gallery,
        total_images: totalImages,
        generated_at: new Date().toISOString()
    };
    
    // 写入文件
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    
    console.log();
    console.log("========================================");
    console.log("索引生成完成！");
    console.log(`总图片数: ${totalImages}`);
    console.log(`输出文件: ${OUTPUT_FILE}`);
    if (exifAvailable) {
        console.log("✓ 已提取EXIF信息");
    } else {
        console.log("⚠ 未提取EXIF信息 (需要安装exiftool)");
    }
    console.log("========================================");
}

// 运行主函数
try {
    generateGalleryIndex();
} catch (error) {
    console.error("生成索引时发生错误:", error.message);
    process.exit(1);
} 