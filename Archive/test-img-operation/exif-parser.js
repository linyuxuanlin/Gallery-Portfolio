const fs = require('fs');
const exifParser = require('exif-parser');

// Specify the path to the image file
const imagePath = './gallery_preview_DSC05563.JPG';

// Read the file into a buffer
fs.readFile(imagePath, (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Create a parser for the buffer
    const parser = exifParser.create(data);

    // Parse the EXIF data
    const result = parser.parse();

    // Output all EXIF information
    console.log('EXIF Data:', result);
});
