#!/usr/bin/env node

/**
 * 从Cloudflare R2存储桶生成图片索引
 * 支持从R2的wiki-media存储桶下的gallery目录获取文件列表
 */

const fs = require('fs');
const path = require('path');
const config = require('./r2-config');

// 从配置文件获取设置
const R2_CONFIG = config.r2;
const IMAGE_URL_CONFIG = config.images;
const SUPPORTED_FORMATS = config.supportedFormats;
const DIRECTORY_CONFIG = config.directories;

/**
 * 从R2获取文件列表
 */
async function listR2Files(prefix = DIRECTORY_CONFIG.scanPrefix) {
    try {
        const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
        
        const client = new S3Client({
            region: R2_CONFIG.region,
            endpoint: R2_CONFIG.endpoint,
            credentials: {
                accessKeyId: R2_CONFIG.accessKeyId,
                secretAccessKey: R2_CONFIG.secretAccessKey,
            },
        });

        const command = new ListObjectsV2Command({
            Bucket: R2_CONFIG.bucketName,
            Prefix: prefix,
            Delimiter: '/'
        });

        const response = await client.send(command);
        return response.Contents || [];
    } catch (error) {
        console.error('获取R2文件列表失败:', error);
        throw error;
    }
}

/**
 * 从R2下载文件并获取EXIF信息
 */
async function getExifFromR2(fileKey) {
    try {
        const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
        const { ExifTool } = require('node-exiftool');
        
        const client = new S3Client({
            region: R2_CONFIG.region,
            endpoint: R2_CONFIG.endpoint,
            credentials: {
                accessKeyId: R2_CONFIG.accessKeyId,
                secretAccessKey: R2_CONFIG.secretAccessKey,
            },
        });

        const command = new GetObjectCommand({
            Bucket: R2_CONFIG.bucketName,
            Key: fileKey
        });

        const response = await client.send(command);
        const imageBuffer = await response.Body.transformToByteArray();
        
        // 使用ExifTool提取EXIF信息
        const exifTool = new ExifTool.ExifTool({ taskTimeoutMillis: 5000 });
        
        try {
            const metadata = await exifTool.readMetadata(imageBuffer, ['-Aperture', '-ShutterSpeed', '-ISO', '-FocalLength', '-Model', '-LensModel', '-GPSLatitude', '-GPSLongitude', '-DateTimeOriginal']);
            
            if (metadata.error) {
                console.warn(`EXIF提取失败: ${fileKey}`, metadata.error);
                return null;
            }
            
            const exifData = metadata.data[0];
            const exif = {};
            
            if (exifData.Aperture) exif.aperture = exifData.Aperture;
            if (exifData.ShutterSpeed) exif.shutterSpeed = exifData.ShutterSpeed;
            if (exifData.ISO) exif.iso = exifData.ISO;
            if (exifData.FocalLength) exif.focalLength = exifData.FocalLength;
            if (exifData.Model) exif.camera = exifData.Model;
            if (exifData.LensModel) exif.lens = exifData.LensModel;
            if (exifData.GPSLatitude && exifData.GPSLongitude) {
                exif.gps = `${exifData.GPSLatitude}, ${exifData.GPSLongitude}`;
            }
            if (exifData.DateTimeOriginal) exif.dateTime = exifData.DateTimeOriginal;
            
            return Object.keys(exif).length > 0 ? exif : null;
            
        } finally {
            await exifTool.close();
        }
        
    } catch (error) {
        console.warn(`获取EXIF信息失败: ${fileKey}`, error.message);
        return null;
    }
}

/**
 * 解析文件路径获取分类和文件名
 */
function parseFilePath(filePath) {
    const parts = filePath.split('/');
    if (parts.length < 3) return null;
    
    const category = parts[1];
    const fileName = parts[parts.length - 1];
    const fileExt = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, fileExt);
    
    // 检查是否为图片文件
    if (!SUPPORTED_FORMATS.includes(fileExt)) return null;
    
    return {
        category,
        fileName,
        baseName,
        fileExt: fileExt.substring(1), // 去掉点号
        fullPath: filePath
    };
}

/**
 * 生成图片URL
 */
function generateImageUrls(fileInfo) {
    const { category, baseName, fileExt } = fileInfo;
    
    return {
        original: `${IMAGE_URL_CONFIG.baseUrl}/${IMAGE_URL_CONFIG.galleryPath}/${category}/${baseName}.${fileExt}`,
        preview: `${IMAGE_URL_CONFIG.baseUrl}/${IMAGE_URL_CONFIG.previewPath}/${category}/${baseName}.${fileExt}`
    };
}

/**
 * 按分类组织文件并获取EXIF信息
 */
