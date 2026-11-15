import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const books = JSON.parse(await readFile(new URL('../books.json', import.meta.url), 'utf8'));
const titles = books.map(book => book.title);

async function expectDescription(page, index) {
  const book = books[index];
  await expect(page.locator('#book-details')).toBeVisible();
  await expect(page.locator('.book-names')).toBeHidden();
  await expect(page.locator('.book-name:visible')).toHaveCount(0);
  await expect(page.locator('#book-title')).toHaveText(book.title);
  await expect(page.locator('#book-meta')).toHaveText(book.meta);
  expect(await page.locator('#book-description p').allTextContents()).toEqual(book.description);
  await expect(page.locator('#book-description')).toHaveAttribute('lang', book.language);
  await expect(page.locator('#book-purchase')).toHaveAttribute('href', book.url);
  await expect(page.locator('#book-purchase')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.locator('.book-name.is-selected')).toHaveCount(1);
  await expect(page.locator('.book.is-selected')).toHaveCount(1);
}

test('all book names are visible at rest, with independent cover previews and no description until selection', async ({ page, request }) => {
  const failures = [], sourceRequests = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  page.on('request', request => { if (/\/res\/(works|publications)\//.test(request.url())) sourceRequests.push(request.url()); });
  await page.goto('/gallery.html');
  await page.getByRole('link', { name: 'Books', exact: true }).click();
  await expect(page.locator('h1')).toHaveClass(/sr-only/);
  expect(await page.locator('.book-name').allTextContents()).toEqual(titles);
  for (const name of await page.locator('.book-name').all()) await expect(name).toBeVisible();
  await expect(page.locator('.book')).toHaveCount(4);
  await expect(page.locator('.book.is-open')).toHaveCount(0);
  await expect(page.locator('#book-details')).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('font-family', /Helvetica Neue/);
  await expect(page.locator('.book-object').first()).toHaveCSS('transform-style', 'preserve-3d');
  await page.locator('.book-front img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.screenshot({ path: `test-results/books-${test.info().project.name}.png`, fullPage: true });
  expect(failures).toEqual([]);
  expect(sourceRequests).toEqual([]);
  const files = await readdir('dist/res/book-covers');
  expect(files).toHaveLength(4);
  for (const file of files) {
    const image = await sharp(`dist/res/book-covers/${file}`).metadata();
    expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(960);
    expect(image.exif).toBeUndefined();
  }
  expect((await request.get('/res/publications/crepuscolo.jpg')).status()).toBe(404);
  expect((await request.get('/books.json')).status()).toBe(404);
});

test('book names stay left of a larger, vertically centred horizontal row that stacks below them on phones', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  await expect(page.locator('.book-names')).toHaveCSS('display', 'grid');
  const positions = await page.locator('.book-name').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
  const gaps = positions.slice(1).map((box, index) => box.y - positions[index].y - positions[index].height);
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(31);
  const steps = positions.slice(1).map((box, index) => box.y - positions[index].y);
  expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(1);
  const list = await page.locator('.book-names').boundingBox();
  expect(positions[0].y).toBeCloseTo(list.y, 0);
  expect(positions.at(-1).y + positions.at(-1).height).toBeCloseTo(list.y + list.height, 0);
  for (const [width, height] of [[1440, 1000], [1024, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const names = await page.locator('.book-names').boundingBox();
    const scene = await page.locator('.books-scene').boundingBox();
    expect(names.x + names.width).toBeLessThan(scene.x);
    expect(names.y).toBeCloseTo(80, 0);
    expect(scene.y).toBeCloseTo(80, 0);
    const first = await page.locator('.book').first().boundingBox();
    expect(first.y + first.height / 2).toBeCloseTo(scene.y + scene.height / 2, 0);
    if (width === 1440) expect(first.height).toBeGreaterThan(650);
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const names = await page.locator('.book-names').boundingBox();
    const scene = await page.locator('.books-scene').boundingBox();
    expect(scene.y).toBeGreaterThan(names.y + names.height);
    expect(scene.x + scene.width).toBeLessThanOrEqual(width);
  }
  const slots = await page.locator('.book').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
  for (let index = 0; index < slots.length; index++) {
    expect(slots[index].y).toBeCloseTo(slots[0].y, 0);
    expect(slots[index].height).toBeCloseTo(slots[0].height, 0);
    if (index) expect(slots[index].x).toBeGreaterThanOrEqual(slots[index - 1].x + slots[index - 1].width + 15);
  }
  expect(slots[0].height).toBeGreaterThan(190);
});

test('book titles exactly match Selected works row positions, list height and gutters', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[1440, 1000], [1024, 900], [390, 844], [320, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/gallery.html');
    await page.evaluate(() => document.fonts.ready);
    const reference = await page.locator('.series-name, .books-link').evaluateAll(elements => elements.map(element => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })));
    const referenceHeight = (await page.locator('.series-index').boundingBox()).height;
    await page.goto('/books.html');
    await page.evaluate(() => document.fonts.ready);
    const actual = await page.locator('.book-name').evaluateAll(elements => elements.map(element => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })));
    for (let index = 0; index < actual.length; index++) {
      expect(actual[index].x, `${width}px row ${index + 1} left`).toBeCloseTo(reference[index].x, 0);
      expect(actual[index].y, `${width}px row ${index + 1} top`).toBeCloseTo(reference[index].y, 0);
    }
    const names = await page.locator('.book-names').boundingBox();
    expect(names.height).toBeCloseTo(referenceHeight, 0);
    if (width <= 700) {
      const scene = await page.locator('.books-scene').boundingBox();
      expect(scene.y).toBeGreaterThan(names.y + names.height);
    }
  }
});

