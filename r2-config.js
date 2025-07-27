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
        bucketName: 'wiki-media',
        endpoint: process.env.R2_ENDPOINT || 'https://your-account-id.r2.cloudflarestorage.com'
    },
    
    // 图片URL配置
    images: {
        baseUrl: 'https://media.wiki-power.com',
        galleryPath: 'gallery',
        previewPath: 'gallery/0_preview'
    },
    
    // 支持的图片格式
    supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
    
    // 目录结构配置
    directories: {
        // 要扫描的目录前缀
        scanPrefix: 'gallery/',
        // 要跳过的目录
        skipDirectories: ['0_preview']
    }
}; 