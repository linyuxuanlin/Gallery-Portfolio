#!/usr/bin/env node

/**
 * 图片目录索引生成器 (Cloudflare R2版本)
 * 使用 S3 API 获取文件列表
 */

import fs from "fs";
import dotenv from "dotenv";
import { imagePaths, normalizeDirectory, publicObjectUrl } from "./scripts/image-paths.js";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

dotenv.config();

console.log("========================================");
console.log("图片目录索引生成器 (Cloudflare R2版)");
console.log("========================================");

// 配置
const OUTPUT_FILE = "gallery-index.json";
const BUCKET = process.env.R2_BUCKET_NAME;
const ENDPOINT = process.env.R2_ENDPOINT;
const REGION = process.env.R2_REGION || "auto";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const IMAGE_DIR = normalizeDirectory(process.env.R2_IMAGE_DIR); // R2 根目录下的父目录，比如 "gallery/"


// 初始化 S3 客户端
const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

// 从 R2 获取所有对象
async function listAllObjects(prefix) {
  let continuationToken = undefined;
  let allObjects = [];

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3.send(command);

    if (response.Contents) {
      allObjects = allObjects.concat(response.Contents);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return allObjects;
}

// 主函数
async function generateGalleryIndex() {
  for (const name of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_IMAGE_BASE_URL']) {
    if (!process.env[name]) throw new Error(`缺少配置: ${name}`);
  }
  console.log(`正在扫描 R2 存储桶: ${BUCKET}`);
  console.log(`输出文件: ${OUTPUT_FILE}`);
  console.log();

  const gallery = {};
  let totalImages = 0;

  // 获取所有对象
  const objects = await listAllObjects(IMAGE_DIR ? `${IMAGE_DIR}/` : '');

  // 按 "目录" 分类
  const categories = {};

  for (const obj of objects) {
    const key = obj.Key;
    if (!key) continue;

    const paths = imagePaths(key, IMAGE_DIR);
    if (!paths) continue;
    const categoryName = paths.category;
    const imageInfo = {
      name: paths.name,
      original: publicObjectUrl(process.env.R2_IMAGE_BASE_URL, paths.originalKey),
      preview: publicObjectUrl(process.env.R2_IMAGE_BASE_URL, paths.previewKey),
      category: categoryName,
      bytes: obj.Size,
    };

    if (!categories[categoryName]) {
      categories[categoryName] = [];
    }
    categories[categoryName].push(imageInfo);
    totalImages++;
  }

  // 整理分类数据
  for (const [categoryName, images] of Object.entries(categories)) {
    images.sort((a, b) => a.name.localeCompare(b.name));

    gallery[categoryName] = {
      name: categoryName,
      images: images,
      count: images.length,
    };

    console.log(`完成分类 ${categoryName}，共 ${images.length} 张图片`);
  }

  // 生成最终 JSON
  const output = {
    gallery: gallery,
    total_images: totalImages,
    generated_at: new Date().toISOString(),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log();
  console.log("========================================");
  console.log("索引生成完成！");
  console.log(`总图片数: ${totalImages}`);
  console.log(`输出文件: ${OUTPUT_FILE}`);
  console.log("========================================");
}

// 运行主函数
generateGalleryIndex().catch((err) => {
  console.error("生成索引时发生错误:", err.message);
  process.exit(1);
});
