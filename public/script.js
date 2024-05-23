const galleryElement = document.getElementById('gallery');
const columns = 3;
const columnElements = [];
const loadMoreButton = document.getElementById('load-more');
let imageUrls = [];
let currentIndex = 0;
const imagesPerLoad = 10;

// 创建列元素
for (let i = 0; i < columns; i++) {
    const column = document.createElement('div');
    column.classList.add('column');
    columnElements.push(column);
    galleryElement.appendChild(column);
}

// 从服务器获取所有图片 URL
fetch('/images')
    .then(response => response.json())
    .then(urls => {
        imageUrls = urls;
        loadNextImages();
    })
    .catch(error => console.error('Error loading images:', error));

// 加载下一批图片
function loadNextImages() {
    const endIndex = Math.min(currentIndex + imagesPerLoad, imageUrls.length);
    for (let i = currentIndex; i < endIndex; i++) {
        const img = document.createElement('img');
        img.src = imageUrls[i];
        img.alt = `Photo ${i + 1}`;
        img.onload = function() {
            this.classList.add('loaded'); // Add loaded class when image is loaded
            columnElements[i % columns].appendChild(img);
        };
        img.onclick = function() {
            openModal(img.src, img.alt);
        };
        img.onerror = () => {
            console.error(`Error loading image: ${imageUrls[i]}`);
        };
    }
    currentIndex = endIndex;
    if (currentIndex >= imageUrls.length) {
        loadMoreButton.style.display = 'none';
    }
}

loadMoreButton.onclick = loadNextImages;

// 模态窗口逻辑
const modal = document.getElementById('myModal');
const modalImg = document.getElementById('img01');
const captionText = document.getElementById('caption');
const exifInfo = document.getElementById('exif-info');
const span = document.getElementsByClassName('close')[0];

function openModal(src, alt) {
    modal.style.display = 'block';
    document.body.classList.add('no-scroll');
    modalImg.src = src;
    captionText.innerHTML = alt;
    exifInfo.innerHTML = ''; // Clear previous EXIF info

    // Fetch and display EXIF data
    modalImg.onload = function() {
        EXIF.getData(modalImg, function() {
            const aperture = EXIF.getTag(this, 'FNumber');
            const exposureTime = EXIF.getTag(this, 'ExposureTime');
            const iso = EXIF.getTag(this, 'ISOSpeedRatings');

            exifInfo.innerHTML = `
                <p>光圈: ${aperture ? `f/${aperture}` : 'N/A'}</p>
                <p>快门: ${exposureTime ? `${exposureTime}s` : 'N/A'}</p>
                <p>ISO: ${iso ? iso : 'N/A'}</p>
            `;
        });
    };
}

span.onclick = function() {
    closeModal();
}

modal.onclick = function(event) {
    if (event.target === modal) {
        closeModal();
    }
}

function closeModal() {
    modal.style.display = 'none';
    document.body.classList.remove('no-scroll');
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Theme toggle logic
const themeToggle = document.getElementById('theme-toggle');

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    if (document.body.classList.contains('dark')) {
        themeToggle.textContent = 'brightness_7';
    } else {
        themeToggle.textContent = 'brightness_4';
    }
});

// Add footer and load more button dynamically
window.addEventListener('load', () => {
    const footer = document.createElement('footer');
    footer.innerHTML = '<p>© 2024 Power\'s Wiki | <a href="https://wiki-power.com" target="_blank">Power\'s Wiki</a></p>';
    document.body.appendChild(footer);
    footer.style.opacity = '1'; // Fade-in effect for footer
    
    loadMoreButton.style.opacity = '1'; // Fade-in effect for load more button
});
