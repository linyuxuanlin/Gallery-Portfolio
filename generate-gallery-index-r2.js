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
            region: 'auto',
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
 * 按分类组织文件
 */
function organizeFilesByCategory(files) {
    const categories = {};
    
    files.forEach(file => {
        const fileInfo = parseFilePath(file.Key);
        if (!fileInfo) return;
        
        const { category, baseName, fileExt } = fileInfo;
        
        if (!categories[category]) {
            categories[category] = [];
        }
        
        // 跳过指定目录
        if (DIRECTORY_CONFIG.skipDirectories.includes(category)) return;
        
        const urls = generateImageUrls(fileInfo);
        
        categories[category].push({
            name: baseName,
            original: urls.original,
            preview: urls.preview,
            category: category,
            // 注意：从R2无法直接获取EXIF信息，需要额外的处理
            exif: null
        });
    });
    
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
    const requiredEnvVars = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('错误: 缺少必要的环境变量:');
        missingVars.forEach(varName => console.error(`  - ${varName}`));
        console.error('\n请设置以下环境变量:');
        console.error('CLOUDFLARE_ACCOUNT_ID: Cloudflare账户ID');
        console.error('R2_ACCESS_KEY_ID: R2访问密钥ID');
        console.error('R2_SECRET_ACCESS_KEY: R2访问密钥');
        console.error('R2_ENDPOINT: R2端点URL (可选)');
        process.exit(1);
    }
    
    try {
        console.log('正在从R2获取文件列表...');
        const files = await listR2Files();
        
        if (files.length === 0) {
            console.log('未找到任何文件');
            return;
        }
        
        console.log(`找到 ${files.length} 个文件`);
        
        console.log('正在按分类组织文件...');
        const categories = organizeFilesByCategory(files);
        
        console.log('正在生成gallery-index.json...');
        const galleryData = generateGalleryIndex(categories);
        
        // 写入文件
        const outputFile = 'gallery-index.json';
        fs.writeFileSync(outputFile, JSON.stringify(galleryData, null, 2));
        
        console.log('========================================');
        console.log('索引生成完成！');
        console.log(`总图片数: ${galleryData.total}`);
        console.log(`输出文件: ${outputFile}`);
        console.log('分类列表:');
        Object.keys(categories).forEach(category => {
            console.log(`  - ${category}: ${categories[category].length} 张图片`);
        });
        console.log('========================================');
        
    } catch (error) {
        console.error('生成索引失败:', error);
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