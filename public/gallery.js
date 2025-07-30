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

        // 监听浏览器前进后退按钮
        window.addEventListener('popstate', () => {
            this.handleUrlParams();
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
            // 更新URL
            this.updateUrlForTag(tag);
        });
        
        // 创建标签筛选器
        const categories = this.dataLoader.getCategories();
        this.tagFilter.createTagFilter(categories);
        
        // 设置模态窗口事件
        this.imageLoader.setupModalEvents();
        
        // 设置gallery的margin-top
        this.imageLoader.setGalleryMarginTop();
        
        // 在标签筛选器创建完成后处理URL参数
        this.handleUrlParams();
    }

    // 处理URL参数
    handleUrlParams() {
        // 确保组件已经初始化
        if (!this.tagFilter || !this.imageLoader) {
            console.log('组件未完全初始化，跳过URL参数处理');
            return;
        }

        const path = window.location.pathname;
        const tagFromUrl = path.substring(1); // 移除开头的斜杠
        
        console.log('处理URL参数:', { path, tagFromUrl });
        
        if (tagFromUrl && tagFromUrl !== '') {
            // 检查标签是否存在
            const categories = this.dataLoader.getCategories();
            console.log('可用标签:', categories);
            
            if (categories.includes(tagFromUrl)) {
                console.log('找到匹配的标签:', tagFromUrl);
                // 选择对应的标签
                this.tagFilter.selectTagByValue(tagFromUrl);
                this.imageLoader.filterImages(tagFromUrl);
            } else {
                console.log('标签不存在:', tagFromUrl);
                // 如果标签不存在，选择"All"标签
                if (this.tagFilter.getCurrentTag() !== 'all') {
                    this.tagFilter.selectTagByValue('all');
                    this.imageLoader.filterImages('all');
                }
            }
        } else {
            // URL中没有标签参数，选择"All"标签
            console.log('URL中没有标签参数，选择All标签');
            if (this.tagFilter.getCurrentTag() !== 'all') {
                this.tagFilter.selectTagByValue('all');
                this.imageLoader.filterImages('all');
            }
        }
    }

    // 更新URL
    updateUrlForTag(tag) {
        console.log('更新URL为标签:', tag);
        
        if (tag === 'all') {
            // 如果选择"All"标签，移除URL中的标签参数
            if (window.location.pathname !== '/') {
                console.log('移除URL中的标签参数');
                window.history.pushState({}, '', '/');
            }
        } else {
            // 更新URL为选中的标签
            const newUrl = `/${tag}`;
            if (window.location.pathname !== newUrl) {
                console.log('更新URL为:', newUrl);
                window.history.pushState({}, '', newUrl);
            }
        }
    }

    loadInitialImages() {
        // 如果没有从URL设置标签，则默认选择 "All" 标签
        if (this.tagFilter.getCurrentTag() === 'all') {
            this.imageLoader.filterImages('all');
        }
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
