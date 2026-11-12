/* Native horizontal scrolling on phones. Three fixed cycles provide an endless
   ribbon without moving/recycling the element underneath an active finger. */
class MobileGallery {
  constructor(rail, { cards, createCard, count, active, onPosition, onGesture, onIdle }) {
    Object.assign(this, { rail, cards, createCard, count, active, onPosition, onGesture, onIdle });
    this.enabled = false;
    this.position = 0;
    this.target = null;
    this.centres = [];
    this.scrollFrame = 0;
    this.navigationFrame = 0;
    this.settleTimer = 0;
    this.touching = false;
    this.ignoreScrollUntil = 0;
    this.mouse = null;
    this.gestureScrolling = false;

    rail.addEventListener('wheel', event => {
      if (!this.enabled || !this.active() || event.ctrlKey) return;
      this.gestureScrolling = true;
      this.target = null;
      cancelAnimationFrame(this.navigationFrame);
      this.navigationFrame = 0;
      for (const animation of rail.getAnimations({ subtree: true })) animation.finish();
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientWidth : 1;
        rail.scrollLeft += event.deltaY * unit;
      }
    }, { passive: false });
    rail.addEventListener('scroll', () => {
      if (!this.enabled || !this.active()) return;
      if (!this.scrollFrame) this.scrollFrame = requestAnimationFrame(() => {
        this.scrollFrame = 0;
        this.read();
        // Very fast flings on short landscape screens must not hit the finite
        // outer edge before the idle-time rebase gets a chance to run.
        if (this.position <= -this.count + 1 || this.position >= this.count * 2 - 2) {
          this.jump(((this.position % this.count) + this.count) % this.count);
        }
        if (performance.now() > this.ignoreScrollUntil && this.gestureScrolling) this.onGesture();
      });
      this.settle();
    }, { passive: true });
    rail.addEventListener('touchstart', event => {
      if (!this.enabled || !this.active()) return;
      this.touching = true;
      this.gestureScrolling = false;
      for (const animation of rail.getAnimations({ subtree: true })) animation.finish();
      this.target = null;
      this.touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }, { passive: true });
    rail.addEventListener('touchmove', event => {
      if (!this.enabled || !this.touchStart || event.touches.length !== 1) return;
      if (Math.hypot(event.touches[0].clientX - this.touchStart.x, event.touches[0].clientY - this.touchStart.y) > 8) {
        this.gestureScrolling = true;
        this.onGesture();
      }
    }, { passive: true });
    const endTouch = () => {
      if (!this.enabled) return;
      this.touching = false;
      this.touchStart = null;
      this.settle();
    };
    rail.addEventListener('touchend', endTouch, { passive: true });
    rail.addEventListener('touchcancel', endTouch, { passive: true });

