document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle logic
    const themeToggle = document.getElementById('theme-toggle');

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        if (document.body.classList.contains('dark')) {
            themeToggle.textContent = 'brightness_7';
        } else {
            themeToggle.textContent = 'brightness_4';
        }
    });

    // Add footer dynamically
    const footer = document.createElement('footer');
    footer.innerHTML = '<p>© 2024 Power\'s Wiki | <a href="https://wiki-power.com" target="_blank">Power\'s Wiki</a></p>';
    document.body.appendChild(footer);

    // Add loaded class to images after window load to enable hover effect
    window.addEventListener('load', () => {
        const images = document.querySelectorAll('.gallery img');
        images.forEach(img => {
            img.classList.add('loaded');
        });
    });
});
