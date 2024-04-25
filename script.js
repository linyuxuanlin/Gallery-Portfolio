document.addEventListener("DOMContentLoaded", function() {
    const gallery = document.getElementById("gallery");
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const currentPageSpan = document.getElementById("currentPage");

    let currentPage = 1;
    const photosPerPage = 6;
    const photoDirectory = "./photo/";

    function loadPhotos() {
        fetch(photoDirectory)
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const links = Array.from(doc.querySelectorAll("a"));

                const startIndex = (currentPage - 1) * photosPerPage;
                const endIndex = startIndex + photosPerPage;
                const paginatedLinks = links.slice(startIndex, endIndex);

                gallery.innerHTML = "";

                paginatedLinks.forEach(link => {
                    const imgSrc = link.href;
                    if (imgSrc.endsWith(".jpg") || imgSrc.endsWith(".png") || imgSrc.endsWith(".jpeg")) {
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
                    }
                });

                currentPageSpan.textContent = `Page ${currentPage}`;
            })
            .catch(error => console.error("Error fetching photos:", error));
    }

    function goToPrevPage() {
        if (currentPage > 1) {
            currentPage--;
            loadPhotos();
        }
    }

    function goToNextPage() {
        currentPage++;
        loadPhotos();
    }

    prevPageBtn.addEventListener("click", goToPrevPage);
    nextPageBtn.addEventListener("click", goToNextPage);

    loadPhotos();
});
