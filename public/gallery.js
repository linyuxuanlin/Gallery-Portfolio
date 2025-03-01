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

        // 创建标签栏 - 优化版本
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

            // 分页加载第一批图片 - 确保调用一次初始加载
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
            const width = window.innerWidth;
            let computedColumns, computedImagesPerLoad;
            
            // 计算应用的列数和每次加载图片数量（保持不变）
            if (width < 600) {
                computedColumns = 2;
                computedImagesPerLoad = 6;
            } else if (width < 900) {
                computedColumns = 3;
                computedImagesPerLoad = 9;
            } else if (width < 1200) {
                computedColumns = 4;
                computedImagesPerLoad = 12;
            } else if (width < 1500) {
                computedColumns = 5;
                computedImagesPerLoad = 16;
            } else {
                computedColumns = 6;
                computedImagesPerLoad = 20;
            }
            
            // 如果列数没有变化，仅更新加载图片数量，不重新排布
            if (computedColumns === columns) {
                imagesPerLoad = computedImagesPerLoad;
                return;
            }
            
            // 如果列数变化，则获取所有已加载的图片，并记录它们的原始顺序
            const loadedImages = Array.from(document.querySelectorAll('.gallery img'));
            
            // 如果图片已有序号属性，按照序号排序；否则维持当前DOM顺序
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
            
            // 使用原始顺序重新分配图片
            distributeImagesInOriginalOrder(loadedImages);
            
            // 设置其他必要的更新
            setupLoadMoreObserver();
            setTimeout(updateHoverEffects, 300);
        }

        // 新增：按照原始顺序分配图片的函数
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
                
                // 将图片添加到最短的列（基于图片的高宽比估算高度）
                const shortestColumnIndex = getShortestColumn();
                columnElements[shortestColumnIndex].appendChild(images[i]);
            }
        }

        // 修改 loadNextImages 函数，实现逐次加载并立即呈现
        function loadNextImages() {
            const images = imageUrls[currentTag] || [];
            
            // 检查是否还有更多图片需要加载
            if (currentIndex >= images.length) {
                handleAllImagesLoaded();
                return;
            }

            // 立即设置加载状态，防止多次触发加载
            setLoadingState(true);
            
            // 增加一个延迟变量来追踪当前批次的图片加载
            const currentBatchId = Date.now();
            loadingBatchId = currentBatchId;
            
            // 单张图片加载逻辑
            function loadSingleImage(index) {
                if (index >= images.length) {
                    // 所有图片加载完成
                    setLoadingState(false);
                    checkIfAllImagesLoaded();
                    
                    // 没有更多图片时，立即隐藏"加载更多"按钮并显示完成消息
                    handleAllImagesLoaded();
                    return;
                }
                
                const imageData = images[index];
                const img = new Image();
                
                img.onload = function() {
                    // 图片加载完成后，添加到最短的列
                    const shortestColumnIndex = getShortestColumn();
                    columnElements[shortestColumnIndex].appendChild(img);
                    img.classList.add('loaded');
                    
                    // 更新计数器
                    currentIndex++;
                    imagesLoadedCount++;
                    
                    // 检查是否需要继续加载图片
                    if (shouldLoadMoreImages()) {
                        // 继续加载下一张图片
                        loadSingleImage(currentIndex);
                    } else {
                        // 当前批次加载完成
                        setLoadingState(false);
                        checkIfAllImagesLoaded();
                        
                        // 检查是否已加载所有图片
                        if (currentIndex >= images.length) {
                            handleAllImagesLoaded();
                        } else {
                            // 预加载下一批图片
                            preloadNextBatchImages();
                        }
                    }
                    
                    // 图片加载完成后，设置悬停效果
                    updateHoverEffects();

                    // 添加原始序号
                    img.dataset.originalOrder = currentIndex - 1; // 当前图片的序号
                };
                
                img.onerror = function() {
                    console.error('图片加载失败:', imageData.thumbnail);
                    // 跳过失败的图片，继续加载下一张
                    currentIndex++;
                    loadSingleImage(currentIndex);
                };
                
                // 设置图片属性
                img.src = imageData.thumbnail;
                img.setAttribute('data-original', imageData.original);
                img.setAttribute('data-preview', imageData.thumbnail);
                img.alt = '图片';
                
                // 添加点击事件，打开模态窗口
                img.addEventListener('click', function() {
                    openModal(this.getAttribute('data-original'), this.getAttribute('data-preview'));
                });
            }
            
            // 开始加载第一张图片
            loadSingleImage(currentIndex);
        }

        // 判断是否应该继续加载更多图片
        function shouldLoadMoreImages() {
            // 如果当前正在加载中，则不应该再次触发加载
            if (loadingImagesCount > 0) {
                return false;
            }
            
            // 确保 imageUrls 和 currentTag 有效
            if (!imageUrls || !imageUrls[currentTag]) {
                return false;
            }
            
            // 如果还有图片可加载，并且内容高度不足以填满页面或触发滚动，则继续加载
            if (currentIndex >= imageUrls[currentTag].length) {
                return false; // 没有更多图片了
            }
            
            // 获取页面可见区域高度
            const viewportHeight = window.innerHeight;
            
            // 确保 columnElements 已初始化且包含元素
            if (!columnElements || columnElements.length === 0) {
                return true; // 如果列还未初始化，则需要加载图片
            }
            
            // 获取内容总高度 - 使用更安全的方法
            const contentHeight = Math.max(...columnElements.map(col => col.offsetHeight || 0));
            
            // 获取滚动位置
            const scrollPosition = window.scrollY + viewportHeight;
            
            // 初始加载或内容不足时，继续加载
            if (contentHeight === 0) {
                return true;
            }
            
            // 图片很少的情况下，如果未满3张图，继续加载
            const totalImages = document.querySelectorAll('.gallery img').length;
            if (totalImages < columns * 2) {  // 确保至少有2行图片
                return true;
            }
            
            // 对所有标签使用同样的流畅瀑布流逻辑
            // 如果内容高度小于视口高度的2倍，或者滚动位置接近内容底部，则加载更多
            return contentHeight < viewportHeight * 2 || scrollPosition > contentHeight - 300;
        }

        // 预加载下一批图片 - 比当前版面多预加载8张
        function preloadNextBatchImages() {
            const images = imageUrls[currentTag] || [];
            // 修改为imagesPerLoad + 8，确保预加载比显示的多8张
            const endIndex = Math.min(currentIndex + imagesPerLoad + 8, images.length);
            
            // 如果已经到达末尾，不需要预加载
            if (currentIndex >= endIndex) return;
            
            // 预加载下一批图片
            for (let i = currentIndex; i < endIndex; i++) {
                const imageData = images[i];
                const preloadImg = new Image();
                preloadImg.src = imageData.thumbnail;
            }
            
            console.log(`预加载了${endIndex - currentIndex}张图片`);
        }

        // 检查是否所有图片都加载完成
        function checkIfAllImagesLoaded() {
            const galleryElement = document.querySelector('.gallery');
            // 如果画廊还未显示（opacity !== '1'）则立即显示
            if (galleryElement.style.opacity !== '1') {
                galleryElement.style.opacity = '1';             // 显示 gallery
                document.querySelector('footer').style.opacity = '1'; // 显示 footer
                loadMoreButton.style.opacity = '1';               // 显示加载更多按钮
                loadingElement.classList.add('hidden');           // 隐藏加载动画
            }
        }

        // 设置加载按钮状态
        function setLoadingState(isLoading) {
            if (isLoading) {
                // 正在加载中 - 显示灰色加载中按钮
                loadMoreButton.disabled = true;
                loadMoreButton.textContent = '加载中...';
                loadMoreButton.style.backgroundColor = '#ccc';
                loadMoreButton.style.cursor = 'not-allowed';
                loadMoreButton.style.display = 'block'; // 始终显示按钮，只是变灰
            } else if (currentIndex >= (imageUrls[currentTag] || []).length) {
                // 所有图片都已加载 - 隐藏按钮
                handleAllImagesLoaded();
            } else {
                // 加载完成但还有更多图片 - 恢复按钮状态
                loadMoreButton.disabled = false;
                loadMoreButton.textContent = '加载更多';
                loadMoreButton.style.backgroundColor = '';
                loadMoreButton.style.cursor = 'pointer';
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

        function openModal(original, preview) {
            // 移除所有图片的悬停状态
            document.querySelectorAll('.gallery img.hover-active').forEach(img => {
                img.classList.remove('hover-active');
            });
            
            // 临时禁用悬停效果
            document.body.classList.add('modal-open');
            
            if (isPageLoading) {
                console.log('页面正在加载，无法打开大图');
                return; // 如果页面正在加载，直接返回
            }
            // 取消正在进行的图片或 EXIF 请求
            if (currentImageRequest) {
                currentImageRequest.abort();
            }
            if (currentExifRequest) {
                currentExifRequest.abort();
            }

            modal.style.display = 'block';
            document.body.classList.add('no-scroll');
            exifInfo.innerHTML = 'Loading original image and EXIF data...';

            // 为当前请求创建新的 AbortController
            const imageController = new AbortController();
            const exifController = new AbortController();
            currentImageRequest = imageController;
            currentExifRequest = exifController;

            // 获取 EXIF 数据（使用高清图地址）
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

            // 创建新的 Image 对象加载高清图
            const highResImage = new Image();
            highResImage.src = original;
            highResImage.onload = () => {
                if (!imageController.signal.aborted) {
                    // 切换显示高清图并去除模糊效果
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
            
            // 移除模态窗口类，重新启用悬停效果
            document.body.classList.remove('modal-open');
            
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
                updateColumns();
                lastWidth = window.innerWidth;
                // 重新设置悬停效果
                setTimeout(updateHoverEffects, 300);
            }
            setGalleryMarginTop();
        });

        updateColumns(); // Initial column setup
        setGalleryMarginTop(); // Initial gallery margin-top setup

        // 修改滚动事件处理，实现滚动加载
        let lastScrollY = window.scrollY;
        let scrollDelta = 0;

        window.addEventListener('scroll', () => {
            // 现有的 header 隐藏逻辑保持不变
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
            
            // 检查是否需要加载更多图片，并确保按钮状态正确
            if (loadingImagesCount > 0) {
                // 如果有图片正在加载，确保显示加载中状态
                setLoadingState(true);
            } else if (!loadMoreButton.disabled && shouldLoadMoreImages()) {
                loadNextImages();
            }
        });

        // 从服务器获取所有图片 URL
        fetch('/images')
            .then(response => response.json())
            .then(data => {
                imageUrls = data;
                createTagFilter(Object.keys(data));
                // 首次加载时自动选择 "All" 标签 - filterImages内部会调用loadNextImages
                filterImages('all');
                updateColumns();
            })
            .catch(error => console.error('Error loading images:', error));

        // 简化 setupLoadMoreObserver 函数
        function setupLoadMoreObserver() {
            // 只在合适的时候触发初始加载
            setTimeout(() => {
                // 延迟执行以确保DOM已完全渲染
                if (shouldLoadMoreImages()) {
                    loadNextImages();
                }
            }, 100);
        }

        // 添加新函数，处理所有图片加载完成的情况
        function handleAllImagesLoaded() {
            loadMoreButton.style.display = 'none';
            
            // 添加"已全部加载完成"的提示（如果不存在）
            if (!document.getElementById('all-loaded-message')) {
                const loadedMsg = document.createElement('div');
                loadedMsg.id = 'all-loaded-message';
                loadedMsg.textContent = '————  已全部加载  ————';
                loadedMsg.style.textAlign = 'center';
                loadedMsg.style.margin = '20px 0';
                loadedMsg.style.color = 'var(--text-color)';
                document.querySelector('footer').before(loadedMsg);
            }
        }

        // 替换当前的setupImageHoverEffects和updateHoverEffects函数
        // 使用更可靠的方法实现图片悬停效果

        function setupImageHoverEffects() {
            // 使用MutationObserver监视图片添加到DOM
            if (window.hoverEffectObserver) {
                window.hoverEffectObserver.disconnect();
            }
            
            // 创建监视器，监听DOM变化
            window.hoverEffectObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes) {
                        mutation.addedNodes.forEach(function(node) {
                            // 检查是否是新添加的图片
                            if (node.tagName === 'IMG') {
                                addHoverEffect(node);
                            } else if (node.querySelectorAll) {
                                // 如果是容器元素，检查其中的图片
                                node.querySelectorAll('img').forEach(addHoverEffect);
                            }
                        });
                    }
                });
            });
            
            // 立即为现有图片添加效果
            document.querySelectorAll('.gallery img').forEach(addHoverEffect);
            
            // 开始监视整个gallery元素
            window.hoverEffectObserver.observe(galleryElement, {
                childList: true,
                subtree: true
            });
            
            console.log('已设置悬停效果监视器');
        }

        // 为单个图片添加悬停效果
        function addHoverEffect(img) {
            if (img.dataset.hoverInitialized) return; // 避免重复初始化
            
            img.dataset.hoverInitialized = 'true';
            
            // 添加更简单的事件监听
            img.addEventListener('mouseenter', function() {
                this.classList.add('hover-active');
            });
            
            img.addEventListener('mouseleave', function() {
                this.classList.remove('hover-active');
            });
            
            console.log('已为图片添加悬停效果', img.src);
        }

        // 更新悬停效果 (不需要频繁调用，只在重大布局更改后)
        function updateHoverEffects() {
            setupImageHoverEffects();
        }
    }
});