const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 输入输出路径
const rootInputDir = 'C:/Users/Power/Wiki-media/gallery';
const rootOutputDir = path.join(rootInputDir, '0_preview');

// 支持的图片扩展名
const supportedExtensions = ['.jpg', '.jpeg', '.png'];

/**
 * 获取一级子目录（排除 0_preview）
 */
function getSubdirectories(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '0_preview')
    .map(d => d.name);
}

/**
 * 获取所有需要转换的图像文件路径
 */
function getAllImageFiles() {
  const imageFiles = [];

  const subdirs = getSubdirectories(rootInputDir);
  subdirs.forEach(subdir => {
    const fullSubdirPath = path.join(rootInputDir, subdir);
    const files = fs.readdirSync(fullSubdirPath);

    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (supportedExtensions.includes(ext)) {
        const inputFilePath = path.join(fullSubdirPath, file);

        const baseName = path.parse(file).name;
        const outputFileName = baseName + '.webp';
        const outputSubdir = path.join(rootOutputDir, subdir);
        const outputFilePath = path.join(outputSubdir, outputFileName);

        if (!fs.existsSync(outputFilePath)) {
          imageFiles.push({
            input: inputFilePath,
            output: outputFilePath,
            fileName: file
          });
        }
      }
    });
  });

  return imageFiles;
}

/**
 * 执行图像转换
 */
async function convertImages() {
  const imageFiles = getAllImageFiles();
  const total = imageFiles.length;

  if (total === 0) {
    console.log('✅ 没有需要转换的新图片。');
    return;
  }

  console.log(`开始转换 ${total} 张图片...\n`);

  for (let i = 0; i < total; i++) {
    const { input, output, fileName } = imageFiles[i];
    fs.mkdirSync(path.dirname(output), { recursive: true });

    try {
      await sharp(input)
        .rotate() // ✅ 根据 EXIF 正确旋转
        .withMetadata({ orientation: undefined }) // ✅ 保留其他 EXIF，去除 Orientation
        .webp({ quality: 80 }) // ✅ 转为 WebP
        .toFile(output);

      const percent = ((i + 1) / total * 100).toFixed(1);
      console.log(`✔️ (${i + 1}/${total}) ${percent}% - ${fileName} → ${path.relative(rootOutputDir, output)}`);
    } catch (err) {
      console.error(`❌ 转换失败: ${input}`, err);
    }
  }

  console.log('\n✅ 全部转换完成。');
}

// 执行主流程
convertImages();
