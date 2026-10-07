// Native buttons work with mouse, touch and keyboard; keep selection visible.
class TagFilter {
    constructor(onTagSelect) {
        this.onTagSelect = onTagSelect;
        this.currentTag = 'all';
    }
    createTagFilter(categories) {
        this.tagContainer = document.createElement('nav');
        this.tagContainer.className = 'tag-filter-vertical';
        this.tagContainer.setAttribute('aria-label', '作品分类');
        const tags = ['all', ...categories.filter(tag => tag !== 'all' && tag !== '0_preview').sort()];
        tags.forEach(tag => {
            const button = document.createElement('button');
            button.className = 'tag';
            button.type = 'button';
            button.dataset.tag = tag;
            button.textContent = tag === 'all' ? 'All' : tag;
            button.setAttribute('aria-pressed', String(tag === this.currentTag));
            button.addEventListener('click', () => this.selectTag(button, tag));
            this.tagContainer.appendChild(button);
        });
        document.querySelector('header').after(this.tagContainer);
    }
    centerTagButton(button) {
        const horizontal = window.innerWidth <= 600;
        this.tagContainer.scrollTo(horizontal ? {
            left: button.offsetLeft - (this.tagContainer.clientWidth - button.offsetWidth) / 2,
            behavior: 'smooth',
        } : {
            top: button.offsetTop - (this.tagContainer.clientHeight - button.offsetHeight) / 2,
            behavior: 'smooth',
        });
    }
    selectTag(button, tag) {
        this.tagContainer.querySelectorAll('.tag').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
        this.currentTag = tag;
        this.onTagSelect(tag);
        this.centerTagButton(button);
    }
    getCurrentTag() { return this.currentTag; }
    selectTagByValue(tag) {
        const button = [...this.tagContainer.querySelectorAll('.tag')].find(button => button.dataset.tag === tag);
        if (button) this.selectTag(button, tag);
    }
    destroy() { this.tagContainer?.remove(); }
}
window.TagFilter = TagFilter;
