const express = require('express');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;

// 配置 AWS SDK
const s3Client = new S3Client({
    region: process.env.R2_REGION,
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

// 处理获取图片列表的请求
app.get('/images', async (req, res) => {
    try {
        const params = {
            Bucket: process.env.R2_BUCKET_NAME,
            Prefix: 'gallery/'
        };
        const command = new ListObjectsV2Command(params);
        const data = await s3Client.send(command);
        const imageUrls = data.Contents.map(item => {
            return `${process.env.IMAGE_BASE_URL}/${item.Key}`;
        });
        res.json(imageUrls);
    } catch (error) {
        console.error('Error fetching images from R2:', error);
        res.status(500).send('Error fetching images from R2');
    }
});

app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
