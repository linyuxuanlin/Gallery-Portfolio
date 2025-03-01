document.addEventListener('DOMContentLoaded', () => {
    let IMAGE_BASE_URL;
    let columns = 3; // Default number of columns
    let imagesPerLoad = 10; // Default images per load
    const SCROLL_THRESHOLD = 100; // Scroll threshold to start hiding the header
    let currentImageRequest = null; // Variable to hold the current image request
    let currentExifRequest = null; // Variable to hold the current EXIF request
    let isPageLoading = true; // 页面加载标志
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
        const loadingElement = document.getElementById('loading');
        let imageUrls = {};
        let currentIndex = 0;
        let imagesLoadedCount = 0;
        let loadingImagesCount = 0;
        let columnElements = [];
        let currentTag = 'all';
        let isScrollLoading = false;
        let scrollTriggerTimeout = null;
        
        // 改进：使用更多信息进行图片去重
        let loadedImagePaths = new Set(); // 存储完整的图片路径
        
        // 创建标签筛选器函数（保持不变）
        function createTagFilter(tags) {
            const tagContainer = document.createElement('div');
            tagContainer.className = 'tag-filter-vertical';
            
            // 使用文档片段提高性能
            const fragment = document.createDocumentFragment();
            
            // 添加鼠标滚轮事件，实现鼠标悬停在标签栏上时通过滚轮垂直滚动标签栏
            tagContainer.addEventListener('wheel', (event) => {
                event.preventDefault();
                tagContainer.scrollTop += event.deltaY;
            });
        
            // 辅助函数：将选中的标签滚动到中间
            function centerTagButton(btn) {
                const containerHeight = tagContainer.clientHeight;
                const btnOffsetTop = btn.offsetTop;
                const btnHeight = btn.clientHeight;
                const scrollTarget = btnOffsetTop - (containerHeight / 2) + (btnHeight / 2);
                tagContainer.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            }
        
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
                // 滚动到正中间
                centerTagButton(allTag);
            });
            fragment.appendChild(allTag);
        
            // 过滤掉 'all' 和 'preview' 标签，并按字母顺序排序
            const filteredTags = tags.filter(tag => tag !== 'all' && tag !== 'preview').sort();
            
            // 添加其他标签
            filteredTags.forEach(tag => {
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
                    // 滚动到正中间
                    centerTagButton(tagButton);
                });
                fragment.appendChild(tagButton);
            });
        
            // 一次性添加所有标签
            tagContainer.appendChild(fragment);
        
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

        // 图片筛选功能 - 修复
        function filterImages(tag) {
            // 清除现有消息...
            
            // 重置所有状态
            currentTag = tag;
            currentIndex = 0;
            imagesLoadedCount = 0;
            loadingImagesCount = 0;
            isScrollLoading = false;
            
            // 重要：彻底清除加载记录
            loadedImagePaths.clear();
            
            // 清空并重建列
            while (galleryElement.firstChild) {
                galleryElement.removeChild(galleryElement.firstChild);
            }
            createColumns();
            
            // 处理"all"标签...
            
            // 重置已加载消息标志
            document.body.classList.remove('all-images-loaded');
            
            // 触发初始加载
            loadNextImages();
        }

        // 创建列 - 增强防重复逻辑
        function createColumns() {
            // 清除现有列
            columnElements = [];
            galleryElement.innerHTML = '';
            
            // 创建新列
            for (let i = 0; i < columns; i++) {
                const column = document.createElement('div');
                column.className = 'column';
                column.dataset.columnIndex = i;
                columnElements.push(column);
                galleryElement.appendChild(column);
            }
        }

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
            return columnElements[minIndex];
        }

        // 更新列数及每次加载的图片数
        function updateColumns() {
            const width = window.innerWidth;
            let computedColumns, computedImagesPerLoad;
            
            // 计算应用的列数和每次加载图片数量
            if (width < 600) {
                computedColumns = 2;
                computedImagesPerLoad = 8; // 增加每批次加载数量
            } else if (width < 900) {
                computedColumns = 3;
                computedImagesPerLoad = 12;
            } else if (width < 1200) {
                computedColumns = 4;
                computedImagesPerLoad = 16;
            } else if (width < 1500) {
                computedColumns = 5;
                computedImagesPerLoad = 20;
            } else {
                computedColumns = 6;
                computedImagesPerLoad = 24;
            }
            
            // 如果列数没有变化，仅更新加载图片数量，不重新排布
            if (computedColumns === columns) {
                imagesPerLoad = computedImagesPerLoad;
                return;
            }
            
            // 记录现有图片
            const loadedImages = Array.from(document.querySelectorAll('.gallery img'));
            
            // 根据原始顺序排序图片
            loadedImages.sort((a, b) => {
                const orderA = parseInt(a.dataset.originalOrder || 0);
                const orderB = parseInt(b.dataset.originalOrder || 0);
                return orderA - orderB;
            });
            
            // 更新全局变量
            columns = computedColumns;
            imagesPerLoad = computedImagesPerLoad;
            
            // 创建新列
            createColumns();
            
            // 重新分配图片
            distributeImagesInOriginalOrder(loadedImages);
            
            // 更新其他设置
            setTimeout(updateHoverEffects, 300);
            
            // 检查是否需要加载更多图片
            checkIfMoreImagesNeeded();
        }

        // 按照原始顺序分配图片
        function distributeImagesInOriginalOrder(images) {
            if (images.length === 0) return;
            
            // 移除所有图片
            images.forEach(img => {
                if (img.parentNode) {
                    img.parentNode.removeChild(img);
                }
            });
            
            // 创建足够的图片容器
            for (let i = 0; i < images.length; i++) {
                // 如果图片没有原始序号，则添加一个
                if (!images[i].dataset.originalOrder) {
                    images[i].dataset.originalOrder = i;
                }
                
                // 将图片添加到最短的列
                const shortestColumn = getShortestColumn();
                shortestColumn.appendChild(images[i]);
            }
        }

        // 检查是否需要加载更多图片
        function checkIfMoreImagesNeeded() {
            // 检查当前内容高度是否填满屏幕
            const viewportHeight = window.innerHeight;
            const contentHeight = Math.max(...columnElements.map(col => col.offsetHeight || 0));
            
            // 如果内容不足以填满屏幕+额外两行，加载更多
            if (contentHeight < viewportHeight * 1.5) {
                if (currentIndex < (imageUrls[currentTag] || []).length) {
                    // 使用setTimeout确保DOM更新后再检查
                    setTimeout(() => {
                        loadNextImages();
                    }, 100);
                }
            }
        }

        // 修改 loadNextImages 函数，强化去重逻辑
        function loadNextImages() {
            const images = imageUrls[currentTag] || [];
            
            // 检查是否还有更多图片需要加载
            if (currentIndex >= images.length) {
                handleAllImagesLoaded();
                return;
            }
            
            // 设置加载状态...
            
            // 修改：使用更保守的批次加载方式
            const viewportHeight = window.innerHeight;
            const headerHeight = document.querySelector('header').offsetHeight;
            const availableHeight = viewportHeight - headerHeight;
            const avgImageHeight = 200; 
            const imagesPerRow = columns;
            const rowsToFillScreen = Math.ceil(availableHeight / avgImageHeight) + 1;
            const additionalRows = 2; // 减少预加载行数，避免过多并发加载
            const totalRowsToLoad = rowsToFillScreen + additionalRows;
            const maxImagesToLoad = Math.min(totalRowsToLoad * imagesPerRow, images.length - currentIndex);
            
            // 改进：增加单批次时间限制，防止长时间加载导致的问题
            const startTime = Date.now();
            const MAX_BATCH_TIME = 2000; // 2秒最大批次时间
            
            // 减少残余加载的影响
            isScrollLoading = true;
            let loadedInThisBatch = 0;
            
            // 递归加载单张图片 - 增强去重逻辑
            function loadSingleImage(index) {
                // 检查是否达到时间限制或完成加载
                if (Date.now() - startTime > MAX_BATCH_TIME || 
                    index >= images.length || 
                    loadedInThisBatch >= maxImagesToLoad) {
                    
                    // 移除临时加载消息
                    const tempMsg = document.getElementById('temp-loading-msg');
                    if (tempMsg) tempMsg.remove();
                    
                    // 检查是否全部加载完成
                    if (index >= images.length) {
                        handleAllImagesLoaded();
                    } else {
                        // 预加载下一批
                        setTimeout(() => {
                            preloadNextBatchImages();
                        }, 300);
                    }
                    
                    // 延迟重置滚动加载状态，避免立即触发下一次加载
                    setTimeout(() => {
                        isScrollLoading = false;
                    }, 500);
                    
                    return;
                }
                
                // 获取图片数据
                const imageData = images[index];
                if (!imageData) {
                    // 跳过无效图片数据
                    currentIndex++;
                    loadSingleImage(currentIndex);
                    return;
                }
                
                const imageUrl = imageData.thumbnail;
                const originalUrl = imageData.original;
                
                // 重要：使用更严格的图片去重检查
                const imagePath = `${imageUrl}||${originalUrl}`;
                if (loadedImagePaths.has(imagePath)) {
                    // 已加载过此图片，跳过
                    console.log('跳过重复图片:', imageUrl);
                    currentIndex++;
                    loadSingleImage(currentIndex);
                    return;
                }
                
                // 立即标记为已加载，避免并发加载过程中重复
                loadedImagePaths.add(imagePath);
                
                // 实际加载图片过程...
                const img = new Image();
                
                // 设置加载计数
                loadingImagesCount++;
                
                img.onload = function() {
                    // 图片加载成功
                    const shortestColumn = getShortestColumn();
                    shortestColumn.appendChild(img);
                    img.classList.add('loaded');
                    
                    // 更新计数
                    loadingImagesCount--;
                    imagesLoadedCount++;
                    loadedInThisBatch++;
                    currentIndex++;
                    
                    // 加载速度控制
                    if (Date.now() - startTime < 100) {
                        // 加载很快，立即继续
                        loadSingleImage(currentIndex);
                    } else {
                        // 使用小延迟让浏览器有时间渲染
                        setTimeout(() => {
                            loadSingleImage(currentIndex);
                        }, 10);
                    }
                };
                
                img.onerror = function() {
                    console.error('图片加载失败:', imageUrl);
                    // 移除失败图片的记录
                    loadedImagePaths.delete(imagePath);
                    loadingImagesCount--;
                    currentIndex++;
                    loadSingleImage(currentIndex);
                };
                
                // 设置图片属性
                img.src = imageUrl;
                img.setAttribute('data-original', originalUrl);
                img.setAttribute('data-preview', imageUrl);
                img.alt = '图片';
                
                // 添加点击事件
                img.addEventListener('click', function() {
                    openModal(this.getAttribute('data-original'), this.getAttribute('data-preview'));
                });
            }
            
            // 开始加载图片
            loadSingleImage(currentIndex);
        }

        // 改进预加载函数，使用相同的去重逻辑
        function preloadNextBatchImages() {
            const images = imageUrls[currentTag] || [];
            if (currentIndex >= images.length || isScrollLoading) {
                return;
            }
            
            // 预加载更保守的数量
            const preloadCount = columns * 2;
            let preloadEndIndex = Math.min(currentIndex + preloadCount, images.length);
            
            // 预加载图片但不添加到DOM
            for (let i = currentIndex; i < preloadEndIndex; i++) {
                if (i >= images.length) break;
                
                const imageData = images[i];
                if (!imageData) continue;
                
                const imageUrl = imageData.thumbnail;
                const originalUrl = imageData.original;
                const imagePath = `${imageUrl}||${originalUrl}`;
                
                // 跳过已加载的图片
                if (loadedImagePaths.has(imagePath)) {
                    continue;
                }
                
                // 预加载图片
                const preloadImg = new Image();
                preloadImg.src = imageUrl;
            }
        }

        // 滚动处理优化 - 更稳定的加载触发
        window.addEventListener('scroll', () => {
            // Header隐藏逻辑保持不变...
            
            // 检查是否需要加载更多图片
            if (isScrollLoading || isPageLoading) return;
            
            clearTimeout(scrollTriggerTimeout);
            scrollTriggerTimeout = setTimeout(() => {
                // 已经在加载中或页面仍在加载，不触发新的加载
                if (isScrollLoading || isPageLoading) return;
                
                // 计算滚动位置触发点：当前视口底部 + 2屏幕高度的预加载区域
                const scrollPosition = window.scrollY + window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;
                const triggerPoint = documentHeight - (window.innerHeight * 2);
                
                // 当滚动接近底部时触发加载
                if (scrollPosition > triggerPoint) {
                    // 检查是否还有图片可加载
                    const images = imageUrls[currentTag] || [];
                    if (currentIndex < images.length) {
                        isScrollLoading = true;
                        loadNextImages();
                    }
                }
            }, 100);
        });

        // 处理所有图片加载完成的情况
        function handleAllImagesLoaded() {
            // 添加"已全部加载完成"的提示（如果不存在）
            if (!document.getElementById('all-loaded-message')) {
                const loadedMsg = document.createElement('div');
                loadedMsg.id = 'all-loaded-message';
                loadedMsg.textContent = '————  已全部加载完毕  ————';
                loadedMsg.style.textAlign = 'center';
                loadedMsg.style.margin = '20px 0';
                loadedMsg.style.padding = '10px';
                loadedMsg.style.color = 'var(--text-color)';
                loadedMsg.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
                loadedMsg.style.borderRadius = '5px';
                loadedMsg.style.animation = 'fadeIn 1s';
                document.querySelector('footer').before(loadedMsg);
                
                // 添加淡入动画
                if (!document.getElementById('fadeInStyle')) {
                    const style = document.createElement('style');
                    style.id = 'fadeInStyle';
                    style.textContent = `
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                    `;
                    document.head.appendChild(style);
                }
            }
            
            // 触发布局调整
            setTimeout(() => {
                window.scrollBy(0, 1);
                window.scrollBy(0, -1);
            }, 200);
        }

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (window.innerWidth !== lastWidth) {
                updateColumns();
                lastWidth = window.innerWidth;
                
                // 重新设置悬停效果
                setTimeout(updateHoverEffects, 300);
            }
            
            // 设置gallery上边距
            setGalleryMarginTop();
        });

        // 设置 gallery 的 margin-top
        function setGalleryMarginTop() {
            const headerHeight = document.querySelector('header').offsetHeight;
            galleryElement.style.marginTop = `${headerHeight + 20}px`;
        }

        // 初始设置
        updateColumns();
        setGalleryMarginTop();

        // 从服务器获取所有图片 URL
        fetch('/images')
            .then(response => response.json())
            .then(data => {
                imageUrls = data;
                createTagFilter(Object.keys(data));
                // 首次加载时选择 "All" 标签
                filterImages('all');
                updateColumns();
                
                // 初始加载后检查是否需要更多图片
                setTimeout(() => {
                    checkIfMoreImagesNeeded();
                }, 500);
            })
            .catch(error => console.error('Error loading images:', error));

        // 模态窗口逻辑 (保持不变)
        const modal = document.getElementById('myModal');
        const modalContent = document.querySelector('.modal-content');
        const modalImg = document.getElementById('img01');
        const exifInfo = document.getElementById('exif-info');
        const span = document.getElementsByClassName('close')[0];

        function openModal(original, preview) {
            // 移除所有图片的悬停状态
            document.querySelectorAll('.gallery img.hover-active').forEach(img => {
                img.classList.remove('hover-active');
            });
            
            document.body.classList.add('modal-open');
            modal.style.opacity = '1';
            
            if (isPageLoading) {
                console.log('页面正在加载，无法打开大图');
                return;
            }
            
            if (currentImageRequest) {
                currentImageRequest.abort();
            }
            if (currentExifRequest) {
                currentExifRequest.abort();
            }

            modal.style.display = 'block';
            document.body.classList.add('no-scroll');
            exifInfo.innerHTML = 'Loading original image and EXIF data...';

            const imageController = new AbortController();
            const exifController = new AbortController();
            currentImageRequest = imageController;
            currentExifRequest = exifController;

            // 获取 EXIF 数据
            fetch(`/exif/${encodeURIComponent(original.replace(IMAGE_BASE_URL + '/', ''))}`, { signal: exifController.signal })
                .then(response => response.json())
                .then(data => {
                    if (!exifController.signal.aborted) {
                        let shutterDisplay = 'N/A';
                        if (data.ExposureTime) {
                            if (data.ExposureTime < 1) {
                                const denominator = Math.round(1 / data.ExposureTime);
                                shutterDisplay = `1/${denominator}s`;
                            } else {
                                shutterDisplay = `${data.ExposureTime}s`;
                            }
                        }
                        exifInfo.innerHTML = `
                            <p>光圈: ${data.FNumber ? `f/${data.FNumber}` : 'N/A'}  ·  快门: ${shutterDisplay}  ·  ISO: ${data.ISO ? data.ISO : 'N/A'}</p>
                        `;
                    }
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error('Error fetching EXIF data:', error);
                        exifInfo.innerHTML = 'Error loading EXIF data';
                    }
                });

            // 先展示预览图并添加模糊效果
            modalImg.src = preview;
            modalImg.style.filter = 'blur(20px)';

            // 加载高清图
            const highResImage = new Image();
            highResImage.src = original;
            highResImage.onload = () => {
                if (!imageController.signal.aborted) {
                    modalImg.src = original;
                    modalImg.style.transition = 'filter 0.5s ease';
                    modalImg.style.filter = 'blur(0px)';
                    currentImageRequest = null;
                }
            };
            highResImage.onerror = () => {
                if (!imageController.signal.aborted) {
                    console.error('Error loading high resolution image');
                    modalImg.style.filter = 'blur(0px)';
                }
            };
        }

        span.onclick = function () {
            closeModal();
        }

        modalContent.onclick = function (event) {
            event.stopPropagation();
        }

        modal.onclick = function () {
            closeModal();
        }

        function closeModal() {
            modal.style.opacity = '0';
            
            setTimeout(() => {
                if (currentImageRequest) {
                    currentImageRequest.abort();
                }
                if (currentExifRequest) {
                    currentExifRequest.abort();
                }
                
                modal.style.display = 'none';
                document.body.classList.remove('no-scroll');
                modal.style.opacity = '1';
                
                setTimeout(() => {
                    document.body.classList.remove('modal-open');
                }, 300);
            }, 300);
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        });

        // 图片悬停效果
        function setupImageHoverEffects() {
            if (window.hoverEffectObserver) {
                window.hoverEffectObserver.disconnect();
            }
            
            window.hoverEffectObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes) {
                        mutation.addedNodes.forEach(function(node) {
                            if (node.tagName === 'IMG') {
                                addHoverEffect(node);
                            } else if (node.querySelectorAll) {
                                node.querySelectorAll('img').forEach(addHoverEffect);
                            }
                        });
                    }
                });
            });
            
            // 为现有图片添加效果
            document.querySelectorAll('.gallery img').forEach(addHoverEffect);
            
            // 观察gallery元素
            window.hoverEffectObserver.observe(galleryElement, {
                childList: true,
                subtree: true
            });
        }

        function addHoverEffect(img) {
            if (img.dataset.hoverInitialized) return;
            
            img.dataset.hoverInitialized = 'true';
            
            img.addEventListener('mouseenter', function() {
                this.classList.add('hover-active');
            });
            
            img.addEventListener('mouseleave', function() {
                this.classList.remove('hover-active');
            });
        }

        function updateHoverEffects() {
            setupImageHoverEffects();
        }
    }
});