// 一次筛选固定一份顺序；限制并发，旧分类的异步请求不能修改新分类。
class ImageLoader {
    constructor(galleryElement, dataLoader) {
        this.galleryElement = galleryElement;
        this.dataLoader = dataLoader;
        this.currentTag = 'all';
        this.currentImages = [];
        this.currentIndex = 0;
        this.generation = 0;
        this.activeLoads = 0;
        this.maxConcurrent = 4;
        this.queue = [];
        this.pendingLoads = new Set();
        this.cards = [];
        this.columnElements = [];
        this.columns = 0;
        this.isModalOpen = false;
        this.modalRequest = 0;
        this.updateColumns();
        this.setupScrollListener();
        window.addEventListener('resize', () => {
            this.updateColumns();
            this.setGalleryMarginTop();
        });
    }

    createColumns() {
        this.galleryElement.replaceChildren();
        this.columnElements = Array.from({ length: this.columns }, () => {
            const column = document.createElement('div');
            column.className = 'column';
            this.galleryElement.appendChild(column);
            return column;
        });
        this.cards.forEach(card => this.placeCard(card));
    }

    placeCard(card) {
        const column = this.columnElements.reduce((shortest, candidate) =>
            candidate.offsetHeight < shortest.offsetHeight ? candidate : shortest);
        column.appendChild(card);
    }

    updateColumns() {
        const width = window.innerWidth;
        const columns = width < 600 ? 2 : width < 900 ? 3 : width < 1200 ? 4 : width < 1500 ? 5 : 6;
        this.imagesPerLoad = columns * 4;
        if (columns !== this.columns) {
            this.columns = columns;
            this.createColumns();
        }
    }

    getCurrentImages() { return this.currentImages; }

    filterImages(tag) {
        this.closeModal();
        this.generation++;
        // 完成旧任务、清除事件，再开启新队列，防止回调污染新分类。
        [...this.pendingLoads].forEach(task => task.cancel());
        this.queue = [];
        this.activeLoads = 0;
        this.currentTag = tag;
        const images = tag === 'all' ? this.dataLoader.getAllImages() : this.dataLoader.getImagesByCategory(tag);
        const seen = new Set();
        this.currentImages = images.filter(image => {
            if (!image.original || seen.has(image.original)) return false;
            seen.add(image.original);
            return true;
        });
        this.currentIndex = 0;
        this.cards = [];
        this.createColumns();
        document.getElementById('all-loaded-message')?.remove();
        this.galleryElement.style.opacity = '1';
        document.querySelector('footer').style.opacity = '1';
        document.getElementById('loading').classList.add('hidden');
        this.loadNextImages();
    }

    loadNextImages() {
        const generation = this.generation;
        const end = Math.min(this.currentIndex + this.imagesPerLoad, this.currentImages.length);
        while (this.currentIndex < end) {
            const data = this.currentImages[this.currentIndex++];
            const card = document.createElement('div');
            card.className = 'gallery-card';
            card.style.aspectRatio = data.width && data.height ? `${data.width} / ${data.height}` : '3 / 2';
            card.dataset.original = data.original;
            this.cards.push(card);
            this.placeCard(card);
            this.queue.push({ card, data, generation });
        }
        this.pumpQueue();
        if (this.currentIndex === this.currentImages.length) this.handleAllImagesLoaded();
    }

    pumpQueue() {
        while (this.activeLoads < this.maxConcurrent && this.queue.length) {
            const job = this.queue.shift();
            if (job.generation !== this.generation) continue;
            this.activeLoads++;
            this.loadPreview(job);
        }
    }

