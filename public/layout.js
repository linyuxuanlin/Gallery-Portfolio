document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    function setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark');
            themeIcon.src = '/assets/brightness_7.svg'; // 日间图标
        } else {
            document.body.classList.remove('dark');
            themeIcon.src = '/assets/brightness_4.svg'; // 夜间图标
        }
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeIcon.src = isDark ? '/assets/brightness_7.svg' : '/assets/brightness_4.svg';
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
    });
});
