// Import the sharp module
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Define the input and output paths
const inputPath = path.join(__dirname, 'gallery_DSC05563.JPG'); // Replace 'input.jpg' with your local photo file
const outputPath = path.join(__dirname, 'gallery_DSC05563_resize.JPG');

// Define the minimum width and height
const minWidth = 200; // Minimum width
const minHeight = 200; // Minimum height

// Function to resize the image while maintaining the aspect ratio
const resizeImage = async (inputPath, outputPath, minWidth, minHeight) => {
    try {
        // Use sharp to get the metadata of the image
        const metadata = await sharp(inputPath).metadata();

        // Calculate the new dimensions while maintaining the aspect ratio
        let width, height;
        if (metadata.width / metadata.height > minWidth / minHeight) {
            width = minWidth;
            height = Math.round((minWidth / metadata.width) * metadata.height);
        } else {
            width = Math.round((minHeight / metadata.height) * metadata.width);
            height = minHeight;
        }

        // Use sharp to resize the image and keep the metadata
        await sharp(inputPath)
            .resize(width, height)
            .withMetadata()
            .toFile(outputPath);

        console.log(`Image resized and saved to ${outputPath}`);
    } catch (error) {
        console.error('Error resizing image:', error);
    }
};

// Check if the input file exists
fs.access(inputPath, fs.constants.F_OK, (err) => {
    if (err) {
        console.error('Input file does not exist:', inputPath);
        return;
    }

    // Resize the image
    resizeImage(inputPath, outputPath, minWidth, minHeight);
});