test('hovering turns only one cover, keeping all books in the same bounded row without overlap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Fine-pointer hover');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  const geometry = () => page.locator('.book').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
  const initial = await geometry();
  const scene = await page.locator('.books-scene').boundingBox();
  let openWidth = null;
  for (let index = 0; index < books.length; index++) {
    for (const selector of ['.book-name', '.book']) {
      await page.locator(selector).nth(index).hover();
      await expect(page.locator('.book.is-open')).toHaveCount(1);
      await expect(page.locator('.book').nth(index)).toHaveClass(/is-open/);
      await expect(page.locator('#book-details')).toBeHidden();
      await expect(page.locator('.book-name[aria-expanded="true"]')).toHaveCount(0);
      const slots = await geometry();
      for (let slot = 0; slot < slots.length; slot++) {
        expect(slots[slot].y).toBeCloseTo(initial[slot].y, 0);
        expect(slots[slot].height).toBeCloseTo(initial[slot].height, 0);
        expect(slots[slot].x).toBeGreaterThanOrEqual(scene.x);
        expect(slots[slot].x + slots[slot].width).toBeLessThanOrEqual(scene.x + scene.width);
        if (slot) expect(slots[slot].x).toBeGreaterThanOrEqual(slots[slot - 1].x + slots[slot - 1].width + 15);
      }
      if (openWidth === null) openWidth = slots[index].width;
      else expect(slots[index].width).toBeCloseTo(openWidth, 0);
      expect(await page.locator('.book-object').nth(index).evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m11)).toBeGreaterThan(.9);
    }
  }
  await page.mouse.move(5, 5);
  await expect(page.locator('.book.is-open')).toHaveCount(0);
});

test('clicking every book shows the exact supplied paragraphs and the correct purchase link', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  for (let index = 0; index < books.length; index++) {
    await page.locator('.book-name').nth(index).click();
    await expectDescription(page, index);
    await expect(page.locator('.book-name').nth(index)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.book').nth(index)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.book-name:visible')).toHaveCount(0);
    await expect(page.locator('#book-title')).toBeFocused();
    await page.locator('#book-close').click();
    await expect(page.locator('#book-details')).toBeHidden();
    for (const name of await page.locator('.book-name').all()) await expect(name).toBeVisible();
    await expect(page.locator('.book-name').nth(index)).toBeFocused();
  }
  await page.locator('.book').nth(1).click();
  await expectDescription(page, 1);
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map(animation => animation.finished)));
  await page.screenshot({ path: `test-results/books-open-${test.info().project.name}.png`, fullPage: true });
});

test('hovering another book changes the preview but never replaces a clicked description', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Fine-pointer hover');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  await page.locator('.book-name').first().click();
  await page.locator('.book').nth(2).hover();
  await expect(page.locator('.book').nth(2)).toHaveClass(/is-open/);
  await expectDescription(page, 0);
  await page.mouse.move(5, 5);
  await expect(page.locator('.book').first()).toHaveClass(/is-open/);
  await expect(page.locator('.book.is-open')).toHaveCount(1);
});

test('keyboard arrows preview books; Enter and Space select descriptions; Escape closes them', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  await page.locator('.book-name').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.book-name').nth(1)).toBeFocused();
  await expect(page.locator('.book').nth(1)).toHaveClass(/is-open/);
  await expect(page.locator('#book-details')).toBeHidden();
  await page.keyboard.press('Enter');
  await expectDescription(page, 1);
  await expect(page.locator('#book-title')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#book-details')).toBeHidden();
  await expect(page.locator('.book-name').nth(1)).toBeFocused();
  await page.locator('.book').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.book').nth(1)).toBeFocused();
  await page.keyboard.press('Space');
  await expectDescription(page, 1);
  await expect(page.locator('.book-object').first()).toHaveCSS('transition-duration', '0s');
});

test('previews and every description fit narrow, landscape and desktop screens without horizontal overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [768, 1024], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    for (let index = 0; index < books.length; index++) {
      await page.locator('.book-name').nth(index).click();
      await expectDescription(page, index);
      const shelf = await page.locator('.bookshelf').boundingBox();
      expect(shelf.x).toBeGreaterThanOrEqual(0);
      expect(shelf.x + shelf.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#book-close').click();
    }
  }
});

test('phone taps reveal covers and scroll to the selected description without requiring hover', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Native touch');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/books.html');
  await page.locator('.book').nth(2).tap();
  await expectDescription(page, 2);
  await expect(page.locator('.book').nth(2)).toHaveClass(/is-open/);
  await expect(page.locator('#book-title')).toBeInViewport();
  await page.locator('#book-close').tap();
  await expect(page.locator('#book-details')).toBeHidden();
});

test('all descriptions and purchase links remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/books.html');
    const articles = page.locator('.book-fallback article');
    await expect(articles).toHaveCount(4);
    for (let index = 0; index < books.length; index++) {
      await expect(articles.nth(index).locator('h2')).toHaveText(books[index].title);
      expect(await articles.nth(index).locator('p').allTextContents()).toEqual([books[index].meta, ...books[index].description]);
      await expect(articles.nth(index).locator('a')).toHaveAttribute('href', books[index].url);
    }
  } finally { await context.close(); }
});
