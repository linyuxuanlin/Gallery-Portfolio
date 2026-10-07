class AutoScroll {
    constructor() {
        this.autoScrollEnabled = false;
        this.scrollButton = document.createElement('button');
        this.scrollButton.className = 'scroll-to-bottom';
        this.scrollButton.type = 'button';
        this.scrollButton.setAttribute('aria-label', '开始自动滚动');
        this.scrollButton.setAttribute('aria-pressed', 'false');
        this.scrollButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>';
        this.scrollButton.addEventListener('click', () => this.toggleAutoScroll());
        this.scrollIndicator = document.createElement('div');
        this.scrollIndicator.className = 'auto-scroll-indicator';
        this.scrollIndicator.textContent = '自动滚动中';
        document.body.append(this.scrollButton, this.scrollIndicator);
        window.addEventListener('wheel', event => { if (event.deltaY < 0) this.stopAutoScroll(); }, { passive: true });
        window.addEventListener('touchstart', event => { if (!this.scrollButton.contains(event.target)) this.stopAutoScroll(); }, { passive: true });
        window.addEventListener('pointerdown', event => { if (!this.scrollButton.contains(event.target)) this.stopAutoScroll(); }, { passive: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.stopAutoScroll(); });
    }
    autoScroll(timestamp) {
        if (!this.autoScrollEnabled) return;
        const delta = this.lastFrame ? Math.min(timestamp - this.lastFrame, 50) : 0;
        this.lastFrame = timestamp;
        const bottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        if (bottom) {
            const loader = window.gallery?.imageLoader;
            loader?.checkIfMoreImagesNeeded();
            if (loader && loader.currentIndex >= loader.currentImages.length && !loader.activeLoads && !loader.queue.length) {
                this.stopAutoScroll();
                return;
            }
        } else {
            this.scrollRemainder += 80 * delta / 1000;
            const distance = Math.floor(this.scrollRemainder);
            this.scrollRemainder -= distance;
            if (distance) window.scrollBy(0, distance);
        }
        this.autoScrollAnimationFrame = requestAnimationFrame(time => this.autoScroll(time));
    }
    toggleAutoScroll() {
        if (this.autoScrollEnabled) { this.stopAutoScroll(); return; }
        this.autoScrollEnabled = true;
        this.lastFrame = 0;
        this.scrollRemainder = 0;
        this.updateControls();
        this.autoScrollAnimationFrame = requestAnimationFrame(time => this.autoScroll(time));
    }
    updateControls() {
        this.scrollButton.classList.toggle('active', this.autoScrollEnabled);
        this.scrollButton.setAttribute('aria-pressed', String(this.autoScrollEnabled));
        this.scrollButton.setAttribute('aria-label', this.autoScrollEnabled ? '停止自动滚动' : '开始自动滚动');
        this.scrollButton.querySelector('svg').style.transform = this.autoScrollEnabled ? 'rotate(180deg)' : '';
        this.scrollIndicator.classList.toggle('visible', this.autoScrollEnabled);
    }
    setupScrollButtonVisibility() {
        const update = () => {
            const visible = window.scrollY > window.innerHeight / 2;
            this.scrollButton.classList.toggle('visible', visible);
            if (!visible) this.stopAutoScroll();
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
    }
    stopAutoScroll() {
        this.autoScrollEnabled = false;
        cancelAnimationFrame(this.autoScrollAnimationFrame);
        this.lastFrame = 0;
        this.updateControls();
    }
    isAutoScrollEnabled() { return this.autoScrollEnabled; }
}
window.AutoScroll = AutoScroll;
