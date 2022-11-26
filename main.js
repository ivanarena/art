// nav anchors
const main = document.getElementById('main-link');
const works = document.getElementById('works-link');
const about = document.getElementById('about-link');
const contact = document.getElementById('contact-link');
let activeAnchor = main;

// text sections
const mainText = document.getElementById('main-text');
const worksText = document.getElementById('works-text');
const aboutText = document.getElementById('about-text');
const contactText = document.getElementById('contact-text');
let activeText = mainText;

const worksSection = document.getElementById('works-sec');
let activeSection = worksSection;


function setActive(e) {
    if (e.target != activeAnchor) {
        activeAnchor.classList.remove('is-active');
        activeText.classList.remove('is-active');
        activeSection.classList.remove('is-active');

        activeAnchor = e.target;
        activeAnchor.classList.add('is-active')

        if (activeAnchor == main) {
            activeText = mainText;
            mainText.classList.add('is-active');
        } else if (activeAnchor == works) {
            activeText = worksText;
            activeSection = worksSection;
            worksText.classList.add('is-active');
            worksSection.classList.add('is-active');
        } else if (activeAnchor == about) {
            activeText = aboutText;
            aboutText.classList.add('is-active');
        } else if (activeAnchor == contact) {
            activeText = contactText;
            contactText.classList.add('is-active');
        }
    }
}

main.addEventListener('click', setActive);
works.addEventListener('click', setActive);
about.addEventListener('click', setActive);
contact.addEventListener('click', setActive);

