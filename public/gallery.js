document.addEventListener('DOMContentLoaded', () => {
    let IMAGE_BASE_URL;
    let columns = 3; // Default number of columns
    let imagesPerLoad = 10; // Default images per load
    const SCROLL_THRESHOLD = 100; // Scroll threshold to start hiding the header
    let currentImageRequest = null; // Variable to hold the current image request
    let currentExifRequest = null; // Variable to hold the current EXIF request

    // Fetch configuration from server
    fetch('/config')
        .then(response => response.json())
        .then(config => {
            IMAGE_BASE_URL = config.IMAGE_BASE_URL;
            // Proceed with the rest of the logic
            initGallery();
        })
        .catch(error => console.error('Error loading config:', error));

    function initGallery() {
        const galleryElement = document.getElementById('gallery');
        const loadMoreButton = document.getElementById('load-more');
        const loadingElement = document.getElementById('loading');
        let imageUrls = [];
        let currentIndex = 0;
        let imagesLoadedCount = 0;
        let loadingImagesCount = 0;
        let columnElements = [];

        // 创建列元素
        function createColumns() {
            columnElements.forEach(column => galleryElement.removeChild(column));
            columnElements = [];
            for (let i = 0; i < columns; i++) {
                const column = document.createElement('div');
                column.classList.add('column');
                columnElements.push(column);
                galleryElement.appendChild(column);
            }
        }

        function updateColumns() {
            const width = window.innerWidth;
            if (width < 600) {
                columns = 2;
                imagesPerLoad = 10;
            } else if (width < 900) {
                columns = 3;
                imagesPerLoad = 15;
            } else if (width < 1200) {
                columns = 4;
                imagesPerLoad = 20;
            } else if (width < 1500) {
                columns = 5;
                imagesPerLoad = 23;
            } else {
                columns = 6;
                imagesPerLoad = 25;
            }
            createColumns();
            distributeImages();
        }

        function distributeImages() {
            columnElements.forEach(column => column.innerHTML = '');
            imageUrls.slice(0, currentIndex).forEach((imageUrl, index) => {
                const img = document.createElement('img');
                img.src = imageUrl.thumbnail;
                img.alt = `Photo ${index + 1}`;
                img.classList.add('loaded'); // Assume images are loaded after initial load
                img.onclick = () => openModal(imageUrl.original);
                columnElements[index % columns].appendChild(img);
            });
        }

        // 从服务器获取所有图片 URL
        fetch('/images')
            .then(response => response.json())
            .then(urls => {
                imageUrls = urls;
                updateColumns(); // Initial column update before loading images
                loadNextImages();
            })
            .catch(error => console.error('Error loading images:', error));

        // 获取最短列的索引
        function getShortestColumn() {
            let minIndex = 0;
            let minHeight = columnElements[0].offsetHeight;
            for (let i = 1; i < columnElements.length; i++) {
                if (columnElements[i].offsetHeight < minHeight) {
                    minHeight = columnElements[i].offsetHeight;
                    minIndex = i;
                }
            }
            return minIndex;
        }

        // 加载下一批图片
        function loadNextImages() {
            setLoadingState(true);
            const endIndex = Math.min(currentIndex + imagesPerLoad, imageUrls.length);
            loadingImagesCount = endIndex - currentIndex;

            for (let i = currentIndex; i < endIndex; i++) {
                const img = document.createElement('img');
                img.src = imageUrls[i].thumbnail;
                img.alt = `Photo ${i + 1}`;
                img.onload = function () {
                    this.classList.add('loaded'); // Add loaded class when image is loaded
                    const shortestColumn = getShortestColumn();
                    columnElements[shortestColumn].appendChild(img);
                    imagesLoadedCount++;
                    loadingImagesCount--;
                    if (loadingImagesCount === 0) {
                        setLoadingState(false);
                        checkIfAllImagesLoaded();
                    }
                };
                img.onclick = function () {
                    openModal(imageUrls[i].original);
                };
                img.onerror = () => {
                    console.error(`Error loading image: ${imageUrls[i].thumbnail}`);
                    loadingImagesCount--;
                    if (loadingImagesCount === 0) {
                        setLoadingState(false);
                        checkIfAllImagesLoaded();
                    }
                };
            }
            currentIndex = endIndex;
            if (currentIndex >= imageUrls.length) {
                loadMoreButton.style.display = 'none';
            }
        }

        // 检查是否所有图片都加载完成
        function checkIfAllImagesLoaded() {
            const totalImagesToLoad = Math.min(currentIndex, imageUrls.length);
            if (imagesLoadedCount >= totalImagesToLoad) {
                document.querySelector('.gallery').style.opacity = '1'; // Show gallery
                document.querySelector('footer').style.opacity = '1'; // Show footer
                loadMoreButton.style.opacity = '1'; // Show load more button
                loadingElement.classList.add('hidden'); // Hide loading animation
            }
        }

        // 设置加载按钮状态
        function setLoadingState(isLoading) {
            if (isLoading) {
                loadMoreButton.textContent = '加载中…';
                loadMoreButton.classList.add('loading');
                loadMoreButton.disabled = true;
            } else {
                loadMoreButton.textContent = '加载更多';
                loadMoreButton.classList.remove('loading');
                loadMoreButton.disabled = false;
            }
        }

        loadMoreButton.onclick = loadNextImages;

        // 动态设置 gallery 的 margin-top
        function setGalleryMarginTop() {
            const headerHeight = document.querySelector('header').offsetHeight;
            galleryElement.style.marginTop = `${headerHeight + 20}px`; // 20px 是 header 和 gallery 之间的间距
        }

        // 模态窗口逻辑
        const modal = document.getElementById('myModal');
        const modalContent = document.querySelector('.modal-content');
        const modalImg = document.getElementById('img01');
        const exifInfo = document.getElementById('exif-info');
        const span = document.getElementsByClassName('close')[0];

        function openModal(src) {
            // Cancel any ongoing image or EXIF requests
            if (currentImageRequest) {
                currentImageRequest.abort();
            }
            if (currentExifRequest) {
                currentExifRequest.abort();
            }

            modal.style.display = 'block';
            document.body.classList.add('no-scroll');
            exifInfo.innerHTML = 'Loading original image and EXIF data...'; // Placeholder text

            // Create a new AbortController for the current requests
            const imageController = new AbortController();
            const exifController = new AbortController();
            currentImageRequest = imageController;
            currentExifRequest = exifController;

            // Fetch EXIF data first
            fetch(`/exif/${encodeURIComponent(src.replace(IMAGE_BASE_URL + '/', ''))}`, { signal: exifController.signal })
                .then(response => response.json())
                .then(data => {
                    if (!exifController.signal.aborted) {
                        exifInfo.innerHTML = `
                            <p>光圈: ${data.FNumber ? `f/${data.FNumber}` : 'N/A'}  ·  快门: ${data.ExposureTime ? `${data.ExposureTime}s` : 'N/A'}  ·  ISO: ${data.ISO ? data.ISO : 'N/A'}</p>
                        `;
                    }
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error('Error fetching EXIF data:', error);
                        exifInfo.innerHTML = 'Error loading EXIF data';
                    }
                });

            // Load the image after fetching EXIF data
            modalImg.src = src;
            modalImg.onload = () => {
                if (!imageController.signal.aborted) {
                    currentImageRequest = null; // Clear the current image request when loaded
                }
            };
            modalImg.onerror = () => {
                if (!imageController.signal.aborted) {
                    console.error('Error loading image');
                }
            };
        }

        span.onclick = function () {
            closeModal();
        }

        modalContent.onclick = function (event) {
            event.stopPropagation(); // Prevent click on image from closing modal
        }

        modal.onclick = function () {
            closeModal();
        }

        function closeModal() {
            // Abort any ongoing image or EXIF requests when closing the modal
            if (currentImageRequest) {
                currentImageRequest.abort();
            }
            if (currentExifRequest) {
                currentExifRequest.abort();
            }
            modal.style.display = 'none';
            document.body.classList.remove('no-scroll');
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        });

        window.addEventListener('resize', () => {
            updateColumns(); // Update columns on window resize
            distributeImages(); // Re-distribute images
            setGalleryMarginTop(); // Update gallery margin-top on window resize
        });

        updateColumns(); // Initial column setup
        setGalleryMarginTop(); // Initial gallery margin-top setup

        // Hide header on scroll
        let lastScrollY = window.scrollY;
        let scrollDelta = 0;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            const header = document.querySelector('header');

            if (currentScrollY === 0) {
                header.style.transform = 'translateY(0)';
            } else if (currentScrollY > lastScrollY) {
                scrollDelta += currentScrollY - lastScrollY;
                if (scrollDelta > SCROLL_THRESHOLD) {
                    header.style.transform = 'translateY(-100%)';
                }
            } else {
                scrollDelta = 0;
                header.style.transform = 'translateY(0)';
            }

            lastScrollY = currentScrollY;

            // Check if the user has scrolled to the bottom
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
                setTimeout(() => {
                    loadMoreButton.click();
                }, 500); // Delay of 0.5 seconds
            }
        });
    }
});