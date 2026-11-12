(() => {
  const books = [...document.querySelectorAll('.book')];
  const shelf = document.querySelector('.bookshelf');
  shelf.style.setProperty('--book-count', String(books.length));
  shelf.style.setProperty('--max-cover-ratio', String(Math.max(...books.map(book => Number(book.style.getPropertyValue('--cover-ratio'))))));
  const details = document.getElementById('book-details');
  const title = document.getElementById('book-title');
  const description = document.getElementById('book-description');
  const purchase = document.getElementById('book-purchase');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const detailContent = [title, description, purchase];
  let selectedBook = null;
  let detailGhost = null;

  function discardGhost() {
    if (!detailGhost) return;
    const previous = detailGhost;
    detailGhost = null;
    for (const animation of previous.getAnimations({ subtree: true })) animation.cancel();
    previous.remove();
  }

  function snapshotDetails() {
    const snapshot = details.cloneNode(true);
    snapshot.removeAttribute('id');
    snapshot.removeAttribute('aria-live');
    snapshot.removeAttribute('aria-atomic');
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.inert = true;
    snapshot.classList.add('book-details-ghost');
    snapshot.style.width = `${details.getBoundingClientRect().width}px`;
    for (const element of snapshot.querySelectorAll('[id]')) element.removeAttribute('id');
    detailContent.forEach((element, index) => {
      const style = getComputedStyle(element);
      snapshot.children[index].style.opacity = style.opacity;
      snapshot.children[index].style.filter = style.filter;
    });
    return snapshot;
  }

  function animateDetails(snapshot, selected) {
    if (snapshot) {
      detailGhost = snapshot;
      details.append(snapshot);
      const outgoing = [...snapshot.children].map(element => element.animate([
        { filter: element.style.filter, opacity: element.style.opacity },
        { filter: 'blur(8px)', opacity: 0 },
      ], { duration: 210, easing: 'ease-in', fill: 'forwards' }));
      Promise.allSettled(outgoing.map(animation => animation.finished)).then(() => {
        snapshot.remove();
        if (detailGhost === snapshot) detailGhost = null;
      });
    }
    if (selected) for (const element of detailContent) element.animate([
      { filter: 'blur(6px)', opacity: 0 },
      { filter: 'blur(0px)', opacity: 1 },
    ], { duration: 440, delay: snapshot ? 60 : 0, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'backwards' });
  }

  function selectBook(selected, animate = true) {
    if (selected === selectedBook) return;
    const previous = selectedBook;
    const motion = animate && !reducedMotion.matches;
    discardGhost();
    const snapshot = motion && previous ? snapshotDetails() : null;
    if (animate) for (const element of detailContent) for (const animation of element.getAnimations()) animation.cancel();
    selectedBook = selected;
    for (const book of books) {
      const open = book === selected;
      book.classList.toggle('is-open', open);
      book.setAttribute('aria-expanded', String(open));
      book.setAttribute('aria-label', `${open ? 'Close' : 'Open'} ${book.dataset.title}`);
    }
    details.classList.toggle('is-empty', !selected);
    details.setAttribute('aria-hidden', String(!selected));
    if (selected) {
      // Live content and the purchase destination change immediately. Only the
      // inert, ID-free visual snapshot retains the departing book's details.
      title.textContent = selected.dataset.title;
      description.textContent = selected.dataset.description;
      purchase.href = selected.dataset.url;
      purchase.setAttribute('aria-label', `Get ${selected.dataset.title}`);
    }
    if (motion) animateDetails(snapshot, selected);
  }

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    discardGhost();
    for (const element of detailContent) {
      for (const animation of element.getAnimations()) animation.cancel();
    }
  });

  for (const book of books) {
    book.addEventListener('click', () => selectBook(book.classList.contains('is-open') ? null : book));
  }
  shelf.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const current = books.indexOf(document.activeElement);
    if (current < 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = books[(current + (event.key === 'ArrowRight' ? 1 : -1) + books.length) % books.length];
      selectBook(next);
      next.focus({ preventScroll: true });
    }
  });
  const canvas = document.querySelector('.books-main');
  canvas.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = books.find(book => book.classList.contains('is-open'));
    if (!open) return;
    event.preventDefault();
    selectBook(null);
    open.focus({ preventScroll: true });
  });
  canvas.addEventListener('click', event => {
    if (event.target === canvas || event.target === shelf) selectBook(null);
  });

  // As with the photographs, these deter casual saving, not screen capture.
  document.addEventListener('contextmenu', event => { if (event.target.closest('.book')) event.preventDefault(); });
  document.addEventListener('dragstart', event => { if (event.target.closest('.book')) event.preventDefault(); });
  selectBook(books.find(book => book.classList.contains('is-open')) || null, false);
})();
