import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'no-preference' }); });

async function settle(page) {
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map(animation => animation.finished)));
}

test('cover turns keep printed planes sharp and opaque while selected descriptions animate separately', async ({ page }) => {
  await page.goto('/books.html');
  await page.locator('.book-name').first().click();
  await settle(page);
  const state = await page.evaluate(() => {
    document.querySelectorAll('.book')[1].click();
    return {
      scenes: [...document.querySelectorAll('.book')].slice(0, 2).map(book => ({
        filter: getComputedStyle(book).filter, opacity: getComputedStyle(book).opacity,
        objectFilter: getComputedStyle(book.querySelector('.book-object')).filter,
        objectOpacity: getComputedStyle(book.querySelector('.book-object')).opacity,
        transformStyle: getComputedStyle(book.querySelector('.book-object')).transformStyle,
        planes: [...book.querySelectorAll('.book-front, .book-spine')].map(plane => ({ filter: getComputedStyle(plane).filter, opacity: getComputedStyle(plane).opacity, animations: plane.getAnimations().length })),
      })),
      title: document.getElementById('book-title').textContent,
      url: document.getElementById('book-purchase').href,
      incoming: document.getElementById('book-description').getAnimations()[0].effect.getKeyframes().map(({ filter, opacity }) => ({ filter, opacity })),
      snapshots: document.querySelectorAll('.book-details-ghost').length,
    };
  });
  for (const scene of state.scenes) {
    expect(scene).toMatchObject({ filter: 'none', opacity: '1', objectFilter: 'none', objectOpacity: '1', transformStyle: 'preserve-3d' });
    expect(scene.planes).toEqual([{ filter: 'none', opacity: '1', animations: 0 }, { filter: 'none', opacity: '1', animations: 0 }]);
  }
  expect(state.title).toBe('And Then We Walk Out');
  expect(state.url).toBe('https://www.amazon.com/dp/B0FMJV8SJL');
  expect(state.incoming[0].filter).toBe('blur(6px)');
  expect(Number(state.incoming[0].opacity)).toBe(0);
  expect(state.snapshots).toBe(0);
  await settle(page);
  await expect(page.locator('#book-description')).toHaveCSS('filter', 'none');
  await expect(page.locator('.book-front').nth(1)).toHaveCSS('opacity', '1');
  await page.screenshot({ path: `test-results/books-motion-${test.info().project.name}.png`, fullPage: true });
});

test('rapid selections keep only the latest description, purchase target and animation; closing clears it immediately', async ({ page }) => {
  await page.goto('/books.html');
  const latest = await page.evaluate(() => {
    const previews = document.querySelectorAll('.book');
    for (const index of [3, 0, 1, 3, 2]) previews[index].click();
    return {
      title: document.getElementById('book-title').textContent,
      url: document.getElementById('book-purchase').href,
      descriptions: document.querySelectorAll('#book-description').length,
      animations: document.getElementById('book-description').getAnimations().length,
      snapshots: document.querySelectorAll('.book-details-ghost').length,
    };
  });
  expect(latest).toEqual({ title: 'Crepuscolo', url: 'https://www.amazon.com/dp/B0DP4HZVNV', descriptions: 1, animations: 1, snapshots: 0 });
  await page.locator('#book-close').click();
  await expect(page.locator('#book-details')).toBeHidden();
  expect(await page.locator('#book-description').evaluate(element => element.getAnimations().length)).toBe(0);
  await expect(page.locator('.book.is-selected, .book-name.is-selected')).toHaveCount(0);
});

test('rapidly returning to the same book schedules only one scroll to its description', async ({ page }) => {
  await page.goto('/books.html');
  const calls = await page.evaluate(async () => {
    const panel = document.getElementById('book-details');
    let calls = 0;
    panel.scrollIntoView = () => { calls++; };
    const previews = document.querySelectorAll('.book');
    for (const index of [0, 1, 0]) previews[index].click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return calls;
  });
  expect(calls).toBe(1);
  await expect(page.locator('#book-title')).toHaveText('The Second Thought');
});

test('reduced motion selects immediately and enabling it mid-switch clears caption effects and cover transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  await page.locator('.book-name').nth(2).click();
  await expect(page.locator('#book-title')).toHaveText('Crepuscolo');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.book').nth(1).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#book-description')).toHaveCSS('filter', 'none');
  await expect(page.locator('.book-front').nth(1)).toHaveCSS('filter', 'none');
  await expect(page.locator('#book-purchase')).toHaveAttribute('href', 'https://www.amazon.com/dp/B0FMJV8SJL');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('page arrivals and native internal-navigation transitions share fade motion and tolerate interruption', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.sawNativeTransition = false;
    addEventListener('pagereveal', event => { window.sawNativeTransition = Boolean(event.viewTransition); });
  });
  await page.goto('/');
  await expect(page.locator('.home-page .intro')).toHaveCSS('animation-name', 'intro-arrive');
  await page.getByRole('link', { name: 'Elsewhere', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.sawNativeTransition)).toBe(true);
  await page.getByRole('link', { name: 'Selected works', exact: true }).click();
  await page.getByRole('link', { name: 'Books', exact: true }).click();
  expect(await page.evaluate(() => window.sawNativeTransition)).toBe(false);
  await expect(page.locator('.book-front').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.book-spine').first()).toHaveCSS('filter', 'none');
  await page.getByRole('link', { name: 'Elsewhere', exact: true }).click();
  await expect(page.locator('.writing-entry').first()).toHaveCSS('animation-name', 'soft-reveal');
  await page.getByRole('link', { name: 'Selected works', exact: true }).click();
  await expect(page.locator('.series-name')).toHaveCount(3);
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
  await page.getByRole('link', { name: 'Selected works', exact: true }).click();
  await page.getByRole('link', { name: 'Books', exact: true }).click();
  expect(await page.evaluate(() => window.sawNativeTransition)).toBe(false);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
