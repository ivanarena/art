import { test, expect } from '@playwright/test';

test('phone taps open series names directly and the ribbon has no arrows, counters or viewer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone navigation');
  await page.goto('/gallery.html');
  await page.locator('.series-name').nth(1).click();
  await expect(page).toHaveURL(/alexythimia\.html$/);
  await expect(page.locator('#series-track')).toHaveAttribute('data-loop-ready', 'true');
  await expect(page.locator('.carousel-controls, #carousel-position, dialog, [data-focus]')).toHaveCount(0);
});

test('a native ribbon swipe scrolls without opening anything', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch ribbon');
  await page.goto('/alexythimia.html');
  const track = page.locator('#series-track');
  await track.scrollIntoViewIfNeeded();
  const before = await track.evaluate(track => track.scrollLeft);
  const box = await track.boundingBox();
  const y = box.y + Math.min(200, box.height / 2);
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y }] });
  for (let x = 300; x >= 60; x -= 20) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(10);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Math.abs(await track.evaluate(track => track.scrollLeft) - before)).toBeGreaterThan(50);
  await expect(page.locator('dialog')).toHaveCount(0);
});

test('tapping artwork in every series keeps the page in its normal scrollable layout', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch artwork');
  for (const slug of ['a-face-in-the-crowd', 'alexythimia', 'for-now-we-see-through-a-glass-darkly']) {
    await page.goto(`/${slug}.html`);
    const image = page.locator('.series-work[data-original] img').first();
    await image.tap();
    await expect(page).toHaveURL(new RegExp(`/${slug}\\.html$`));
    await expect(page.locator('dialog, #series-track a, #series-track button')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  }
});
