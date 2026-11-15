// One horizontal bookshelf: hovering turns a cover; selecting reveals its copy.
(() => {
  const data = document.getElementById('book-data');
  if (!data) return;
  const books = JSON.parse(data.textContent);
  const byId = new Map(books.map(book => [book.id, book]));
  const canvas = document.querySelector('.books-main');
  const previews = [...document.querySelectorAll('.book')];
  const controls = [...document.querySelectorAll('.book-name, .book')];
  const names = document.querySelector('.book-names');
  const details = document.getElementById('book-details');
  const title = document.getElementById('book-title');
  const meta = document.getElementById('book-meta');
  const description = document.getElementById('book-description');
  const purchase = document.getElementById('book-purchase');
  const content = [title, meta, description, document.querySelector('.book-actions')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let selected = null;
  let hovered = null;
  let keyboardPreview = null;
  let opener = null;
  let scrollFrame = 0;

  function renderPreview() {
    const current = hovered || keyboardPreview || selected;
    for (const book of previews) book.classList.toggle('is-open', book.dataset.book === current);
  }
  function cancelCopyAnimations() {
    for (const element of content) for (const animation of element.getAnimations()) animation.cancel();
  }
  function selectBook(id, control) {
    cancelCopyAnimations();
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    selected = id;
    if (control) opener = control;
    names.hidden = Boolean(selected);
    for (const element of controls) {
      const active = element.dataset.book === selected;
      element.classList.toggle('is-selected', active);
      element.setAttribute('aria-expanded', String(active));
    }
    if (selected) {
      hovered = null;
      keyboardPreview = null;
      const book = byId.get(selected);
      title.textContent = book.title;
      meta.textContent = book.meta;
      description.lang = book.language;
      description.replaceChildren(...book.description.map(text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        return paragraph;
      }));
      purchase.href = book.url;
      purchase.setAttribute('aria-label', `Get ${book.title}`);
      details.hidden = false;
      title.focus({ preventScroll: true });
      if (!reducedMotion.matches) for (const element of content) element.animate([
        { filter: 'blur(6px)', opacity: 0 },
        { filter: 'blur(0px)', opacity: 1 },
      ], { duration: 440, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'backwards' });
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        if (selected === id) details.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      });
    } else {
      details.hidden = true;
      purchase.removeAttribute('href');
    }
    renderPreview();
  }
  function closeDetails(restoreFocus = false) {
    selectBook(null);
    if (restoreFocus) opener?.focus({ preventScroll: true });
  }
  for (const control of controls) {
    const id = control.dataset.book;
    control.addEventListener('pointerenter', event => {
      if (!finePointer.matches || event.pointerType === 'touch') return;
      hovered = id;
      renderPreview();
    });
    control.addEventListener('pointerleave', () => {
      if (hovered === id) hovered = null;
      renderPreview();
    });
    control.addEventListener('focus', () => {
      if (control.matches(':focus-visible')) keyboardPreview = id;
      renderPreview();
    });
    control.addEventListener('blur', () => {
      if (keyboardPreview === id) keyboardPreview = null;
      renderPreview();
    });
    control.addEventListener('click', () => selectBook(selected === id ? null : id, control));
  }
  for (const group of document.querySelectorAll('.book-names, .bookshelf')) group.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const members = [...group.querySelectorAll('[data-book]')];
    const index = members.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
    const next = members[(index + direction + members.length) % members.length];
    hovered = null;
    next.focus({ preventScroll: true });
    keyboardPreview = next.dataset.book;
    renderPreview();
  });
  document.getElementById('book-close').addEventListener('click', () => closeDetails(true));
  canvas.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !selected) return;
    event.preventDefault();
    closeDetails(true);
  });
  canvas.addEventListener('click', event => {
    if (event.target.matches('.books-main, .books-layout, .books-scene, .bookshelf')) closeDetails();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      cancelCopyAnimations();
      window.scrollTo({ top: scrollY, behavior: 'instant' });
    }
  });
  finePointer.addEventListener('change', () => { hovered = null; renderPreview(); });
  for (const type of ['contextmenu', 'dragstart']) document.addEventListener(type, event => {
    if (event.target.closest('.book')) event.preventDefault();
  });
  renderPreview();
})();
