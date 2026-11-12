import { test, expect } from '@playwright/test';

test('homepage centers the Karla introduction and gallery together without forced capitals', async ({ page }) => {
  const errors = [], external = [], large = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  page.on('request', request => {
    if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url());
    if (request.url().includes('-large.webp')) large.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#pile')).toBeVisible();
  await expect(page.locator('#gallery:visible, #viewer:visible')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Hey, I’m Ivan Arena. I’m an artist based in Vienna, working with photography, music and literature. See my selected work.');
  await expect(page.locator('body')).toHaveCSS('font-family', /Karla/);
  for (const selector of ['h1', '.contact-links', '.copyright']) {
    await expect(page.locator(selector)).toHaveCSS('text-transform', 'none');
    await expect(page.locator(selector)).toHaveCSS('font-weight', '400');
  }
  expect(await page.evaluate(() => document.fonts.check('400 24px "Karla"'))).toBe(true);
  await expect(page.locator('.intro .contact-links a')).toHaveCount(4);
  await expect(page.locator('.pile-image')).toHaveCount(13);
  const intro = await page.locator('.intro').boundingBox();
  const strip = await page.locator('#pile').boundingBox();
  expect(strip.y).toBeGreaterThan(intro.y + intro.height);
  expect(Math.abs((intro.y + strip.y + strip.height) / 2 - page.viewportSize().height / 2)).toBeLessThan(2);
  expect(Math.abs(strip.x + strip.width / 2 - page.viewportSize().width / 2)).toBeLessThan(2);
  expect(external).toEqual([]);
  expect(large).toEqual([]);
  expect(errors).toEqual([]);
  await page.locator('.pile-image[data-index="0"]').evaluate(image => image.decode());
  await page.screenshot({ path: `test-results/home-bold-intro-${test.info().project.name}.png` });
});

test('one photograph click expands that work into the horizontal gallery on the homepage', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const title = await page.evaluate(() => WORKS[1].title);
  await page.locator('.pile-image[data-index="1"]').click();
  await expect(page.locator('#gallery')).toBeVisible();
  await expect(page.locator('#rail')).toHaveAttribute('data-axis', 'horizontal');
  await expect(page.locator('#gallery-work-title')).toHaveText(title);
  await expect(page).toHaveURL(/\/$/);
  await page.locator('#inspect').click();
  await expect(page.locator('#viewer')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#rail')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#gallery')).not.toBeVisible();
  await expect(page.locator('#pile')).toBeFocused();
});

test('legacy gallery, books and writing links all return to the homepage introduction and preview', async ({ page }) => {
  await page.goto('/gallery.html');
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.locator('#pile')).toBeVisible();
  for (const name of ['Books', 'Elsewhere']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('link', { name: 'Selected work', exact: true })).toHaveAttribute('href', 'index.html');
    await page.getByRole('link', { name: 'Selected work', exact: true }).click();
    await expect(page.locator('#pile')).toBeVisible();
    await expect(page.locator('#gallery')).not.toBeVisible();
  }
});

test('intro, photographs and links remain browsable without JavaScript', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/');
    await expect(page.locator('h1')).toContainText("Hey, I’m Ivan Arena");
    await expect(page.locator('.static-gallery img')).toHaveCount(13);
    await expect(page.locator('.static-gallery img').first()).toBeVisible();
    await expect(page.locator('#pile:visible, #gallery:visible')).toHaveCount(0);
    expect(await page.locator('.static-gallery').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await page.getByRole('link', { name: 'Books', exact: true }).click();
    await page.getByRole('link', { name: 'Selected work', exact: true }).click();
    await expect(page.locator('.static-gallery img')).toHaveCount(13);
  } finally { await context.close(); }
});
