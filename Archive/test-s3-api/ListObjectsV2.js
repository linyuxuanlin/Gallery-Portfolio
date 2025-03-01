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

// Function to download an image file
async function downloadImage(fileName) {
  try {
    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `${process.env.R2_PREFIX_NAME}/${fileName}` // Specify the full path of the image file
    };
    const data = await s3Client.send(new GetObjectCommand(params));
    const fileStream = fs.createWriteStream(fileName);
    data.Body.pipe(fileStream);
    console.log(`Image "${fileName}" downloaded successfully.`);
  } catch (err) {
    console.error('Error downloading image:', err);
  }
}

// Call the function to download the image file "DSC05563.JPG"
const imageName = 'DSC05563.JPG';
downloadImage(imageName);
