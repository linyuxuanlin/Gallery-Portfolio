const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const dotenv = require('dotenv');
const path = require('path');

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
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL;

const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

async function checkAndCreateThumbnail(key) {
  const thumbnailKey = `gallery/preview/${path.basename(key)}`;
  try {
    await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: thumbnailKey }));
    return thumbnailKey;
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      const imageBuffer = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })).then(response => {
        return new Promise((resolve, reject) => {
          const chunks = [];
          response.Body.on('data', (chunk) => chunks.push(chunk));
          response.Body.on('end', () => resolve(Buffer.concat(chunks)));
          response.Body.on('error', reject);
        });
      });

      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(200)
        .withMetadata()  // This ensures that all EXIF data is included
        .toBuffer();

      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      return thumbnailKey;
    }
    throw error;
  }
}

app.use(express.static('public'));

app.get('/images', async (req, res) => {
  try {
    const images = await s3Client.send(new ListObjectsCommand({ Bucket: BUCKET_NAME, Prefix: 'gallery/' }));
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
    res.json(imageUrls.filter(url => url !== null));
  } catch (error) {
    console.error('Error loading images:', error);
    res.status(500).send('Error loading images');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
