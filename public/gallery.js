// 主画廊模块
class Gallery {
    constructor() {
        this.dataLoader = new DataLoader();
        this.autoScroll = new AutoScroll();
        this.tagFilter = null;
        this.imageLoader = null;
        this.isPageLoading = true;
        this.lastWidth = window.innerWidth;
        
        this.init();
    }

    async init() {
        // 等待页面加载完成
        window.addEventListener('load', () => {
            this.isPageLoading = false;
        });

        // 加载图片数据
        await this.dataLoader.loadGalleryData();
        
        // 初始化组件
        this.initComponents();
        
        // 设置自动滚动按钮显示逻辑
        this.autoScroll.setupScrollButtonVisibility();
        
        // 初始加载
        this.loadInitialImages();
    }

    initComponents() {
        const galleryElement = document.getElementById('gallery');
        
        // 初始化图片加载器
        this.imageLoader = new ImageLoader(galleryElement, this.dataLoader);
        
        // 初始化标签筛选器
        this.tagFilter = new TagFilter((tag) => {
            this.imageLoader.filterImages(tag);
        });
        
        // 创建标签筛选器
        const categories = this.dataLoader.getCategories();
        this.tagFilter.createTagFilter(categories);
        
        // 设置模态窗口事件
        this.imageLoader.setupModalEvents();
        
        // 设置gallery的margin-top
        this.imageLoader.setGalleryMarginTop();
    }

    loadInitialImages() {
                // 首次加载时选择 "All" 标签
        this.imageLoader.filterImages('all');
        this.imageLoader.updateColumns();
                
                // 初始加载后检查是否需要更多图片
                setTimeout(() => {
            this.imageLoader.checkIfMoreImagesNeeded();
                }, 500);
    }
}

// 页面加载完成后初始化画廊
document.addEventListener('DOMContentLoaded', () => {
    window.gallery = new Gallery();
});
