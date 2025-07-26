document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    // 图标路径配置
    const iconPaths = {
        dark: ['public/assets/brightness_7.svg', 'assets/brightness_7.svg', '/assets/brightness_7.svg'],
        light: ['public/assets/brightness_4.svg', 'assets/brightness_4.svg', '/assets/brightness_4.svg']
    };

    // 智能图标加载函数
    function loadIcon(iconType, imgElement) {
        const paths = iconPaths[iconType];
        let currentIndex = 0;

        function tryNextPath() {
            if (currentIndex >= paths.length) {
                console.error(`所有路径都失败，无法加载${iconType}图标`);
                return;
            }

            const path = paths[currentIndex];
            console.log(`尝试加载图标: ${path}`);
            
            imgElement.src = path;
            currentIndex++;
        }

        imgElement.onerror = function() {
            console.warn(`图标加载失败: ${imgElement.src}`);
            tryNextPath();
        };

        imgElement.onload = function() {
            console.log(`图标加载成功: ${imgElement.src}`);
        };

        tryNextPath();
    }

    function setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark');
            loadIcon('dark', themeIcon);
        } else {
            document.body.classList.remove('dark');
            loadIcon('light', themeIcon);
        }
    }

    // 确保图标在页面完全加载后仍能正常工作
    function ensureIconLoaded() {
        const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
        if (!themeIcon.src || themeIcon.src.includes('undefined') || themeIcon.src.includes('null')) {
            console.log('重新加载图标:', currentTheme);
            loadIcon(currentTheme, themeIcon);
        }
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        loadIcon(isDark ? 'dark' : 'light', themeIcon);
    });

    // 初始化主题
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // Add footer dynamically
    const footer = document.createElement('footer');
    footer.innerHTML = '<p>© 2024 Power | <a href="https://wiki-power.com" target="_blank">Power\'s Wiki</a></p>';
    document.body.appendChild(footer);

    // Add loaded class to images after window load to enable hover effect
    window.addEventListener('load', () => {
        const images = document.querySelectorAll('.gallery img');
        images.forEach(img => {
            if (img.complete) {
                img.classList.add('loaded');
            } else {
                img.addEventListener('load', () => img.classList.add('loaded'));
            }
        });
        document.querySelector('footer').style.opacity = '1'; // 显示底栏
        
        // 确保图标在页面完全加载后仍能正常工作
        setTimeout(ensureIconLoaded, 100);
    });

    // 监听DOM变化，确保图标不被其他脚本覆盖
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                const target = mutation.target;
                if (target === themeIcon && (!target.src || target.src.includes('undefined'))) {
                    console.log('检测到图标被重置，重新加载');
                    ensureIconLoaded();
                }
            }
        });
    });

    observer.observe(themeIcon, {
        attributes: true,
        attributeFilter: ['src']
    });
});
