const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const dotenv = require('dotenv');
const path = require('path');
const exifParser = require('exif-parser');
const { Semaphore } = require('async-mutex');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 创建多线程控制信号量，默认允许3个并发请求
const MAX_CONCURRENT_THUMBNAILS = 3;
const thumbnailSemaphore = new Semaphore(MAX_CONCURRENT_THUMBNAILS);

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
const IMAGE_COMPRESSION_QUALITY = parseInt(process.env.IMAGE_COMPRESSION_QUALITY, 10);

const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// 检测图片复杂度并返回适合的压缩质量
async function determineOptimalQuality(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    
    // 获取图片的宽高和格式
    const { width, height, format } = metadata;
    
    // 判断图片复杂度的简单算法
    // 1. 图片分辨率越高，适当降低质量以减小文件大小
    // 2. 不同格式采用不同的基准质量
    
    let baseQuality = 75; // 默认基础质量
    
    // 根据格式调整基础质量
    if (['jpeg', 'jpg'].includes(format)) {
      baseQuality = 75;
    } else if (format === 'png') {
      baseQuality = 80; // PNG通常需要较高质量
    } else if (format === 'webp') {
      baseQuality = 75; // WebP本身就有较好的压缩率
    }
    
    // 根据分辨率调整质量
    const resolution = width * height;
    
    if (resolution > 4000000) { // 超过400万像素
      baseQuality -= 10;
    } else if (resolution > 2000000) { // 超过200万像素
      baseQuality -= 5;
    }
    
    // 确保质量在合理范围内
    const finalQuality = Math.max(60, Math.min(baseQuality, 90));
    console.log(`图片[${width}x${height}]格式[${format}]计算得出最佳压缩质量: ${finalQuality}`);
    
    return finalQuality;
  } catch (error) {
    console.error('计算最佳压缩质量时出错:', error);
    return 75; // 出错时返回默认质量
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
        
        // 使用WebP格式的缩略图路径
        const originalBasename = path.basename(item.Key);
        const thumbnailBasename = path.parse(originalBasename).name + '.webp';
        
        imageMap.get(folder).push({
          original: `${IMAGE_BASE_URL}/${item.Key}`,
          thumbnail: `${IMAGE_BASE_URL}/${IMAGE_DIR}/preview/${thumbnailBasename}`
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
  const originalKey = `${IMAGE_DIR}/${key}`;
  
  // 为缩略图创建WebP文件名 (替换扩展名为.webp)
  const parsedKey = path.parse(key);
  const thumbnailKey = `${IMAGE_DIR}/preview/${parsedKey.name}.webp`;
  
  try {
    // 检查缩略图是否存在
    await s3Client.send(new HeadObjectCommand({ 
      Bucket: BUCKET_NAME, 
      Key: thumbnailKey 
    }));
    res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
  } catch (error) {
    if (error.name === 'NotFound') {
      try {
        // 使用信号量控制并发处理数量
        const release = await thumbnailSemaphore.acquire();
        console.log(`生成WebP缩略图: ${thumbnailKey}，当前并发数: ${MAX_CONCURRENT_THUMBNAILS - thumbnailSemaphore.getValue()}`);
        
        try {
          // 如果不存在，生成缩略图
          const imageBuffer = await s3Client.send(new GetObjectCommand({ 
            Bucket: BUCKET_NAME, 
            Key: originalKey 
          })).then(response => {
            return new Promise((resolve, reject) => {
              const chunks = [];
              response.Body.on('data', (chunk) => chunks.push(chunk));
              response.Body.on('end', () => resolve(Buffer.concat(chunks)));
              response.Body.on('error', reject);
            });
          });

          // 获取原始图片元数据
          const metadata = await sharp(imageBuffer).metadata();
          console.log(`原始图片[${metadata.width}x${metadata.height}]格式[${metadata.format}]大小[${(imageBuffer.length/1024).toFixed(2)}KB]`);
          
          // 确定最佳压缩质量
          const optimalQuality = await determineOptimalQuality(imageBuffer);
          
          // 创建缩略图，保留方向信息
          const sharpInstance = sharp(imageBuffer)
            .resize(300) // 增加缩略图尺寸为300像素宽度
            .withMetadata() // 保留元数据(包括方向信息)
            .webp({ quality: optimalQuality }); // 使用WebP格式，根据复杂度自动调整质量
          
          const thumbnailBuffer = await sharpInstance.toBuffer();
          
          console.log(`生成的WebP缩略图大小: ${(thumbnailBuffer.length/1024).toFixed(2)}KB，压缩率: ${((1 - thumbnailBuffer.length/imageBuffer.length) * 100).toFixed(2)}%`);
          
          // 上传到S3存储
          await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: thumbnailKey,
            Body: thumbnailBuffer,
            ContentType: 'image/webp',
          }));

          res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
        } finally {
          // 无论成功失败，都释放信号量
          release();
        }
      } catch (err) {
        console.error(`生成缩略图失败: ${err.message}`);
        res.status(500).send('生成缩略图失败');
      }
    } else {
      console.error(`获取缩略图失败: ${error.message}`);
      res.status(500).send('获取缩略图失败');
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
  res.json({ IMAGE_BASE_URL: process.env.R2_IMAGE_BASE_URL });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
