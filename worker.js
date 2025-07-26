import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import exifParser from 'exif-parser';

// Cloudflare Workers 环境变量
const R2_REGION = 'auto';
const R2_ENDPOINT = 'https://your-endpoint.r2.cloudflarestorage.com';
const R2_ACCESS_KEY_ID = 'your-access-key-id';
const R2_SECRET_ACCESS_KEY = 'your-secret-access-key';
const BUCKET_NAME = 'your-bucket-name';
const IMAGE_BASE_URL = 'https://your-image-base-url.com';
const IMAGE_DIR = 'gallery';
const IMAGE_COMPRESSION_QUALITY = 100;

const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

const s3Client = new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  tls: true,
});

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

async function generateThumbnail(originalKey, thumbnailKey) {
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
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 设置 CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 静态文件服务
    if (path === '/' || path === '/index.html') {
      const html = await fetch('https://raw.githubusercontent.com/your-repo/Gallery-Portfolio/main/public/index.html');
      return new Response(await html.text(), {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    if (path.startsWith('/assets/') || path.startsWith('/styles.css') || path.startsWith('/gallery.css') || 
        path.startsWith('/gallery.js') || path.startsWith('/layout.js') || path.startsWith('/exif.js')) {
      const filePath = path.startsWith('/assets/') ? path : path.substring(1);
      const fileUrl = `https://raw.githubusercontent.com/your-repo/Gallery-Portfolio/main/public/${filePath}`;
      const response = await fetch(fileUrl);
      const contentType = getContentType(path);
      return new Response(await response.text(), {
        headers: { ...corsHeaders, 'Content-Type': contentType }
      });
    }

    // API 路由
    if (path === '/images') {
      try {
        console.log('获取图片列表...');
        
        const imageMap = new Map();
        let continuationToken = undefined;
        let totalImages = 0;
        
        do {
          const images = await s3Client.send(new ListObjectsV2Command({ 
            Bucket: BUCKET_NAME, 
            Prefix: IMAGE_DIR,
            MaxKeys: 1000,
            ContinuationToken: continuationToken
          }));
          
          const currentBatchSize = images.Contents?.length || 0;
          totalImages += currentBatchSize;
          console.log(`本次获取 ${currentBatchSize} 个对象，累计总数：${totalImages}`);
          
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
          
          continuationToken = images.IsTruncated ? images.NextContinuationToken : undefined;
          
        } while (continuationToken);
        
        const result = {};
        for (const [folder, images] of imageMap.entries()) {
          result[folder] = images;
          console.log(`文件夹 "${folder}" 包含 ${images.length} 张图片`);
        }
        
        console.log(`处理完成：总共 ${totalImages} 个对象，${Object.keys(result).length} 个文件夹`);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('获取图片列表失败:', error.message);
        return new Response('获取图片列表失败', { 
          status: 500,
          headers: corsHeaders
        });
      }
    }

    if (path.startsWith('/thumbnail/')) {
      const key = decodeURIComponent(path.substring('/thumbnail/'.length));
      console.log(`请求缩略图: ${key}`);
      
      const keyParts = key.split('/');
      let folderName = 'all';
      
      if (keyParts.length > 1) {
        folderName = keyParts.length > 2 ? keyParts[1] : (keyParts.length > 1 ? keyParts[0] : 'all');
      }
      
      const thumbnailKey = `${IMAGE_DIR}/0_preview/${folderName}/${path.basename(key)}`;
      console.log(`构建的缩略图路径: ${thumbnailKey}`);
      
      const thumbnailUrl = `${IMAGE_BASE_URL}/${thumbnailKey}`;
      console.log(`返回缩略图URL: ${thumbnailUrl}`);
      
      // 异步检查并生成缩略图
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
          });
        }
      }
      
      return Response.redirect(thumbnailUrl, 302);
    }

    if (path.startsWith('/exif/')) {
      const key = decodeURIComponent(path.substring('/exif/'.length));
      console.log(`请求EXIF数据: ${key}`);
      
      let processedKey = key;
      if (key.startsWith(IMAGE_BASE_URL)) {
        processedKey = key.replace(IMAGE_BASE_URL + '/', '');
        console.log(`从完整URL提取路径: ${processedKey}`);
      }
      
      try {
        console.log(`处理的EXIF路径: ${processedKey}`);
        const exifData = await getExifData(processedKey);
        console.log(`EXIF数据获取成功: ${JSON.stringify(exifData)}`);
        return new Response(JSON.stringify(exifData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error(`获取EXIF数据失败(${processedKey}): ${error.message}`);
        return new Response(JSON.stringify({
          error: error.message,
          FNumber: null,
          ExposureTime: null,
          ISO: null
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (path === '/config') {
      return new Response(JSON.stringify({ IMAGE_BASE_URL }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 404 处理
    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });
  }
};

function getContentType(path) {
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  return 'text/plain';
} 