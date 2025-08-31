import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import fs from "fs/promises";

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://<your-account-id>.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const bucket = "<your-bucket>";

async function ensurePreviewExists(key) {
  // 缩略图路径：0_preview/xxx.jpg
  const previewKey = `0_preview/${key}`;

  try {
    // 检查是否已经存在
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: previewKey }));
    console.log(`✅ 缩略图已存在，跳过生成: ${previewKey}`);
    return;
  } catch (err) {
    if (err.name !== "NotFound") {
      throw err; // 其他错误需要抛出
    }
  }

  // 下载原图（这里只是示例，避免下载全量大图你可以用 range 请求）
  const tmpFile = `/tmp/${Date.now()}-${key.split("/").pop()}`;
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const stream = obj.Body;
  const fileBuffer = await streamToBuffer(stream);
  await fs.writeFile(tmpFile, fileBuffer);

  // 用 sharp 生成缩略图
  const previewBuffer = await sharp(tmpFile)
    .resize({ width: 400 }) // 宽度 400px
    .toBuffer();

  // 上传缩略图到 R2
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: previewKey,
      Body: previewBuffer,
      ContentType: "image/jpeg"
    })
  );

  console.log(`✨ 缩略图生成完成: ${previewKey}`);
}

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
