document.addEventListener("DOMContentLoaded", function() {
    const gallery = document.getElementById("gallery");
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const currentPageSpan = document.getElementById("currentPage");

    let currentPage = 1;
    const photosPerPage = 18;
    const photoDirectory = "./photo/";

    async function loadPhotos(page) {
        const startIndex = (page - 1) * photosPerPage;
        const endIndex = startIndex + photosPerPage;

        const response = await fetch(photoDirectory);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const links = Array.from(doc.querySelectorAll("a"));

        // Filter out non-image files and sort by modification date in descending order
        const imageLinks = links
            .filter(link => link.href.match(/\.(jpg|jpeg|png)$/i))
            .sort((a, b) => {
                const aModified = new Date(a.lastModified);
                const bModified = new Date(b.lastModified);
                return bModified - aModified;
            });

        const paginatedLinks = imageLinks.slice(startIndex, endIndex);

        gallery.innerHTML = "";

        for (const link of paginatedLinks) {
            const imgSrc = link.href;
            const imgContainer = document.createElement("div");
            imgContainer.classList.add("img-container");

            const img = document.createElement("img");
            img.src = imgSrc;
            img.style.opacity = 0; // Start with opacity 0 for fade-in effect

            const overlay = document.createElement("div");
            overlay.classList.add("img-overlay");
            overlay.innerHTML = "<h3>Click to enlarge</h3>";

            imgContainer.appendChild(img);
            imgContainer.appendChild(overlay);
            gallery.appendChild(imgContainer);

            // Fade in image
            img.onload = () => {
                img.style.transition = "opacity 0.5s";
                img.style.opacity = 1;
            };

            // Wait for image to load
            await new Promise(resolve => {
                img.onload = () => {
                    img.style.transition = "opacity 0.5s";
                    img.style.opacity = 1;
                    resolve();
                };
            });
        }

        currentPageSpan.textContent = `Page ${page}`;

        // Update URL only if it's not the first page
        if (page > 1) {
            history.pushState(null, null, `?page=${page}`);
        } else {
            history.pushState(null, null, window.location.pathname);
        }

        // Disable or enable pagination buttons based on availability of photos
        if (imageLinks.length <= endIndex) {
            nextPageBtn.disabled = true;
            nextPageBtn.classList.add("disabled");
        } else {
            nextPageBtn.disabled = false;
            nextPageBtn.classList.remove("disabled");
        }

        if (page === 1) {
            prevPageBtn.disabled = true;
            prevPageBtn.classList.add("disabled");
        } else {
            prevPageBtn.disabled = false;
            prevPageBtn.classList.remove("disabled");
        }
    }

    function goToPrevPage() {
        if (currentPage > 1) {
            currentPage--;
            loadPhotos(currentPage);
        }
    }

    function goToNextPage() {
        currentPage++;
        loadPhotos(currentPage);
    }

    prevPageBtn.addEventListener("click", goToPrevPage);
    nextPageBtn.addEventListener("click", goToNextPage);

    // Check if page number is provided in URL
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get("page");
    if (pageParam && !isNaN(pageParam) && pageParam > 0) {
        currentPage = parseInt(pageParam);
    }

    loadPhotos(currentPage);

    // Dynamically calculate number of columns based on window width
    function calculateColumns() {
        const windowWidth = window.innerWidth;
        let columns = Math.floor(windowWidth / 200); // Minimum width for each image container is 200px
        columns = Math.max(2, Math.min(columns, 8)); // Ensure minimum of 2 and maximum of 8 columns
        gallery.style.columnCount = columns;
    }

    // Call calculateColumns function initially and on window resize
    calculateColumns();
    window.addEventListener("resize", calculateColumns);
});