    // A mouse attached to a small/tablet viewport can still drag the native rail.
    rail.addEventListener('pointerdown', event => {
      if (!this.enabled || !this.active() || event.pointerType !== 'mouse' || event.button !== 0) return;
      this.target = null;
      for (const animation of rail.getAnimations({ subtree: true })) animation.finish();
      this.mouse = { id: event.pointerId, x: event.clientX, scroll: rail.scrollLeft, moved: false };
    });
    rail.addEventListener('pointermove', event => {
      if (!this.mouse || this.mouse.id !== event.pointerId) return;
      const distance = event.clientX - this.mouse.x;
      if (!this.mouse.moved && Math.abs(distance) > 8) {
        this.mouse.moved = true;
        this.gestureScrolling = true;
        rail.setPointerCapture(event.pointerId);
        rail.classList.add('is-dragging');
      }
      if (!this.mouse.moved) return;
      rail.scrollLeft = this.mouse.scroll - distance;
      this.onGesture();
    });
    const endMouse = event => {
      if (!this.mouse || this.mouse.id !== event.pointerId) return;
      if (this.mouse.moved) this.onGesture();
      this.mouse = null;
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
      rail.classList.remove('is-dragging');
      this.settle();
    };
    rail.addEventListener('pointerup', endMouse);
    rail.addEventListener('pointercancel', endMouse);
    rail.addEventListener('lostpointercapture', event => { if (event.target === rail) endMouse(event); });
  }

  layout(metrics, position, sizeAt, reducedMotion) {
    const goal = this.target;
    const initial = !this.enabled;
    this.enabled = true;
    this.rail.dataset.layout = 'native';
    this.rail.style.overflowX = '';
    if (initial) {
      this.rail.replaceChildren();
      this.cards.clear();
      for (let slot = -this.count; slot < this.count * 2; slot++) this.createCard(slot);
    }
    const first = sizeAt(-this.count);
    const last = sizeAt(this.count * 2 - 1);
    const padding = Math.max(0, (metrics.viewport - first.width) / 2);
    this.rail.style.paddingLeft = `${padding}px`;
    this.rail.style.paddingRight = `${Math.max(0, (metrics.viewport - last.width) / 2)}px`;
    this.rail.style.setProperty('--native-gap', `${metrics.gap}px`);
    this.centres = [];
    let edge = padding;
    for (const [slot, card] of this.cards) {
      const size = sizeAt(slot);
      card.style.setProperty('--card-width', `${size.width}px`);
      card.style.setProperty('--card-height', `${size.height}px`);
      card.style.transform = `translateY(${size.offsetY}px)`;
      this.centres.push({ slot, centre: edge + size.width / 2 });
      edge += size.width + metrics.gap;
    }
    this.target = null;
    this.position = ((position % this.count) + this.count) % this.count;
    this.jump(this.position);
    // A viewport/chrome resize must not discard a keyboard/button navigation
    // already in flight (mobile browser bars can resize the viewport mid-scroll).
    if (goal !== null) {
      this.target = goal + this.position - position;
      this.navigate(reducedMotion);
    }
  }

  offset(position) {
    const slot = Math.floor(position);
    const left = this.centres.find(item => item.slot === slot);
    const right = this.centres.find(item => item.slot === slot + 1) || left;
    if (!left) return this.rail.scrollLeft;
    return left.centre + (position - slot) * (right.centre - left.centre) - this.rail.clientWidth / 2;
  }

  read() {
    if (!this.enabled || !this.centres.length) return this.position;
    const middle = this.rail.scrollLeft + this.rail.clientWidth / 2;
    let index = this.centres.findIndex(item => item.centre >= middle);
    if (index < 0) index = this.centres.length - 1;
    const left = this.centres[Math.max(0, index - 1)];
    const right = this.centres[index];
    const fraction = right.centre === left.centre ? 0 : (middle - left.centre) / (right.centre - left.centre);
    // scrollLeft is pixel-quantised, while fitted print sizes are fractional.
    // Treat a sub-pixel centre as exact so a loop seam cannot miss its rebase.
    this.position = Math.abs(middle - left.centre) < 1 ? left.slot : Math.abs(middle - right.centre) < 1 ? right.slot : left.slot + fraction;
    if (this.active()) this.onPosition(this.position);
    return this.position;
  }

  jump(position) {
    this.ignoreScrollUntil = performance.now() + 100;
    this.rail.scrollLeft = this.offset(position);
    this.position = position;
    if (this.active()) this.onPosition(position);
  }

  move(amount, reducedMotion) {
    if (!this.enabled) return;
    let goal = Math.round(this.target ?? this.read()) + amount;
    if (goal < -this.count || goal >= this.count * 2) {
      this.jump(((this.position % this.count) + this.count) % this.count);
      goal = Math.round(this.position) + amount;
    }
    this.target = goal;
    this.gestureScrolling = false;
    this.navigate(reducedMotion);
  }

  navigate(reducedMotion) {
    clearTimeout(this.settleTimer);
    cancelAnimationFrame(this.navigationFrame);
    // Commit the initial/rebased scroll before starting a smooth one. Chromium
    // can otherwise silently discard a navigation issued in that same frame.
    this.navigationFrame = requestAnimationFrame(() => {
      this.navigationFrame = 0;
      if (!this.enabled || !this.active() || this.target === null) return;
      this.rail.scrollTo({ left: this.offset(this.target), behavior: reducedMotion ? 'auto' : 'smooth' });
      this.settle();
    });
  }

  settle() {
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      if (!this.enabled || !this.active() || this.touching || this.mouse) return;
      if (this.navigationFrame) { this.settle(); return; }
      this.read();
      this.target = null;
      this.gestureScrolling = false;
      if (this.position < -.01 || this.position >= this.count) {
        this.jump(((this.position % this.count) + this.count) % this.count);
      }
      this.onIdle();
    }, 180);
  }

  stop() {
    clearTimeout(this.settleTimer);
    cancelAnimationFrame(this.scrollFrame);
    cancelAnimationFrame(this.navigationFrame);
    this.scrollFrame = this.navigationFrame = 0;
    this.target = null;
    this.touching = false;
    this.gestureScrolling = false;
    this.touchStart = null;
    this.mouse = null;
    this.rail.scrollTo({ left: this.rail.scrollLeft, behavior: 'auto' });
    this.rail.style.overflowX = 'hidden';
    this.rail.classList.remove('is-dragging');
  }

  visible(card) {
    const box = card.getBoundingClientRect();
    const viewport = this.rail.getBoundingClientRect();
    return box.right > viewport.left && box.left < viewport.right;
  }

  disable() {
    if (!this.enabled) return;
    this.stop();
    this.enabled = false;
    this.rail.replaceChildren();
    this.cards.clear();
    this.rail.dataset.layout = 'virtual';
    this.rail.style.paddingLeft = this.rail.style.paddingRight = this.rail.style.overflowX = '';
    this.rail.style.removeProperty('--native-gap');
    this.rail.scrollLeft = 0;
    this.centres = [];
  }
}
