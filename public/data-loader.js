// 数据加载模块
class DataLoader {
    constructor() {
        this.galleryData = null;
        this.loading = false;
    }

    // 从本地JSON文件加载图片数据
    async loadGalleryData() {
        if (this.loading) {
            return this.galleryData;
        }

        this.loading = true;
        
        try {
            const response = await fetch('gallery-index.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.galleryData = await response.json();
            console.log('图片数据加载成功:', this.galleryData);
            return this.galleryData;
        } catch (error) {
            console.error('加载图片数据失败:', error);
            // 返回空数据，避免页面崩溃
            return {
                gallery: {},
                total_images: 0,
                generated_at: new Date().toISOString()
            };
        } finally {
            this.loading = false;
        }
    }

    // 获取所有分类
    getCategories() {
        if (!this.galleryData) return [];
        return Object.keys(this.galleryData.gallery || {});
    }

    // 获取指定分类的图片
    getImagesByCategory(category) {
        if (!this.galleryData || !this.galleryData.gallery) return [];
        const images = this.galleryData.gallery[category]?.images || [];
        // 随机打乱分类内图片的顺序
        return images.sort(() => Math.random() - 0.5);
    }

    // 获取所有图片（用于"全部"标签）
    getAllImages() {
        if (!this.galleryData || !this.galleryData.gallery) return [];
        
        const allImages = [];
        const categories = Object.keys(this.galleryData.gallery);
        
        // 随机打乱分类顺序
        const shuffledCategories = [...categories].sort(() => Math.random() - 0.5);
        
        // 使用Set去重
        const uniqueImageUrls = new Set();
        
        shuffledCategories.forEach(category => {
            const images = this.galleryData.gallery[category].images || [];
            images.forEach(img => {
                if (!uniqueImageUrls.has(img.original)) {
                    uniqueImageUrls.add(img.original);
                    allImages.push(img);
                }
            });
        });
        
        // 随机打乱所有图片的顺序
        return allImages.sort(() => Math.random() - 0.5);
    }

    // 获取总图片数
    getTotalImages() {
        return this.galleryData?.total_images || 0;
    }
}

// 导出为全局变量
window.DataLoader = DataLoader; 