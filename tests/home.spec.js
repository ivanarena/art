import { test, expect } from '@playwright/test';
import { series } from './catalogue.js';
import sharp from 'sharp';

test('homepage contains the square portrait, introduction and navigation on a solid background', async ({ page }) => {
  const errors = [], external = [], galleryRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  page.on('request', request => {
    if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url());
    if (/main\.js|works\.js|mobile-gallery/.test(request.url())) galleryRequests.push(request.url());
  });
  await page.goto('/');
  await page.locator('.home-portrait').evaluate(image => image.decode());
  await expect(page.locator('.home-portrait')).toHaveAttribute('src', /res\/portraits\/ivan\.webp\?v=/);
  await expect(page.locator('.home-portrait')).toHaveAttribute('alt', 'Portrait of Ivan Arena');
  await expect(page.locator('.home-background')).toHaveCount(0);
  await expect(page.locator('body')).toHaveCSS('background-image', 'none');
  await expect(page.locator('h1')).toHaveText('Hey, I’m Ivan Arena. I’m an artist based in Vienna, working with photography, music and literature.');
  await expect(page.locator('.pile, .gallery-work, dialog, .visual-copy')).toHaveCount(0);
  await expect(page.locator('.intro > p')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Selected works', exact: true })).toHaveAttribute('href', 'gallery.html');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(galleryRequests).toEqual([]);
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map(animation => animation.finished)));
  await expect(page.locator('.intro')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: `test-results/home-${test.info().project.name}.png`, fullPage: true });
});

test('portrait stays display-sized, is hidden on phones and has a static desktop fallback for reduced motion', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const metadata = await sharp('dist/res/portraits/ivan.webp').metadata();
  expect(metadata).toMatchObject({ width: 960, height: 960 });
  expect(metadata.exif).toBeUndefined();
  expect((await request.get('/res/portraits/ivan-arena.webp')).status()).toBe(404);
  expect((await request.get('/ivan.jpeg')).status()).toBe(404);
  await page.goto('/');
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 480]]) {
    await page.setViewportSize({ width, height });
    const frame = await page.locator('.intro').boundingBox();
    expect(frame.width).toBeGreaterThanOrEqual(width * .8);
    expect(frame.width).toBeLessThanOrEqual(width);
    expect(Math.abs(frame.x + frame.width / 2 - width / 2)).toBeLessThan(1);
    if (width < 901 || test.info().project.name === 'mobile') {
      await expect(page.locator('.home-portrait')).toBeHidden();
    } else {
      const portrait = await page.locator('.home-portrait').boundingBox();
      expect(portrait.width).toBeLessThanOrEqual(240);
      expect(portrait.width).toBeCloseTo(portrait.height, 0);
    }
    await expect(page.locator('body')).not.toHaveCSS('cursor', 'none');
    await expect(page.locator('.home-portrait')).toHaveAttribute('data-cursor-follow', 'false');
  }
});

test('homepage uses bold newspaper paragraphs beneath fixed navigation without screen overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('h1')).toHaveCSS('font-family', /Helvetica Neue/);
  await expect(page.locator('h1')).toHaveCSS('font-weight', '700');
  await expect(page.locator('h1')).toHaveCSS('text-align', 'justify');
  await expect(page.locator('.site-nav')).toHaveCSS('font-weight', '700');
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 480], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const type = await page.locator('h1').evaluate(heading => ({ size: parseFloat(getComputedStyle(heading).fontSize), bottom: heading.getBoundingClientRect().bottom }));
    expect(type.size).toBeCloseTo(Math.max(28, Math.min(44, width * .032)), 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const navigation = await page.locator('.site-nav').boundingBox();
    expect(navigation.y).toBe(0);
    expect(navigation.width).toBe(width);
    for (const link of await page.locator('.site-nav a').all()) {
      const box = await link.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  }
});

test('homepage, overview and series remain browsable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4173/');
    await page.getByRole('link', { name: 'Selected works', exact: true }).click();
    await expect(page.locator('.series-name')).toHaveCount(series.length);
    await page.locator('.series-name').first().click();
    await expect(page.locator('h1')).toHaveText('A Face in the Crowd');
    await expect(page.locator('.series-description')).toContainText('All photographs in this series are self-portraits shots');
    await expect(page.locator('.series-work')).toHaveCount(6);
    await expect(page.locator('.series-work img').first()).toHaveAttribute('src', /01-large\.webp\?v=/);
    await expect(page.locator('#series-track a, dialog')).toHaveCount(0);
  } finally { await context.close(); }
});

test('homepage links open selected works and writing, with Books inside selected works', async ({ page }) => {
  for (const [name, url] of [['Selected works', 'gallery'], ['Elsewhere', 'elsewhere']]) {
    await page.goto('/');
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${url}\\.html$`));
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    if (test.info().project.name === 'mobile') await expect(page.locator('.home-portrait')).toBeHidden();
    else await expect(page.locator('.home-portrait')).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Books', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Selected works', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Books', exact: true })).toHaveAttribute('href', 'books.html');
  await expect(page.locator('header a[href="books.html"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Books', exact: true }).click();
  await expect(page).toHaveURL(/\/books\.html$/);
});
