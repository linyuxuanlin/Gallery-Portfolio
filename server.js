const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const sharp = require('sharp');
const dotenv = require('dotenv');
const path = require('path');
const exifParser = require('exif-parser');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 存储所有的SSE客户端连接
const clients = [];

// 用于发送通知消息到所有连接的客户端
function sendNotification(message) {
  console.log(`通知消息: ${message}`);
  const notification = JSON.stringify({ message });
  
  // 发送到所有客户端
  clients.forEach(client => {
    try {
      client.write(`data: ${notification}\n\n`);
    } catch (error) {
      console.error('发送通知失败:', error);
    }
  });
}

// SSE endpoint
app.get('/notifications', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  
  const clientId = Date.now();
  clients.push(res);
  
  console.log(`客户端连接到通知服务: ${clientId}`);
  
  // 当客户端断开连接时移除它
  req.on('close', () => {
    console.log(`客户端断开连接: ${clientId}`);
    const index = clients.indexOf(res);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

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
    console.log('获取图片列表...');
    
    const imageMap = new Map();
    let continuationToken = undefined;
    let totalImages = 0;
    
    do {
      // 使用 ListObjectsV2Command 替代 ListObjectsCommand
      const images = await s3Client.send(new ListObjectsV2Command({ 
        Bucket: BUCKET_NAME, 
        Prefix: IMAGE_DIR,
        MaxKeys: 1000,
        ContinuationToken: continuationToken
      }));
      
      const currentBatchSize = images.Contents?.length || 0;
      totalImages += currentBatchSize;
      console.log(`本次获取 ${currentBatchSize} 个对象，累计总数：${totalImages}`);
      console.log(`NextContinuationToken: ${images.NextContinuationToken}`);
      console.log(`IsTruncated: ${images.IsTruncated}`);
      
      // 处理当前页的图片
      images.Contents
        .filter(item => {
          const itemExtension = path.extname(item.Key).toLowerCase();
          const isValidImage = validImageExtensions.includes(itemExtension);
          const isInPreviewFolder = item.Key.includes('/0_preview/');
          return isValidImage && !isInPreviewFolder;
        })
        .forEach(item => {
          const parts = item.Key.split('/');
          const folder = parts.length > 2 ? parts[1] : 'all';
          
          if (!imageMap.has(folder)) {
            imageMap.set(folder, []);
            console.log(`创建新文件夹: ${folder}`);
          }
          
          const thumbnailPath = `/thumbnail/${encodeURIComponent(item.Key)}`;
          imageMap.get(folder).push({
            original: `${IMAGE_BASE_URL}/${item.Key}`,
            thumbnail: thumbnailPath
          });
        });
      
      // 使用 IsTruncated 和 NextContinuationToken 来判断是否还有更多数据
      continuationToken = images.IsTruncated ? images.NextContinuationToken : undefined;
      
      if (images.IsTruncated) {
        console.log('还有更多数据需要获取...');
      } else {
        console.log('已获取所有数据');
      }
      
    } while (continuationToken);
    
    // 将分类结果转换为对象
    const result = {};
    for (const [folder, images] of imageMap.entries()) {
      result[folder] = images;
      console.log(`文件夹 "${folder}" 包含 ${images.length} 张图片`);
    }
    
    console.log(`处理完成：总共 ${totalImages} 个对象，${Object.keys(result).length} 个文件夹`);
    res.json(result);
    
  } catch (error) {
    console.error('获取图片列表失败:', error.message);
    console.error('错误详情:', error);
    res.status(500).send('获取图片列表失败');
  }
});

app.get('/thumbnail/:key', async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  console.log(`请求缩略图: ${key}`);
  
  // 解析原始图片的路径，从中提取文件夹结构
  const keyParts = key.split('/');
  let folderName = 'all'; // 默认为all
  
  // 提取文件夹名称 (改进路径解析逻辑)
  if (keyParts.length > 1) {
    folderName = keyParts.length > 2 ? keyParts[1] : (keyParts.length > 1 ? keyParts[0] : 'all');
  }
  
  // 构建缩略图存储路径
  const thumbnailKey = `${IMAGE_DIR}/0_preview/${folderName}/${path.basename(key)}`;
  console.log(`构建的缩略图路径: ${thumbnailKey}`);
  
  // 直接返回缩略图URL，不检查是否存在
  const thumbnailUrl = `${IMAGE_BASE_URL}/${thumbnailKey}`;
  console.log(`返回缩略图URL: ${thumbnailUrl}`);
  res.redirect(thumbnailUrl);

  // 异步检查并生成缩略图（如果不存在）
  try {
    await s3Client.send(new HeadObjectCommand({ 
      Bucket: BUCKET_NAME, 
      Key: thumbnailKey 
    }));
    console.log(`缩略图已存在: ${thumbnailKey}`);
  } catch (error) {
    if (error.name === 'NotFound') {
      console.log(`缩略图不存在，开始异步生成: ${thumbnailKey}`);
      generateThumbnail(key, thumbnailKey).catch(err => {
        console.error(`生成缩略图失败 (${key}): ${err.message}`);
        sendNotification(`缩略图生成失败: ${path.basename(key)}`);
      });
    }
  }
});

// 将缩略图生成逻辑抽取为独立函数
async function generateThumbnail(originalKey, thumbnailKey) {
  sendNotification(`正在生成缩略图: ${path.basename(originalKey)}`);
  
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
  
  console.log(`原图获取成功，大小: ${imageBuffer.length} 字节`);
  console.log(`处理图片中...`);
  
  const sharpInstance = sharp(imageBuffer).resize(200).withMetadata();
  if (IMAGE_COMPRESSION_QUALITY >= 0 && IMAGE_COMPRESSION_QUALITY <= 100) {
    sharpInstance.jpeg({ quality: IMAGE_COMPRESSION_QUALITY });
  }

  const thumbnailBuffer = await sharpInstance.toBuffer();
  console.log(`缩略图生成成功，大小: ${thumbnailBuffer.length} 字节`);
  
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
    }
  });
  
  await upload.done();
  console.log(`缩略图上传成功`);
  sendNotification(`缩略图生成完成: ${path.basename(originalKey)}`);
}

app.get('/exif/:key', async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  console.log(`请求EXIF数据: ${key}`);
  
  // 处理相对路径，确保我们有完整的存储桶路径
  let processedKey = key;
  if (key.startsWith(IMAGE_BASE_URL)) {
    // 如果是完整URL，提取路径部分
    processedKey = key.replace(IMAGE_BASE_URL + '/', '');
    console.log(`从完整URL提取路径: ${processedKey}`);
  }
  
  try {
    console.log(`处理的EXIF路径: ${processedKey}`);
    const exifData = await getExifData(processedKey);
    console.log(`EXIF数据获取成功: ${JSON.stringify(exifData)}`);
    res.json(exifData);
  } catch (error) {
    console.error(`获取EXIF数据失败(${processedKey}): ${error.message}`, error);
    console.error(`错误栈: ${error.stack}`);
    res.status(500).json({
      error: error.message,
      FNumber: null,
      ExposureTime: null,
      ISO: null
    });
  }
});

app.get('/config', (req, res) => {
  res.json({ IMAGE_BASE_URL: process.env.R2_IMAGE_BASE_URL });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

