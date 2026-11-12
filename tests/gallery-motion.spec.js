import { test, expect } from '@playwright/test';

async function settle(page) {
  await page.locator('#viewer').evaluate(element => Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
}

test('inspection flies/fades in and out from the homepage and reopens without stale opacity', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pile').click();
  const frames = await page.evaluate(() => {
    document.getElementById('inspect').click();
    return document.getElementById('inspection').getAnimations()[0].effect.getKeyframes();
  });
  expect(frames.every(frame => frame.filter === undefined)).toBe(true);
  expect(frames[0].transform).not.toBe(frames[1].transform);
  expect(Number(frames[0].opacity)).toBe(0);
  expect(Number(frames[1].opacity)).toBe(1);
  await settle(page);
  await expect(page.locator('#inspection')).toHaveCSS('filter', 'none');
  const exit = await page.evaluate(() => {
    document.getElementById('close-viewer').click();
    return document.getElementById('inspection').getAnimations()[0].effect.getKeyframes();
  });
  expect(exit.every(frame => frame.filter === undefined)).toBe(true);
  expect(Number(exit[1].opacity)).toBe(0);
  await expect(page.locator('#viewer')).not.toBeVisible();
  await expect(page.locator('#rail')).toBeVisible();
  await page.locator('#inspect').click();
  await settle(page);
  await expect(page.locator('#inspection')).toHaveCSS('opacity', '1');
});

test('interrupted inspection opening reverses smoothly from its actual position and opacity', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pile').click();
  const state = await page.evaluate(() => {
    document.getElementById('inspect').click();
    const print = document.getElementById('inspection');
    for (const animation of print.getAnimations()) { animation.pause(); animation.currentTime = 160; }
    const before = { box: print.getBoundingClientRect().toJSON(), opacity: getComputedStyle(print).opacity };
    document.getElementById('close-viewer').click();
    const reverse = print.getAnimations()[0];
    reverse.pause(); reverse.currentTime = 0;
    const after = { box: print.getBoundingClientRect().toJSON(), opacity: getComputedStyle(print).opacity };
    reverse.play();
    return { before, after };
  });
  expect(Number(state.before.opacity)).toBeGreaterThan(0);
  expect(Number(state.before.opacity)).toBeLessThan(1);
  for (const edge of ['x', 'y', 'width', 'height']) expect(state.after.box[edge]).toBeCloseTo(state.before.box[edge], 1);
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
