// Background image rotation for home and about pages
document.addEventListener('DOMContentLoaded', () => {
  console.log('Portfolio loaded');
  
  // Function to rotate background images
  function rotateBackgrounds(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length <= 1) return;
    
    let currentIndex = 0;
    
    // Show first image
    images[0].classList.add('active');
    
    // Rotate every 5 seconds
    setInterval(() => {
      images[currentIndex].classList.remove('active');
      currentIndex = (currentIndex + 1) % images.length;
      images[currentIndex].classList.add('active');
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

    console.log('Copyright overlay created');

    // Add double-click handler to all images
    const images = document.querySelectorAll('.works-grid img, .works-gallery-preview img, .self-portraits-preview img');
    console.log('Found images:', images.length);
    
    images.forEach(img => {
      // Double-click to show copyright
      img.addEventListener('dblclick', (e) => {
        e.preventDefault();
        console.log('Double-click detected');
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
        console.log('Context menu prevented');
      });
    });
  }
});


