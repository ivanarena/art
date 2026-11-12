import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test('intro and gallery are centered as one compact group and expanded photos fit every screen', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 844, height: 390 }, { width: 390, height: 844 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport);
    const intro = await page.locator('.intro').boundingBox();
    const pile = await page.locator('#pile').boundingBox();
    expect(pile.y).toBeGreaterThanOrEqual(intro.y + intro.height);
    expect(pile.y - intro.y - intro.height).toBeLessThanOrEqual(16);
    const contentHeight = pile.y + pile.height - intro.y;
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(Math.abs((intro.y + pile.y + pile.height) / 2 - pageHeight / 2)).toBeLessThan(2);
    for (const selector of ['.intro-copy', '.contact-links', '#pile']) {
      const box = await page.locator(selector).boundingBox();
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
    }
    expect(pageHeight).toBeLessThanOrEqual(Math.max(viewport.height, contentHeight + 128) + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await expect(page.getByRole('link', { name: 'Email', exact: true })).toBeInViewport();
    await page.locator('#pile').click();
    await expect.poll(() => page.evaluate(() => {
      const rail = document.getElementById('rail').getBoundingClientRect();
      return [...document.querySelectorAll('.gallery-card')].every(card => {
        const box = card.getBoundingClientRect();
        return box.right < 0 || box.left > innerWidth || (box.top >= rail.top - 1 && box.bottom <= rail.bottom + 1);
      });
    })).toBe(true);
    await expect(page.locator('#inspect')).toBeInViewport();
    await page.locator('#close-gallery').click();
    await expect(page.locator('#pile')).toBeVisible();
  }
});

test('preview and expanded photos remain sharp on hover; only keyboard-focused gallery tiles blur peers', async ({ page }, testInfo) => {
  for (const image of await page.locator('.pile-image').all()) await expect(image).toHaveCSS('filter', 'none');
  await page.locator('#pile').click();
  if (testInfo.project.name === 'desktop') await page.locator('.gallery-card.is-current').hover();
  for (const image of await page.locator('.gallery-card img').all()) await expect(image).toHaveCSS('filter', 'none');
  await page.keyboard.press('Tab');
  await page.locator('.gallery-card.is-current').focus();
  await expect(page.locator('.gallery-card.is-current img')).toHaveCSS('filter', 'none');
  await expect(page.locator('.gallery-card:not(.is-current) img').first()).toHaveCSS('filter', 'blur(5px)');
  await page.locator('#close-gallery').focus();
  for (const image of await page.locator('.gallery-card img').all()) await expect(image).toHaveCSS('filter', 'none');
});
