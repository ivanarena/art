// Background image rotation for home and about pages
document.addEventListener('DOMContentLoaded', () => {
  
  // Prevent all images from being dragged
  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      return false;
    }
  });
  
  // Add draggable=false attribute to all images
  const allImages = document.querySelectorAll('img');
  allImages.forEach(img => {
    img.setAttribute('draggable', 'false');
  });
  
  // Function to shuffle array (Fisher-Yates shuffle)
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  // Function to rotate background images
  function rotateBackgrounds(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length <= 1) return;
    
    // Shuffle the images array for random order
    const shuffledImages = shuffleArray(images);
    let currentIndex = 0;
    
    // Show first image in shuffled array
    shuffledImages[0].classList.add('active');
    
    // Rotate every 15 seconds with random selection
    setInterval(() => {
      shuffledImages[currentIndex].classList.remove('active');
      currentIndex = (currentIndex + 1) % shuffledImages.length;
      shuffledImages[currentIndex].classList.add('active');
    }, 15000);
  }
  
  // Initialize background rotation
  rotateBackgrounds('bg-home');
  rotateBackgrounds('bg-about');

  // Copyright protection for images
  if (document.querySelector('.works-page')) {
    // Create copyright overlay
    const overlay = document.createElement('div');
    overlay.className = 'copyright-overlay';
    overlay.textContent = '© 2025 Ivan Arena. All rights reserved.';
    document.body.appendChild(overlay);

    // Add double-click handler to all images
    const images = document.querySelectorAll('.works-grid img, .works-gallery-preview img, .self-portraits-preview img');
    console.log('Found images:', images.length);
    
    images.forEach(img => {
      // Double-click to show copyright
      img.addEventListener('dblclick', (e) => {
        e.preventDefault();
        overlay.classList.add('show');
        setTimeout(() => {
          overlay.classList.remove('show');
        }, 2000);
      });

      // Single click also shows copyright (easier for mobile)
      img.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Click detected');
        overlay.classList.add('show');
        setTimeout(() => {
          overlay.classList.remove('show');
        }, 1000);
      });

      // Prevent context menu (right-click)
      img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    });
  }
});


