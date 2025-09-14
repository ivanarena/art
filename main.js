const images = Array.from(document.querySelectorAll(".pictures img"));

// Fisher-Yates shuffle
for (let i = images.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
}

images[0].classList.add("active");
let current = 0;
setInterval(() => {
    images[current].classList.remove("active");
    current = (current + 1) % images.length;
    images[current].classList.add("active");
}, 7000);