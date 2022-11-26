
const main = document.getElementById('main-link');
const works = document.getElementById('works-link');
const about = document.getElementById('about-link');
const contact = document.getElementById('contact-link');

const mainText = document.getElementById('main-text');
const worksText = document.getElementById('works-text');
const aboutText = document.getElementById('about-text');
const contactText = document.getElementById('contact-text');

let activeAnchor = main;
let activeSection = mainText;

function setActive(e) {
    if (e.target != activeAnchor) {
        activeAnchor.classList.remove('is-active');
        activeSection.classList.remove('is-active');

        activeAnchor = e.target;
        activeAnchor.classList.add('is-active')

        if (activeAnchor == main) {
            activeSection = mainText;
            mainText.classList.add('is-active');
        } else if (activeAnchor == works) {
            activeSection = worksText;
            worksText.classList.add('is-active');
        } else if (activeAnchor == about) {
            activeSection = aboutText;
            aboutText.classList.add('is-active');
        } else if (activeAnchor == contact) {
            activeSection = contactText;
            contactText.classList.add('is-active');
        }
    }
}

main.addEventListener('click', setActive);
works.addEventListener('click', setActive);
about.addEventListener('click', setActive);
contact.addEventListener('click', setActive);

