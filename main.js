/* A small, virtualised ribbon: the work loops forever, the DOM doesn't grow. */
(() => {
  const $ = id => document.getElementById(id);
  const gallery = $('gallery');
  const viewer = $('viewer');
  const rail = $('rail');
  const inspection = $('inspection');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const phoneLayout = matchMedia('(max-width: 600px), (max-width: 900px) and (pointer: coarse)');
  const wrap = n => ((n % WORKS.length) + WORKS.length) % WORKS.length;
  const number = n => String(n + 1).padStart(2, '0');
  const count = n => `${number(wrap(n))} / ${WORKS.length}`;
  const cards = new Map();
  let position = 0;
  let target = 0;
  let frame = 0;
  let lastTime = 0;
  let activeIndex = -1;
  let inspected = 0;
  let closingViewer = false;
  let closingGallery = false;
  let drag = null;
  let suppressClickUntil = 0;
  let openingTimer;
  let statusTimer;
  let metrics;
  let layoutFrame = 0;
  let pendingLayout = false;
  let forceLayout = false;
  let pageScroll = 0;
  let viewerGesture = null;
  const mobileRibbon = new MobileGallery(rail, {
    cards, createCard: makeCard, count: WORKS.length,
    active: () => gallery.open && !viewer.open && !closingGallery,
    onPosition: value => {
      position = value;
      target = mobileRibbon.target ?? value;
      updateSelection(Math.round(value));
    },
    onGesture: () => { suppressClickUntil = performance.now() + 350; },
    onIdle: () => { if (pendingLayout) scheduleLayout(true); },
  });

  // A vertically staggered, naturally sized filmstrip, with the first work centred
  // and photographs visible on both sides. No overlapping prints or autoplay.
  const home = $('pile');
  const homeHeights = [310, 260, 235, 330, 280, 225, 300, 255, 325, 245, 285, 215, 270];
  const homeLevels = [-12, 28, -34, 0, 18, 38, -18, 30, -8, 36, -24, 42, -26];
  const selection = WORKS.slice(0, 20).map((_, index) => index);
  const pivot = Math.ceil(selection.length / 2);
  const pileOrder = [...selection.slice(pivot), ...selection.slice(0, pivot)];
  let homeIndex = 0;
  let homeFrame = 0;
  pileOrder.forEach(workIndex => {
    const image = new Image();
    const work = WORKS[workIndex];
    image.src = work.preview;
    image.alt = '';
    image.width = work.width;
    image.height = work.height;
    image.decoding = 'sync';
    image.draggable = false;
    if (workIndex === 0) image.fetchPriority = 'high';
    image.className = 'pile-image';
    image.dataset.index = workIndex;
    image.style.setProperty('--height', `${homeHeights[workIndex % homeHeights.length]}px`);
    image.style.setProperty('--home-y', `${homeLevels[workIndex % homeLevels.length]}px`);
    image.classList.toggle('is-home-current', workIndex === homeIndex);
    $('pile-images').append(image);
  });

  function centreHome() {
    const image = home.querySelector(`[data-index="${homeIndex}"]`) || home.querySelector('.pile-image');
    if (!image) return;
    const box = image.getBoundingClientRect();
    const viewport = home.getBoundingClientRect();
    home.scrollLeft += box.x + box.width / 2 - viewport.x - viewport.width / 2;
    for (const print of home.querySelectorAll('.pile-image')) print.classList.toggle('is-home-current', print === image);
  }
  home.addEventListener('scroll', () => {
    if (homeFrame) return;
    homeFrame = requestAnimationFrame(() => {
      homeFrame = 0;
      const viewport = home.getBoundingClientRect();
      const prints = [...home.querySelectorAll('.pile-image')];
      const closest = prints.reduce((best, print) => {
        const box = print.getBoundingClientRect();
        const distance = Math.abs(box.x + box.width / 2 - viewport.x - viewport.width / 2);
        return !best || distance < best.distance ? { print, distance } : best;
      }, null)?.print;
      if (closest) {
        homeIndex = Number(closest.dataset.index);
        for (const print of prints) print.classList.toggle('is-home-current', print === closest);
      }
    });
  }, { passive: true });
  centreHome();
  new ResizeObserver(() => { if (!gallery.open) centreHome(); }).observe(home);

  function homePrints() {
    const viewport = home.getBoundingClientRect();
    return [...home.querySelectorAll('.pile-image')].filter(image => {
      const box = image.getBoundingClientRect();
      return box.right > viewport.left && box.left < viewport.right;
    });
  }

  function artSize(work, maxWidth, maxHeight) {
    const height = Math.min(maxHeight, maxWidth * work.height / work.width);
    return { width: height * work.width / work.height, height };
  }

  function cardSize(slot) {
    return {
      ...artSize(WORKS[wrap(slot)], metrics.cardWidth, metrics.cardHeight),
      // Key the level to the artwork, not its repeated slot, so native loop
      // rebasing preserves the exact same composition in every cycle.
      offsetY: homeLevels[wrap(slot) % homeLevels.length] * Math.min(1, metrics.height / 600),
    };
  }

  function setStage(dialog) {
    const box = dialog.getBoundingClientRect();
    const top = dialog.querySelector('.chrome').getBoundingClientRect();
    const bottom = dialog.querySelector('.gallery-bottom, .viewer-bottom').getBoundingClientRect();
    const stageTop = Math.ceil(top.bottom - box.top + 12);
    const stageBottom = Math.ceil(box.bottom - bottom.top + 16);
    const changed = dialog.style.getPropertyValue('--stage-top') !== `${stageTop}px` || dialog.style.getPropertyValue('--stage-bottom') !== `${stageBottom}px`;
    dialog.style.setProperty('--stage-top', `${stageTop}px`);
    dialog.style.setProperty('--stage-bottom', `${stageBottom}px`);
    return { changed, top: stageTop, bottom: stageBottom, height: Math.max(80, dialog.clientHeight - stageTop - stageBottom) };
  }

  function measure() {
    setStage(gallery);
    const vertical = false;
    const mobile = phoneLayout.matches;
    const height = rail.clientHeight;
    const cardHeight = Math.min(mobile ? 460 : 490, height * (mobile ? .74 : .68));
    const cardWidth = Math.min(mobile ? rail.clientWidth * .62 : innerWidth * .25, mobile ? 360 : 365);
    const gap = Math.max(28, Math.min(64, innerWidth * .04));
    const extents = WORKS.map(work => {
      const size = artSize(work, cardWidth, cardHeight);
      return vertical ? size.height : size.width;
    });
    metrics = {
      vertical, mobile, height, cardHeight, cardWidth, gap,
      viewport: vertical ? height : rail.clientWidth,
      step: extents.reduce((sum, extent) => sum + extent, 0) / extents.length + gap,
      minStep: Math.min(...extents) + gap,
    };
    rail.dataset.axis = vertical ? 'vertical' : 'horizontal';
    $('gallery-help').textContent = `Scroll or drag ${vertical ? 'vertically' : 'horizontally'} to browse. Use arrow keys to move and Enter to inspect.`;
    $('previous').textContent = $('detail-previous').textContent = vertical ? '↑' : '←';
    $('next').textContent = $('detail-next').textContent = vertical ? '↓' : '→';
    for (const id of ['previous', 'detail-previous']) $(id).setAttribute('aria-keyshortcuts', vertical ? 'ArrowUp' : 'ArrowLeft');
    for (const id of ['next', 'detail-next']) $(id).setAttribute('aria-keyshortcuts', vertical ? 'ArrowDown' : 'ArrowRight');
  }

  // FLIP: move each physical print from its actual old rectangle to the new one.
  // The image keeps its aspect ratio throughout. Animate only transform/opacity:
  // large moving bitmaps never need a new blur raster on every frame.
  function transitionPrint(element, rectangle, { reverse = false, duration = 560, delay = 0, fill = reverse ? 'forwards' : 'backwards' } = {}) {
    const before = element.getBoundingClientRect();
    const appearance = getComputedStyle(element);
    const beforeOpacity = appearance.opacity;
    for (const animation of element.getAnimations()) animation.cancel();
    if (!rectangle || !rectangle.width || reducedMotion.matches) return null;
    const destination = element.getBoundingClientRect();
    if (!destination.width || !destination.height) return null;
    const dx = rectangle.x + rectangle.width / 2 - destination.x - destination.width / 2;
    const dy = rectangle.y + rectangle.height / 2 - destination.y - destination.height / 2;
    const base = getComputedStyle(element).transform;
    const transform = base === 'none' ? '' : base;
    const scale = Math.min(rectangle.width / destination.width, rectangle.height / destination.height);
    const displaced = `translate(${dx}px, ${dy}px) ${transform} scale(${scale})`;
    const keyframes = [
      { transform: displaced, opacity: 0 },
      { transform: transform || 'none', opacity: 1 },
    ];
    if (reverse) {
      // Start from the currently visible frame, even if opening was interrupted.
      const fromX = before.x + before.width / 2 - destination.x - destination.width / 2;
      const fromY = before.y + before.height / 2 - destination.y - destination.height / 2;
      const fromScale = Math.min(before.width / destination.width, before.height / destination.height);
      keyframes[0].transform = `translate(${fromX}px, ${fromY}px) ${transform} scale(${fromScale})`;
      keyframes[0].opacity = beforeOpacity;
      keyframes[1].transform = displaced;
      keyframes[1].opacity = 0;
    }
    return element.animate(keyframes, {
      duration, delay, easing: 'cubic-bezier(.22,.8,.2,1)', fill,
    });
  }

  function captureEdgeFade(dialog) {
    // Reverse from the actual frame, including a quick close during fade-in.
    for (const edge of dialog.querySelectorAll('.gallery-edge')) {
      edge.style.setProperty('--edge-tint-opacity', getComputedStyle(edge, '::after').opacity);
      for (const layer of edge.children) {
        const style = getComputedStyle(layer);
        layer.style.setProperty('--edge-from-opacity', style.opacity);
      }
    }
  }

  function setCredit(work, titleId, mediumId, yearId) {
    $(titleId).textContent = work.title;
    $(mediumId).textContent = work.medium || 'Digital image';
    $(yearId).textContent = work.year || 'n.d.';
    if (work.year) $(yearId).removeAttribute('aria-label');
    else $(yearId).setAttribute('aria-label', 'Year not specified');
  }

  function ribbonSnapshots() {
    const snapshots = new Map();
    const distances = new Map();
    const viewport = rail.getBoundingClientRect();
    for (const card of cards.values()) {
      const index = Number(card.dataset.index);
      const box = card.getBoundingClientRect();
      const distance = metrics?.vertical ? Math.abs(box.y + box.height / 2 - viewport.y - viewport.height / 2) : Math.abs(box.x + box.width / 2 - viewport.x - viewport.width / 2);
      // Native mobile cycles repeat each image. Use the on-screen copy, not the
      // last (off-screen) duplicate, as the inspection animation's origin.
      if (!distances.has(index) || distance < distances.get(index)) {
        distances.set(index, distance);
        snapshots.set(index, box);
      }
    }
    return snapshots;
  }

  function makeCard(slot) {
    const index = wrap(slot);
    const work = WORKS[index];
    const button = document.createElement('button');
    button.className = 'gallery-card';
    button.tabIndex = -1;
    button.dataset.slot = slot;
    button.dataset.index = index;
    button.setAttribute('aria-label', `Inspect ${work.title}`);
    const image = new Image();
    if (mobileRibbon.enabled) image.loading = Math.abs(slot) <= 2 ? 'eager' : 'lazy';
    image.src = work.preview;
    image.alt = work.title;
    image.width = work.width;
    image.height = work.height;
    image.draggable = false;
    image.decoding = 'sync';
    button.append(image);
    button.addEventListener('click', () => {
      if (performance.now() < suppressClickUntil) return;
      inspect(index, slot);
    });
    rail.append(button);
    cards.set(slot, button);
  }

  function render() {
    if (!metrics) measure();
    if (metrics.mobile) {
      mobileRibbon.layout(metrics, position, cardSize, reducedMotion.matches);
      updateSelection(Math.round(position));
      return;
    }
    mobileRibbon.disable();
    rail.dataset.layout = 'virtual';
    const centre = Math.round(position);
    // Enough overscan for ultrawide screens, with a hard-bounded reusable window.
    const radius = Math.ceil(metrics.viewport / metrics.minStep / 2) + 2;
    for (const [slot, card] of cards) {
      if (Math.abs(slot - centre) > radius) { card.remove(); cards.delete(slot); }
    }
    for (let slot = centre - radius; slot <= centre + radius; slot++) {
      if (!cards.has(slot)) makeCard(slot);
    }
    const stagger = [-.18, -.28, -.06, .19, .28, .08, -.12];
    const base = Math.floor(position);
    const extent = slot => cardSize(slot)[metrics.vertical ? 'height' : 'width'];
    const separation = slot => (extent(slot) + extent(slot + 1)) / 2 + metrics.gap;
    const centres = new Map([[base, -(position - base) * separation(base)]]);
    for (let slot = base + 1; slot <= centre + radius; slot++) {
      centres.set(slot, centres.get(slot - 1) + separation(slot - 1));
    }
    for (let slot = base - 1; slot >= centre - radius; slot--) {
      centres.set(slot, centres.get(slot + 1) - separation(slot));
    }
    for (const [slot, card] of cards) {
      const { width, height } = cardSize(slot);
      const drift = stagger[((slot % stagger.length) + stagger.length) % stagger.length];
      const x = metrics.vertical ? drift * rail.clientWidth * .14 : centres.get(slot);
      const maxOffset = Math.max(0, (metrics.height - height) / 2 - 2);
      const y = metrics.vertical ? centres.get(slot) : Math.max(-maxOffset, Math.min(maxOffset, drift * metrics.height * .65));
      card.style.setProperty('--card-width', `${width}px`);
      card.style.setProperty('--card-height', `${height}px`);
      card.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }
    // Virtual positioning owns the offset; focus/paint overflow must not add a
    // second native scroll offset when a blurred print crosses the boundary.
    rail.scrollLeft = rail.scrollTop = 0;
    updateSelection(centre);
  }

  function updateSelection(centre) {
    for (const [slot, card] of cards) card.classList.toggle('is-current', slot === centre);
    const current = wrap(centre);
    if (activeIndex !== current) {
      activeIndex = current;
      $('position').textContent = count(centre);
      setCredit(WORKS[current], 'gallery-work-title', 'gallery-medium', 'gallery-year');
      $('inspect').setAttribute('aria-label', `Inspect ${WORKS[current].title}, ${count(centre)}`);
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        const work = WORKS[current];
        $('gallery-status').textContent = `${work.title}. ${work.medium || 'Digital image'}. ${work.year || 'Year not specified'}. Work ${current + 1} of ${WORKS.length}.`;
      }, 180);
    }
  }

  function animate(time) {
    frame = 0;
    if (!gallery.open || viewer.open) { rail.classList.remove('is-moving'); return; }
    const dt = lastTime ? Math.min(time - lastTime, 48) : 16;
    lastTime = time;
    const distance = target - position;
    position = reducedMotion.matches || Math.abs(distance) < .001 ? target : position + distance * (1 - Math.exp(-dt / 105));
    render();
    if (position !== target) frame = requestAnimationFrame(animate);
    else { lastTime = 0; rail.classList.remove('is-moving'); }
  }

  function requestRender() {
    if (!reducedMotion.matches) rail.classList.add('is-moving');
    if (!frame) frame = requestAnimationFrame(animate);
  }

  function move(amount) {
    if (!gallery.open || viewer.open || closingGallery) return;
    for (const animation of rail.getAnimations({ subtree: true })) animation.finish();
    if (mobileRibbon.enabled) {
      mobileRibbon.move(amount, reducedMotion.matches);
      return;
    }
    target = Math.round(target) + amount;
    requestRender();
  }

  function openGallery(event) {
    if (gallery.open || closingGallery) return;
    const clicked = event?.target.closest?.('.pile-image');
    if (clicked) position = target = Number(clicked.dataset.index);
    else if (event?.currentTarget === home) position = target = homeIndex;
    const pile = homePrints();
    const origins = new Map(pile.map(image => [Number(image.dataset.index), image.getBoundingClientRect()]));
    pageScroll = window.scrollY;
    document.body.style.setProperty('--page-top', `${-pageScroll}px`);
    document.body.classList.add('gallery-open');
    gallery.showModal();
    updateSelection(Math.round(position));
    measure();
    render();
    for (const [slot, card] of cards) {
      if (!mobileRibbon.visible(card)) continue;
      const source = origins.get(wrap(slot)) || pile[((slot % pile.length) + pile.length) % pile.length].getBoundingClientRect();
      transitionPrint(card, source, { duration: 620, delay: Math.min(80, Math.abs(slot - Math.round(position)) * 12) });
    }
    if (!reducedMotion.matches) {
      gallery.classList.add('is-opening');
      clearTimeout(openingTimer);
      openingTimer = setTimeout(() => gallery.classList.remove('is-opening'), 740);
    }
    rail.focus({ preventScroll: true });
  }

  async function closeGallery() {
    if (!gallery.open || viewer.open || closingGallery) return;
    if (mobileRibbon.enabled) position = target = mobileRibbon.read();
    closingGallery = true;
    mobileRibbon.stop();
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (drag) endDrag({ pointerId: drag.id });
    target = position;
    clearTimeout(openingTimer);
    gallery.classList.remove('is-opening');
    captureEdgeFade(gallery);
    gallery.classList.add('is-closing');
    homeIndex = wrap(Math.round(position));
    centreHome();
    const pile = homePrints();
    const destinations = new Map(pile.map(image => [Number(image.dataset.index), image.getBoundingClientRect()]));
    const motions = [...cards].map(([slot, card]) => {
      if (!mobileRibbon.visible(card)) return null;
      const fallback = pile[((slot % pile.length) + pile.length) % pile.length].getBoundingClientRect();
      return transitionPrint(card, destinations.get(wrap(slot)) || fallback, {
        reverse: true, duration: 460, delay: Math.min(48, Math.abs(slot - Math.round(position)) * 10),
      });
    });
    await Promise.allSettled(motions.filter(Boolean).map(animation => animation.finished));
    gallery.close();
    $('pile').focus({ preventScroll: true });
  }

  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', openGallery));
  $('close-gallery').addEventListener('click', closeGallery);
  gallery.addEventListener('cancel', event => {
    event.preventDefault();
    closeGallery();
  });
  gallery.addEventListener('click', event => {
    if (viewer.open || performance.now() < suppressClickUntil) return;
    // Only blank canvas exits; a completed drag must not count as a click.
    if (event.target === gallery || event.target === rail) closeGallery();
  });
  gallery.addEventListener('close', () => {
    document.body.classList.remove('gallery-open');
    document.body.style.removeProperty('--page-top');
    window.scrollTo({ top: pageScroll, behavior: 'auto' });
    closingGallery = false;
    suppressClickUntil = 0;
    clearTimeout(openingTimer);
    clearTimeout(statusTimer);
    gallery.classList.remove('is-closing', 'is-opening', 'is-inspecting');
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    drag = null;
    rail.classList.remove('is-dragging', 'is-moving');
    // Leave the pile intact and remember where the visitor was wandering.
    for (const animation of rail.getAnimations({ subtree: true })) animation.cancel();
    position = target;
  });
  $('previous').addEventListener('click', () => move(-1));
  $('next').addEventListener('click', () => move(1));
  $('inspect').addEventListener('click', () => inspect(wrap(Math.round(position))));

  rail.addEventListener('wheel', event => {
    if (mobileRibbon.enabled || event.ctrlKey || viewer.open || closingGallery) return; // Keep browser pinch-to-zoom available.
    event.preventDefault();
    for (const animation of rail.getAnimations({ subtree: true })) animation.finish();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? metrics.height : 1;
    const delta = (metrics.vertical ? event.deltaY : Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit;
    target += Math.max(-600, Math.min(600, delta)) / metrics.step;
    requestRender();
  }, { passive: false });

  rail.addEventListener('pointerdown', event => {
    if (mobileRibbon.enabled || closingGallery || event.button !== 0 || (event.pointerType === 'touch' && !event.isPrimary)) return;
    for (const animation of rail.getAnimations({ subtree: true })) animation.finish();
    cancelAnimationFrame(frame);
    frame = 0;
    target = position;
    drag = { id: event.pointerId, vertical: metrics.vertical, coordinate: metrics.vertical ? event.clientY : event.clientX, start: target, moved: false };
  });
  rail.addEventListener('pointermove', event => {
    if (mobileRibbon.enabled) return;
    if (!drag || event.pointerId !== drag.id) return;
    const delta = (drag.vertical ? event.clientY : event.clientX) - drag.coordinate;
    if (!drag.moved && Math.abs(delta) > 6) {
      drag.moved = true;
      rail.setPointerCapture(event.pointerId);
      rail.classList.add('is-dragging');
    }
    if (!drag.moved) return;
    target = position = drag.start - delta / metrics.step;
    render();
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) suppressClickUntil = performance.now() + 300;
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    drag = null;
    rail.classList.remove('is-dragging');
  }
  rail.addEventListener('pointerup', endDrag);
  rail.addEventListener('pointercancel', endDrag);
  rail.addEventListener('lostpointercapture', event => {
    // Touch starts with implicit capture on the card. Transferring that capture
    // to the ribbon is not the end of the gesture; ignore the bubbled event.
    if (event.target === rail) endDrag(event);
  });
  // A pointer released outside the ribbon must not leave it stuck dragging.
  window.addEventListener('pointerup', endDrag);

  // Keep Tab inside the active layer, including browsers that tab to browser chrome.
  function containFocus(event) {
    if (event.key !== 'Tab' || (event.currentTarget === gallery && viewer.open)) return;
    const focusable = [...event.currentTarget.querySelectorAll('button, a[href], [tabindex="0"]')]
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length);
    if (!focusable.length) return;
    event.preventDefault();
    event.stopPropagation();
    const current = focusable.indexOf(document.activeElement);
    const next = (current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
    focusable[next].focus({ preventScroll: true });
  }
  gallery.addEventListener('keydown', containFocus);
  viewer.addEventListener('keydown', containFocus);

  // Listen at document level so desktop arrows work regardless of which
  // gallery control has focus. Never intercept keys while the gallery is shut.
  document.addEventListener('keydown', event => {
    if (!gallery.open || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (closingGallery || closingViewer) return;
      const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      if (viewer.open) showWork(inspected + direction);
      else move(direction);
    }
    if (event.key === 'Enter' && event.target === rail && !viewer.open) {
      event.preventDefault();
      if (!closingGallery) inspect(wrap(Math.round(position)));
    }
  });

  function viewerSnapshots() {
    const snapshots = new Map([...$('viewer-context').children].map(card => [Number(card.dataset.index), card.getBoundingClientRect()]));
    if (viewer.open) snapshots.set(inspected, inspection.getBoundingClientRect());
    return snapshots;
  }

  function layoutViewer(origins = new Map()) {
    const vertical = false;
    const stage = setStage(viewer);
    const stageHeight = stage.height;
    viewer.style.setProperty('--viewer-center', `${stage.top + stageHeight / 2}px`);
    const size = artSize(WORKS[inspected], viewer.clientWidth * (phoneLayout.matches ? .76 : .68), stageHeight * (vertical ? .68 : .96));
    for (const animation of inspection.getAnimations()) animation.cancel();
    inspection.style.width = `${size.width}px`;
    inspection.style.height = `${size.height}px`;
    const gap = vertical ? Math.max(16, Math.min(24, innerHeight * .025)) : Math.max(18, Math.min(60, innerWidth * .04));
    const context = $('viewer-context');
    context.replaceChildren();
    for (const direction of [-1, 1]) {
      let edge = (vertical ? size.height : size.width) / 2 + gap;
      for (let distance = 1; distance <= 3; distance++) {
        const offset = distance * direction;
        const index = wrap(inspected + offset);
        const work = WORKS[index];
        const small = artSize(work, Math.min(230, innerWidth * (vertical ? .46 : .30)), vertical ? Math.min(180, stageHeight * .24) : Math.min(320, innerHeight * .34));
        const card = document.createElement('button');
        card.className = 'context-card';
        card.tabIndex = -1;
        card.dataset.index = index;
        card.dataset.offset = offset;
        card.style.width = `${small.width}px`;
        card.style.height = `${small.height}px`;
        const x = vertical ? direction * (distance % 2 ? 10 : -12) : direction * (edge + small.width / 2);
        const y = vertical ? direction * (edge + small.height / 2) : direction * (distance % 2 ? 20 : -24);
        card.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        card.setAttribute('aria-label', `Inspect ${direction < 0 ? 'previous' : 'next'} work: ${work.title}`);
        const image = new Image();
        image.src = work.preview;
        image.alt = work.title;
        image.draggable = false;
        image.decoding = 'async';
        card.append(image);
        card.addEventListener('click', () => { if (performance.now() >= suppressClickUntil) showWork(index); });
        context.append(card);
        transitionPrint(card, origins.get(index));
        edge += (vertical ? small.height : small.width) + gap;
      }
    }
    transitionPrint(inspection, origins.get(inspected));
  }

  function showWork(index, origins = viewerSnapshots()) {
    if (closingViewer || closingGallery) return;
    inspected = wrap(index);
    const work = WORKS[inspected];
    setCredit(work, 'work-title', 'detail-medium', 'detail-year');
    $('detail-position').textContent = count(inspected);
    $('detail-image').alt = work.title;
    // Show the cached display preview immediately instead of leaving the
    // previous work visible while a larger image downloads on a phone.
    $('detail-image').src = work.preview;
    const full = new Image();
    full.src = work.detail;
    full.decode().then(() => {
      if (inspected === wrap(index) && viewer.open) $('detail-image').src = work.detail;
    }).catch(() => {});
    $('image-error').hidden = true;
    layoutViewer(origins);
  }

  function alignRibbon() {
    const centre = Math.round(position);
    let distance = wrap(inspected - wrap(centre));
    if (distance > WORKS.length / 2) distance -= WORKS.length;
    position = target = centre + distance;
    render();
  }

  function inspect(index, slot = Math.round(position)) {
    if (viewer.open || closingGallery) return;
    if (mobileRibbon.enabled) {
      position = target = mobileRibbon.read();
      mobileRibbon.stop();
    }
    const origins = ribbonSnapshots();
    cancelAnimationFrame(frame);
    frame = 0;
    position = target = slot;
    for (const animation of rail.getAnimations({ subtree: true })) animation.cancel();
    render();
    rail.classList.remove('is-moving');
    gallery.classList.add('is-inspecting');
    viewer.showModal();
    showWork(index, origins);
  }

  async function closeViewer() {
    if (closingViewer || !viewer.open) return;
    viewerGesture = null;
    closingViewer = true;
    captureEdgeFade(viewer);
    viewer.classList.add('is-closing');
    alignRibbon();
    // Reveal the real ribbon underneath and return each print to its place.
    gallery.classList.remove('is-inspecting');
    const destinations = ribbonSnapshots();
    const motions = [transitionPrint(inspection, destinations.get(inspected), { reverse: true, duration: 400 })];
    for (const card of $('viewer-context').children) {
      motions.push(transitionPrint(card, destinations.get(Number(card.dataset.index)), { reverse: true, duration: 400 }));
    }
    await Promise.allSettled(motions.filter(Boolean).map(animation => animation.finished));
    viewer.classList.remove('is-closing');
    viewer.close();
    closingViewer = false;
    rail.focus({ preventScroll: true });
  }

  $('detail-image').addEventListener('error', () => { $('image-error').hidden = false; });
  $('detail-image').addEventListener('load', () => { $('image-error').hidden = true; });
  $('close-viewer').addEventListener('click', closeViewer);
  viewer.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) return;
    // Empty canvas dismisses inspection; image and neighbor/control clicks do not.
    if (event.target === viewer) closeViewer();
  });
  viewer.addEventListener('pointerdown', event => {
    if (!phoneLayout.matches || !viewer.open || closingViewer || event.button !== 0 || event.target.closest('.chrome')) return;
    if (event.pointerType === 'touch' && !event.isPrimary) { viewerGesture = null; return; }
    viewerGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, delta: 0, moved: false };
  });
  viewer.addEventListener('pointermove', event => {
    if (!viewerGesture || viewerGesture.id !== event.pointerId) return;
    const dy = event.clientY - viewerGesture.y;
    const dx = event.clientX - viewerGesture.x;
    viewerGesture.delta = dx;
    if (!viewerGesture.moved && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      viewerGesture.moved = true;
      viewer.setPointerCapture(event.pointerId);
      for (const animation of viewer.getAnimations({ subtree: true })) animation.finish();
    }
  });
  function endViewerGesture(event) {
    if (!viewerGesture || viewerGesture.id !== event.pointerId) return;
    const gesture = viewerGesture;
    viewerGesture = null;
    if (viewer.hasPointerCapture(event.pointerId)) viewer.releasePointerCapture(event.pointerId);
    if (!gesture.moved) return;
    suppressClickUntil = performance.now() + 350;
    if (event.type === 'pointerup' && Math.abs(gesture.delta) >= 48) showWork(inspected + (gesture.delta < 0 ? 1 : -1));
  }
  viewer.addEventListener('pointerup', endViewerGesture);
  viewer.addEventListener('pointercancel', endViewerGesture);
  viewer.addEventListener('lostpointercapture', event => { if (event.target === viewer) endViewerGesture(event); });

  viewer.addEventListener('cancel', event => {
    event.preventDefault();
    closeViewer();
  });
  $('detail-previous').addEventListener('click', () => showWork(inspected - 1));
  $('detail-next').addEventListener('click', () => showWork(inspected + 1));
  viewer.addEventListener('close', () => {
    if (viewer.open) return;
    // Position and focus were restored synchronously by closeViewer. Do not
    // realign here: this queued event could otherwise swallow the next arrow key.
    gallery.classList.remove('is-inspecting');
    viewer.classList.remove('is-closing');
    closingViewer = false;
  });
  function scheduleLayout(force = false) {
    if (!gallery.open || closingGallery) return;
    forceLayout ||= force;
    if (mobileRibbon.touching) { pendingLayout = true; return; }
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      pendingLayout = false;
      const force = forceLayout;
      forceLayout = false;
      if (!gallery.open || closingGallery) return;
      if (force || setStage(gallery).changed) {
        if (drag) endDrag({ pointerId: drag.id });
        if (mobileRibbon.enabled && !viewer.open) position = target = mobileRibbon.read();
        measure();
        render();
      }
      if (viewer.open && !closingViewer && (force || setStage(viewer).changed)) layoutViewer();
    });
  }
  window.addEventListener('resize', () => scheduleLayout(true));
  window.visualViewport?.addEventListener('resize', () => scheduleLayout(true));
  const chromeObserver = new ResizeObserver(() => scheduleLayout());
  document.querySelectorAll('.chrome').forEach(element => chromeObserver.observe(element));

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    // End in-flight entrances/exits as well as future motion when the system
    // preference changes. Static edge frosting is deliberately unaffected.
    for (const animation of document.getAnimations()) animation.finish();
    rail.classList.remove('is-moving');
    if (gallery.open && !viewer.open && !closingGallery) {
      if (mobileRibbon.enabled) {
        if (mobileRibbon.target !== null) mobileRibbon.move(0, true);
      } else {
        position = target;
        render();
      }
    }
  });

  // These deter casual saving, not screenshots or determined copying. Pixels
  // delivered to a browser can always be captured; don't disable browser keys.
  const isArtwork = target => target instanceof Element && target.closest('#pile, .gallery-card, .context-card, .inspection');
  document.addEventListener('contextmenu', event => { if (isArtwork(event.target)) event.preventDefault(); });
  document.addEventListener('dragstart', event => { if (isArtwork(event.target)) event.preventDefault(); });
})();
