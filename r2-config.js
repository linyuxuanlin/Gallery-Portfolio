/**
 * Cloudflare R2 配置文件
 * 用于管理R2存储桶的设置和连接
 */

module.exports = {
    // R2存储桶配置
    r2: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucketName: process.env.R2_BUCKET_NAME || 'wiki-media',
        endpoint: process.env.R2_ENDPOINT || 'https://your-account-id.r2.cloudflarestorage.com',
        region: process.env.R2_REGION || 'auto'
    },
    
    // 图片URL配置
    images: {
        baseUrl: process.env.R2_IMAGE_BASE_URL || 'https://media.wiki-power.com',
        galleryPath: process.env.R2_IMAGE_DIR || 'gallery',
        previewPath: `${process.env.R2_IMAGE_DIR || 'gallery'}/0_preview`
    },
    
    // 支持的图片格式
    supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
    
    // 目录结构配置
    directories: {
        // 要扫描的目录前缀
        scanPrefix: `${process.env.R2_IMAGE_DIR || 'gallery'}/`,
        // 要跳过的目录
        skipDirectories: ['0_preview']
    }
}; 