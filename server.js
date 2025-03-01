const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const dotenv = require('dotenv');
const path = require('path');
const exifParser = require('exif-parser');
const { Mutex } = require('async-mutex');

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
const IMAGE_COMPRESSION_QUALITY = parseInt(process.env.IMAGE_COMPRESSION_QUALITY, 10);
const THUMB_CONCURRENT_LIMIT = 3;
const mutex = new Mutex();

let thumbnailQueue = [];
let activeGenerations = 0;
const maxConcurrent = THUMB_CONCURRENT_LIMIT;

const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

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
        imageMap.get(folder).push({
          original: `${IMAGE_BASE_URL}/${item.Key}`,
          thumbnail: `${IMAGE_BASE_URL}/${IMAGE_DIR}/preview/${path.basename(item.Key)}`
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
  const thumbnailKey = `${IMAGE_DIR}/preview/${path.basename(key).split('.')[0]}.webp`;
  
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
      console.log(`缩略图不存在，添加到生成队列: ${thumbnailKey}`);
      
      // 将任务添加到队列，并返回一个Promise
      const taskPromise = new Promise((resolve, reject) => {
        const task = {
          key,
          thumbnailKey,
          resolve,
          reject
        };
        
        thumbnailQueue.push(task);
        processQueue(); // 处理队列
      });
      
      try {
        // 等待任务完成
        await taskPromise;
        console.log(`缩略图生成完成: ${thumbnailKey}`);
        res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
      } catch (err) {
        console.error(`缩略图生成失败: ${err.message}`);
        res.status(500).send('Error generating thumbnail');
      }
    } else {
      console.error(`检查缩略图时出错: ${error.message}`);
      res.status(500).send('Error checking thumbnail');
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

async function processQueue() {
  await mutex.runExclusive(async () => {
    while (thumbnailQueue.length > 0 && activeGenerations < maxConcurrent) {
      const task = thumbnailQueue.shift();
      activeGenerations++;
      
      generateThumbnail(task.key, task.thumbnailKey)
        .then(result => {
          task.resolve(result);
          activeGenerations--;
          processQueue();
        })
        .catch(err => {
          task.reject(err);
          activeGenerations--;
          processQueue();
        });
    }
  });
}

async function generateThumbnail(originalKey, thumbnailKey) {
  console.log(`开始生成缩略图: ${thumbnailKey} (原图: ${originalKey})`);
  
  try {
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

    const sharpInstance = sharp(imageBuffer)
      .resize(300)
      .withMetadata();
    
    const { entropy } = await sharpInstance.stats();
    
    let quality = 75;
    if (entropy > 7) {
      quality = 85;
    } else if (entropy < 5) {
      quality = 65;
    }
    
    console.log(`图片复杂度(熵值): ${entropy}, 设置WebP质量: ${quality}`);
    
    const thumbnailBuffer = await sharpInstance.webp({ 
      quality: quality,
      effort: 4,
      nearLossless: false
    }).toBuffer();
    
    const compressionRatio = (thumbnailBuffer.length / imageBuffer.length * 100).toFixed(2);
    console.log(`缩略图生成完成，大小: ${(thumbnailBuffer.length/1024).toFixed(2)}KB, 压缩率: ${compressionRatio}%`);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/webp',
    }));
    
    return thumbnailKey;
  } catch (error) {
    console.error(`生成缩略图失败 (${originalKey}): ${error.message}`);
    throw error;
  }
}
