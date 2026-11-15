// Shared page lifecycle, with no third-party requests or intercepted links.
(() => {
  function initialize() {
    document.getElementById('year').textContent = new Date().getFullYear();
    const portrait = document.querySelector('.home-portrait');
    if (!portrait) return;
    const desktop = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let enabled = false;
    let frame = 0;
    let x = innerWidth * .68;
    let y = innerHeight * .48;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    function paint() {
      frame = 0;
      if (!enabled) return;
      const width = portrait.offsetWidth, height = portrait.offsetHeight;
      portrait.style.setProperty('--portrait-x', `${clamp(x - width / 2, 12, Math.max(12, innerWidth - width - 12))}px`);
      portrait.style.setProperty('--portrait-y', `${clamp(y - height / 2, 12, Math.max(12, innerHeight - height - 12))}px`);
    }
    function queue() { if (enabled && !frame) frame = requestAnimationFrame(paint); }
    function park() { x = innerWidth * .68; y = innerHeight * .48; queue(); }
    function updateMode() {
      enabled = desktop.matches && !reduced.matches;
      portrait.classList.toggle('portrait-follows', enabled);
      portrait.dataset.cursorFollow = String(enabled);
      if (enabled) { x = innerWidth * .68; y = innerHeight * .48; paint(); }
      else {
        cancelAnimationFrame(frame);
        frame = 0;
        portrait.style.removeProperty('--portrait-x');
        portrait.style.removeProperty('--portrait-y');
      }
    }
    window.addEventListener('pointermove', event => {
      if (!enabled || event.pointerType === 'touch') return;
      x = event.clientX; y = event.clientY; queue();
    }, { passive: true });
    window.addEventListener('pointerout', event => { if (!event.relatedTarget) park(); }, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    window.addEventListener('blur', park);
    portrait.addEventListener('load', queue, { once: true });
    desktop.addEventListener('change', updateMode);
    reduced.addEventListener('change', updateMode);
    updateMode();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
  // Native navigation transitions may legitimately be skipped (a second
  // navigation, viewport resize, hidden tab). Handle their native lifecycle
  // promises only; application errors are not intercepted or suppressed.
  for (const type of ['pageswap', 'pagereveal']) window.addEventListener(type, event => {
    if (!event.viewTransition) return;
    for (const phase of ['ready', 'finished', 'updateCallbackDone']) event.viewTransition[phase].catch(() => {});
    // Opt out before taking the outgoing snapshot too, rather than waiting for
    // the books document's CSS opt-out to abort an already-captured transition.
    const destination = event.activation?.entry?.url;
    if (type === 'pageswap' && destination && new URL(destination, location.href).pathname.endsWith('/books.html')) {
      event.viewTransition.skipTransition();
    }
  });
})();
