// 自动滚动模块
class AutoScroll {
    constructor() {
        this.autoScrollEnabled = false;
        this.autoScrollSpeed = 1;
        this.autoScrollAnimationFrame = null;
        this.lastLoadedImagesCount = 0;
        this.lastWheelTime = 0;
        
        this.createScrollButton();
        this.createScrollIndicator();
        this.setupWheelListener();
    }

    // 创建置底按钮
    createScrollButton() {
        this.scrollButton = document.createElement('button');
        this.scrollButton.className = 'scroll-to-bottom';
        this.scrollButton.innerHTML = `<svg viewBox="0 0 24 24">
            <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
        </svg>`;
        document.body.appendChild(this.scrollButton);
        
        this.scrollButton.addEventListener('click', () => {
            this.toggleAutoScroll();
        });
    }

    // 创建自动滚动指示器
    createScrollIndicator() {
        this.scrollIndicator = document.createElement('div');
        this.scrollIndicator.className = 'auto-scroll-indicator';
        this.scrollIndicator.textContent = '自动滚动中';
        document.body.appendChild(this.scrollIndicator);
    }

    // 设置滚轮监听
    setupWheelListener() {
        window.addEventListener('wheel', (event) => {
            const now = Date.now();
            
            // 如果自动滚动已启用，并且检测到向上滚动
            if (this.autoScrollEnabled && event.deltaY < 0) {
                // 确保不会因为触控板的微小滚动而过于敏感
                if (now - this.lastWheelTime > 50) {
                    console.log('检测到向上滚动，停止自动滚动');
                    this.toggleAutoScroll();
                }
            }
            this.lastWheelTime = now;
        }, { passive: true });
    }

    // 自动滚动函数
    autoScroll() {
        if (!this.autoScrollEnabled) return;

        // 获取当前已加载的图片数量
        const currentImagesCount = document.querySelectorAll('.gallery img').length;
        
        // 根据新加载的图片数量调整滚动速度
        if (currentImagesCount > this.lastLoadedImagesCount) {
            // 新图片加载时，临时提高滚动速度
            this.autoScrollSpeed = 4;
            setTimeout(() => {
                // 1秒后恢复正常速度
                if (this.autoScrollEnabled) this.autoScrollSpeed = 4;
            }, 1000);
        }
        this.lastLoadedImagesCount = currentImagesCount;

        // 计算页面总高度和当前滚动位置
        const totalHeight = document.documentElement.scrollHeight;
        const currentScroll = window.scrollY;
        const windowHeight = window.innerHeight;

        // 如果还没到底，继续滚动
        if (currentScroll + windowHeight < totalHeight) {
            window.scrollBy(0, this.autoScrollSpeed);
            this.autoScrollAnimationFrame = requestAnimationFrame(() => this.autoScroll());
        } else {
            // 到达底部时，等待新图片加载
            setTimeout(() => {
                if (this.autoScrollEnabled) {
                    this.autoScrollAnimationFrame = requestAnimationFrame(() => this.autoScroll());
                }
            }, 500);
        }
    }

    // 切换自动滚动状态
    toggleAutoScroll() {
        this.autoScrollEnabled = !this.autoScrollEnabled;
        this.scrollButton.classList.toggle('active');
        this.scrollIndicator.classList.toggle('visible');
        
        if (this.autoScrollEnabled) {
            this.autoScrollSpeed = 1;
            this.autoScrollAnimationFrame = requestAnimationFrame(() => this.autoScroll());
            this.scrollButton.style.transform = 'rotate(180deg)';
        } else {
            if (this.autoScrollAnimationFrame) {
                cancelAnimationFrame(this.autoScrollAnimationFrame);
            }
            this.scrollButton.style.transform = 'none';
        }
    }

    // 设置滚动按钮显示逻辑
    setupScrollButtonVisibility() {
        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            
            // 当页面滚动超过一屏时显示按钮
            if (scrollTop > windowHeight / 2) {
                this.scrollButton.classList.add('visible');
            } else {
                this.scrollButton.classList.remove('visible');
                // 如果按钮隐藏，同时关闭自动滚动
                if (this.autoScrollEnabled) {
                    this.toggleAutoScroll();
                }
            }
        });
    }

    // 停止自动滚动
    stopAutoScroll() {
        if (this.autoScrollEnabled) {
            this.toggleAutoScroll();
        }
    }

    // 获取自动滚动状态
    isAutoScrollEnabled() {
        return this.autoScrollEnabled;
    }
}

// 导出为全局变量
window.AutoScroll = AutoScroll; 