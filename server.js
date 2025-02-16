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
  const getObjectParams = {
    Bucket: BUCKET_NAME,
    Key: key,
  };
  const imageBuffer = await s3Client.send(new GetObjectCommand(getObjectParams)).then(response => {
    return new Promise((resolve, reject) => {
      const chunks = [];
      response.Body.on('data', (chunk) => chunks.push(chunk));
      response.Body.on('end', () => resolve(Buffer.concat(chunks)));
      response.Body.on('error', reject);
    });
  });
  const parser = exifParser.create(imageBuffer);
  const exifData = parser.parse().tags;
  return {
    FNumber: exifData.FNumber,
    ExposureTime: exifData.ExposureTime,
    ISO: exifData.ISO,
  };
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
  // 定义预览图的格式，可选 'webp'、'heif' 或 'jpeg'（默认使用 webp）
  const previewFormat = process.env.IMAGE_PREVIEW_FORMAT || 'webp';
  // 根据预览图格式设置文件扩展名：如果为 jpeg，则使用原始扩展名，否则替换为相应格式
  const newExt = (previewFormat === 'jpeg') ? path.extname(key) : `.${previewFormat}`;
  const thumbnailKey = `${IMAGE_DIR}/preview/${path.basename(key, path.extname(key))}${newExt}`;

  try {
    // 检查缩略图是否存在
    await s3Client.send(new HeadObjectCommand({ 
      Bucket: BUCKET_NAME, 
      Key: thumbnailKey 
    }));
    res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
  } catch (error) {
    if (error.name === 'NotFound') {
      // 如果预览图不存在，则生成
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
      
      // 根据预览图格式选择相应的压缩方式（并设置压缩质量）
      if (IMAGE_COMPRESSION_QUALITY >= 0 && IMAGE_COMPRESSION_QUALITY <= 100) {
        if (previewFormat === 'webp') {
          sharpInstance.webp({ quality: IMAGE_COMPRESSION_QUALITY });
        } else if (previewFormat === 'heif') {
          sharpInstance.heif({ quality: IMAGE_COMPRESSION_QUALITY });
        } else {
          sharpInstance.jpeg({ quality: IMAGE_COMPRESSION_QUALITY });
        }
      }

      const thumbnailBuffer = await sharpInstance.toBuffer();

      // 根据生成的格式设置 Content-Type
      let contentType = 'image/jpeg';
      if (previewFormat === 'webp') {
        contentType = 'image/webp';
      } else if (previewFormat === 'heif') {
        contentType = 'image/heif';
      }

      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: contentType,
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