async function organizeFilesByCategory(files) {
    const categories = {};
    
    console.log('正在处理文件并获取EXIF信息...');
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileInfo = parseFilePath(file.Key);
        if (!fileInfo) continue;
        
        const { category, baseName, fileExt } = fileInfo;
        
        if (!categories[category]) {
            categories[category] = [];
        }
        
        // 跳过指定目录
        if (DIRECTORY_CONFIG.skipDirectories.includes(category)) continue;
        
        const urls = generateImageUrls(fileInfo);
        
        // 获取EXIF信息
        let exifData = null;
        try {
            exifData = await getExifFromR2(file.Key);
            if (exifData) {
                console.log(`✓ 获取EXIF信息: ${baseName}.${fileExt}`);
            }
        } catch (error) {
            console.warn(`⚠ EXIF获取失败: ${baseName}.${fileExt}`);
        }
        
        categories[category].push({
            name: baseName,
            original: urls.original,
            preview: urls.preview,
            category: category,
            exif: exifData
        });
        
        // 显示进度
        if ((i + 1) % 10 === 0 || i === files.length - 1) {
            console.log(`处理进度: ${i + 1}/${files.length}`);
        }
    }
    
    return categories;
}

/**
 * 生成gallery-index.json
 */
function generateGalleryIndex(categories) {
    const galleryData = {
        gallery: {},
        total: 0
    };
    
    let totalImages = 0;
    
    Object.keys(categories).forEach(category => {
        const images = categories[category];
        totalImages += images.length;
        
        galleryData.gallery[category] = {
            name: category,
            images: images,
            count: images.length
        };
    });
    
    galleryData.total = totalImages;
    
    return galleryData;
}

/**
 * 主函数
 */
async function main() {
    console.log('========================================');
    console.log('从Cloudflare R2生成图片索引');
    console.log('========================================');
    
    // 检查环境变量
    const requiredEnvVars = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('错误: 缺少必要的环境变量:');
        missingVars.forEach(varName => console.error(`  - ${varName}`));
        console.error('\n请设置以下环境变量:');
        console.error('CLOUDFLARE_ACCOUNT_ID: Cloudflare账户ID');
        console.error('R2_ACCESS_KEY_ID: R2访问密钥ID');
        console.error('R2_SECRET_ACCESS_KEY: R2访问密钥');
        console.error('R2_BUCKET_NAME: R2存储桶名称');
        console.error('R2_ENDPOINT: R2端点URL (可选)');
        console.error('R2_REGION: R2区域 (可选，默认auto)');
        console.error('R2_IMAGE_BASE_URL: 图片基础URL (可选)');
        console.error('R2_IMAGE_DIR: 图片目录 (可选，默认gallery)');
        process.exit(1);
    }
    
    try {
        console.log('正在从R2获取文件列表...');
        console.log(`R2配置信息:`);
        console.log(`  - 存储桶: ${R2_CONFIG.bucketName}`);
        console.log(`  - 端点: ${R2_CONFIG.endpoint}`);
        console.log(`  - 区域: ${R2_CONFIG.region}`);
        console.log(`  - 扫描前缀: ${DIRECTORY_CONFIG.scanPrefix}`);
        
        const files = await listR2Files();
        
        if (files.length === 0) {
            console.log('未找到任何文件');
            return;
        }
        
        console.log(`找到 ${files.length} 个文件`);
        console.log('文件列表预览:');
        files.slice(0, 5).forEach(file => {
            console.log(`  - ${file.Key}`);
        });
        if (files.length > 5) {
            console.log(`  ... 还有 ${files.length - 5} 个文件`);
        }
        
        console.log('正在按分类组织文件...');
        const categories = await organizeFilesByCategory(files);
        
        console.log('正在生成gallery-index.json...');
        const galleryData = generateGalleryIndex(categories);
        
        // 写入文件
        const outputFile = 'gallery-index.json';
        fs.writeFileSync(outputFile, JSON.stringify(galleryData, null, 2));
        
        // 获取文件统计信息
        const stats = fs.statSync(outputFile);
        const fileSizeInKB = (stats.size / 1024).toFixed(2);
        
        console.log('========================================');
        console.log('索引生成完成！');
        console.log(`总图片数: ${galleryData.total}`);
        console.log(`输出文件: ${outputFile}`);
        console.log(`文件大小: ${fileSizeInKB} KB`);
        console.log(`生成时间: ${new Date().toLocaleString()}`);
        console.log('分类列表:');
        Object.keys(categories).forEach(category => {
            const categoryData = categories[category];
            const exifCount = categoryData.filter(img => img.exif).length;
            console.log(`  - ${category}: ${categoryData.length} 张图片 (${exifCount} 张包含EXIF信息)`);
        });
        console.log('========================================');
        
    } catch (error) {
        console.error('生成索引失败:', error);
        console.error('错误详情:', error.message);
        if (error.stack) {
            console.error('错误堆栈:', error.stack);
        }
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = {
    listR2Files,
    parseFilePath,
    generateImageUrls,
    organizeFilesByCategory,
    generateGalleryIndex
}; 