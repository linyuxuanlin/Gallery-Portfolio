document.addEventListener('DOMContentLoaded', () => {
    let IMAGE_BASE_URL;
    let columns = 3; // Default number of columns
    let imagesPerLoad = 10; // Default images per load
    const SCROLL_THRESHOLD = 100; // Scroll threshold to start hiding the header
    let currentImageRequest = null; // Variable to hold the current image request
    let currentExifRequest = null; // Variable to hold the current EXIF request
    let isPageLoading = true; // 页面加载标志
    let lastWidth = window.innerWidth;
    let lastScrollY = window.scrollY;
    let scrollDelta = 0;
    let scrollThrottleTimer = null;
    let isScrollLoading = false; // 是否正在通过滚动加载图片
    
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
        let scrollThrottleTimer = null;
        let lastScrollY = window.scrollY;
        let scrollDelta = 0;
        let loadingImages = []; // 正在加载中的图片
        
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
        
            // 过滤掉 'all' 和 '0_preview' 标签，并按字母顺序排序
            const filteredTags = tags.filter(tag => tag !== 'all' && tag !== '0_preview').sort();
            
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
            // 重要：取消正在加载中的图片
            loadingImages.forEach((img) => {
                img.src = ""; // 清空图片 src，取消加载
                img.onload = null; // 清理 onload 事件监听器
                img.onerror = null; // 清理 onerror 事件监听器
                img.removeEventListener("click", img.imgClickHandler); // 清理 click 事件监听器
            });
            loadingImages = [];
            console.log(`标签切换到: ${tag}, 已清空已加载图片缓存`);

            currentTag = tag;
            currentIndex = 0;
            imagesLoadedCount = 0;
            loadingImagesCount = 0;
            
            // 清除所有列并重新创建
            createColumns();

            // 如果是 "all" 标签，则组合所有图片（排除 0_preview 文件夹）
            if (tag === 'all') {
                // 获取所有非 0_preview 的文件夹名
                const folderKeys = Object.keys(imageUrls).filter(key => key !== '0_preview');
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
            loadNextImages(tag);
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
            // 每行图片高度约为200px，所以两行图片高度大约是400px
            const rowHeight = 200; // 预估每行高度
            const requiredHeight = viewportHeight + (rowHeight * 2); // 可视区域 + 两行

            console.log(`检查是否需要加载更多: 内容高度=${contentHeight}, 所需高度=${requiredHeight}`);
            
            if (contentHeight < requiredHeight) {
                if (currentIndex < (imageUrls[currentTag] || []).length) {
                    // 使用setTimeout确保DOM更新后再检查
                    setTimeout(() => {
                        loadNextImages(currentTag);
                    }, 100);
                }
            }
        }

        // 修改 loadNextImages 函数，添加去重逻辑
        function loadNextImages(tag) {
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
            
            // 计算屏幕能显示多少行
            const rowsToFillScreen = Math.ceil(availableHeight / avgImageHeight);
            // 额外加载2行
            const additionalRows = 2; 
            const totalRowsToLoad = rowsToFillScreen + additionalRows;
            const maxImagesToLoad = totalRowsToLoad * imagesPerRow;
            
            // 计算当前已加载的图片数量
            const loadedImagesCount = document.querySelectorAll('.gallery img').length;
            
            // 计算还需要加载多少图片
            let remainingToLoad = Math.max(imagesPerRow, maxImagesToLoad - loadedImagesCount);
            
            console.log(`准备加载图片: 当前已加载=${loadedImagesCount}, 目标总数=${maxImagesToLoad}, 还需加载=${remainingToLoad}`);
            
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
                
                // 图片加载
                const img = new Image();
                
                img.onload = function() {
                    if (tag !== currentTag) {
                        console.log(`tag已经切换：当前选中tag:${currentTag}，本请求tag:${tag}，跳过加载`);
                        return;
                    }
                    loadingImages.splice(loadingImages.indexOf(img), 1);
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
                    // 在图片加载失败时添加重试逻辑
                    console.log('尝试直接从服务器请求缩略图...');
                    setTimeout(() => {
                        currentIndex++;
                        loadSingleImage(currentIndex);
                    }, 500); // 添加延迟，避免频繁请求
                };
                
                // 构建完整URL (如果需要)
                let fullImageUrl = imageUrl;
                if (imageUrl.startsWith('/thumbnail/')) {
                    // 这是相对路径，需要添加域名
                    fullImageUrl = window.location.origin + imageUrl;
                    console.log(`缩略图路径转换: ${imageUrl} -> ${fullImageUrl}`);
                }
                
                // 设置图片属性
                img.src = fullImageUrl;
                img.setAttribute('data-original', imageData.original);
                img.setAttribute('data-preview', imageData.thumbnail);
                img.alt = '图片';
                
                // 添加点击事件
                const imgClickHandler = function() {
                    // 使用完整URL打开模态窗口
                    let previewUrl = this.getAttribute('data-preview');
                    if (previewUrl.startsWith('/thumbnail/')) {
                        previewUrl = window.location.origin + previewUrl;
                    }
                    openModal(this.getAttribute('data-original'), previewUrl);
                }
                img.imgClickHandler = imgClickHandler;
                img.addEventListener('click', imgClickHandler);
                loadingImages.push(img);
            }
            
            // 开始加载第一张图片
            isScrollLoading = true;
            loadSingleImage(currentIndex);
        }

        // 优化滚动检测
        window.addEventListener('scroll', () => {
            // 如果正在加载图片，不触发新的加载
            if (isScrollLoading) return;
            
            // 节流处理，避免频繁触发
            if (scrollThrottleTimer) return;
            
            scrollThrottleTimer = setTimeout(() => {
                scrollThrottleTimer = null;
                
                // 计算滚动方向和距离
                const currentScrollY = window.scrollY;
                scrollDelta = currentScrollY - lastScrollY;
                lastScrollY = currentScrollY;
                
                // 检查是否滚动到底部附近
                const documentHeight = document.documentElement.scrollHeight;
                const scrollPosition = window.scrollY + window.innerHeight;
                const scrollThreshold = 500; // 距离底部多远时触发加载
                
                // 计算页面高度和内容高度
                const viewportHeight = window.innerHeight;
                const contentHeight = Math.max(...columnElements.map(col => col.offsetHeight || 0));
                
                // 判断是否需要加载更多图片
                const needsMoreContent = contentHeight < (viewportHeight + (2 * 200)); // 视口高度 + 两行
                
                if ((scrollPosition > documentHeight - scrollThreshold) || needsMoreContent) {
                    // 如果接近底部或内容不足，检查是否需要加载更多
                    if (currentIndex < (imageUrls[currentTag] || []).length && !isScrollLoading) {
                        console.log(`触发滚动加载: 滚动位置=${scrollPosition}, 文档高度=${documentHeight}, 内容高度=${contentHeight}`);
                        isScrollLoading = true;
                        loadNextImages(currentTag);
                    }
                }
            }, 120); // 减少延迟，更快响应滚动
        });

        // 更智能的预加载图片函数
        function preloadNextBatchImages() {
            const images = imageUrls[currentTag] || [];
            
            // 如果没有更多图片，直接返回
            if (currentIndex >= images.length) return;
            
            // 计算预加载行数
            const imagesPerRow = columns;
            const rowsToPreload = 2; // 只预加载比可视页面多2行的图片
            const preloadCount = imagesPerRow * rowsToPreload;
            
            // 计算预加载范围
            const endIndex = Math.min(currentIndex + preloadCount, images.length);
            
            // 创建预加载容器
            let preloadContainer = document.getElementById('preload-container');
            if (!preloadContainer) {
                preloadContainer = document.createElement('div');
                preloadContainer.id = 'preload-container';
                preloadContainer.style.display = 'none';
                document.body.appendChild(preloadContainer);
            }
            
            // 清空之前的预加载图片
            preloadContainer.innerHTML = '';
            
            // 预加载下一批图片
            for (let i = currentIndex; i < endIndex; i++) {
                const imageData = images[i];
                const preloadImg = new Image();
                
                // 构建完整URL (如果需要)
                let thumbnailUrl = imageData.thumbnail;
                if (thumbnailUrl.startsWith('/thumbnail/')) {
                    // 这是相对路径，需要添加域名
                    thumbnailUrl = window.location.origin + thumbnailUrl;
                    console.log(`预加载图片路径转换: ${imageData.thumbnail} -> ${thumbnailUrl}`);
                }
                
                preloadImg.src = thumbnailUrl;
                preloadContainer.appendChild(preloadImg);
            }
            
            console.log(`预加载了${endIndex - currentIndex}张图片，相当于${Math.ceil((endIndex - currentIndex) / imagesPerRow)}行`);
        }

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
            // 确保 preview 是完整URL
            if (preview && preview.startsWith('/thumbnail/')) {
                preview = window.location.origin + preview;
                console.log(`模态窗口中转换预览图路径: ${preview}`);
            }
            
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
            console.log(`设置模态窗口预览图: ${preview}`);
            modalImg.src = preview;
            modalImg.style.filter = 'blur(10px)'; // 降低模糊程度，减少处理负担
            
            // 确保模糊效果有平滑过渡
            modalImg.style.transition = 'filter 0.3s ease';

            // 加载高清图
            const highResImage = new Image();
            highResImage.onload = () => {
                if (!imageController.signal.aborted) {
                    console.log(`高清图加载完成，设置到模态窗口: ${original}`);
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
                
                // 确保使用正确的路径格式获取EXIF数据
                console.log(`准备获取EXIF数据: ${original}`);
                
                fetch(`/exif/${encodeURIComponent(original)}`, { 
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
                            console.log(`获取到EXIF数据: ${JSON.stringify(data)}`);
                            
                            // 检查是否有错误信息
                            if (data.error) {
                                console.warn(`EXIF数据包含错误: ${data.error}`);
                                exifInfo.innerHTML = '<p>EXIF数据不可用</p>';
                                return;
                            }
                            
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
    }
});
