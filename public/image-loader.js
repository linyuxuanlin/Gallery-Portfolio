// 图片加载模块
class ImageLoader {
    constructor(galleryElement, dataLoader) {
        this.galleryElement = galleryElement;
        this.dataLoader = dataLoader;
        this.columns = 3;
        this.columnElements = [];
        this.currentIndex = 0;
        this.imagesLoadedCount = 0;
        this.loadingImagesCount = 0;
        this.currentTag = null;
        this.loadedImageUrls = new Set();
        this.loadingImages = [];
        this.isScrollLoading = false;
        
        // 新增：大图加载队列和状态管理
        this.highResQueue = [];
        this.loadingHighRes = new Map(); // 存储正在加载的高清图
        this.loadedHighRes = new Set(); // 存储已加载的高清图
        this.loadingOverlays = new Map(); // 存储加载遮罩元素
        
        // 滚动相关状态初始化
        this.scrollThrottleTimer = null;
        this.lastScrollY = window.scrollY;
        this.scrollDelta = 0;
        this.lastWidth = window.innerWidth;
    }

    init() {
        this.createColumns();
        this.setupScrollListener();
        this.setupResizeListener();
        
        // 迁移现有图片到容器结构（如果有的话）
        this.migrateExistingImages();
    }
    
    // 迁移现有图片到容器结构
    migrateExistingImages() {
        const existingImages = document.querySelectorAll('.gallery .column > img');
        existingImages.forEach(img => {
            // 检查图片是否已经在容器中
            if (!img.closest('.image-container')) {
                // 创建容器
                const container = document.createElement('div');
                container.className = 'image-container';
                container.style.cssText = `
                    position: relative;
                    display: block;
                    margin-bottom: 0.8em;
                `;
                
                // 将图片移动到容器中
                img.parentNode.insertBefore(container, img);
                container.appendChild(img);
            }
        });
    }

    // 创建列元素
    createColumns() {
        // 清空旧的列
        this.columnElements.forEach(column => {
            if (column.parentNode === this.galleryElement) {
                this.galleryElement.removeChild(column);
            }
        });
        this.columnElements = [];
        
        for (let i = 0; i < this.columns; i++) {
            const column = document.createElement('div');
            column.classList.add('column');
            this.columnElements.push(column);
            this.galleryElement.appendChild(column);
        }
    }

    // 获取最短列的索引
    getShortestColumn() {
        let minIndex = 0;
        let minHeight = this.columnElements[0].offsetHeight;
        for (let i = 1; i < this.columnElements.length; i++) {
            if (this.columnElements[i].offsetHeight < minHeight) {
                minHeight = this.columnElements[i].offsetHeight;
                minIndex = i;
            }
        }
        return minIndex;
    }

