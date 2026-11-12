import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source = await readFile(new URL('../works.js', import.meta.url), 'utf8');
const catalogue = JSON.parse(source.match(/const WORKS = ([\s\S]*);/)[1]);
const total = catalogue.length;
const positionText = index => `${String(((index % total) + total) % total + 1).padStart(2, '0')} / ${total}`;

async function swipe(page, context, { y, from, to }) {
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + (to - from) * step / 12, y }] });
    await page.waitForTimeout(12);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

async function centreSlot(page, slot) {
  await page.evaluate(slot => {
    const rail = document.getElementById('rail');
    const box = rail.querySelector(`[data-slot="${slot}"]`).getBoundingClientRect();
    const viewport = rail.getBoundingClientRect();
    rail.scrollLeft += box.left + box.width / 2 - viewport.left - viewport.width / 2;
  }, slot);
}

async function centreDistance(page, slot) {
  return page.evaluate(slot => {
    const box = document.querySelector(`.gallery-card[data-slot="${slot}"]`).getBoundingClientRect();
    const rail = document.getElementById('rail').getBoundingClientRect();
    return Math.abs(box.left + box.width / 2 - rail.left - rail.width / 2);
  }, slot);
}

test('built pages and display images have content-versioned URLs', async ({ page, request }) => {
  await page.goto('/');
  const assets = await page.locator('script[src], link[rel="stylesheet"]').evaluateAll(elements => elements.map(element => element.src || element.href));
  for (const asset of assets) {
    const url = new URL(asset);
    const bytes = await readFile(`dist${url.pathname}`);
    expect(url.searchParams.get('v')).toBe(createHash('sha256').update(bytes).digest('hex').slice(0, 12));
    expect((await request.get(asset)).ok()).toBe(true);
  }
  const images = await page.evaluate(() => WORKS.flatMap(work => [work.preview, work.detail]));
  expect(images).toHaveLength(total * 2);
  for (const image of images) expect(image).toMatch(/^res\/previews\/[^?]+\.webp\?v=[a-f0-9]{12}$/);
});

test.describe('native phone gallery', () => {
  test.skip(({ isMobile }) => !isMobile, 'Phone/touch-specific regressions');

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#pile').tap();
  });

  test('real swipes scroll the native ribbon on photos and blank margins without dismissing it', async ({ page, context }) => {

    const rail = page.locator('#rail');
    await expect(rail).toHaveAttribute('data-layout', 'native');
    await expect(rail).toHaveAttribute('data-axis', 'horizontal');
    await expect(rail).toHaveCSS('touch-action', 'pan-x pinch-zoom');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    for (const fraction of [.5, .08, .5]) {
      const viewport = await rail.boundingBox();
      const before = await rail.evaluate(element => element.scrollLeft);
      await swipe(page, context, { y: viewport.y + viewport.height * fraction, from: viewport.x + viewport.width * .8, to: viewport.x + viewport.width * .2 });
      await expect.poll(() => rail.evaluate(element => element.scrollLeft)).not.toBe(before);
      await expect(page.locator('#gallery')).toBeVisible();
      await expect(page.locator('#viewer')).not.toHaveAttribute('open', '');
    }
    expect(await page.locator('.gallery-card').count()).toBe(total * 3);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test('both loop seams rebase to the middle cycle without changing the selected work', async ({ page }) => {

    await centreSlot(page, -1);
    await expect(page.locator('#position')).toHaveText(positionText(-1));
    await expect.poll(() => centreDistance(page, total - 1)).toBeLessThan(2);
    await centreSlot(page, total);
    await expect(page.locator('#position')).toHaveText(positionText(0));
    await expect.poll(() => centreDistance(page, 0)).toBeLessThan(2);
    expect(await page.locator('.gallery-card').count()).toBe(total * 3);
  });

  test('swiping an enlarged picture selects neighbors and never dismisses the viewer', async ({ page, context }) => {

    await page.locator('#inspect').tap();
    for (const direction of [-1, 1]) {
      const box = await page.locator('#inspection').boundingBox();
      const middle = box.x + box.width / 2;
      await swipe(page, context, { y: box.y + box.height / 2, from: middle - direction * 70, to: middle + direction * 70 });
      await expect(page.locator('#viewer')).toHaveAttribute('open', '');
      await expect(page.locator('#work-title')).toHaveText(catalogue[direction < 0 ? 1 : 0].title);
    }
    await page.waitForTimeout(360);
    await page.locator('#viewer').tap({ position: { x: 10, y: 150 } });
    await expect(page.locator('#viewer')).not.toHaveAttribute('open', '');
    await expect(page.locator('#gallery')).toBeVisible();
  });

  test('short, narrow and landscape viewports keep full images clear of long credits and touch controls', async ({ page }) => {
    await page.evaluate(() => {
      WORKS[1].title = 'A considerably longer artwork title that needs several lines on a narrow phone';
      WORKS[1].medium = 'Archival pigment print on cotton paper';
    });

    await page.locator('#next').tap();
    await expect(page.locator('#position')).toHaveText(positionText(1));
    await page.locator('#inspect').tap();
    for (const viewport of [{ width: 320, height: 480 }, { width: 375, height: 600 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => {
        const image = document.getElementById('inspection').getBoundingClientRect();
        const top = document.querySelector('.viewer-top').getBoundingClientRect();
        const bottom = document.querySelector('.viewer-bottom').getBoundingClientRect();
        return image.top >= top.bottom + 10 && image.bottom <= bottom.top - 10;
      })).toBe(true);
      const bounds = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.getElementById('viewer').getBoundingClientRect().height,
        controls: [...document.querySelectorAll('#viewer .chrome button')].map(button => button.getBoundingClientRect().toJSON()),
      }));
      expect(bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.height).toBeLessThanOrEqual(viewport.height + 1);
      for (const button of bounds.controls) {
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.bottom).toBeLessThanOrEqual(viewport.height);
      }
    }
  });

  test('browser-bar and orientation resizes do not cancel an in-flight navigation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await page.keyboard.press('ArrowDown');
    await page.setViewportSize({ width: 390, height: 664 });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('#position')).toHaveText(positionText(1));
    await expect.poll(() => centreDistance(page, 1)).toBeLessThan(2);
    await expect(page.locator('#rail')).toHaveAttribute('data-layout', 'native');
  });

  test('closing and returning from books preserves the homepage intro and bottom preview', async ({ page }) => {
    await page.locator('#close-gallery').tap();
    await expect(page.locator('#pile')).toBeVisible();
    await page.getByRole('link', { name: 'Books', exact: true }).click();
    await page.getByRole('link', { name: 'Selected work', exact: true }).click();
    await expect(page.locator('#pile')).toBeVisible();
    await expect(page.locator('#gallery')).not.toBeVisible();
    await page.locator('#pile').tap();
    await expect(page.locator('#rail')).toHaveAttribute('data-axis', 'horizontal');
  });
});
