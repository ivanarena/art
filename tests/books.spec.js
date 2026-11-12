import { test, expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';
import sharp from 'sharp';

const titles = ['The Second Thought', 'And Then We Walk Out', 'Crepuscolo', 'Versi Liberi'];
const purchaseIds = ['B0HB2SYTR4', 'B0FMJV8SJL', 'B0DP4HZVNV', 'B0CRRN5X4M'];
const descriptions = ['Hybrid work · 2026', 'Poems · 2025', 'Novel · 2024', 'Poems · 2023'];

test('books page is linked, self-hosted and separate from the photograph gallery', async ({ page, request }) => {
  const failures = [];
  const sourceRequests = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  page.on('request', request => { if (/\/res\/(works|publications)\//.test(request.url())) sourceRequests.push(request.url()); });
  await page.goto('/');
  await page.getByRole('link', { name: 'Books', exact: true }).click();
  await expect(page).toHaveURL(/\/books\.html$/);
  await expect(page.getByRole('heading', { name: 'Books', exact: true })).toBeVisible();
  await expect(page.locator('.book')).toHaveCount(titles.length);
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.book-front img')].map(image => image.decode())));
  await expect(page.locator('body')).toHaveCSS('font-family', /Afacad/);
  await expect(page.locator('.book-object').first()).toHaveCSS('transform-style', 'preserve-3d');
  await expect(page.locator('.book').first()).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#book-title')).toHaveText(titles[0]);
  await page.screenshot({ path: `test-results/books-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: 'Selected work', exact: true }).click();
  await expect(page.locator('#pile')).toBeVisible();
  expect(sourceRequests).toEqual([]);
  expect(failures).toEqual([]);
  expect((await request.get('/res/publications/crepuscolo.jpg')).status()).toBe(404);
  const files = await readdir('dist/res/book-covers');
  expect(files).toHaveLength(titles.length);
  expect((await request.get('/res/publications/the_second_thought.jpg')).status()).toBe(404);
  for (const file of files) {
    const image = await sharp(`dist/res/book-covers/${file}`).metadata();
    expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(960);
    expect(image.exif).toBeUndefined();
  }
});

test('clicking a spine unfolds its cover and updates the correct purchase link', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  for (let i = 0; i < titles.length; i++) {
    const book = page.locator('.book').nth(i);
    if (await book.getAttribute('aria-expanded') !== 'true') await book.click();
    await expect(book).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.book.is-open')).toHaveCount(1);
    await expect(page.locator('#book-title')).toHaveText(titles[i]);
    await expect(page.locator('#book-description')).toHaveText(descriptions[i]);
    await expect(page.locator('#book-purchase')).toHaveAttribute('href', `https://www.amazon.com/dp/${purchaseIds[i]}`);
    await expect(page.locator('#book-purchase')).toHaveAttribute('rel', 'noopener noreferrer');
    const open = await book.boundingBox();
    const closed = await page.locator('.book').nth((i + 1) % titles.length).boundingBox();
    expect(open.width).toBeGreaterThan(closed.width * 4);
    await book.click();
    await expect(book).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.book.is-open')).toHaveCount(0);
    await expect(page.locator('#book-details')).toHaveAttribute('aria-hidden', 'true');
  }
  await page.locator('.book').nth(1).click();
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.book-front img')].map(image => image.decode())));
  await page.screenshot({ path: `test-results/books-open-${test.info().project.name}.png`, fullPage: true });
});

test('book spines work with keyboard, focus and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  const first = page.locator('.book').first();
  await first.focus();
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  for (let i = 1; i <= titles.length; i++) {
    await page.keyboard.press('ArrowRight');
    const next = page.locator('.book').nth(i % titles.length);
    await expect(next).toBeFocused();
    await expect(next).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(first).toBeFocused();
  await page.locator('#book-purchase').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.book.is-open')).toHaveCount(0);
  await expect(first).toBeFocused();
  await expect(page.locator('.book-object').first()).toHaveCSS('transition-duration', '0s');
});

test('shelf fits narrow, tall and landscape screens with every book selected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  for (const [width, height] of [[320, 844], [320, 568], [390, 844], [844, 390], [768, 1024], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    for (let i = 0; i < titles.length; i++) {
      const book = page.locator('.book').nth(i);
      if (await book.getAttribute('aria-expanded') !== 'true') await book.click();
      const box = await page.locator('.bookshelf').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('blank canvas folds the active book but links do not', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  await page.mouse.click(8, 8);
  await expect(page.locator('.book.is-open')).toHaveCount(0);
  await page.locator('.book').nth(2).click();
  await page.locator('#book-title').click();
  await expect(page.locator('.book').nth(2)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/ivanknowswhat/');
  await expect(page.getByRole('link', { name: 'Email', exact: true })).toHaveAttribute('href', 'mailto:parlementmgmt@gmail.com');
});
