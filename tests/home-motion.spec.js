import { test, expect } from '@playwright/test';

test('homepage and navbar use exactly one solid background colour with no background photograph', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-background')).toHaveCount(0);
  for (const selector of ['html', 'body', '.site-nav']) {
    await expect(page.locator(selector)).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.locator(selector)).toHaveCSS('background-image', 'none');
  }
  expect(await page.locator('body').evaluate(body => getComputedStyle(body, '::before').content)).toBe('none');
});

test('reduced motion disables homepage arrival and leaves a static, keyboard-browsable artwork ribbon', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.intro')).toHaveCSS('animation-name', 'none');
  await page.goto('/a-face-in-the-crowd.html');
  await expect(page.locator('#series-track')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('#series-track')).toHaveAttribute('tabindex', '0');
  await expect(page.locator('dialog, [data-focus]')).toHaveCount(0);
});
