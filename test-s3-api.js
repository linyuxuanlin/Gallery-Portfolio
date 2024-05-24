require('dotenv').config(); // Load environment variables from .env file
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

// Set AWS credentials from environment variables
const s3Client = new S3Client({
  region: process.env.R2_REGION,
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
});

// Function to list buckets
async function listBuckets() {
  try {
    const data = await s3Client.send(new ListBucketsCommand({}));
    console.log('Buckets:');
    data.Buckets.forEach(bucket => {
      console.log(bucket.Name);
    });
  } catch (err) {
    console.error('Error listing buckets:', err);
  }
}

// Call the function to list buckets
listBuckets();



//// Example of putting an object
//const putObjectCommand = new PutObjectCommand({
//    Bucket: {YOUR BUCKET NAME},
//    Key: {PATH YOU PREFERRED},
//    Body: JSON.stringify(payload)
//});
//
//s3Client.send(putObjectCommand);