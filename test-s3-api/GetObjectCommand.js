require('dotenv').config(); // Load environment variables from .env file
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

// Set AWS credentials from environment variables
const s3Client = new S3Client({
  region: process.env.R2_REGION,
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
});

// Function to download image file
async function downloadImage(fileName) {
  try {
    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: process.env.R2_PREFIX_NAME, // Specify the directory path
      Key: fileName // Specify the file name to download
    };
    const { Body } = await s3Client.send(new GetObjectCommand(params));
    const fileStream = fs.createWriteStream(fileName);
    Body.pipe(fileStream);
    console.log(`Downloaded ${fileName} successfully.`);
  } catch (err) {
    console.error('Error downloading image:', err);
  }
}

// Call the function to download image file
downloadImage('DSC05563.JPG');
