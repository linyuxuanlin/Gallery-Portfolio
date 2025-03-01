document.addEventListener('DOMContentLoaded', () => {
    let IMAGE_BASE_URL;
    let columns = 3; // Default number of columns
    let imagesPerLoad = 10; // Default images per load
    const SCROLL_THRESHOLD = 100; // Scroll threshold to start hiding the header
    let currentImageRequest = null; // Variable to hold the current image request
    let currentExifRequest = null; // Variable to hold the current EXIF request
    let isPageLoading = true; // 页面加载标志
    let lastWidth = window.innerWidth;
    let useWebP = true; // 默认使用WebP格式，将从服务器获取实际配置
    
    // Fetch configuration from server
    fetch('/config')
        .then(response => response.json())
        .then(config => {
            IMAGE_BASE_URL = config.IMAGE_BASE_URL;
            useWebP = config.USE_WEBP !== false; // 获取WebP配置
            console.log(`配置加载完成: IMAGE_BASE_URL=${IMAGE_BASE_URL}, 使用WebP=${useWebP}`);
            // Proceed with the rest of the logic
            initGallery();
        })
        .catch(error => console.error('Error loading config:', error));

    // 检查浏览器是否支持WebP
    function checkWebPSupport() {
        const webpTest = new Image();
        webpTest.onload = function() {
            useWebP = true; // 浏览器支持WebP
            console.log('浏览器支持WebP格式');
        };
        webpTest.onerror = function() {
            useWebP = false; // 浏览器不支持WebP
            console.log('浏览器不支持WebP格式，将使用JPEG');
        };
        webpTest.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vv9UAA=';
    }
    
    // 执行WebP支持检查
    checkWebPSupport();

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
        
        // 用于追踪已加载图片，避免重复加载
        let loadedImageUrls = new Set();
        
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

        // 图片筛选功能 - 修复重置逻辑
        function filterImages(tag) {
            // 移除底部"已全部加载完成"的提示消息（如果存在）
            const loadedMsg = document.getElementById('all-loaded-message');
            if (loadedMsg) {
                loadedMsg.remove();
            }
            
            // 移除临时加载消息（如果存在）
            const tempMsg = document.getElementById('temp-loading-msg');
            if (tempMsg) {
                tempMsg.remove();
            }
            
            // 重要：重置已加载图片集合
            loadedImageUrls.clear();
            console.log(`标签切换到: ${tag}, 已清空已加载图片缓存`);

            currentTag = tag;
            currentIndex = 0;
            imagesLoadedCount = 0;
            loadingImagesCount = 0;
            
            // 清除所有列并重新创建
            createColumns();

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
                
                // 在组合图片时进行去重，防止不同文件夹中存在相同图片
                const uniqueImageUrls = new Set();
                
                folderKeys.forEach(key => {
                    // 同一个文件夹内的图片保持连续顺序
                    imageUrls[key].forEach(img => {
                        // 使用原图URL作为唯一标识
                        if (!uniqueImageUrls.has(img.original)) {
                            uniqueImageUrls.add(img.original);
                            allImages.push(img);
                        }
                    });
                });
                
                console.log(`全部标签: 收集了 ${allImages.length} 张唯一图片`);
                imageUrls['all'] = allImages;
            }

            // 分页加载第一批图片
            loadNextImages();
        }

        // 创建列元素
        function createColumns() {
            // 清空旧的列
            columnElements.forEach(column => {
                if (column.parentNode === galleryElement) {
                    galleryElement.removeChild(column);
                }
            });
            columnElements = [];
            
            for (let i = 0; i < columns; i++) {
                const column = document.createElement('div');
                column.classList.add('column');
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
            return minIndex;
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
            
            console.log(`调整列数: ${columns} -> ${computedColumns}`);
            
            // 记录现有图片
            const loadedImages = Array.from(document.querySelectorAll('.gallery img'));
            
            // 创建图片URL的集合，用于去重
            const imageUrlSet = new Set();
            
            // 根据原始顺序排序图片，并去除重复
            const uniqueImages = loadedImages.filter(img => {
                const originalUrl = img.getAttribute('data-original');
                if (imageUrlSet.has(originalUrl)) {
                    // 如果已经有相同URL的图片，删除这个重复的
                    if (img.parentNode) {
                        console.log('发现重复图片，删除:', originalUrl);
                        img.parentNode.removeChild(img);
                    }
                    return false;
                }
                imageUrlSet.add(originalUrl);
                return true;
            }).sort((a, b) => {
                const orderA = parseInt(a.dataset.originalOrder || 0);
                const orderB = parseInt(b.dataset.originalOrder || 0);
                return orderA - orderB;
            });
            
            console.log(`调整布局: 共有 ${loadedImages.length} 张图片，去重后 ${uniqueImages.length} 张`);
            
            // 更新全局变量
            columns = computedColumns;
            imagesPerLoad = computedImagesPerLoad;
            
            // 创建新列
            createColumns();
            
            // 重新分配图片
            distributeImagesInOriginalOrder(uniqueImages);
            
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
            
            // 创建图片URL的集合，用于最后一次检查去重
            const finalImageUrlSet = new Set();
            
            // 逐个将图片添加到最短的列，确保不会有重复
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                const originalUrl = img.getAttribute('data-original');
                
                // 最后一次去重检查
                if (finalImageUrlSet.has(originalUrl)) {
                    console.log('分配时发现重复图片，跳过:', originalUrl);
                    continue;
                }
                finalImageUrlSet.add(originalUrl);
                
                // 如果图片没有原始序号，则添加一个
                if (!img.dataset.originalOrder) {
                    img.dataset.originalOrder = i;
                }
                
                // 将图片添加到最短的列
                const shortestColumnIndex = getShortestColumn();
                columnElements[shortestColumnIndex].appendChild(img);
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

        // 修改 loadNextImages 函数，添加去重逻辑
        function loadNextImages() {
            const images = imageUrls[currentTag] || [];
            
            // 检查是否还有更多图片需要加载
            if (currentIndex >= images.length) {
                handleAllImagesLoaded();
                return;
            }

            // 设置加载状态
            const tempLoadingMsg = document.createElement('div');
            tempLoadingMsg.id = 'temp-loading-msg';
            tempLoadingMsg.textContent = '加载中...';
            tempLoadingMsg.style.textAlign = 'center';
            tempLoadingMsg.style.margin = '20px 0';
            tempLoadingMsg.style.padding = '10px';
            tempLoadingMsg.style.color = '#777';
            
            // 只有在不存在加载消息时才添加
            if (!document.getElementById('temp-loading-msg')) {
                document.querySelector('footer').before(tempLoadingMsg);
            }
            
            // 确保gallery可见
            const galleryElement = document.querySelector('.gallery');
            if (galleryElement.style.opacity !== '1') {
                galleryElement.style.opacity = '1';
                document.querySelector('footer').style.opacity = '1';
                loadingElement.classList.add('hidden');
            }
            
            // 计算需要加载的图片数量
            const viewportHeight = window.innerHeight;
            const headerHeight = document.querySelector('header').offsetHeight;
            const availableHeight = viewportHeight - headerHeight;
            const avgImageHeight = 200; 
            const imagesPerRow = columns;
            const rowsToFillScreen = Math.ceil(availableHeight / avgImageHeight) + 1;
            const additionalRows = 3; // 确保预加载至少3行
            const totalRowsToLoad = rowsToFillScreen + additionalRows;
            const maxImagesToLoad = totalRowsToLoad * imagesPerRow;
            
            // 确保至少加载一定数量的图片
            let remainingToLoad = Math.max(imagesPerRow * 3, maxImagesToLoad - document.querySelectorAll('.gallery img').length);
            
            console.log(`准备加载一批新图片: 目标数量 ${remainingToLoad}, 当前索引 ${currentIndex}, 总图片数 ${images.length}`);
            
            // 单张图片加载计数器
            let loadedInThisBatch = 0;
            const batchStart = Date.now();
            
            // 递归加载单张图片
            function loadSingleImage(index) {
                // 检查是否完成加载
                if (index >= images.length || remainingToLoad <= 0) {
                    // 移除加载消息
                    const tempMsg = document.getElementById('temp-loading-msg');
                    if (tempMsg) tempMsg.remove();
                    
                    if (index >= images.length) {
                        console.log('所有图片已加载完毕');
                        handleAllImagesLoaded();
                    } else {
                        console.log(`本批次加载完成，共加载 ${loadedInThisBatch} 张图片`);
                        // 预加载下一批
                        preloadNextBatchImages();
                        
                        // 再次检查是否需要加载更多
                        checkIfMoreImagesNeeded();
                    }
                    
                    // 重置滚动加载状态
                    setTimeout(() => {
                        isScrollLoading = false;
                    }, 200);
                    
                    return;
                }
                
                const imageData = images[index];
                const imageUrl = imageData.thumbnail;
                const originalUrl = imageData.original;
                
                // 更严格的去重：检查缩略图和原图URL
                if (loadedImageUrls.has(imageUrl) || document.querySelector(`.gallery img[data-original="${originalUrl}"]`)) {
                    console.log(`跳过已加载图片: ${imageUrl}`);
                    currentIndex++;
                    loadSingleImage(currentIndex);
                    return;
                }
                
                // 图片加载 - 采用懒加载策略
                const img = new Image();
                
                // 设置数据属性而不是直接设置src，让IntersectionObserver处理加载
                img.dataset.src = imageUrl;
                img.setAttribute('data-original', imageData.original);
                img.setAttribute('data-preview', imageData.thumbnail);
                img.alt = '图片';
                
                // 添加loading="lazy"属性作为浏览器原生懒加载支持
                img.loading = 'lazy';
                
                // 设置空白占位符，避免页面跳动
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
                
                // 添加点击事件
                img.addEventListener('click', function() {
                    openModal(this.getAttribute('data-original'), this.getAttribute('data-preview'));
                });
                
                img.onload = function() {
                    // 只有当实际图片加载完成时才处理
                    if (this.src !== img.dataset.src && this.src.indexOf('data:image/svg+xml') === 0) {
                        return;
                    }
                    
                    try {
                        // 再次检查DOM中是否已存在此图片（确保在加载过程中没有被其他过程添加）
                        if (document.querySelector(`.gallery img[data-original="${originalUrl}"]`)) {
                            console.log(`图片已存在于DOM中: ${originalUrl}`);
                            currentIndex++;
                            loadSingleImage(currentIndex);
                            return;
                        }
                        
                        // 添加到已加载集合
                        loadedImageUrls.add(imageUrl);
                        
                        // 添加到最短列
                        const shortestColumnIndex = getShortestColumn();
                        columnElements[shortestColumnIndex].appendChild(img);
                        
                        // 设置加载动画
                        setTimeout(() => {
                            img.classList.add('loaded');
                        }, 10);
                        
                        // 更新计数
                        currentIndex++;
                        imagesLoadedCount++;
                        remainingToLoad--;
                        loadedInThisBatch++;
                        
                        // 添加序号
                        img.dataset.originalOrder = currentIndex - 1;
                        
                        // 更新悬停效果
                        updateHoverEffects();
                        
                        // 控制加载速度，防止一次加载过多图片导致卡顿
                        const timeElapsed = Date.now() - batchStart;
                        if (loadedInThisBatch >= 20 && timeElapsed < 500) {
                            // 加载速度过快，稍微延迟下一张
                            setTimeout(() => {
                                if (remainingToLoad > 0 && currentIndex < images.length) {
                                    loadSingleImage(currentIndex);
                                } else {
                                    // 移除加载消息
                                    const tempMsg = document.getElementById('temp-loading-msg');
                                    if (tempMsg) tempMsg.remove();
                                    
                                    if (currentIndex >= images.length) {
                                        handleAllImagesLoaded();
                                    } else {
                                        preloadNextBatchImages();
                                    }
                                    
                                    // 重置滚动加载状态
                                    isScrollLoading = false;
                                }
                            }, 50);
                        } else {
                            // 正常加载速度，立即加载下一张
                            if (remainingToLoad > 0 && currentIndex < images.length) {
                                loadSingleImage(currentIndex);
                            } else {
                                // 移除加载消息
                                const tempMsg = document.getElementById('temp-loading-msg');
                                if (tempMsg) tempMsg.remove();
                                
                                if (currentIndex >= images.length) {
                                    handleAllImagesLoaded();
                                } else {
                                    preloadNextBatchImages();
                                }
                                
                                // 重置滚动加载状态
                                isScrollLoading = false;
                            }
                        }
                    } catch (err) {
                        console.error(`图片处理过程中发生错误:`, err);
                        currentIndex++;
                        loadSingleImage(currentIndex);
                    }
                };
                
                img.onerror = function() {
                    console.error('图片加载失败:', imageUrl);
                    
                    // 检查是否为缩略图加载失败
                    if (imageUrl.includes('/preview/')) {
                        // 确保配置已加载
                        if (!IMAGE_BASE_URL) {
                            console.error('配置尚未加载完成，无法生成缩略图');
                            // 延迟一段时间后重试这张图片
                            setTimeout(() => {
                                img.src = `${imageUrl}?retry=1`;
                            }, 1000);
                            return;
                        }
                        
                        // 从URL中提取原始图片路径
                        const originalKey = imageData.original.replace(`${IMAGE_BASE_URL}/`, '');
                        console.log(`尝试生成缩略图: ${originalKey}`);
                        
                        // 触发缩略图生成
                        fetch(`/thumbnail/${encodeURIComponent(originalKey)}`)
                            .then(response => {
                                if (response.ok) {
                                    console.log(`缩略图已生成，重新加载图片`);
                                    // 添加时间戳防止浏览器缓存
                                    img.src = `${imageUrl}?t=${new Date().getTime()}`;
                                } else {
                                    console.error('缩略图生成失败，跳到下一张');
                                    currentIndex++;
                                    loadSingleImage(currentIndex);
                                }
                            })
                            .catch(err => {
                                console.error('缩略图请求出错:', err);
                                currentIndex++;
                                loadSingleImage(currentIndex);
                            });
                    } else {
                        // 非缩略图加载失败，直接跳到下一张
                        currentIndex++;
                        loadSingleImage(currentIndex);
                    }
                };
                
                // 添加到最短列，让IntersectionObserver进行真正的图片加载
                const shortestColumnIndex = getShortestColumn();
                columnElements[shortestColumnIndex].appendChild(img);
                
                // 应用懒加载
                setupLazyLoading();
            }
            
            // 开始加载第一张图片
            isScrollLoading = true;
            loadSingleImage(currentIndex);
        }

        // 优化滚动检测
        let lastScrollY = window.scrollY;
        let scrollDelta = 0;

        window.addEventListener('scroll', () => {
            // header 隐藏逻辑
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
            
            // 防止重复触发加载事件
            if (scrollTriggerTimeout) {
                clearTimeout(scrollTriggerTimeout);
            }
            
            // 快速检测是否需要加载更多图片
            scrollTriggerTimeout = setTimeout(() => {
                // 避免重复加载
                if (isScrollLoading) return;
                
                // 检查是否还有图片可加载
                if (currentIndex >= (imageUrls[currentTag] || []).length) return;
                
                // 计算滚动位置
                const windowHeight = window.innerHeight;
                const documentHeight = Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight
                );
                const scrollRemaining = documentHeight - (windowHeight + currentScrollY);
                
                // 预加载阈值 - 更积极地提前加载
                const rowHeight = 200;
                const preloadThreshold = rowHeight * 5; // 提前5行触发加载
                
                if (scrollRemaining < preloadThreshold) {
                    loadNextImages();
                }
            }, 120); // 减少延迟，更快响应滚动
        });

        // 预加载下一批图片的缩略图
        function preloadNextBatchImages() {
            const images = imageUrls[currentTag] || [];
            const startIndex = currentIndex;
            const endIndex = Math.min(startIndex + imagesPerLoad, images.length);
            
            // 如果没有更多图片需要预加载，则退出
            if (startIndex >= endIndex) return;
            
            console.log(`预加载下一批图片缩略图: ${startIndex} - ${endIndex-1}`);
            
            // 创建一个队列来控制并发请求数量
            const queue = [];
            const MAX_CONCURRENT = 3; // 最大并发数量
            let activeRequests = 0;
            
            // 预加载处理函数
            function processQueue() {
                if (queue.length === 0 || activeRequests >= MAX_CONCURRENT) return;
                
                activeRequests++;
                const imageData = queue.shift();
                const imageUrl = imageData.thumbnail;
                
                // 检查是否需要预加载
                if (loadedImageUrls.has(imageUrl) || document.querySelector(`.gallery img[data-original="${imageData.original}"]`)) {
                    // 已加载过，跳过
                    activeRequests--;
                    processQueue();
                    return;
                }
                
                // 从URL中提取原始图片路径
                if (imageUrl.includes('/preview/') && IMAGE_BASE_URL) {
                    const originalKey = imageData.original.replace(`${IMAGE_BASE_URL}/`, '');
                    
                    // 静默请求缩略图生成，不等待结果
                    fetch(`/thumbnail/${encodeURIComponent(originalKey)}`)
                        .then(() => {
                            // 完成后减少活跃请求计数并继续队列
                            activeRequests--;
                            processQueue();
                        })
                        .catch(err => {
                            console.error('预加载缩略图出错:', err);
                            activeRequests--;
                            processQueue();
                        });
                } else {
                    activeRequests--;
                    processQueue();
                }
            }
            
            // 将需要预加载的图片添加到队列
            for (let i = startIndex; i < endIndex; i++) {
                queue.push(images[i]);
            }
            
            // 开始处理队列
            for (let i = 0; i < Math.min(MAX_CONCURRENT, queue.length); i++) {
                processQueue();
            }
        }
        
        // 在初始化加载完成后调用
        function handleAllImagesLoaded() {
            console.log('所有图片已加载完毕');
            const loadedMsg = document.createElement('div');
            loadedMsg.id = 'all-loaded-message';
            loadedMsg.style.textAlign = 'center';
            loadedMsg.style.margin = '20px 0';
            loadedMsg.style.padding = '10px';
            loadedMsg.style.color = '#777';
            loadedMsg.textContent = '已全部加载完成';
            
            // 添加到底部
            if (!document.getElementById('all-loaded-message')) {
                document.querySelector('footer').before(loadedMsg);
            }
            
            // 移除加载消息
            const tempMsg = document.getElementById('temp-loading-msg');
            if (tempMsg) tempMsg.remove();
            
            // 重置滚动加载状态
            isScrollLoading = false;
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
            
            // 取消之前的请求
            if (currentImageRequest) {
                currentImageRequest.abort();
            }
            if (currentExifRequest) {
                currentExifRequest.abort();
            }

            modal.style.display = 'block';
            document.body.classList.add('no-scroll');
            
            // 显示友好的加载状态
            exifInfo.innerHTML = '<p>加载原图及EXIF数据中...</p>';

            // 创建新的控制器
            const imageController = new AbortController();
            const exifController = new AbortController();
            currentImageRequest = imageController;
            currentExifRequest = exifController;

            // 先展示预览图并添加模糊效果
            modalImg.src = preview;
            modalImg.style.filter = 'blur(10px)'; // 降低模糊程度，减少处理负担
            
            // 确保模糊效果有平滑过渡
            modalImg.style.transition = 'filter 0.3s ease';

            // 如果使用WebP且是预览图，检查是否需要转换URL
            if (useWebP && preview.indexOf('.webp') === -1 && preview.indexOf('/preview/') !== -1) {
                const previewBase = preview.substring(0, preview.lastIndexOf('.'));
                preview = `${previewBase}.webp`;
            }

            // 加载高清图
            const highResImage = new Image();
            
            // 可以考虑根据网络状况动态降低高清图质量
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection && (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
                // 如果是省流量模式或网络很慢，尝试使用中等质量的图片
                console.log('检测到网络状况不佳，降低图片质量');
                // 这里可以根据服务器的实际实现调整URL
                // 例如: original = original.replace('/original/', '/medium/');
            }
            
            highResImage.onload = () => {
                if (!imageController.signal.aborted) {
                    modalImg.src = original;
                    modalImg.style.filter = 'blur(0px)';
                    currentImageRequest = null;
                }
            };
            
            highResImage.onerror = () => {
                if (!imageController.signal.aborted) {
                    console.error('加载高清图失败:', original);
                    // 失败时直接使用预览图并移除模糊
                    modalImg.style.filter = 'blur(0px)';
                    exifInfo.innerHTML += '<p style="color:red;">原图加载失败</p>';
                }
            };
            
            // 开始加载高清图
            highResImage.src = original;

            // 获取 EXIF 数据 - 与图片加载分离处理
            setTimeout(() => {
                if (exifController.signal.aborted) return;
                
                fetch(`/exif/${encodeURIComponent(original.replace(IMAGE_BASE_URL + '/', ''))}`, { 
                    signal: exifController.signal,
                    headers: { 'Cache-Control': 'no-cache' } // 避免缓存问题
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP错误 ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (!exifController.signal.aborted) {
                        try {
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
                        } catch (error) {
                            console.error('EXIF数据处理错误:', error);
                            exifInfo.innerHTML = '<p>EXIF数据处理出错</p>';
                        }
                        
                        currentExifRequest = null;
                    }
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error('获取EXIF数据出错:', error);
                        if (!exifController.signal.aborted) {
                            exifInfo.innerHTML = '<p>无法加载EXIF数据</p>';
                        }
                    }
                });
            }, 100); // 延迟执行EXIF数据获取，优先加载图片
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

        // 图片加载优化函数 - 使用IntersectionObserver实现懒加载
        function setupLazyLoading() {
            if ('IntersectionObserver' in window) {
                const lazyImageObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            if (img.dataset.src) {
                                img.src = img.dataset.src;
                                img.removeAttribute('data-src');
                                observer.unobserve(img);
                            }
                        }
                    });
                }, {
                    rootMargin: '200px 0px', // 提前200px开始加载
                    threshold: 0.01 // 只要有1%可见就开始加载
                });
                
                // 观察所有带有data-src属性的图片
                document.querySelectorAll('img[data-src]').forEach(img => {
                    lazyImageObserver.observe(img);
                });
            } else {
                // 回退到简单的scroll事件监听
                const lazyLoadImages = () => {
                    const lazyImages = document.querySelectorAll('img[data-src]');
                    lazyImages.forEach(img => {
                        const rect = img.getBoundingClientRect();
                        if (rect.top < window.innerHeight + 200) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                    });
                    
                    if (document.querySelectorAll('img[data-src]').length === 0) {
                        window.removeEventListener('scroll', lazyLoad);
                    }
                };
                
                const lazyLoad = () => {
                    requestAnimationFrame(lazyLoadImages);
                };
                
                window.addEventListener('scroll', lazyLoad);
                lazyLoad(); // 初始检查
            }
        }
    }
});