    // 更新列数及每次加载的图片数
    updateColumns() {
        const width = window.innerWidth;
        let computedColumns, computedImagesPerLoad;
        
        // 计算应用的列数和每次加载图片数量
        if (width < 600) {
            computedColumns = 2;
            computedImagesPerLoad = 8;
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
        if (computedColumns === this.columns) {
            this.imagesPerLoad = computedImagesPerLoad;
            return;
        }
        
        console.log(`调整列数: ${this.columns} -> ${computedColumns}`);
        
        // 记录现有图片
        const loadedImages = Array.from(document.querySelectorAll('.gallery img'));
        
        // 创建图片URL的集合，用于去重
        const imageUrlSet = new Set();
        
        // 根据原始顺序排序图片，并去除重复
        const uniqueImages = loadedImages.filter(img => {
            const originalUrl = img.getAttribute('data-original');
            if (imageUrlSet.has(originalUrl)) {
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
        this.columns = computedColumns;
        this.imagesPerLoad = computedImagesPerLoad;
        
        // 创建新列
        this.createColumns();
        
        // 重新分配图片
        this.distributeImagesInOriginalOrder(uniqueImages);
        
        // 更新其他设置
        setTimeout(() => {
            this.updateHoverEffects();
        }, 300);
        
        // 检查是否需要加载更多图片
        this.checkIfMoreImagesNeeded();
    }

    // 按照原始顺序分配图片
    distributeImagesInOriginalOrder(images) {
        if (images.length === 0) return;
        
        // 移除所有图片容器
        images.forEach(img => {
            const container = img.closest('.image-container');
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            } else if (img.parentNode) {
                // 如果没有容器，直接移除图片
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
            
            // 确保图片在容器中
            let container = img.closest('.image-container');
            if (!container) {
                // 如果图片不在容器中，创建容器
                container = document.createElement('div');
                container.className = 'image-container';
                container.style.cssText = `
                    position: relative;
                    display: block;
                    margin-bottom: 0.8em;
                `;
                container.appendChild(img);
            }
            
            // 将容器添加到最短的列
            const shortestColumnIndex = this.getShortestColumn();
            this.columnElements[shortestColumnIndex].appendChild(container);
        }
    }

    // 检查是否需要加载更多图片
    checkIfMoreImagesNeeded() {
        // 检查当前内容高度是否填满屏幕
        const viewportHeight = window.innerHeight;
        const contentHeight = Math.max(...this.columnElements.map(col => col.offsetHeight || 0));
        
        // 如果内容不足以填满屏幕+额外两行，加载更多
        const rowHeight = 200; // 预估每行高度
        const requiredHeight = viewportHeight + (rowHeight * 2);

        console.log(`检查是否需要加载更多: 内容高度=${contentHeight}, 所需高度=${requiredHeight}`);
        
        if (contentHeight < requiredHeight) {
            const images = this.getCurrentImages();
            if (this.currentIndex < images.length) {
                setTimeout(() => {
                    this.loadNextImages(this.currentTag);
                }, 100);
            }
        }
    }

    // 获取当前标签的图片
    getCurrentImages() {
        if (this.currentTag === 'all') {
            return this.dataLoader.getAllImages();
        } else {
            return this.dataLoader.getImagesByCategory(this.currentTag);
        }
    }

    // 加载下一批图片
    loadNextImages(tag) {
        const images = this.getCurrentImages();
        
        // 检查是否还有更多图片需要加载
        if (this.currentIndex >= images.length) {
            this.handleAllImagesLoaded();
            return;
        }

        // 设置加载状态
        this.showLoadingMessage();
        
        // 确保gallery可见
        if (this.galleryElement.style.opacity !== '1') {
            this.galleryElement.style.opacity = '1';
            document.querySelector('footer').style.opacity = '1';
            document.getElementById('loading').classList.add('hidden');
        }
        
        // 计算需要加载的图片数量
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const headerHeight = document.querySelector('header').offsetHeight;
        const availableHeight = viewportHeight - headerHeight;
        const imagesPerRow = this.columns;
        
        // 根据屏幕大小动态调整平均图片高度
        let avgImageHeight;
        if (viewportWidth < 600) {
            avgImageHeight = 180; // 手机端图片较小
        } else if (viewportWidth < 900) {
            avgImageHeight = 200; // 平板端
        } else if (viewportWidth < 1200) {
            avgImageHeight = 220; // 小桌面
        } else if (viewportWidth < 1500) {
            avgImageHeight = 240; // 大桌面
        } else {
            avgImageHeight = 260; // 超大屏幕
        }
        
        // 计算屏幕能显示多少行
        const rowsToFillScreen = Math.ceil(availableHeight / avgImageHeight);
        
        // 根据屏幕大小动态调整额外行数
        let additionalRows;
        if (viewportWidth < 600) {
            additionalRows = 3; // 手机端：更多预加载
        } else if (viewportWidth < 900) {
            additionalRows = 2; // 平板端：中等预加载
        } else if (viewportWidth < 1200) {
            additionalRows = 2; // 小桌面：中等预加载
        } else if (viewportWidth < 1500) {
            additionalRows = 1; // 大桌面：较少预加载
        } else {
            additionalRows = 1; // 超大屏幕：最少预加载
        }
        
        const totalRowsToLoad = rowsToFillScreen + additionalRows;
        const maxImagesToLoad = totalRowsToLoad * imagesPerRow;
        
        // 计算当前已加载的图片数量
        const loadedImagesCount = document.querySelectorAll('.gallery img').length;
        
        // 计算还需要加载多少图片
        let remainingToLoad = Math.max(imagesPerRow, maxImagesToLoad - loadedImagesCount);
        
        console.log(`准备加载图片: 屏幕=${viewportWidth}x${viewportHeight}, 列数=${imagesPerRow}, 平均高度=${avgImageHeight}, 当前已加载=${loadedImagesCount}, 目标总数=${maxImagesToLoad}, 还需加载=${remainingToLoad}`);
        
        // 单张图片加载计数器
        let loadedInThisBatch = 0;
        const batchStart = Date.now();
        
        // 递归加载单张图片
        const loadSingleImage = (index) => {
            // 检查是否完成加载
            if (index >= images.length || remainingToLoad <= 0) {
                this.hideLoadingMessage();
                
                if (index >= images.length) {
                    console.log('所有图片已加载完毕');
                    this.handleAllImagesLoaded();
                } else {
                    console.log(`本批次加载完成，共加载 ${loadedInThisBatch} 张图片`);
                    this.preloadNextBatchImages();
                    this.checkIfMoreImagesNeeded();
                }
                
                // 重置滚动加载状态
                setTimeout(() => {
                    this.isScrollLoading = false;
                    console.log('滚动加载状态已重置');
                }, 200);
                
                return;
            }
            
            const imageData = images[index];
            const imageUrl = imageData.preview;
            const originalUrl = imageData.original;
            
            // 更严格的去重：检查缩略图和原图URL
            if (this.loadedImageUrls.has(imageUrl) || document.querySelector(`.gallery img[data-original="${originalUrl}"]`)) {
                console.log(`跳过已加载图片: ${imageUrl}`);
                this.currentIndex++;
                loadSingleImage(this.currentIndex);
                return;
            }
            
            // 图片加载
            const img = new Image();
            
            // 预览图缺失检测
            let previewFailed = false;
            
            img.onload = () => {
                if (tag !== this.currentTag) {
                    console.log(`tag已经切换：当前选中tag:${this.currentTag}，本请求tag:${tag}，跳过加载`);
                    return;
                }
                this.loadingImages.splice(this.loadingImages.indexOf(img), 1);
                
                try {
                    // 再次检查DOM中是否已存在此图片
                    if (document.querySelector(`.gallery img[data-original="${originalUrl}"]`)) {
                        console.log(`图片已存在于DOM中: ${originalUrl}`);
                        this.currentIndex++;
                        loadSingleImage(this.currentIndex);
                        return;
                    }
                    
                    // 添加到已加载集合
                    this.loadedImageUrls.add(imageUrl);
                    
                    // 创建图片包装容器
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'image-container';
                    imgContainer.style.cssText = `
                        position: relative;
                        display: block;
                        margin-bottom: 0.8em;
                    `;
                    
                    // 将图片添加到容器中
                    imgContainer.appendChild(img);
                    
                    // 添加到最短列
                    const shortestColumnIndex = this.getShortestColumn();
                    this.columnElements[shortestColumnIndex].appendChild(imgContainer);
                    
                    // 设置加载动画
                    setTimeout(() => {
                        img.classList.add('loaded');
                    }, 10);
                    
                    // 更新计数
                    this.currentIndex++;
                    this.imagesLoadedCount++;
                    remainingToLoad--;
                    loadedInThisBatch++;
                    
                    // 添加序号
                    img.dataset.originalOrder = this.currentIndex - 1;
                    
                    // 继续加载下一张图片
                    loadSingleImage(this.currentIndex);
                    
                } catch (error) {
                    console.error('处理图片加载时出错:', error);
                    this.currentIndex++;
                    loadSingleImage(this.currentIndex);
                }
            };
            
            img.onerror = () => {
                console.warn(`预览图加载失败: ${imageUrl}`);
                this.loadingImages.splice(this.loadingImages.indexOf(img), 1);
                
                // 如果预览图加载失败，尝试加载原图
                if (!previewFailed) {
                    previewFailed = true;
                    console.log(`尝试加载原图: ${originalUrl}`);
                    img.src = originalUrl;
                    return;
                }
                
                // 如果原图也加载失败，跳过这张图片
                console.error(`原图也加载失败，跳过: ${originalUrl}`);
                this.currentIndex++;
                loadSingleImage(this.currentIndex);
            };
            
            // 设置图片属性
            img.src = imageUrl;
            img.alt = imageData.name || 'Gallery Image';
            img.dataset.original = originalUrl;
            img.dataset.preview = imageUrl;
            img.dataset.category = imageData.category || 'unknown';
            
            // 添加到加载中列表
            this.loadingImages.push(img);
            
            // 添加点击事件
            const imgClickHandler = () => {
                // 使用新的加载队列系统
                this.addToHighResQueue(originalUrl, imageUrl);
            };
            img.addEventListener('click', imgClickHandler);
            img.imgClickHandler = imgClickHandler;
        };
        
        // 开始加载第一张图片
        this.isScrollLoading = true;
        loadSingleImage(this.currentIndex);
    }

    // 显示加载消息
    showLoadingMessage() {
        if (!document.getElementById('temp-loading-msg')) {
            const tempLoadingMsg = document.createElement('div');
            tempLoadingMsg.id = 'temp-loading-msg';
            tempLoadingMsg.textContent = '加载中...';
            tempLoadingMsg.style.textAlign = 'center';
            tempLoadingMsg.style.margin = '20px 0';
            tempLoadingMsg.style.padding = '10px';
            tempLoadingMsg.style.color = '#777';
            document.querySelector('footer').before(tempLoadingMsg);
        }
    }

    // 隐藏加载消息
    hideLoadingMessage() {
        const tempMsg = document.getElementById('temp-loading-msg');
        if (tempMsg) tempMsg.remove();
    }

    // 预加载下一批图片
    preloadNextBatchImages() {
        const images = this.getCurrentImages();
        
        if (this.currentIndex >= images.length) return;
        
        // 根据屏幕大小和列数动态调整预加载数量
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 计算动态预加载数量
        let preloadCount;
        
        if (viewportWidth < 600) {
            // 手机端：预加载更多图片，确保滚动流畅
            const rowsToPreload = Math.ceil(viewportHeight / 200) + 2; // 屏幕高度对应的行数 + 2行
            preloadCount = this.columns * rowsToPreload;
        } else if (viewportWidth < 900) {
            // 平板端：中等预加载
            const rowsToPreload = Math.ceil(viewportHeight / 250) + 1;
            preloadCount = this.columns * rowsToPreload;
        } else if (viewportWidth < 1200) {
            // 小桌面：较少预加载
            const rowsToPreload = Math.ceil(viewportHeight / 300) + 1;
            preloadCount = this.columns * rowsToPreload;
        } else if (viewportWidth < 1500) {
            // 大桌面：更少预加载
            const rowsToPreload = Math.ceil(viewportHeight / 350) + 1;
            preloadCount = this.columns * rowsToPreload;
        } else {
            // 超大屏幕：最少预加载
            const rowsToPreload = Math.ceil(viewportHeight / 400) + 1;
            preloadCount = this.columns * rowsToPreload;
        }
        
        // 确保预加载数量在合理范围内
        preloadCount = Math.max(this.columns * 2, Math.min(preloadCount, this.columns * 8));
        
        const endIndex = Math.min(this.currentIndex + preloadCount, images.length);
        
        let preloadContainer = document.getElementById('preload-container');
        if (!preloadContainer) {
            preloadContainer = document.createElement('div');
            preloadContainer.id = 'preload-container';
            preloadContainer.style.display = 'none';
            document.body.appendChild(preloadContainer);
        }
        
        preloadContainer.innerHTML = '';
        
        for (let i = this.currentIndex; i < endIndex; i++) {
            const imageData = images[i];
            const preloadImg = new Image();
            preloadImg.src = imageData.preview;
            preloadContainer.appendChild(preloadImg);
        }
        
        console.log(`预加载了${endIndex - this.currentIndex}张图片 (屏幕: ${viewportWidth}x${viewportHeight}, 列数: ${this.columns}, 预加载: ${preloadCount})`);
    }

    // 处理所有图片加载完成
    handleAllImagesLoaded() {
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
        
        setTimeout(() => {
            window.scrollBy(0, 1);
            window.scrollBy(0, -1);
        }, 200);
    }

    // 设置滚动监听
    setupScrollListener() {
        window.addEventListener('scroll', () => {
            // 如果正在加载中，直接返回
            if (this.isScrollLoading) {
                console.log('滚动加载被阻止：正在加载中');
                return;
            }
            
            // 节流处理
            if (this.scrollThrottleTimer) return;
            
            this.scrollThrottleTimer = setTimeout(() => {
                this.scrollThrottleTimer = null;
                
                const currentScrollY = window.scrollY;
                this.scrollDelta = currentScrollY - this.lastScrollY;
                this.lastScrollY = currentScrollY;
                
                const documentHeight = document.documentElement.scrollHeight;
                const scrollPosition = window.scrollY + window.innerHeight;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // 根据屏幕大小动态调整滚动阈值
                let scrollThreshold;
                if (viewportWidth < 600) {
                    // 手机端：更早触发加载，确保流畅
                    scrollThreshold = viewportHeight * 0.8;
                } else if (viewportWidth < 900) {
                    // 平板端：中等阈值
                    scrollThreshold = viewportHeight * 0.6;
                } else if (viewportWidth < 1200) {
                    // 小桌面：较小阈值
                    scrollThreshold = viewportHeight * 0.5;
                } else if (viewportWidth < 1500) {
                    // 大桌面：更小阈值
                    scrollThreshold = viewportHeight * 0.4;
                } else {
                    // 超大屏幕：最小阈值
                    scrollThreshold = viewportHeight * 0.3;
                }
                
                const contentHeight = Math.max(...this.columnElements.map(col => col.offsetHeight || 0));
                const needsMoreContent = contentHeight < (viewportHeight + (2 * 200));
                
                if ((scrollPosition > documentHeight - scrollThreshold) || needsMoreContent) {
                    const images = this.getCurrentImages();
                    if (this.currentIndex < images.length && !this.isScrollLoading) {
                        console.log(`触发滚动加载: 滚动位置=${scrollPosition}, 文档高度=${documentHeight}, 阈值=${scrollThreshold}, 内容高度=${contentHeight}`);
                        this.isScrollLoading = true;
                        this.loadNextImages(this.currentTag);
                    }
                }
            }, 120);
        });
    }

    // 设置窗口大小变化监听
    setupResizeListener() {
        window.addEventListener('resize', () => {
            if (window.innerWidth !== this.lastWidth) {
                this.updateColumns();
                this.lastWidth = window.innerWidth;
                setTimeout(() => {
                    this.updateHoverEffects();
                }, 300);
            }
            this.setGalleryMarginTop();
        });
    }

    // 设置gallery的margin-top
    setGalleryMarginTop() {
        const headerHeight = document.querySelector('header').offsetHeight;
        this.galleryElement.style.marginTop = `${headerHeight + 20}px`;
    }

    // 更新悬停效果
    updateHoverEffects() {
        this.setupImageHoverEffects();
    }

    // 设置图片悬停效果
    setupImageHoverEffects() {
        if (window.hoverEffectObserver) {
            window.hoverEffectObserver.disconnect();
        }
        
        window.hoverEffectObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.tagName === 'IMG') {
                            this.addHoverEffect(node);
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll('img').forEach(img => this.addHoverEffect(img));
                        }
                    });
                }
            });
        });
        
        document.querySelectorAll('.gallery img').forEach(img => this.addHoverEffect(img));
        
        window.hoverEffectObserver.observe(this.galleryElement, {
            childList: true,
            subtree: true
        });
    }

    // 添加悬停效果
    addHoverEffect(img) {
        if (img.dataset.hoverInitialized) return;
        
        img.dataset.hoverInitialized = 'true';
        
        img.addEventListener('mouseenter', function() {
            this.classList.add('hover-active');
        });
        
        img.addEventListener('mouseleave', function() {
            this.classList.remove('hover-active');
        });
    }

    // 筛选图片
    filterImages(tag) {
        // 移除底部"已全部加载完成"的提示消息
        const loadedMsg = document.getElementById('all-loaded-message');
        if (loadedMsg) {
            loadedMsg.remove();
        }
        
        // 移除临时加载消息
        this.hideLoadingMessage();
        
        // 重置已加载图片集合
        this.loadedImageUrls.clear();
        
        // 取消正在加载中的图片
        this.loadingImages.forEach((img) => {
            img.src = "";
            img.onload = null;
            img.onerror = null;
            img.removeEventListener("click", img.imgClickHandler);
        });
        this.loadingImages = [];
        
        console.log(`标签切换到: ${tag}, 已清空已加载图片缓存`);

        this.currentTag = tag;
        this.currentIndex = 0;
        this.imagesLoadedCount = 0;
        this.loadingImagesCount = 0;
        
        // 清除所有列并重新创建
        this.createColumns();

        // 分页加载第一批图片
        this.loadNextImages(tag);
    }

    // 打开模态窗口
    openModal(original, preview) {
        console.log(`打开模态窗口: original=${original}, preview=${preview}`);
        
        const modal = document.getElementById('myModal');
        const modalImg = document.getElementById('img01');
        const exifInfo = document.getElementById('exif-info');
        
        // 移除所有图片的悬停状态
        document.querySelectorAll('.gallery img.hover-active').forEach(img => {
            img.classList.remove('hover-active');
        });
        
        // 获取点击的图片元素位置信息
        const clickedImg = document.querySelector(`img[data-original="${original}"]`);
        if (!clickedImg) {
            console.error(`找不到图片元素: ${original}`);
            return;
        }
        
        console.log(`找到图片元素:`, clickedImg);
        
        // 检查是否已加载高清图
        const isHighResLoaded = clickedImg.getAttribute('data-highres-loaded') === 'true';
        const imageToUse = isHighResLoaded ? original : preview;
        
        console.log(`使用图片: ${imageToUse}, 高清图已加载: ${isHighResLoaded}`);
        
        // 获取小图的位置和尺寸
        const imgRect = clickedImg.getBoundingClientRect();
        
        // 计算目标位置（模态窗口中心）
        const modalWidth = window.innerWidth;
        const modalHeight = window.innerHeight;
        const targetX = modalWidth / 2;
        const targetY = modalHeight / 2;
        
        // 计算起始位置（小图中心）
        const startX = imgRect.left + imgRect.width / 2;
        const startY = imgRect.top + imgRect.height / 2;
        
        // 设置模态窗口初始状态
        modal.style.display = 'block';
        modal.style.opacity = '0';
        document.body.classList.add('no-scroll');
        
        // 设置图片初始状态（从小图位置开始）
        modalImg.style.position = 'fixed';
        modalImg.style.left = `${startX}px`;
        modalImg.style.top = `${startY}px`;
        modalImg.style.width = `${imgRect.width}px`;
        modalImg.style.height = `${imgRect.height}px`;
        modalImg.style.transform = 'translate(-50%, -50%)';
        modalImg.style.borderRadius = '8px';
        modalImg.style.transition = 'none';
        modalImg.style.zIndex = '1001';
        modalImg.style.objectFit = 'cover';
        
        // 显示图片（使用已加载的原图或预览图）
        modalImg.src = imageToUse;
        
        // 立即开始动画
        // 显示模态窗口背景
        modal.style.opacity = '1';
        
        // 动画到目标位置
        modalImg.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        modalImg.style.left = `${targetX}px`;
        modalImg.style.top = `${targetY}px`;
        modalImg.style.width = 'auto';
        modalImg.style.height = 'auto';
        modalImg.style.transform = 'translate(-50%, -50%) scale(1)';
        modalImg.style.borderRadius = '0';
        
        // 动画完成后设置正常状态
        setTimeout(() => {
            modalImg.style.position = 'static';
            modalImg.style.left = 'auto';
            modalImg.style.top = 'auto';
            modalImg.style.transform = 'none';
            modalImg.style.transition = 'none';
            modalImg.style.zIndex = 'auto';
            modalImg.style.objectFit = 'contain';
            
            // 如果使用了预览图，加载高清图
            if (!isHighResLoaded) {
                this.loadHighResForModal(original, preview, exifInfo);
            } else {
                // 如果已经加载了高清图，直接显示EXIF信息
                this.getExifInfo(original).then(exifData => {
                    exifInfo.innerHTML = this.createExifInfo(exifData);
                }).catch(error => {
                    console.error('获取EXIF信息失败:', error);
                    exifInfo.innerHTML = '<p>EXIF信息获取失败</p>';
                });
            }
            
            // 隐藏加载遮罩
            this.hideLoadingOverlay(original);
        }, 400);
        
        // 确保滚动加载状态不受影响
        console.log('模态窗口打开，滚动加载状态:', this.isScrollLoading);
    }
    
    // 为模态窗口加载高清图
    loadHighResForModal(original, preview, exifInfo) {
        // 显示加载动画
        exifInfo.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>加载原图中...</p>
            </div>
        `;
        
        // 如果已经加载过，直接显示
        if (this.loadedHighRes.has(original)) {
            this.displayHighResInModal(original, exifInfo);
            return;
        }
        
        // 加载高清图
        const highResImage = new Image();
        
        highResImage.onload = () => {
            console.log(`模态窗口高清图加载完成: ${original}`);
            this.loadedHighRes.add(original);
            this.displayHighResInModal(original, exifInfo);
        };
        
        highResImage.onerror = () => {
            console.error(`模态窗口高清图加载失败: ${original}`);
            exifInfo.innerHTML = '<p style="color:red;">原图加载失败</p>';
        };
        
        highResImage.src = original;
    }
    
    // 在模态窗口中显示高清图
    displayHighResInModal(original, exifInfo) {
        const modalImg = document.getElementById('img01');
        
        // 设置高清图
        modalImg.src = original;
        
        // 更新对应的图片元素，替换为原图
        const clickedImg = document.querySelector(`img[data-original="${original}"]`);
        if (clickedImg) {
            clickedImg.src = original;
            clickedImg.setAttribute('data-highres-loaded', 'true');
        }
        
        // 获取EXIF信息
        this.getExifInfo(original).then(exifData => {
            exifInfo.innerHTML = this.createExifInfo(exifData);
        }).catch(error => {
            console.error('获取EXIF信息失败:', error);
            exifInfo.innerHTML = '<p>EXIF信息获取失败</p>';
        });
    }
    
    // 获取EXIF信息
    async getExifInfo(imageUrl) {
        try {
            // 尝试从gallery-index.json中获取EXIF信息
            const images = this.getCurrentImages();
            const imageData = images.find(img => img.original === imageUrl);
            
            if (imageData && imageData.exif) {
                return imageData.exif;
            }
            
            // 如果没有预存的EXIF信息，尝试从服务器获取
            const response = await fetch(`/api/exif?url=${encodeURIComponent(imageUrl)}`);
            if (response.ok) {
                const exifData = await response.json();
                return exifData;
            }
            
            return null;
        } catch (error) {
            console.error('获取EXIF信息失败:', error);
            return null;
        }
    }

    // 创建EXIF信息显示
    createExifInfo(exifData) {
        if (!exifData) return '<p>无EXIF信息</p>';
        
        let exifHtml = '<div class="exif-info">';
        
        // 基本信息
        if (exifData.aperture) {
            exifHtml += `<p><strong>光圈:</strong> f/${exifData.aperture}</p>`;
        }
        if (exifData.shutterSpeed) {
            exifHtml += `<p><strong>快门:</strong> ${exifData.shutterSpeed}s</p>`;
        }
        if (exifData.iso) {
            exifHtml += `<p><strong>ISO:</strong> ${exifData.iso}</p>`;
        }
        if (exifData.focalLength) {
            exifHtml += `<p><strong>焦距:</strong> ${exifData.focalLength}mm</p>`;
        }
        if (exifData.camera) {
            exifHtml += `<p><strong>相机:</strong> ${exifData.camera}</p>`;
        }
        if (exifData.lens) {
            exifHtml += `<p><strong>镜头:</strong> ${exifData.lens}</p>`;
        }
        
        // 地理位置信息
        if (exifData.gps) {
            exifHtml += `<p><strong>位置:</strong> ${exifData.gps}</p>`;
        }
        
        // 拍摄时间
        if (exifData.dateTime) {
            exifHtml += `<p><strong>拍摄时间:</strong> ${exifData.dateTime}</p>`;
        }
        
        exifHtml += '</div>';
        return exifHtml;
    }

    // 设置模态窗口事件
    setupModalEvents() {
        const modal = document.getElementById('myModal');
        const span = document.getElementsByClassName('close')[0];
        const modalContent = document.querySelector('.modal-content');

        span.onclick = () => this.closeModal();
        modalContent.onclick = (event) => event.stopPropagation();
        modal.onclick = () => this.closeModal();

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    // 关闭模态窗口
    closeModal() {
        const modal = document.getElementById('myModal');
        modal.style.opacity = '0';
        
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.classList.remove('no-scroll');
            modal.style.opacity = '1';
            
            // 确保滚动加载状态正常
            if (this.isScrollLoading) {
                console.log('模态窗口关闭，滚动加载状态:', this.isScrollLoading);
            }
            
            setTimeout(() => {
                document.body.classList.remove('modal-open');
            }, 300);
        }, 300);
    }

    // 创建加载遮罩
    createLoadingOverlay(imgElement, originalUrl) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>加载大图中...</p>
            </div>
        `;
        
        // 设置遮罩样式
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            z-index: 10;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // 找到图片容器（image-container）
        const imgContainer = imgElement.closest('.image-container');
        if (!imgContainer) {
            console.error('找不到图片容器:', imgElement);
            return overlay;
        }
        
        // 确保图片容器是相对定位
        if (imgContainer.style.position !== 'relative') {
            imgContainer.style.position = 'relative';
        }
        
        // 将遮罩添加到图片容器中
        imgContainer.appendChild(overlay);
        
        // 显示遮罩
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
        
        return overlay;
    }
    
    // 更新加载状态
    updateLoadingState(imgElement, originalUrl, status) {
        const overlay = this.loadingOverlays.get(originalUrl);
        if (!overlay) return;
        
        // 重新找到图片元素（以防DOM结构变化）
        const currentImgElement = document.querySelector(`img[data-original="${originalUrl}"]`);
        if (!currentImgElement) return;
        
        switch (status) {
            case 'loading':
                overlay.innerHTML = `
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>加载大图中...</p>
                    </div>
                `;
                break;
            case 'success':
                overlay.innerHTML = `
                    <div class="loading-success">
                        <div class="success-icon">✓</div>
                        <p>已加载完成</p>
                    </div>
                `;
                // 加载完成后替换预览图为原图
                currentImgElement.src = originalUrl;
                currentImgElement.setAttribute('data-highres-loaded', 'true');
                
                // 确保点击事件仍然有效
                if (!currentImgElement.imgClickHandler) {
                    const imgClickHandler = () => {
                        // 直接打开模态窗口，因为已经加载完成
                        this.openModal(originalUrl, originalUrl);
                    };
                    currentImgElement.addEventListener('click', imgClickHandler);
                    currentImgElement.imgClickHandler = imgClickHandler;
                }
                
                // 不自动隐藏遮罩，等待用户点击大图
                break;
            case 'error':
                overlay.innerHTML = `
                    <div class="loading-error">
                        <div class="error-icon">✗</div>
                        <p>加载失败</p>
                    </div>
                `;
                // 2秒后隐藏遮罩
                setTimeout(() => {
                    overlay.style.opacity = '0';
                    setTimeout(() => {
                        if (overlay.parentElement) {
                            overlay.parentElement.removeChild(overlay);
                        }
                        this.loadingOverlays.delete(originalUrl);
                    }, 300);
                }, 2000);
                break;
        }
    }
    
    // 添加到高清图加载队列
    addToHighResQueue(originalUrl, previewUrl) {
        console.log(`尝试添加到高清图队列: ${originalUrl}`);
        
        if (this.loadedHighRes.has(originalUrl)) {
            console.log(`图片已加载完成，直接打开: ${originalUrl}`);
            // 已经加载完成，直接打开
            this.openModal(originalUrl, originalUrl);
            return;
        }
        
        if (this.loadingHighRes.has(originalUrl)) {
            console.log(`图片正在加载中，跳过: ${originalUrl}`);
            // 正在加载中，不重复添加
            return;
        }
        
        console.log(`添加到加载队列: ${originalUrl}`);
        // 添加到队列
        this.highResQueue.push({ originalUrl, previewUrl });
        this.processHighResQueue();
    }
    
    // 处理高清图加载队列
    processHighResQueue() {
        if (this.highResQueue.length === 0 || this.loadingHighRes.size >= 3) {
            return; // 队列为空或正在加载的图片过多
        }
        
        const item = this.highResQueue.shift();
        this.loadHighResImage(item.originalUrl, item.previewUrl);
    }
    
    // 加载高清图
    loadHighResImage(originalUrl, previewUrl) {
        // 找到对应的图片元素
        const imgElement = document.querySelector(`img[data-original="${originalUrl}"]`);
        if (!imgElement) return;
        
        // 创建加载遮罩
        const overlay = this.createLoadingOverlay(imgElement, originalUrl);
        this.loadingOverlays.set(originalUrl, overlay);
        
        // 标记为正在加载
        this.loadingHighRes.set(originalUrl, true);
        
        // 更新加载状态
        this.updateLoadingState(imgElement, originalUrl, 'loading');
        
        // 创建图片对象加载高清图
        const highResImage = new Image();
        
        highResImage.onload = () => {
            console.log(`高清图加载完成: ${originalUrl}`);
            
            // 标记为已加载
            this.loadedHighRes.add(originalUrl);
            this.loadingHighRes.delete(originalUrl);
            
            // 更新加载状态
            this.updateLoadingState(imgElement, originalUrl, 'success');
            
            // 处理队列中的下一个
            this.processHighResQueue();
        };
        
        highResImage.onerror = () => {
            console.error(`高清图加载失败: ${originalUrl}`);
            
            // 移除加载状态
            this.loadingHighRes.delete(originalUrl);
            
            // 更新加载状态
            this.updateLoadingState(imgElement, originalUrl, 'error');
            
            // 处理队列中的下一个
            this.processHighResQueue();
        };
        
        highResImage.src = originalUrl;
    }

    // 隐藏加载遮罩
    hideLoadingOverlay(originalUrl) {
        const overlay = this.loadingOverlays.get(originalUrl);
        if (!overlay) return;
        
        overlay.style.opacity = '0';
        setTimeout(() => {
            if (overlay.parentElement) {
                overlay.parentElement.removeChild(overlay);
            }
            this.loadingOverlays.delete(originalUrl);
        }, 300);
    }

    // 强制重置滚动加载状态
    resetScrollLoadingState() {
        this.isScrollLoading = false;
        if (this.scrollThrottleTimer) {
            clearTimeout(this.scrollThrottleTimer);
            this.scrollThrottleTimer = null;
        }
        console.log('强制重置滚动加载状态');
    }
}

// 导出为全局变量
window.ImageLoader = ImageLoader; 