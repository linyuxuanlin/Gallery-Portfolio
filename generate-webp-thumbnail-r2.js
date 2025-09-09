import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const REGION = process.env.R2_REGION || "auto";
const ENDPOINT = process.env.R2_ENDPOINT;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET_NAME;
const IMAGE_DIR = (process.env.R2_IMAGE_DIR || "").replace(/^\/+|\/+$/g, "");
const QUALITY = Number(process.env.IMAGE_COMPRESSION_QUALITY || 80);

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]; // 输入可能包含 webp

function toPreviewKey(srcKey) {
  // srcKey: gallery/Category/Filename.EXT
  const rel = IMAGE_DIR ? srcKey.replace(new RegExp(`^${IMAGE_DIR}/`), "") : srcKey;
  const parts = rel.split("/");
  if (parts.length < 2) return null;
  const category = parts[0];
  if (category === "0_preview") return null;
  const filename = parts[parts.length - 1];
  const baseName = filename.replace(/\.[^.]+$/, "");
  const prefix = IMAGE_DIR ? `${IMAGE_DIR}/` : "";
  return `${prefix}0_preview/${category}/${baseName}.webp`;
}

async function ensurePreviewExists(srcKey) {
  const previewKey = toPreviewKey(srcKey);
  if (!previewKey) return;

  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: previewKey }));
    console.log(`预览已存在，跳过: ${previewKey}`);
    return;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode && err.$metadata.httpStatusCode !== 404) {
      throw err;
    }
  }

  // 下载原图 -> 生成 webp -> 上传
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: srcKey }));
  const fileBuffer = await streamToBuffer(obj.Body);

  const previewBuffer = await sharp(fileBuffer)
    .rotate()
    .webp({ quality: QUALITY })
    .toBuffer();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: previewKey,
      Body: previewBuffer,
      ContentType: "image/webp",
    })
  );

  console.log(`预览生成完成: ${previewKey}`);
}

async function listAllObjects(prefix) {
  let token = undefined;
  const out = [];
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token })
    );
    if (res.Contents) out.push(...res.Contents);
    token = res.NextContinuationToken;
  } while (token);
  return out;
}

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function main() {
  console.log("========================================");
  console.log("生成 R2 预览图 (WebP)");
  console.log("========================================");
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`目录前缀: ${IMAGE_DIR || '(root)'}`);

  const objects = await listAllObjects(IMAGE_DIR);
  const keys = objects
    .map((o) => o.Key)
    .filter(Boolean)
    .filter((k) => {
      if (IMAGE_DIR && !k.startsWith(`${IMAGE_DIR}/`)) return false;
      if (k.endsWith("/")) return false; // 目录占位
      if (k.includes("/0_preview/")) return false; // 跳过预览目录
      const ext = path.extname(k).toLowerCase();
      return IMAGE_EXTENSIONS.includes(ext);
    });

  console.log(`发现原图数量: ${keys.length}`);

  for (const key of keys) {
    try {
      await ensurePreviewExists(key);
    } catch (e) {
      console.error(`处理失败: ${key}`, e?.message || e);
    }
  }

  console.log("全部预览处理完成");
}

main().catch((e) => {
  console.error("发生错误:", e?.message || e);
  process.exit(1);
});

