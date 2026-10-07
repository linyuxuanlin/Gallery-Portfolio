class Gallery {
    constructor() {
        this.dataLoader = new DataLoader();
        this.autoScroll = new AutoScroll();
        window.addEventListener('popstate', () => { if (this.tagFilter) this.handleUrlParams(); });
        this.init();
    }
    async init() {
        await this.dataLoader.loadGalleryData();
        if (this.dataLoader.loadError) {
            const loading = document.getElementById('loading');
            loading.classList.add('failed');
            loading.replaceChildren();
            const message = document.createElement('p');
            message.textContent = '作品索引加载失败，请检查网络后重试。';
            const retry = document.createElement('button');
            retry.textContent = '重新加载';
            retry.addEventListener('click', () => { loading.replaceChildren(); loading.classList.remove('failed'); this.init(); });
            loading.append(message, retry);
            return;
        }
        this.imageLoader = new ImageLoader(document.getElementById('gallery'), this.dataLoader);
        this.tagFilter = new TagFilter(tag => {
            this.imageLoader.filterImages(tag);
            if (!this.handlingHistory) {
                const path = tag === 'all' ? '/' : `/${encodeURIComponent(tag)}`;
                if (window.location.pathname !== path) window.history.pushState({}, '', path);
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        });
        this.tagFilter.createTagFilter(this.dataLoader.getCategories());
        this.imageLoader.setupModalEvents();
        this.imageLoader.setGalleryMarginTop();
        this.autoScroll.setupScrollButtonVisibility();
        this.handleUrlParams();
    }
    handleUrlParams() {
        let tag;
        try { tag = decodeURIComponent(window.location.pathname.slice(1).replace(/\/$/, '')); }
        catch { tag = ''; }
        this.handlingHistory = true;
        this.tagFilter.selectTagByValue(this.dataLoader.getCategories().includes(tag) ? tag : 'all');
        this.handlingHistory = false;
    }
}
document.addEventListener('DOMContentLoaded', () => { window.gallery = new Gallery(); });