    loadPreview({ card, data, generation }) {
        const img = new Image();
        img.alt = data.name || '摄影作品';
        img.decoding = 'async';
        img.dataset.original = data.original;
        img.dataset.preview = data.preview || '';
        let settled = false;
        let timer;
        const task = { cancel: () => {
            finish();
            img.removeAttribute('src');
        } };
        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            img.onload = img.onerror = null;
            this.pendingLoads.delete(task);
            if (generation === this.generation) this.activeLoads--;
        };
        const complete = (ok) => {
            if (settled) return;
            finish();
            if (generation !== this.generation) return;
            if (ok) {
                card.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
                img.className = 'loaded';
                img.tabIndex = 0;
                img.setAttribute('role', 'button');
                img.setAttribute('aria-label', `查看 ${img.alt}`);
                const open = () => this.openModal(data.original, data.preview, data);
                img.addEventListener('click', open);
                img.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
                });
                card.replaceChildren(img);
            } else {
                // 预览出错不自动下载几十 MB 的原图；访客仍可主动打开原图。
                const button = document.createElement('button');
                button.className = 'preview-error';
                button.textContent = `${img.alt} · 预览暂不可用，点击查看原图`;
                button.addEventListener('click', () => this.openModal(data.original, null, data));
                card.replaceChildren(button);
            }
            this.pumpQueue();
            this.checkIfMoreImagesNeeded();
        };
        this.pendingLoads.add(task);
        img.onload = () => complete(true);
        img.onerror = () => complete(false);
        timer = setTimeout(() => complete(false), 20000);
        if (data.preview) img.src = data.preview;
        else complete(false);
    }

    checkIfMoreImagesNeeded() {
        if (this.queue.length || this.activeLoads || this.currentIndex >= this.currentImages.length) return;
        const bottom = this.galleryElement.getBoundingClientRect().bottom;
        if (bottom < window.innerHeight + 400) this.loadNextImages();
    }

    setupScrollListener() {
        let scheduled = false;
        window.addEventListener('scroll', () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                this.checkIfMoreImagesNeeded();
            });
        }, { passive: true });
    }

    setGalleryMarginTop() {
        this.galleryElement.style.marginTop = `${document.querySelector('header').offsetHeight + 20}px`;
    }

    handleAllImagesLoaded() {
        if (document.getElementById('all-loaded-message')) return;
        const message = document.createElement('p');
        message.id = 'all-loaded-message';
        message.textContent = this.currentImages.length ? '———— 已全部展示 ————' : '暂无作品';
        document.querySelector('footer').before(message);
    }

    openModal(original, preview, data = {}) {
        this.closeModal();
        this.returnFocus = document.activeElement;
        this.isModalOpen = true;
        this.currentOriginalUrl = original;
        window.gallery?.autoScroll?.stopAutoScroll();
        const modal = document.getElementById('myModal');
        const img = document.getElementById('img01');
        img.alt = data.name || '作品大图';
        img.removeAttribute('src');
        if (preview) img.src = preview;
        modal.style.display = 'block';
        modal.style.opacity = '1';
        modal.classList.remove('original-size');
        document.body.classList.add('no-scroll', 'modal-open');
        const button = document.getElementById('load-original-btn');
        button.style.display = 'flex';
        button.disabled = false;
        button.textContent = '加载原图';
        const link = document.getElementById('original-link');
        link.href = original;
        const zoom = document.getElementById('zoom-original-btn');
        zoom.hidden = true;
        zoom.textContent = '100% 查看';
        const info = document.getElementById('exif-info');
        info.textContent = '';
        if (data.bytes) info.textContent = `原图 ${(data.bytes / 1024 / 1024).toFixed(1)} MB`;
        modal.focus();
    }

    loadOriginalImage() {
        if (!this.currentOriginalUrl || !this.isModalOpen) return;
        const url = this.currentOriginalUrl;
        const request = ++this.modalRequest;
        const button = document.getElementById('load-original-btn');
        button.disabled = true;
        button.textContent = '加载原图中…';
        const image = new Image();
        this.currentHighResImage = image;
        image.onload = () => {
            if (!this.isModalOpen || request !== this.modalRequest) return;
            const modalImg = document.getElementById('img01');
            modalImg.src = url;
            button.style.display = 'none';
            document.getElementById('zoom-original-btn').hidden = false;
            document.getElementById('exif-info').textContent = `原图 ${image.naturalWidth} × ${image.naturalHeight}`;
            image.onload = image.onerror = null;
        };
        image.onerror = () => {
            if (!this.isModalOpen || request !== this.modalRequest) return;
            button.disabled = false;
            button.textContent = '重试加载原图';
            document.getElementById('exif-info').textContent = '原图加载失败，可重试或通过链接打开。';
        };
        image.src = url;
    }

    setupModalEvents() {
        const modal = document.getElementById('myModal');
        const img = document.getElementById('img01');
        modal.querySelector('.close').addEventListener('click', () => this.closeModal());
        modal.addEventListener('click', event => { if (event.target === modal) this.closeModal(); });
        document.getElementById('load-original-btn').addEventListener('click', () => this.loadOriginalImage());
        document.getElementById('zoom-original-btn').addEventListener('click', event => {
            const zoomed = modal.classList.toggle('original-size');
            img.style.width = zoomed ? `${img.naturalWidth}px` : '';
            event.target.textContent = zoomed ? '适应屏幕' : '100% 查看';
        });
        document.addEventListener('keydown', event => {
            if (!this.isModalOpen) return;
            if (event.key === 'Escape') this.closeModal();
            if (event.key === 'Tab') {
                const controls = [...modal.querySelectorAll('button, a[href]')].filter(el =>
                    !el.hidden && !el.disabled && el.getClientRects().length);
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
                    event.preventDefault(); last?.focus();
                } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) {
                    event.preventDefault(); first?.focus();
                }
            }
        });
    }

    closeModal() {
        this.modalRequest++;
        this.isModalOpen = false;
        if (this.currentHighResImage) {
            this.currentHighResImage.onload = this.currentHighResImage.onerror = null;
            this.currentHighResImage.removeAttribute('src');
            this.currentHighResImage = null;
        }
        const modal = document.getElementById('myModal');
        modal.style.display = 'none';
        modal.classList.remove('original-size');
        const img = document.getElementById('img01');
        img.style.width = '';
        img.removeAttribute('src');
        document.body.classList.remove('no-scroll', 'modal-open');
        if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
        this.returnFocus = null;
    }
}
window.ImageLoader = ImageLoader;
