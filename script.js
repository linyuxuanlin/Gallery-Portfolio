document.addEventListener("DOMContentLoaded", function() {
    const gallery = document.getElementById("gallery");

    // Path to your local photo directory
    const photoDirectory = "./photo/";  // /DATA/wiki-media/photo/

    // Function to load photos from directory
    function loadPhotos() {
        fetch(photoDirectory)
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const links = Array.from(doc.querySelectorAll("a"));
                
                links.forEach(link => {
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
            })
            .catch(error => console.error("Error fetching photos:", error));
    }

    loadPhotos();
});
