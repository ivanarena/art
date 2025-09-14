const images = Array.from(document.querySelectorAll(".pictures img"));

// Fisher-Yates shuffle
for (let i = images.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
}

function showImage(index) {
    images.forEach(img => img.classList.remove("active"));
    images[index].classList.add("active");
}

let current = 0;

function showWhenLoaded(index, callback) {
    const img = images[index];
    if (img.complete) {
        showImage(index);
        if (callback) callback();
    } else {
        img.addEventListener("load", function handler() {
            img.removeEventListener("load", handler);
            showImage(index);
            if (callback) callback();
        });
    }
}

// Show the first image only after it's loaded
showWhenLoaded(current, () => setTimeout(nextImage, 10000));

function nextImage() {
    let next = (current + 1) % images.length;
    showWhenLoaded(next, () => {
        current = next;
        setTimeout(nextImage, 10000);
    });
}