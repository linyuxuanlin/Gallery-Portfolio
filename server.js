const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
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
    const images = await s3Client.send(new ListObjectsCommand({ 
      Bucket: BUCKET_NAME, 
      Prefix: IMAGE_DIR 
    }));
    
    console.log(`找到 ${images.Contents?.length || 0} 个对象`);
    
    // 按文件夹分类图片
    const imageMap = new Map();
    images.Contents
      .filter(item => {
        const itemExtension = path.extname(item.Key).toLowerCase();
        return validImageExtensions.includes(itemExtension);
      })
      .forEach(item => {
        const parts = item.Key.split('/');
        // 忽略 0_preview 文件夹
        if (parts.includes('0_preview')) {
          console.log(`跳过缩略图: ${item.Key}`);
          return;
        }
        
        // 获取文件夹名，如果没有文件夹则归类为 'all'
        const folder = parts.length > 2 ? parts[1] : 'all';
        if (!imageMap.has(folder)) {
          imageMap.set(folder, []);
        }
        
        // 构建缩略图路径：按原图所在文件夹分类
        // 此处不需要构建完整路径，只需提供相对路径供 /thumbnail 路由使用
        const thumbnailPath = `/thumbnail/${encodeURIComponent(item.Key)}`;
        
        console.log(`添加图片: ${item.Key}, 文件夹: ${folder}`);
        
        imageMap.get(folder).push({
          original: `${IMAGE_BASE_URL}/${item.Key}`,
          thumbnail: thumbnailPath
        });
      });

    // 将分类结果转换为对象
    const result = {};
    for (const [folder, images] of imageMap.entries()) {
      result[folder] = images;
      console.log(`文件夹 "${folder}" 包含 ${images.length} 张图片`);
    }
    
    console.log('图片列表已发送到客户端');
    res.json(result);
  } catch (error) {
    console.error('获取图片列表失败:', error);
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
    // 检查路径格式，确保正确提取文件夹名
    // 示例: "gallery/folder/image.jpg" -> folder
    // 示例: "folder/image.jpg" -> folder
    folderName = keyParts.length > 2 ? keyParts[1] : (keyParts.length > 1 ? keyParts[0] : 'all');
    
    // 打印诊断信息，并发送通知
    const logMessage = `原始路径: ${path.basename(key)}, 文件夹: ${folderName}`;
    console.log(logMessage);
  }
  
  // 构建缩略图存储路径
  const thumbnailKey = `${IMAGE_DIR}/0_preview/${folderName}/${path.basename(key)}`;
  console.log(`构建的缩略图路径: ${thumbnailKey}`);
  
  try {
    // 检查缩略图是否存在
    console.log(`检查缩略图是否存在: ${thumbnailKey}`);
    await s3Client.send(new HeadObjectCommand({ 
      Bucket: BUCKET_NAME, 
      Key: thumbnailKey 
    }));
    console.log(`缩略图已存在，重定向到: ${IMAGE_BASE_URL}/${thumbnailKey}`);
    
    res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
  } catch (error) {
    if (error.name === 'NotFound') {
      console.log(`缩略图不存在，需要创建: ${thumbnailKey}`);
      const fileName = path.basename(key);
      sendNotification(`正在生成缩略图: ${fileName}`);
      
      // 如果不存在，生成缩略图
      try {
        console.log(`开始获取原图: ${key}`);
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
        console.log(`原图获取成功，大小: ${imageBuffer.length} 字节`);

        console.log(`处理图片中...`);
        const sharpInstance = sharp(imageBuffer).resize(200).withMetadata();
        if (IMAGE_COMPRESSION_QUALITY >= 0 && IMAGE_COMPRESSION_QUALITY <= 100) {
          sharpInstance.jpeg({ quality: IMAGE_COMPRESSION_QUALITY });
        }

        const thumbnailBuffer = await sharpInstance.toBuffer();
        console.log(`缩略图生成成功，大小: ${thumbnailBuffer.length} 字节`);
        
        // 在 S3/R2 中，"目录"只是对象键的前缀，不需要显式创建
        // 直接上传缩略图，S3 会自动处理前缀路径
        console.log(`上传缩略图: ${thumbnailKey}`);
        
        // 使用 Upload 类处理上传，解决流长度未知的问题
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
        
        // 发送缩略图生成完成的通知
        sendNotification(`缩略图生成完成: ${fileName}`);

        console.log(`重定向到缩略图: ${IMAGE_BASE_URL}/${thumbnailKey}`);
        res.redirect(`${IMAGE_BASE_URL}/${thumbnailKey}`);
      } catch (imageError) {
        console.error(`处理图片失败 (${key}): ${imageError.message}`, imageError);
        console.error(`错误栈: ${imageError.stack}`);
        // 发送缩略图生成失败的通知
        sendNotification(`缩略图生成失败: ${fileName}`);
        res.status(500).send(`处理图片失败: ${imageError.message}`);
      }
    } else {
      console.error(`检查缩略图失败 (${thumbnailKey}): ${error.message}`, error);
      console.error(`错误栈: ${error.stack}`);
      // 发送检查缩略图失败的通知
      sendNotification(`缩略图生成失败: ${path.basename(key)}`);
      res.status(500).send(`检查缩略图失败: ${error.message}`);
    }
  }
});

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
