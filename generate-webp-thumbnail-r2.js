import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';
import { imagePaths, normalizeDirectory } from './scripts/image-paths.js';

dotenv.config();
const IMAGE_DIR = normalizeDirectory(process.env.R2_IMAGE_DIR);
const BUCKET = process.env.R2_BUCKET_NAME;
const QUALITY = Number(process.env.IMAGE_COMPRESSION_QUALITY || 80);
const MAX_EDGE = Number(process.env.PREVIEW_MAX_EDGE || 960);
const s3 = new S3Client({
    region: process.env.R2_REGION || 'auto', endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

export async function createPreview(buffer, { quality = QUALITY, maxEdge = MAX_EDGE } = {}) {
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new Error('IMAGE_COMPRESSION_QUALITY 必须为 1–100 的整数');
    if (!Number.isInteger(maxEdge) || maxEdge < 1 || maxEdge > 4096) throw new Error('PREVIEW_MAX_EDGE 必须为 1–4096 的整数');
    return sharp(buffer).rotate()
        .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
        .webp({ quality }).toBuffer({ resolveWithObject: true });
}

export async function ensurePreviewExists(source, { client = s3, bucket = BUCKET, imageDirectory = IMAGE_DIR, quality = QUALITY, maxEdge = MAX_EDGE, force = false } = {}) {
    const paths = imagePaths(source.Key, imageDirectory);
    if (!paths) return;
    const recipe = `resize-v2-${maxEdge}-${quality}`;
    const etag = source.ETag || '';
    if (!force) {
        try {
            const existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: paths.previewKey }));
            if (existing.Metadata?.recipe === recipe && existing.Metadata?.['source-etag'] === etag) {
                console.log(`预览未变，跳过: ${paths.previewKey}`);
                return;
            }
        } catch (error) {
            if (error?.$metadata?.httpStatusCode !== 404 && error.name !== 'NotFound' && error.name !== 'NoSuchKey') throw error;
        }
    }
    const original = await client.send(new GetObjectCommand({ Bucket: bucket, Key: paths.originalKey }));
    const chunks = [];
    for await (const chunk of original.Body) chunks.push(Buffer.from(chunk));
    const { data, info } = await createPreview(Buffer.concat(chunks), { quality, maxEdge });
    await client.send(new PutObjectCommand({
        Bucket: bucket, Key: paths.previewKey, Body: data, ContentType: 'image/webp',
        CacheControl: 'public, max-age=3600, must-revalidate',
        Metadata: { recipe, 'source-etag': etag, width: String(info.width), height: String(info.height) },
    }));
    console.log(`预览已更新 (${info.width}×${info.height}): ${paths.previewKey}`);
}

async function main() {
    for (const name of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']) {
        if (!process.env[name]) throw new Error(`缺少配置: ${name}`);
    }
    let token;
    let failures = 0;
    do {
        const result = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: IMAGE_DIR ? `${IMAGE_DIR}/` : '', ContinuationToken: token }));
        for (const source of result.Contents || []) {
            if (!source.Key || !imagePaths(source.Key, IMAGE_DIR)) continue;
            try {
                await ensurePreviewExists(source, { force: process.argv.includes('--force') });
            } catch (error) {
                failures++;
                console.error(`处理失败: ${source.Key}`, error.message);
            }
        }
        token = result.NextContinuationToken;
    } while (token);
    if (failures) throw new Error(`${failures} 张预览生成失败，请重试`);
    console.log('预览处理完成，原图保持不变。');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
