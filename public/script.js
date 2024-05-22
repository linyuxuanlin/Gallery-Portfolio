const galleryElement = document.getElementById('gallery');
const columns = 3;
const columnElements = [];

// 创建列元素
for (let i = 0; i < columns; i++) {
    const column = document.createElement('div');
    column.classList.add('column');
    columnElements.push(column);
    galleryElement.appendChild(column);
}

// 从服务器获取图片 URL 并展示
fetch('/images')
    .then(response => response.json())
    .then(imageUrls => {
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = `Photo ${index + 1}`;
            columnElements[index % columns].appendChild(img);
        });
    })
    .catch(error => console.error('Error loading images:', error));
