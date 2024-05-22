const express = require('express');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;

// 配置 AWS SDK
const r2 = new AWS.S3({
    endpoint: new AWS.Endpoint(process.env.R2_ENDPOINT),
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    region: process.env.R2_REGION,
});

// 处理获取图片列表的请求
app.get('/images', async (req, res) => {
    try {
        const params = {
            Bucket: process.env.R2_BUCKET_NAME,
            Prefix: 'gallery/'
        };
        const data = await r2.listObjectsV2(params).promise();
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
