const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const dotenv = require('dotenv');
const path = require('path');
const exifParser = require('exif-parser');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const s3Client = new S3Client({
  region: process.env.R2_REGION,
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  tls: true,
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const IMAGE_BASE_URL = process.env.R2_IMAGE_BASE_URL;
const IMAGE_DIR = process.env.R2_IMAGE_DIR;
const IMAGE_COMPRESSION_QUALITY = parseInt(process.env.IMAGE_COMPRESSION_QUALITY, 10) || 80;
// 是否使用WebP格式，默认为true
const USE_WEBP = process.env.USE_WEBP !== 'false';
// 缩略图尺寸，默认为250像素（稍微增大了一点以提高清晰度）
const THUMBNAIL_SIZE = parseInt(process.env.THUMBNAIL_SIZE, 10) || 250;

const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

// 智能压缩分析函数 - 根据图像内容确定最佳压缩参数
async function analyzeImageForCompression(imageBuffer) {
  try {
    // 获取图像元数据
    const metadata = await sharp(imageBuffer).metadata();
    
    // 记录原始方向信息（如果存在）
    if (metadata.orientation) {
      console.log(`检测到图像方向信息: orientation=${metadata.orientation}`);
    }
    
    // 根据图像尺寸和格式确定基础质量
    let baseQuality = IMAGE_COMPRESSION_QUALITY;
    
    // 分析图像复杂度（简单实现）
    const stats = await sharp(imageBuffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // 计算图像复杂度的简单指标（标准差）
    const pixels = new Uint8Array(stats.data);
    let sum = 0, sumSquared = 0;
    for (let i = 0; i < pixels.length; i++) {
      sum += pixels[i];
      sumSquared += pixels[i] * pixels[i];
    }
    const mean = sum / pixels.length;
    const variance = sumSquared / pixels.length - mean * mean;
    const complexity = Math.sqrt(variance) / 255;
    
    // 根据复杂度调整质量
    // 复杂图像需要更高质量，简单图像可以使用较低质量
    let adjustedQuality;
    if (complexity > 0.2) {
      // 复杂图像（如风景、细节多的图像）
      adjustedQuality = Math.min(baseQuality + 10, 90);
    } else if (complexity < 0.1) {
      // 简单图像（如图标、单色背景）
      adjustedQuality = Math.max(baseQuality - 15, 60);
    } else {
      // 中等复杂度图像
      adjustedQuality = baseQuality;
    }
    
    console.log(`图像分析: 尺寸=${metadata.width}x${metadata.height}, 复杂度=${complexity.toFixed(2)}, 调整质量=${adjustedQuality}`);
    
    return {
      quality: adjustedQuality,
      isPhoto: complexity > 0.15, // 估计是照片还是图形
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    };
  } catch (error) {
    console.error('图像分析失败:', error);
    // 返回默认值
    return {
      quality: IMAGE_COMPRESSION_QUALITY,
      isPhoto: true,
      width: 0,
      height: 0,
      format: 'unknown'
    };
  }
}

async function getExifData(key) {
  try {
    console.log(`获取EXIF数据: ${key}`);
    const getObjectParams = {
      Bucket: BUCKET_NAME,
      Key: key,
    };
    
    // 添加超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('获取图片数据超时')), 5000);
    });
    
    // 获取图片数据，添加超时限制
    const imageBufferPromise = s3Client.send(new GetObjectCommand(getObjectParams)).then(response => {
      return new Promise((resolve, reject) => {
        const chunks = [];
        response.Body.on('data', (chunk) => chunks.push(chunk));
        response.Body.on('end', () => resolve(Buffer.concat(chunks)));
        response.Body.on('error', reject);
      });
    });
    
    // 使用 Promise.race 确保请求不会挂起太久
    const imageBuffer = await Promise.race([imageBufferPromise, timeoutPromise]);
    
    // 添加错误处理
    try {
      // 检查图片格式是否支持EXIF
      const isJpeg = key.toLowerCase().endsWith('.jpg') || key.toLowerCase().endsWith('.jpeg');
      if (!isJpeg) {
        console.log(`图片格式不支持EXIF: ${key}`);
        return {
          FNumber: null,
          ExposureTime: null,
          ISO: null,
        };
      }
      
      const parser = exifParser.create(imageBuffer);
      const exifData = parser.parse().tags;
      
      // 返回整理后的EXIF数据
      return {
        FNumber: exifData.FNumber ? parseFloat(exifData.FNumber.toFixed(1)) : null,
        ExposureTime: exifData.ExposureTime ? parseFloat(exifData.ExposureTime.toFixed(4)) : null,
        ISO: exifData.ISO || null,
      };
    } catch (exifError) {
      console.warn(`无法解析EXIF数据(${key}): ${exifError.message}`);
      return {
        FNumber: null,
        ExposureTime: null,
        ISO: null,
      };
    }
  } catch (error) {
    console.error(`获取图片EXIF数据失败(${key}): ${error.message}`);
    // 返回空数据但不影响整体流程
    return {
      FNumber: null,
      ExposureTime: null,
      ISO: null,
      error: error.message
    };
  }
}

app.use(express.static('public'));

app.get('/images', async (req, res) => {
  try {
    const images = await s3Client.send(new ListObjectsCommand({ 
      Bucket: BUCKET_NAME, 
      Prefix: IMAGE_DIR 
    }));
    
    // 按文件夹分类图片
    const imageMap = new Map();
    images.Contents
      .filter(item => {
        const itemExtension = path.extname(item.Key).toLowerCase();
        return validImageExtensions.includes(itemExtension);
      })
      .forEach(item => {
        const parts = item.Key.split('/');
        // 忽略 preview 文件夹
        if (parts.includes('preview')) return;
        
        // 获取文件夹名，如果没有文件夹则归类为 'all'
        const folder = parts.length > 2 ? parts[1] : 'all';
        if (!imageMap.has(folder)) {
          imageMap.set(folder, []);
        }
        
        // 构建原始URL和缩略图URL
        const originalUrl = `${IMAGE_BASE_URL}/${item.Key}`;
        let thumbnailUrl;
        
        // 根据是否使用WebP格式生成不同的缩略图URL
        const fileBase = path.basename(item.Key, path.extname(item.Key));
        if (USE_WEBP) {
          thumbnailUrl = `${IMAGE_BASE_URL}/${IMAGE_DIR}/preview/${fileBase}.webp`;
        } else {
          thumbnailUrl = `${IMAGE_BASE_URL}/${IMAGE_DIR}/preview/${path.basename(item.Key)}`;
        }
        
        imageMap.get(folder).push({
          original: originalUrl,
          thumbnail: thumbnailUrl
        });
      });

    // 将分类结果转换为对象
    const result = {};
    for (const [folder, images] of imageMap.entries()) {
      result[folder] = images;
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error loading images:', error);
    res.status(500).send('Error loading images');
  }
});

app.get('/thumbnail/:key', async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const fileBase = path.basename(key, path.extname(key));
  
  // 构建缩略图存储路径：可能是WebP格式或原始格式
  let thumbnailKey;
  if (USE_WEBP) {
    thumbnailKey = `${IMAGE_DIR}/preview/${fileBase}.webp`;
  } else {
    thumbnailKey = `${IMAGE_DIR}/preview/${path.basename(key)}`;
  }
  
  console.log(`处理缩略图请求: 原图=${key}, 缩略图=${thumbnailKey}`);
  
  try {
    // 检查缩略图是否存在
    await s3Client.send(new HeadObjectCommand({ 
      Bucket: BUCKET_NAME, 
      Key: thumbnailKey 
    }));
    console.log(`缩略图已存在: ${thumbnailKey}`);
    res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
  } catch (error) {
    if (error.name === 'NotFound') {
      // 如果不存在，生成缩略图
      try {
        console.log(`缩略图不存在，准备生成: ${thumbnailKey}`);
        
        // 首先检查原始图片是否存在
        try {
          await s3Client.send(new HeadObjectCommand({ 
            Bucket: BUCKET_NAME, 
            Key: key 
          }));
        } catch (originalError) {
          if (originalError.name === 'NotFound') {
            console.error(`原始图片不存在: ${key}`);
            return res.status(404).send('原始图片不存在');
          }
          throw originalError;
        }
        
        // 获取原图数据
        const imageBuffer = await s3Client.send(new GetObjectCommand({ 
          Bucket: BUCKET_NAME, 
          Key: key 
        })).then(response => {
          return new Promise((resolve, reject) => {
            const chunks = [];
            response.Body.on('data', (chunk) => chunks.push(chunk));
            response.Body.on('end', () => resolve(Buffer.concat(chunks)));
            response.Body.on('error', reject);
          });
        });

        // 分析图像并确定最佳压缩参数
        const compressionParams = await analyzeImageForCompression(imageBuffer);
        
        // 基础图像处理 - 调整大小并保留元数据
        let sharpInstance = sharp(imageBuffer).resize(THUMBNAIL_SIZE);
        
        // 修改：保留原图的所有元数据，包括旋转方向信息
        sharpInstance = sharpInstance.withMetadata();
        
        // 优化：对于某些图像可以适当锐化以提高缩略图清晰度
        if (compressionParams.isPhoto) {
          sharpInstance = sharpInstance.sharpen({
            sigma: 1.0,
            m1: 0.2,
            m2: 0.7
          });
        }
        
        let thumbnailBuffer;
        let contentType;
        
        // 根据配置选择输出格式
        if (USE_WEBP) {
          // 使用WebP格式
          thumbnailBuffer = await sharpInstance.webp({ 
            quality: compressionParams.quality,
            effort: 4,  // 压缩效果与速度的平衡（0-6，值越高压缩效果越好但越慢）
            nearLossless: compressionParams.isPhoto ? false : true // 非照片使用近无损压缩
          }).toBuffer();
          contentType = 'image/webp';
        } else {
          // 使用JPEG格式
          thumbnailBuffer = await sharpInstance.jpeg({ 
            quality: compressionParams.quality,
            progressive: true,  // 使用渐进式JPEG
            optimizeScans: true // 优化扫描
          }).toBuffer();
          contentType = 'image/jpeg';
        }

        // 确保preview目录存在（如果使用的是本地文件系统）
        // 对于S3/R2存储这一步不是必需的
        
        // 保存到存储
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000' // 缓存一年
        }));

        // 输出压缩信息
        const originalSize = imageBuffer.length;
        const compressedSize = thumbnailBuffer.length;
        const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
        console.log(`缩略图生成完成: ${key} -> ${thumbnailKey}`);
        console.log(`压缩率: ${ratio}%, 原始: ${(originalSize/1024).toFixed(1)}KB, 压缩后: ${(compressedSize/1024).toFixed(1)}KB`);
        console.log(`元数据处理: 已保留原始方向信息`);

        res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
      } catch (genError) {
        console.error(`生成缩略图失败(${key}):`, genError);
        res.status(500).send(`生成缩略图失败: ${genError.message}`);
      }
    } else {
      console.error(`访问缩略图出错(${key}):`, error);
      res.status(500).send(`访问缩略图出错: ${error.message}`);
    }
  }
});

app.get('/exif/:key', async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  try {
    const exifData = await getExifData(key);
    res.json(exifData);
  } catch (error) {
    console.error('Error getting EXIF data:', error);
    res.status(500).send('Error getting EXIF data');
  }
});

app.get('/config', (req, res) => {
  res.json({ 
    IMAGE_BASE_URL: process.env.R2_IMAGE_BASE_URL,
    USE_WEBP: USE_WEBP
  });
});

// 添加一个API端点用于获取缩略图状态
app.get('/thumbnail-status', (req, res) => {
  res.json({
    format: USE_WEBP ? 'WebP' : 'JPEG',
    size: THUMBNAIL_SIZE,
    baseQuality: IMAGE_COMPRESSION_QUALITY,
    adaptiveCompression: true,
    sharpening: true
  });
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
  console.log(`缩略图格式: ${USE_WEBP ? 'WebP' : 'JPEG'}, 宽度: ${THUMBNAIL_SIZE}px`);
});
