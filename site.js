// Shared page lifecycle, with no third-party requests or intercepted links.
(() => {
  const updateYear = () => { document.getElementById('year').textContent = new Date().getFullYear(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateYear, { once: true });
  else updateYear();
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
