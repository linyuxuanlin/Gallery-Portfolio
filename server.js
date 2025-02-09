const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const dotenv = require('dotenv');
const path = require('path');
const exifParser = require('exif-parser');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const helmet = require('helmet');

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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 100个请求
});

app.use(limiter);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:", process.env.R2_IMAGE_BASE_URL],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"]
        }
    }
}));

const cache = new NodeCache({ stdTTL: 600 }); // 10分钟缓存

async function checkAndCreateThumbnail(key) {
  const thumbnailKey = `${IMAGE_DIR}/preview/${path.basename(key)}`;
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: thumbnailKey }));
    return thumbnailKey;
  } catch (error) {
    if (error.name === 'NotFound') {
      const imageBuffer = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })).then(response => {
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

      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      return thumbnailKey;
    }
    console.error('Error in checkAndCreateThumbnail:', {
      key,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    });
    throw error;
  }
}

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
  const cachedImages = cache.get('images');
  if (cachedImages) {
    return res.json(cachedImages);
  }
  try {
    const images = await s3Client.send(new ListObjectsCommand({ Bucket: BUCKET_NAME, Prefix: IMAGE_DIR }));
    const imageUrls = await Promise.all(images.Contents.map(async (item) => {
      const itemExtension = path.extname(item.Key).toLowerCase();
      const isFile = item.Key.split('/').length === 2;
      if (!validImageExtensions.includes(itemExtension) || !isFile) {
        return null;
      }
      const thumbnailKey = await checkAndCreateThumbnail(item.Key);
      return {
        original: `${IMAGE_BASE_URL}/${item.Key}`,
        thumbnail: `${IMAGE_BASE_URL}/${thumbnailKey}`,
      };
    }));
    cache.set('images', imageUrls);
    res.json(imageUrls.filter(url => url !== null));
  } catch (error) {
    console.error('Error loading images:', error);
    res.status(500).send('Error loading images');
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

// 添加统一的错误处理中间件
app.use((err, req, res, next) => {
    console.error('错误:', err);
    res.status(500).json({
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
