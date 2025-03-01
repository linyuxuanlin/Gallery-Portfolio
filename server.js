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
const IMAGE_COMPRESSION_QUALITY = parseInt(process.env.IMAGE_COMPRESSION_QUALITY, 10);

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
  const thumbnailKey = `${IMAGE_DIR}/preview/${path.basename(key)}`;
  
  try {
    // 检查缩略图是否存在
    await s3Client.send(new HeadObjectCommand({ 
      Bucket: BUCKET_NAME, 
      Key: thumbnailKey 
    }));
    res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
  } catch (error) {
    if (error.name === 'NotFound') {
      // 如果不存在，生成缩略图
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

      const sharpInstance = sharp(imageBuffer).resize(200).withMetadata();
      if (IMAGE_COMPRESSION_QUALITY >= 0 && IMAGE_COMPRESSION_QUALITY <= 100) {
        sharpInstance.jpeg({ quality: IMAGE_COMPRESSION_QUALITY });
      }

      const thumbnailBuffer = await sharpInstance.toBuffer();
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      }));

      res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
    } else {
      throw error;
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
