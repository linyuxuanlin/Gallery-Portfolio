document.addEventListener('DOMContentLoaded', () => {
    let IMAGE_BASE_URL;
    let columns = 3; // Default number of columns
    let imagesPerLoad = 10; // Default images per load
    const SCROLL_THRESHOLD = 100; // Scroll threshold to start hiding the header
    let currentImageRequest = null; // Variable to hold the current image request
    let currentExifRequest = null; // Variable to hold the current EXIF request
    let isPageLoading = true; // 页面加载标志
    let manualLoadMoreDone = false; // 新增：用于标记是否已手动点击加载更多

    // 在文件顶部新增一个变量，用于记录上一次的屏幕宽度
    let lastWidth = window.innerWidth;

    // Fetch configuration from server
    fetch('/config')
        .then(response => response.json())
        .then(config => {
            IMAGE_BASE_URL = config.IMAGE_BASE_URL;
            // Proceed with the rest of the logic
            initGallery();
        })
        .catch(error => console.error('Error loading config:', error));

    // 在页面加载完成后设置标志
    window.addEventListener('load', () => {
        isPageLoading = false;
    });

    function initGallery() {
        const galleryElement = document.getElementById('gallery');
        const loadMoreButton = document.getElementById('load-more');
        const loadingElement = document.getElementById('loading');
        let imageUrls = {};
        let currentIndex = 0;
        let imagesLoadedCount = 0;
        let loadingImagesCount = 0;
        let columnElements = [];
        let currentTag = 'all';

        // 新增：记录倒计时定时器和倒计时剩余秒数
        let countdownTimer = null;
        let countdownRemaining = 0;

        // 修改点击事件：如果用户点击则取消倒计时，跳过等待直接加载下一批图片
        loadMoreButton.onclick = () => {
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            loadNextImages();
            manualLoadMoreDone = true; // 标记第一次加载已手动触发
        };

        // 创建标签栏
        function createTagFilter(tags) {
            const tagContainer = document.createElement('div');
            tagContainer.className = 'tag-filter-vertical';
            
            // 添加鼠标滚轮事件，实现鼠标悬停在标签栏上时通过滚轮垂直滚动标签栏
            tagContainer.addEventListener('wheel', (event) => {
                event.preventDefault();
                tagContainer.scrollTop += event.deltaY;
            });

            // 添加"全部"标签
            const allTag = document.createElement('button');
            allTag.className = 'tag';
            allTag.textContent = 'All';
            allTag.style.backgroundColor = '#4CAF50'; // 绿色主题色
            allTag.style.color = '#fff';
            allTag.addEventListener('click', () => {
                // 移除所有标签的选中样式
                tagContainer.querySelectorAll('.tag').forEach(t => {
                    t.style.backgroundColor = '';
                    t.style.color = '';
                });
                // 设置当前标签的选中样式
                allTag.style.backgroundColor = '#4CAF50';
                allTag.style.color = '#fff';
                filterImages('all');
            });
            tagContainer.appendChild(allTag);

            // 添加其他标签，排除 'preview' 文件夹
            tags.forEach(tag => {
                if (tag !== 'all' && tag !== 'preview') {
                    const tagButton = document.createElement('button');
                    tagButton.className = 'tag';
                    tagButton.textContent = tag;
                    tagButton.addEventListener('click', () => {
                        // 移除所有标签的选中样式
                        tagContainer.querySelectorAll('.tag').forEach(t => {
                            t.style.backgroundColor = '';
                            t.style.color = '';
                        });
                        // 设置当前标签的选中样式
                        tagButton.style.backgroundColor = '#4CAF50';
                        tagButton.style.color = '#fff';
                        filterImages(tag);
                    });
                    tagContainer.appendChild(tagButton);
                }
            });

            // 插入到header和gallery之间
            const header = document.querySelector('header');
            header.insertAdjacentElement('afterend', tagContainer);

            // 利用 IntersectionObserver 监听各个标签按钮是否完全可见
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    // 如果标签没有完全展示，则降低透明度，实现"淡化"效果
                    if (entry.intersectionRatio < 1) {
                        entry.target.style.opacity = '0.6';
                    } else {
                        entry.target.style.opacity = '1';
                    }
                });
            }, { root: tagContainer, threshold: 1.0 });

            // 对所有的标签按钮进行观察
            tagContainer.querySelectorAll('.tag').forEach(tagButton => {
                observer.observe(tagButton);
            });
        }

        // 图片筛选功能
        function filterImages(tag) {
            manualLoadMoreDone = false; // 重置手动点击标识

            // 移除底部"已全部加载完成"的提示消息（如果存在）
            const loadedMsg = document.getElementById('all-loaded-message');
            if (loadedMsg) {
                loadedMsg.remove();
            }

            currentTag = tag;
            currentIndex = 0;
            imagesLoadedCount = 0;
            loadingImagesCount = 0;
            createColumns();

            // 新增：重置"加载更多"按钮的显示状态
            loadMoreButton.style.display = 'block';

            // 如果是 "all" 标签，则组合所有图片（排除 preview 文件夹）
            if (tag === 'all') {
                // 获取所有非 preview 的文件夹名
                const folderKeys = Object.keys(imageUrls).filter(key => key !== 'preview');
                // 使用 Fisher-Yates 算法随机打乱文件夹顺序
                for (let i = folderKeys.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [folderKeys[i], folderKeys[j]] = [folderKeys[j], folderKeys[i]];
                }
                const allImages = [];
                folderKeys.forEach(key => {
                    // 同一个文件夹内的图片保持连续顺序
                    allImages.push(...imageUrls[key]);
                });
                imageUrls['all'] = allImages;
            }

            // 分页加载第一批图片
            loadNextImages();
        }

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

        // 获取最短列的索引（根据当前列的 offsetHeight）
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

        // 更新列数及每次加载的图片数，并重新分配已加载图片（使用贪心算法）
        function updateColumns() {
            // 保存当前所有已加载的图片
            const loadedImages = Array.from(document.querySelectorAll('.gallery img'));
            
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
            distributeImages(loadedImages);
            setupLoadMoreObserver();
        }

        // 重新分配当前所有已加载图片，根据图片实际高度分配到最短列，实现均衡布局
        function distributeImages(images) {
            // 如果未传入图片集合，则从 DOM 中获取所有图片
            if (!images) {
                images = Array.from(document.querySelectorAll('.gallery img'));
            }
            // 先清空所有列
            columnElements.forEach(column => column.innerHTML = '');
            images.forEach(img => {
                const shortestColumn = getShortestColumn();
                columnElements[shortestColumn].appendChild(img);
            });
        }

        // 加载下一批图片，优化点在于：等图片加载完毕后，再根据真实高度检测最短列后插入 DOM
        function loadNextImages() {
            setLoadingState(true);
            const images = imageUrls[currentTag] || [];
            const endIndex = Math.min(currentIndex + imagesPerLoad, images.length);
            loadingImagesCount = endIndex - currentIndex;

            for (let i = currentIndex; i < endIndex; i++) {
                const imageData = images[i];
                const img = document.createElement('img');
                img.src = imageData.thumbnail;
                img.alt = `Photo ${i + 1}`;
                img.onclick = () => openModal(imageData.original);

                // 加载出错时，尝试通过 /thumbnail 接口重新加载
                img.onerror = () => {
                    fetch(`/thumbnail/${encodeURIComponent(imageData.original.replace(IMAGE_BASE_URL + '/', ''))}`)
                        .then(() => {
                            img.src = imageData.thumbnail;
                        })
                        .catch(error => {
                            console.error(`Error loading image: ${imageData.thumbnail}`, error);
                            loadingImagesCount--;
                            if (loadingImagesCount === 0) {
                                setLoadingState(false);
                            }
                            checkIfAllImagesLoaded();
                        });
                };

                // 图片加载完成后再插入到当前最短的列中
                img.onload = () => {
                    img.classList.add('loaded');
                    imagesLoadedCount++;
                    loadingImagesCount--;

                    const shortestColumn = getShortestColumn();
                    columnElements[shortestColumn].appendChild(img);

                    if (loadingImagesCount === 0) {
                        setLoadingState(false);
                    }
                    checkIfAllImagesLoaded();
                };
            }
            currentIndex = endIndex;
            if (currentIndex >= images.length) {
                loadMoreButton.style.display = 'none';
                // 在加载完全部图片后添加底部横线和提示信息
                if (!document.getElementById('all-loaded-message')) {
                    const messageContainer = document.createElement('div');
                    messageContainer.id = 'all-loaded-message';
                    messageContainer.style.textAlign = 'center';
                    messageContainer.style.color = 'gray';
                    messageContainer.style.margin = '20px 0';
                    messageContainer.innerHTML = '<hr style="width:100%; margin:0 auto;"/><p>已全部加载完成</p>';
                    loadMoreButton.insertAdjacentElement('afterend', messageContainer);
                   
                }
            }
        }

        // 检查是否所有图片都加载完成
        function checkIfAllImagesLoaded() {
            const totalImagesToLoad = Math.min(currentIndex, imageUrls[currentTag].length);
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
            if (isPageLoading) {
                console.log('页面正在加载，无法打开大图');
                return; // 如果页面正在加载，直接返回
            }
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

        // 修改 resize 事件处理：仅在宽度变化时，重新分配图片
        window.addEventListener('resize', () => {
            if (window.innerWidth !== lastWidth) {
                updateColumns(); // 当屏幕宽度变化时，根据新的宽度更新列数并重新分配图片
                lastWidth = window.innerWidth;
            }
            setGalleryMarginTop(); // 始终更新 gallery 的 margin-top，以确保 header 距离正确
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

            // 移除自动点击 loadMoreButton 的逻辑，避免提前调用点击事件而跳过倒计时
            // if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight) {
            //     setTimeout(() => {
            //         loadMoreButton.click();
            //     }, 500); // 延时 0.5 秒
            // }
        });

        // 从服务器获取所有图片 URL
        fetch('/images')
            .then(response => response.json())
            .then(data => {
                imageUrls = data;
                createTagFilter(Object.keys(data));
                // 首次加载时自动选择 "All" 标签
                filterImages('all');
                updateColumns();
            })
            .catch(error => console.error('Error loading images:', error));

        // 重新定义 setupLoadMoreObserver，使其支持倒计时加载功能
        function setupLoadMoreObserver() {
            const observerOptions = {
                root: null, // 使用视口作为根
                rootMargin: '0px',
                threshold: 1  // 当按钮 100% 可见时触发
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.target === loadMoreButton) {
                        // 当按钮可见且没有禁用且还未启动倒计时时
                        if (entry.isIntersecting && !loadMoreButton.disabled && !countdownTimer) {
                            if (manualLoadMoreDone) {
                                // 如果已经手动点击过，启动倒计时自动加载
                                countdownRemaining = 3;
                                loadMoreButton.textContent = `加载更多（${countdownRemaining}s）`;
                                countdownTimer = setInterval(() => {
                                    countdownRemaining--;
                                    if (countdownRemaining > 0) {
                                        loadMoreButton.textContent = `加载更多（${countdownRemaining}s）`;
                                    } else {
                                        clearInterval(countdownTimer);
                                        countdownTimer = null;
                                        loadNextImages();
                                    }
                                }, 1000);
                            } else {
                                // 首页第一次不自动加载，保持加载按钮原文本
                                loadMoreButton.textContent = '加载更多';
                            }
                        }
                    }
                });
            }, observerOptions);

            observer.observe(loadMoreButton);
        }

        // 调用 setupLoadMoreObserver 来启动自动加载倒计时处理
        setupLoadMoreObserver();
    }
});