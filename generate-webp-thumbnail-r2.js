#!/usr/bin/env node
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

// 读取环境变量
const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_ACCOUNT_ID,
  R2_IMAGE_DIR // gallery 根目录，例如 "gallery"
} = process.env;

// 初始化 R2 客户端
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// 支持的图片扩展名
const supportedExtensions = [".jpg", ".jpeg", ".png"];

/**
 * 列出 R2 下的所有对象
 */
async function listFiles(prefix) {
  let continuationToken = undefined;
  const files = [];

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await s3.send(command);
    if (response.Contents) {
      files.push(...response.Contents);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

/**
 * 下载对象到 Buffer
 */
async function downloadFile(key) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await s3.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * 上传对象
 */
async function uploadFile(key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3.send(command);
}

/**
 * 主逻辑：生成预览图
 */
async function generatePreviews() {
  const allFiles = await listFiles(R2_IMAGE_DIR);

  // 筛选支持的图片，且不在 0_preview 中
  const imageFiles = allFiles.filter(file => {
    const key = file.Key.toLowerCase();
    return (
      supportedExtensions.some(ext => key.endsWith(ext)) &&
      !key.includes("/0_preview/")
    );
  });

  if (imageFiles.length === 0) {
    console.log("✅ 没有需要转换的图片。");
    return;
  }

  console.log(`开始处理 ${imageFiles.length} 张图片...\n`);

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const key = file.Key;
    const fileName = key.split("/").pop().split(".")[0];
    const previewKey = key.replace(R2_IMAGE_DIR, `${R2_IMAGE_DIR}/0_preview`).replace(/\.[^.]+$/, ".webp");

    try {
      // 检查是否已经存在预览图
      const previewFiles = await listFiles(previewKey);
      if (previewFiles.length > 0) {
        console.log(`⏩ 已存在预览图，跳过: ${previewKey}`);
        continue;
      }

      // 下载原图
      const buffer = await downloadFile(key);

      // 用 sharp 转换
      const webpBuffer = await sharp(buffer)
        .rotate()
        .withMetadata({ orientation: undefined })
        .webp({ quality: 1 })
        .toBuffer();

      // 上传回 R2
      await uploadFile(previewKey, webpBuffer, "image/webp");

      const percent = ((i + 1) / imageFiles.length * 100).toFixed(1);
      console.log(`✔️ (${i + 1}/${imageFiles.length}) ${percent}% - ${key} → ${previewKey}`);
    } catch (err) {
      console.error(`❌ 转换失败: ${key}`, err);
    }
  }

  console.log("\n✅ 全部预览图生成完成。");
}

// 执行
generatePreviews().catch(err => {
  console.error("运行出错:", err);
  process.exit(1);
});
