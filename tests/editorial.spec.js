import { test, expect } from '@playwright/test';

test('all pages start close below fixed navigation, use uniform weight and hide page-title labels', async ({ page }) => {
  test.setTimeout(60000);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, selector] of [['/', '.intro-copy'], ['/gallery.html', '.series-name'], ['/a-face-in-the-crowd.html', '.series-description'], ['/alexythimia.html', '.series-description'], ['/for-now-we-see-through-a-glass-darkly.html', '.series-description'], ['/books.html', '.book-name'], ['/elsewhere.html', '.writing-entry h2']]) {
      await page.goto(path);
      const nav = page.locator('.site-nav');
      await expect(nav).toHaveCSS('position', 'fixed');
      expect(await nav.locator('a').allTextContents()).toEqual(['Home', 'Selected works', 'Elsewhere', 'Instagram', 'Email']);
      const box = await nav.boundingBox();
      expect(box.x).toBe(0);
      expect(box.y).toBe(0);
      expect(box.width).toBe(width);
      for (const link of await nav.locator('a').all()) {
        await expect(link).toBeInViewport();
        const bounds = await link.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      }
      await expect(nav.locator('a[href="books.html"]')).toHaveCount(0);
      const copy = await page.locator(selector).first().boundingBox();
      expect(copy.y - box.y - box.height).toBeCloseTo(16, 0);
      const mismatchedWeights = await page.locator('body *').evaluateAll(elements => elements.filter(element =>
        element.getClientRects().length && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()) && getComputedStyle(element).fontWeight !== '700'
      ).map(element => ({ tag: element.tagName, class: element.className, weight: getComputedStyle(element).fontWeight })));
      expect(mismatchedWeights).toEqual([]);
      if (path !== '/') {
        await expect(page.locator('h1')).toHaveClass(/sr-only/);
        const title = await page.locator('h1').boundingBox();
        expect(title.width).toBeLessThanOrEqual(1);
        expect(title.height).toBeLessThanOrEqual(1);
      }
      await page.evaluate(() => scrollTo(0, 500));
      expect((await nav.boundingBox()).y).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('portrait follows desktop pointer positions, stays within the viewport and respects reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Fine-pointer desktop effect');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const portrait = page.locator('.home-portrait');
  await portrait.evaluate(image => image.decode());
  await expect(portrait).toHaveAttribute('data-cursor-follow', 'true');
  await expect(portrait).toHaveCSS('position', 'fixed');
  await expect(portrait).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('body')).not.toHaveCSS('cursor', 'none');
  await expect(page.locator('.site-nav a').first()).not.toHaveCSS('cursor', 'none');
  const size = (await portrait.boundingBox()).width;
  expect(size).toBeLessThanOrEqual(200);
  await page.mouse.move(150, 200);
  await expect.poll(async () => Math.abs((await portrait.boundingBox()).x - (150 - size / 2))).toBeLessThan(2);
  await page.mouse.move(750, 420);
  await expect.poll(async () => Math.abs((await portrait.boundingBox()).x - (750 - size / 2))).toBeLessThan(2);
  await page.mouse.move(1435, 995);
  await expect.poll(async () => Math.abs((await portrait.boundingBox()).x - (1440 - size - 12))).toBeLessThan(2);
  const bounds = await portrait.boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1440);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(1000);
  expect(bounds.y).toBeGreaterThanOrEqual(12);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(portrait).toHaveAttribute('data-cursor-follow', 'false');
  await expect(portrait).toHaveCSS('transform', 'none');
  await expect(page.locator('body')).not.toHaveCSS('cursor', 'none');
  const still = await portrait.boundingBox();
  await page.mouse.move(300, 300);
  expect(await portrait.boundingBox()).toEqual(still);
});

test('phones hide the portrait entirely and retain the normal cursor', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone fallback');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const portrait = page.locator('.home-portrait');
  await portrait.evaluate(image => image.decode());
  await expect(portrait).toHaveAttribute('data-cursor-follow', 'false');
  await expect(portrait).toBeHidden();
  await page.mouse.move(80, 200);
  await expect(portrait).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('cursor', 'none');
});

test('hover ribbons are larger, reach the screen edge and sit close to the series names', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop preview');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/gallery.html');
  const entry = page.locator('.series-entry').first();
  await entry.locator('.series-name').hover();
  const preview = await entry.locator('.series-preview').boundingBox();
  const name = await entry.locator('.series-name').boundingBox();
  expect(preview.height).toBeGreaterThan(500);
  expect(preview.y - (await page.locator('.site-nav').boundingBox()).height).toBeCloseTo(16, 0);
  expect(preview.width).toBeGreaterThan(700);
  expect(preview.x - name.x - name.width).toBeLessThan(180);
  expect(Math.abs(preview.x + preview.width - 1440)).toBeLessThan(1);
});

test('primary text uses looser line height and shares open tracking with navigation on every page', async ({ page }) => {
  for (const [path, selector] of [['/', '.intro-copy'], ['/gallery.html', '.series-name'], ['/a-face-in-the-crowd.html', '.series-description'], ['/books.html', '.book-name'], ['/elsewhere.html', '.writing-entry h2']]) {
    await page.goto(path);
    const leading = await page.locator(selector).first().evaluate(element => {
      const style = getComputedStyle(element);
      return parseFloat(style.lineHeight) / parseFloat(style.fontSize);
    });
    expect(leading).toBeCloseTo(1.15, 3);
    for (const target of [page.locator(selector).first(), page.locator('.site-nav')]) {
      const spacing = await target.evaluate(element => {
        const style = getComputedStyle(element);
        return parseFloat(style.letterSpacing) / parseFloat(style.fontSize);
      });
      expect(spacing).toBeCloseTo(.01, 3);
    }
  }
});

test('short pages fill the usable viewport without centring the first paragraph or forcing overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    for (const [url, selector] of [['/', '.intro'], ['/gallery.html', '.series-index'], ['/books.html', '.books-layout'], ['/elsewhere.html', '.writing-list']]) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      const box = await page.locator(selector).boundingBox();
      expect(box.y).toBeCloseTo(80, 0);
      expect(box.height).toBeGreaterThan(height * .7);
      if (url === '/books.html' && width <= 700) {
        // The full-height title index must not be squeezed by mobile previews.
        const names = await page.locator('.book-names').boundingBox();
        const scene = await page.locator('.books-scene').boundingBox();
        expect(names.height).toBeGreaterThan(height * .7);
        expect(scene.y).toBeGreaterThan(names.y + names.height);
      } else {
        expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('books and published-writing headlines use the same heavy editorial treatment', async ({ page }) => {
  await page.goto('/books.html');
  await expect(page.locator('.book-name').first()).toHaveCSS('font-weight', '700');
  await page.goto('/elsewhere.html');
  await expect(page.locator('.writing-entry h2').first()).toHaveCSS('font-weight', '700');
  await page.goto('/a-face-in-the-crowd.html');
  await expect(page.locator('.series-description p').first()).toHaveCSS('text-align', 'justify');
  await expect(page.locator('.series-description')).toHaveCSS('font-weight', '700');
});
