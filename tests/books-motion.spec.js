import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'no-preference' }); });

async function settle(page) {
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map(animation => animation.finished)));
}

function checkScene(state) {
  expect(state.filter).toBe('none');
  expect(state.opacity).toBe('1');
  expect(state.objectFilter).toBe('none');
  expect(state.objectOpacity).toBe('1');
  expect(state.transformStyle).toBe('preserve-3d');
}

test('book switches keep printed planes sharp and opaque while crossfading text details', async ({ page }) => {
  await page.goto('/books.html');
  await settle(page);
  const state = await page.evaluate(() => {
    const books = [...document.querySelectorAll('.book')];
    books[1].click();
    const ghost = document.querySelector('.book-details-ghost');
    return {
      scenes: books.slice(0, 2).map(book => ({
        filter: getComputedStyle(book).filter, opacity: getComputedStyle(book).opacity,
        objectFilter: getComputedStyle(book.querySelector('.book-object')).filter,
        objectOpacity: getComputedStyle(book.querySelector('.book-object')).opacity,
        transformStyle: getComputedStyle(book.querySelector('.book-object')).transformStyle,
        planes: [...book.querySelectorAll('.book-front, .book-spine')].map(plane => ({ filter: getComputedStyle(plane).filter, opacity: getComputedStyle(plane).opacity, animations: plane.getAnimations().length })),
      })),
      title: document.getElementById('book-title').textContent,
      url: document.getElementById('book-purchase').href,
      ghost: { hidden: ghost.getAttribute('aria-hidden'), inert: ghost.inert, ids: ghost.querySelectorAll('[id]').length, live: ghost.hasAttribute('aria-live'), title: ghost.querySelector('h2').textContent },
      incoming: document.getElementById('book-title').getAnimations()[0].effect.getKeyframes().map(({ filter, opacity }) => ({ filter, opacity })),
      outgoing: ghost.querySelector('h2').getAnimations()[0].effect.getKeyframes().map(({ filter, opacity }) => ({ filter, opacity })),
    };
  });
  for (const scene of state.scenes) {
    checkScene(scene);
    expect(scene.planes).toEqual([{ filter: 'none', opacity: '1', animations: 0 }, { filter: 'none', opacity: '1', animations: 0 }]);
  }
  expect(state.title).toBe('And Then We Walk Out');
  expect(state.url).toBe('https://www.amazon.com/dp/B0FMJV8SJL');
  expect(state.ghost).toEqual({ hidden: 'true', inert: true, ids: 0, live: false, title: 'The Second Thought' });
  expect(state.incoming[0].filter).toBe('blur(6px)');
  expect(Number(state.incoming[0].opacity)).toBe(0);
  expect(state.outgoing[1].filter).toBe('blur(8px)');
  expect(Number(state.outgoing[1].opacity)).toBe(0);
  await expect(page.getByRole('heading', { name: 'The Second Thought', exact: true })).toHaveCount(0);
  await settle(page);
  await expect(page.locator('.book-details-ghost')).toHaveCount(0);
  await expect(page.locator('.book-front').nth(1)).toHaveCSS('filter', 'none');
  await expect(page.locator('.book-front').nth(1)).toHaveCSS('opacity', '1');
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.book-front img')].map(image => image.decode())));
  await page.screenshot({ path: `test-results/books-motion-${test.info().project.name}.png`, fullPage: true });
});

test('interrupted and rapid switches preserve the current frame and latest purchase target; closing fades old details out', async ({ page }) => {
  await page.goto('/books.html');
  await settle(page);
  const interrupted = await page.evaluate(() => {
    const books = [...document.querySelectorAll('.book')];
    books[1].click();
    const title = document.getElementById('book-title');
    for (const animation of title.getAnimations()) { animation.pause(); animation.currentTime = 180; }
    const before = { filter: getComputedStyle(title).filter, opacity: getComputedStyle(title).opacity };
    books[2].click();
    const ghostTitle = document.querySelector('.book-details-ghost h2');
    return { before, after: { filter: ghostTitle.style.filter, opacity: ghostTitle.style.opacity } };
  });
  expect(interrupted.after.filter).toBe(interrupted.before.filter);
  expect(Number(interrupted.after.opacity)).toBeCloseTo(Number(interrupted.before.opacity), 5);
  const latest = await page.evaluate(() => {
    const books = [...document.querySelectorAll('.book')];
    for (const index of [3, 0, 1, 3, 2]) books[index].click();
    return { title: document.getElementById('book-title').textContent, url: document.getElementById('book-purchase').href, ghosts: document.querySelectorAll('.book-details-ghost').length, titles: document.querySelectorAll('#book-title').length };
  });
  expect(latest).toEqual({ title: 'Crepuscolo', url: 'https://www.amazon.com/dp/B0DP4HZVNV', ghosts: 1, titles: 1 });
  await settle(page);
  const closing = await page.evaluate(() => {
    document.querySelector('.book.is-open').click();
    const ghost = document.querySelector('.book-details-ghost');
    return { open: document.querySelectorAll('.book.is-open').length, hidden: document.getElementById('book-details').getAttribute('aria-hidden'), ghostVisible: getComputedStyle(ghost).visibility, inert: ghost.inert };
  });
  expect(closing).toEqual({ open: 0, hidden: 'true', ghostVisible: 'visible', inert: true });
  await expect(page.locator('.book-details-ghost')).toHaveCount(0);
});

test('reduced motion selects immediately and enabling it mid-switch clears blur and caption snapshots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  await page.locator('.book').nth(2).click();
  await expect(page.locator('#book-title')).toHaveText('Crepuscolo');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator('.book-details-ghost')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.querySelectorAll('.book')[1].click());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.book-details-ghost')).toHaveCount(0);
  await expect(page.locator('.book-front').nth(1)).toHaveCSS('filter', 'none');
  await expect(page.locator('.book-front').nth(1)).toHaveCSS('opacity', '1');
  await expect(page.locator('#book-purchase')).toHaveAttribute('href', 'https://www.amazon.com/dp/B0FMJV8SJL');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('page arrivals and native internal-navigation transitions share blur/fade motion and tolerate interruption', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.sawNativeTransition = false;
    addEventListener('pagereveal', event => { window.sawNativeTransition = Boolean(event.viewTransition); });
  });
  await page.goto('/');
  await expect(page.locator('.intro-copy')).toHaveCSS('animation-name', 'soft-reveal');
  await page.getByRole('link', { name: 'Elsewhere', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.sawNativeTransition)).toBe(true);
  await page.getByRole('link', { name: 'Books', exact: true }).click();
  expect(await page.evaluate(() => window.sawNativeTransition)).toBe(false);
  await expect(page.locator('.book-front').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.book-spine').first()).toHaveCSS('filter', 'none');
  await page.getByRole('link', { name: 'Elsewhere', exact: true }).click();
  await expect(page.locator('.writing-entry').first()).toHaveCSS('animation-name', 'soft-reveal');
  await page.getByRole('link', { name: 'Selected work', exact: true }).click();
  await expect(page.locator('#pile')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.writing-list')).toBeVisible();
  expect(errors).toEqual([]);
});

test('reduced motion disables page-arrival and native navigation effects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.sawNativeTransition = false;
    addEventListener('pagereveal', event => { window.sawNativeTransition = Boolean(event.viewTransition); });
  });
  await page.goto('/');
  await expect(page.locator('.intro-copy')).toHaveCSS('animation-name', 'none');
  await page.getByRole('link', { name: 'Books', exact: true }).click();
  expect(await page.evaluate(() => window.sawNativeTransition)).toBe(false);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
