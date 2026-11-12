import { test, expect } from '@playwright/test';

async function settle(page) {
  await page.locator('#viewer').evaluate(element => Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
}

test('inspection blurs/fades in and out from the homepage and reopens without stale opacity', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pile').click();
  const frames = await page.evaluate(() => {
    document.getElementById('inspect').click();
    return document.getElementById('inspection').getAnimations()[0].effect.getKeyframes();
  });
  expect(frames[0].filter).toBe('blur(10px)');
  expect(Number(frames[0].opacity)).toBe(0);
  expect(Number(frames[1].opacity)).toBe(1);
  await settle(page);
  await expect(page.locator('#inspection')).toHaveCSS('filter', 'none');
  const exit = await page.evaluate(() => {
    document.getElementById('close-viewer').click();
    return document.getElementById('inspection').getAnimations()[0].effect.getKeyframes();
  });
  expect(exit[0].filter).toBe('blur(0px)');
  expect(exit[1].filter).toBe('blur(10px)');
  expect(Number(exit[1].opacity)).toBe(0);
  await expect(page.locator('#viewer')).not.toBeVisible();
  await expect(page.locator('#rail')).toBeVisible();
  await page.locator('#inspect').click();
  await settle(page);
  await expect(page.locator('#inspection')).toHaveCSS('opacity', '1');
});

test('interrupted inspection opening reverses from its current blur and opacity', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pile').click();
  const state = await page.evaluate(() => {
    document.getElementById('inspect').click();
    const print = document.getElementById('inspection');
    for (const animation of print.getAnimations()) { animation.pause(); animation.currentTime = 160; }
    const before = { filter: getComputedStyle(print).filter, opacity: getComputedStyle(print).opacity };
    document.getElementById('close-viewer').click();
    const first = print.getAnimations()[0].effect.getKeyframes()[0];
    return { before, after: { filter: first.filter, opacity: first.opacity } };
  });
  expect(Number(state.before.opacity)).toBeGreaterThan(0);
  expect(Number(state.before.opacity)).toBeLessThan(1);
  expect(state.after.filter).toBe(state.before.filter);
  expect(Number(state.after.opacity)).toBeCloseTo(Number(state.before.opacity), 5);
  await expect(page.locator('#viewer')).not.toBeVisible();
});

test('reduced motion disables arrivals and inspection animations but retains static edge frosting', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator('#gallery .gallery-edge span').first()).toHaveCSS('backdrop-filter', 'blur(2px)');
  await page.locator('#inspect').click();
  expect(await page.locator('#viewer').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator('#inspection')).toHaveCSS('filter', 'none');
  await page.locator('#close-viewer').click();
  await expect(page.locator('#rail')).toBeVisible();
});
