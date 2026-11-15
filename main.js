// A bounded, manually scrolled endless ribbon. Artwork never opens a viewer.
(() => {
  const track = document.getElementById('series-track');
  if (!track) return;
  const originals = [...track.children];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const modulo = (value, length) => ((value % length) + length) % length;
  let patternWidth = 0;
  let cycleWidth = 0;
  let touching = false;
  let drag = null;
  let settleTimer = 0;
  let scrollFrame = 0;
  let lastWidth = 0;
  let lastHeight = 0;
  let manualScroll = false;

  function safeOffset(value) {
    return cycleWidth * .5 + modulo(value - cycleWidth * .5, cycleWidth);
  }
  function rebase() {
    if (!cycleWidth || !manualScroll || touching || drag) return;
    if (track.scrollLeft < cycleWidth * .5 || track.scrollLeft > cycleWidth * 1.5) {
      track.scrollLeft = safeOffset(track.scrollLeft);
    }
  }
  function layoutRibbon() {
    if (touching || drag?.moved) return;
    const phase = patternWidth ? modulo(track.scrollLeft - cycleWidth, patternWidth) / patternWidth : 0;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const nextPattern = originals.reduce((sum, figure) => sum + figure.getBoundingClientRect().width + gap, 0);
    if (!nextPattern) return;
    const repeats = Math.max(1, Math.ceil(track.clientWidth * 1.25 / nextPattern));
    const fragment = document.createDocumentFragment();
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let repeat = 0; repeat < repeats; repeat++) {
        for (const original of originals) {
          const isOriginal = cycle === 1 && repeat === 0;
          const figure = isOriginal ? original : original.cloneNode(true);
          if (!isOriginal) {
            figure.removeAttribute('id');
            figure.removeAttribute('data-original');
            figure.setAttribute('aria-hidden', 'true');
            for (const element of figure.querySelectorAll('[id]')) element.removeAttribute('id');
          }
          fragment.append(figure);
        }
      }
    }
    track.replaceChildren(fragment);
    patternWidth = nextPattern;
    cycleWidth = nextPattern * repeats;
    track.scrollLeft = cycleWidth + phase * patternWidth;
    track.dataset.cycleWidth = cycleWidth;
    track.dataset.loopReady = 'true';
    lastWidth = track.clientWidth;
    lastHeight = track.clientHeight;
  }
  layoutRibbon();
  new ResizeObserver(() => {
    if (track.clientWidth !== lastWidth || track.clientHeight !== lastHeight) layoutRibbon();
  }).observe(track);
  track.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      rebase();
    });
    clearTimeout(settleTimer);
    settleTimer = setTimeout(rebase, 140);
  }, { passive: true });
  track.addEventListener('wheel', event => {
    if (event.ctrlKey || !cycleWidth) return; // Preserve browser accessibility zoom.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1;
    const delta = (Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * unit;
    if (!delta) return;
    event.preventDefault();
    manualScroll = true;
    track.scrollLeft = safeOffset(track.scrollLeft + delta);
  }, { passive: false });
  track.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      manualScroll = true;
      track.scrollBy({ left: (event.key === 'ArrowLeft' ? -1 : 1) * Math.max(160, track.clientWidth * .65), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  });
  track.addEventListener('dragstart', event => event.preventDefault());
  track.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') { touching = true; manualScroll = true; return; }
    if (event.button !== 0) return;
    manualScroll = false;
    drag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft, moved: false };
  });
  track.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      manualScroll = true;
      track.setPointerCapture(event.pointerId);
      track.classList.add('is-dragging');
    }
    event.preventDefault();
    track.scrollLeft = drag.left - distance;
  });
  function finishDrag() {
    if (!drag) return;
    const { id, moved } = drag;
    drag = null;
    if (track.hasPointerCapture(id)) track.releasePointerCapture(id);
    track.classList.remove('is-dragging');
    if (track.clientWidth !== lastWidth || track.clientHeight !== lastHeight) layoutRibbon();
    else if (moved) rebase();
  }
  function endPointer(event) {
    if (event.pointerType === 'touch') {
      touching = false;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (track.clientWidth !== lastWidth || track.clientHeight !== lastHeight) layoutRibbon();
        else rebase();
      }, 160);
    }
    if (drag && event.pointerId === drag.id) finishDrag();
  }
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  track.addEventListener('lostpointercapture', finishDrag);
  window.addEventListener('blur', () => {
    touching = false;
    finishDrag();
    if (track.clientWidth !== lastWidth || track.clientHeight !== lastHeight) layoutRibbon();
    else rebase();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) track.scrollTo({ left: track.scrollLeft, behavior: 'instant' });
  });
})();
