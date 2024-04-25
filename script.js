document.addEventListener("DOMContentLoaded", function() {
    const gallery = document.getElementById("gallery");
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const currentPageSpan = document.getElementById("currentPage");

    let currentPage = 1;
    const photosPerPage = 6;
    const photoDirectory = "./photo/";

    function loadPhotos(page) {
        const startIndex = (page - 1) * photosPerPage;
        const endIndex = startIndex + photosPerPage;

        fetch(photoDirectory)
            .then(response => response.text())
            .then(html => {
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

                paginatedLinks.forEach(link => {
                    const imgSrc = link.href;
                    const imgContainer = document.createElement("div");
                    imgContainer.classList.add("img-container");

                    const img = document.createElement("img");
                    img.src = imgSrc;

                    const overlay = document.createElement("div");
                    overlay.classList.add("img-overlay");
                    overlay.innerHTML = "<h3>Click to enlarge</h3>";

                    imgContainer.appendChild(img);
                    imgContainer.appendChild(overlay);
                    gallery.appendChild(imgContainer);
                });

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
            })
            .catch(error => console.error("Error fetching photos:", error));
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
});
