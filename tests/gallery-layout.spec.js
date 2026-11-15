import { test, expect } from '@playwright/test';
import { series, worksFor } from './catalogue.js';

test('selected works lists three series names and Books, with previews hidden until hover', async ({ page }) => {
  await page.goto('/gallery.html');
  await expect(page.locator('h1')).toHaveText('Selected works');
  await expect(page.locator('.books-entry a')).toHaveText('Books');
  await expect(page.locator('header a[href="books.html"]')).toHaveCount(0);
  await expect(page.locator('.series-entry')).toHaveCount(3);
  expect(await page.locator('.series-name').allTextContents()).toEqual(series.map(item => item.title));
  for (const [index, item] of series.entries()) {
    const entry = page.locator('.series-entry').nth(index);
    await expect(entry.locator('.series-name')).toHaveAttribute('href', `${item.slug}.html`);
    await expect(entry.locator('.series-preview')).toBeHidden();
    await expect(entry.locator('.series-preview')).toHaveAttribute('aria-hidden', 'true');
    await expect(entry.locator('img')).toHaveCount(worksFor(item).length);
  }
  await expect(page.locator('.gallery-work, .photo-strip')).toHaveCount(0);
  await page.locator('.series-name').first().click();
  await expect(page).toHaveURL(/\/a-face-in-the-crowd\.html$/);
  await expect(page.locator('.series-description')).toBeVisible();
  await expect(page.locator('.series-work[data-original]')).toHaveCount(6);
});

test('series have a readable display-text column beside large tightly packed images, stacking on phones', async ({ page }) => {
  await page.goto('/a-face-in-the-crowd.html');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const copy = await page.locator('.series-copy').boundingBox();
  const carousel = await page.locator('.series-carousel').boundingBox();
  expect(copy.x + copy.width).toBeLessThan(carousel.x);
  expect(copy.width).toBeLessThanOrEqual(560);
  expect(copy.width).toBeGreaterThan(400);
  expect(Math.abs(copy.y - carousel.y)).toBeLessThan(2);
  const track = page.locator('#series-track');
  expect((await track.boundingBox()).height).toBeGreaterThan(800);
  await expect(track).toHaveCSS('column-gap', '6px');
  const geometry = await page.locator('.series-work[data-original] img').evaluateAll(images => images.map(image => image.getBoundingClientRect().height));
  expect(Math.max(...geometry) - Math.min(...geometry)).toBeLessThan(1);
  await expect(page.locator('.carousel-controls, .series-pagination')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCopy = await page.locator('.series-copy').boundingBox();
  const mobileCarousel = await page.locator('.series-carousel').boundingBox();
  expect(mobileCarousel.y).toBeGreaterThan(mobileCopy.y + mobileCopy.height);
});

test('home, names index and series pages fit phones, landscape and desktop without body overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[320, 480], [390, 844], [844, 390], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    for (const path of ['/', '/gallery.html', '/a-face-in-the-crowd.html', '/for-now-we-see-through-a-glass-darkly.html']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('ribbon images preserve aspect ratio at every size without links or a focus viewer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/for-now-we-see-through-a-glass-darkly.html');
  for (const [width, height] of [[320, 480], [390, 844], [844, 390], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    const image = page.locator('.series-work[data-original] img').first();
    await expect(image).toHaveCSS('object-fit', 'contain');
    const ratio = await image.evaluate(image => ({ source: Number(image.getAttribute('width')) / Number(image.getAttribute('height')), display: image.getBoundingClientRect().width / image.getBoundingClientRect().height }));
    expect(ratio.display).toBeCloseTo(ratio.source, 3);
    await expect(page.locator('#series-track a, [data-focus], dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
