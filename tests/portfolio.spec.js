import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const manifest = await readFile(new URL('../works.js', import.meta.url), 'utf8');
const catalogue = JSON.parse(manifest.match(/const WORKS = ([\s\S]*);/)[1]);
const TOTAL = catalogue.length;
const positionText = index => `${String(((index % TOTAL) + TOTAL) % TOTAL + 1).padStart(2, '0')} / ${TOTAL}`;

test('published artwork uses sharp display-sized derivatives and originals are not served', async ({ request }) => {
  const files = await readdir('dist/res/previews');
  expect(files).toHaveLength(TOTAL * 2);
  expect(catalogue.some(work => work.series === 'Literature')).toBe(false);
  expect((await request.get(`/res/previews/${String(TOTAL + 1).padStart(2, '0')}-large.webp`)).status()).toBe(404);
  for (const file of files) {
    const metadata = await sharp(`dist/res/previews/${file}`).metadata();
    const limit = file.endsWith('-small.webp') ? 960 : 1440;
    expect(Math.max(metadata.width, metadata.height)).toBeLessThanOrEqual(limit);
    if (file.startsWith('01-')) expect(Math.max(metadata.width, metadata.height)).toBe(Math.min(limit, Math.max(catalogue[0].width, catalogue[0].height)));
    expect(metadata.exif).toBeUndefined();
  }
  const directories = await readdir('dist/res');
  expect(directories).not.toContain('works');
  expect(directories).not.toContain('publications');
  expect((await request.get('/res/works/self-portraits/SELF-PORTRAIT.webp')).status()).toBe(404);
  expect((await request.get('/res/publications/crepuscolo.jpg')).status()).toBe(404);
  expect((await request.get('/.git/config')).status()).toBe(404);
});





test('every work is reachable, assets load and the ribbon stays bounded', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const failed = [];
  page.on('pageerror', error => failed.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  await page.goto('/');
  await page.locator('#pile').click();
  for (let i = 0; i < TOTAL + 1; i++) {
    await page.locator('#next').click();
    await expect(page.locator('#position')).toHaveText(positionText(i + 1));
    const native = await page.locator('#rail').getAttribute('data-layout') === 'native';
    expect(await page.locator('.gallery-card').count()).toBeLessThanOrEqual(native ? TOTAL * 3 : 15);
  }
  await page.waitForFunction(() => {
    const rail = document.getElementById('rail').getBoundingClientRect();
    return [...document.querySelectorAll('.gallery-card img')].filter(img => {
      const box = img.getBoundingClientRect();
      return box.bottom > rail.top && box.top < rail.bottom && box.right > rail.left && box.left < rail.right;
    }).every(img => img.complete && img.naturalWidth);
  });
  await page.screenshot({ path: `test-results/gallery-${test.info().project.name}.png` });
  await page.locator('#inspect').click();
  await page.waitForFunction(() => document.getElementById('detail-image').complete && document.getElementById('detail-image').naturalWidth);
  await page.screenshot({ path: `test-results/detail-${test.info().project.name}.png` });
  expect(failed).toEqual([]);
});

test('dragging does not accidentally inspect; clicking a work does', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pile').click();

  await page.waitForTimeout(850);
  const box = await page.locator('#rail').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const vertical = await page.locator('#rail').getAttribute('data-axis') === 'vertical';
  await page.mouse.move(vertical ? x : x - 150, vertical ? y - 150 : y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('#viewer')).not.toBeVisible();
  await page.waitForTimeout(350);
  const centred = page.locator('.gallery-card[data-slot="1"]');
  await centred.click();
  await expect(page.locator('#viewer')).toBeVisible();
});

test('homepage gallery fits short, narrow, landscape and large screens', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pile').click();
  for (const [width, height] of [[320, 568], [768, 1024], [844, 390], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('#inspect')).toBeInViewport();
    await expect(page.locator('#close-gallery')).toBeInViewport();
    await expect(page.locator('#rail')).toHaveAttribute('data-axis', 'horizontal');
  }
});

test('real touch swipe navigates without opening inspection', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch input is tested on mobile');
  await page.goto('/');
  await page.locator('#pile').click();

  await page.waitForTimeout(850);
  const box = await page.locator('#rail').boundingBox();
  const client = await context.newCDPSession(page);
  await expect(page.locator('#rail')).toHaveAttribute('data-axis', 'horizontal');
  const y = box.y + box.height / 2;
  const startX = box.x + box.width * .82;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
  for (let delta = 20; delta <= 240; delta += 20) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - delta, y }] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#position')).not.toHaveText(positionText(0));
  await expect(page.locator('#viewer')).not.toBeVisible();
  await expect(page.locator('#rail')).not.toHaveClass(/is-dragging/);
});

test('equal edge-to-edge gaps across different artwork sizes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();
  await page.evaluate(() => document.fonts.ready);

  for (let i = 0; i < 12; i++) {
    const gaps = await page.locator('.gallery-card').evaluateAll(cards => {
      const vertical = document.getElementById('rail').dataset.axis === 'vertical';
      const rectangles = cards.map(card => card.getBoundingClientRect()).sort((a, b) => vertical ? a.y - b.y : a.x - b.x);
      return rectangles.slice(1).map((rectangle, i) => vertical ? rectangle.top - rectangles[i].bottom : rectangle.left - rectangles[i].right);
    });
    expect(Math.min(...gaps)).toBeGreaterThan(24);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
    await page.locator('#next').click();
    await expect(page.locator('#position')).toHaveText(positionText(i + 1));
  }
});

test('enlarged work keeps smaller clickable neighbors along the gallery axis', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();

  await page.locator('#inspect').click();
  await expect(page.locator('.context-card')).toHaveCount(6);
  const main = await page.locator('#inspection').boundingBox();
  const vertical = await page.locator('#rail').getAttribute('data-axis') === 'vertical';
  for (const offset of [-1, 1]) {
    const neighbor = await page.locator(`.context-card[data-offset="${offset}"]`).boundingBox();
    expect(neighbor.height).toBeLessThan(main.height);
    expect(vertical ? neighbor.y : neighbor.x).toBeLessThan(vertical ? page.viewportSize().height - 80 : page.viewportSize().width);
    expect(vertical ? neighbor.y + neighbor.height : neighbor.x + neighbor.width).toBeGreaterThan(vertical ? 70 : 0);
    const gap = vertical
      ? offset < 0 ? main.y - neighbor.y - neighbor.height : neighbor.y - main.y - main.height
      : offset < 0 ? main.x - neighbor.x - neighbor.width : neighbor.x - main.x - main.width;
    expect(gap).toBeGreaterThan(15);
  }
  const next = await page.locator('.context-card[data-offset="1"]').boundingBox();
  await page.mouse.click(
    vertical ? next.x + next.width / 2 : Math.min(page.viewportSize().width - 5, next.x + 12),
    vertical ? Math.min(page.viewportSize().height - 85, next.y + 12) : next.y + next.height / 2,
  );
  await expect(page.locator('#detail-position')).toHaveText(positionText(1));
  await page.keyboard.press('Escape');
  await expect(page.locator('#viewer')).not.toBeVisible();
  await expect(page.locator('#position')).toHaveText(positionText(1));
});

test('casual saving is deterred and original files are never requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const originals = [];
  page.on('request', request => { if (/\/res\/(works|publications)\//.test(request.url())) originals.push(request.url()); });
  await page.goto('/');
  await page.locator('#pile').click();
  expect(await page.locator('.gallery-card[data-slot="0"]').evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(false);

  await page.locator('#inspect').click();
  await expect(page.locator('#original')).toHaveCount(0);
  await expect(page.locator('#detail-image')).toHaveAttribute('draggable', 'false');
  expect(await page.locator('#detail-image').evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(false);
  await page.locator('#detail-image').dblclick();
  await expect(page.locator('#zoom')).toHaveCount(0);
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /previews\/.*-large\.webp/);
  expect(originals).toEqual([]);
});

test('hover enlarges a print without letting it touch its neighbors', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Hover applies to pointer devices only');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();

  const image = page.locator('.gallery-card[data-slot="0"] img');
  await page.mouse.move(10, 10);
  const before = await image.boundingBox();
  await image.hover();
  await expect.poll(async () => (await image.boundingBox()).width).toBeGreaterThan(before.width * 1.02);
  const after = await image.boundingBox();
  const next = await page.locator('.gallery-card[data-slot="1"]').boundingBox();
  expect(next.x - after.x - after.width).toBeGreaterThan(15);
});



test('gallery and inspection show essential controls with professional artwork credits', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();

  const chromeText = selector => page.locator(selector).evaluate(element => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.sr-only, [hidden], .work-credit').forEach(node => node.remove());
    return clone.textContent.replace(/\s/g, '');
  });
  const vertical = await page.locator('#rail').getAttribute('data-axis') === 'vertical';
  await expect(page.locator('.intro .contact-links a')).toHaveCount(4);
  await expect(page.locator('#gallery')).toHaveAccessibleName('Selected work');
  await expect(page.locator('#gallery-work-title')).toHaveText(catalogue[0].title);
  await expect(page.locator('#gallery-medium')).toHaveText(catalogue[0].medium);
  await expect(page.locator('#gallery-year')).toHaveText(catalogue[0].year || 'n.d.');
  await page.locator('#inspect').click();
  await page.waitForFunction(() => document.getElementById('detail-image').complete);
  expect(await chromeText('#viewer')).toBe(vertical ? '×↑↓' : '×←→');
  await expect(page.locator('#viewer')).toHaveAccessibleName(catalogue[0].title);
  await expect(page.locator('#work-title')).toBeVisible();
  await expect(page.locator('#detail-medium')).toHaveText(catalogue[0].medium);
  await expect(page.locator('#detail-year')).toHaveText(catalogue[0].year || 'n.d.');
  await expect(page.locator('#close-viewer')).toHaveAccessibleName('Back to gallery');
});

test('horizontal keyboard navigation across responsive sizes preserves the selected work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();

  await page.locator('#rail').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#position')).toHaveText(positionText(1));
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#position')).toHaveText(positionText(0));
  await page.keyboard.press('Enter');
  for (const [width, height] of [[390, 844], [844, 390], [1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const vertical = false;
    await expect(page.locator('#rail')).toHaveAttribute('data-axis', vertical ? 'vertical' : 'horizontal');
    // Read both rectangles atomically: resize/font layout can replace context
    // cards between separate protocol calls. Poll until the new layout settles.
    await expect.poll(() => page.evaluate(vertical => {
      const image = document.getElementById('inspection');
      const neighbor = document.querySelector('.context-card[data-offset="1"]');
      if (!image || !neighbor) return -1;
      const main = image.getBoundingClientRect();
      const next = neighbor.getBoundingClientRect();
      return vertical ? next.y - main.y - main.height : next.x - main.x - main.width;
    }, vertical)).toBeGreaterThan(15);
    await expect(page.locator('#detail-position')).toHaveText(positionText(0));
  }
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#detail-position')).toHaveText(positionText(1));
  await page.keyboard.press('Escape');
  await expect(page.locator('#viewer')).not.toBeVisible();
  await expect(page.locator('#position')).toHaveText(positionText(1));
});

test('empty canvas closes inspection while image and neighbor clicks do not', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();

  await page.locator('#inspect').click();
  await page.locator('#detail-image').click();
  await expect(page.locator('#viewer')).toBeVisible();
  const main = await page.locator('#inspection').boundingBox();
  const vertical = await page.locator('#rail').getAttribute('data-axis') === 'vertical';
  await page.mouse.click(vertical ? main.x + main.width / 2 : main.x - 8, vertical ? main.y - 8 : main.y + main.height / 2);
  await expect(page.locator('#viewer')).not.toBeVisible();
  await expect(page.locator('#gallery')).toBeVisible();
  await expect(page.locator('#rail')).toBeFocused();
  await expect(page.locator('#position')).toHaveText(positionText(0));
});

test('expanded gallery closes back to the homepage bottom strip', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const before = await page.locator('#pile').boundingBox();
  await page.locator('#pile').click();
  await page.locator('#next').click();
  await expect(page.locator('#position')).toHaveText(positionText(1));
  await page.keyboard.press('Escape');
  await expect(page.locator('#gallery')).not.toBeVisible();
  await expect(page.locator('#pile')).toBeFocused();
  const after = await page.locator('#pile').boundingBox();
  expect(after.y).toBe(before.y);
  await page.locator('#pile').click();
  await expect(page.locator('#position')).toHaveText(positionText(1));
});

test('desktop left/right keys work from navigation controls and in inspection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();

  await page.locator('#close-gallery').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#position')).toHaveText(positionText(1));
  await page.locator('#previous').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#position')).toHaveText(positionText(2));
  await page.locator('#next').click();
  await expect(page.locator('#position')).toHaveText(positionText(3));
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#position')).toHaveText(positionText(2));
  await page.locator('#inspect').click();
  await page.locator('#close-viewer').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#detail-position')).toHaveText(positionText(1));
  await page.keyboard.press('Escape');
  await expect(page.locator('#viewer')).not.toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#position')).toHaveText(positionText(0));
  await page.keyboard.press('Escape');
  await expect(page.locator('#gallery')).not.toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#position')).toHaveText(positionText(0));
});

test('arrow navigation responds immediately while the opening animation is running', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pile').click();
  const running = await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    return document.getElementById('rail').getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length;
  });
  expect(running).toBe(0);
  await expect(page.locator('#position')).toHaveText(positionText(1));
  await expect.poll(async () => {
    const card = await page.locator('.gallery-card[data-slot="1"]').boundingBox();
    const rail = await page.locator('#rail').boundingBox();
    const vertical = await page.locator('#rail').getAttribute('data-axis') === 'vertical';
    return Math.abs(vertical ? card.y + card.height / 2 - rail.y - rail.height / 2 : card.x + card.width / 2 - rail.x - rail.width / 2);
  }).toBeLessThan(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('#gallery')).not.toBeVisible();
});

test('inspection exit animates and reduced motion dismisses without animation', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pile').click();
  const exit = await page.evaluate(() => {
    document.getElementById('inspect').click();
    document.getElementById('close-viewer').click();
    const viewer = document.getElementById('viewer');
    return { open: viewer.open, closing: viewer.classList.contains('is-closing'), motions: document.getElementById('inspection').getAnimations().length };
  });
  expect(exit.open).toBe(true);
  expect(exit.closing).toBe(true);
  expect(exit.motions).toBeGreaterThan(0);
  await expect(page.locator('#viewer')).not.toBeVisible();
  await expect(page.locator('#gallery')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const count = await page.evaluate(() => {
    document.getElementById('inspect').click();
    document.getElementById('close-viewer').click();
    return document.getElementById('inspection').getAnimations().length;
  });
  expect(count).toBe(0);
  await expect(page.locator('#gallery')).toBeVisible();
});

test('artwork credits follow selection and retain undated years without fabrication', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();

  for (let i = 0; i < TOTAL; i++) {
    const work = catalogue[i];
    expect(typeof work.medium).toBe('string');
    expect(work.medium.length).toBeGreaterThan(0);
    expect(work.year === null || typeof work.year === 'string').toBe(true);
    await expect(page.locator('#gallery-work-title')).toHaveText(work.title);
    await expect(page.locator('#gallery-medium')).toHaveText(work.medium);
    await expect(page.locator('#gallery-year')).toHaveText(work.year || 'n.d.');
    await page.locator('#inspect').click();
    await expect(page.locator('#work-title')).toHaveText(work.title);
    await expect(page.locator('#detail-medium')).toHaveText(work.medium);
    await expect(page.locator('#detail-year')).toHaveText(work.year || 'n.d.');
    const title = await page.locator('#work-title').boundingBox();
    const navigation = await page.locator('.viewer-bottom .navigation').boundingBox();
    expect(title.x + title.width).toBeLessThan(navigation.x);
    expect(title.y + title.height).toBeLessThan(page.viewportSize().height);
    await page.keyboard.press('Escape');
    await expect(page.locator('#viewer')).not.toBeVisible();
    await page.locator('#next').click();
    await expect(page.locator('#position')).toHaveText(positionText(i + 1));
  }
  expect((await request.get('/artwork-metadata.json')).status()).toBe(404);
});

test('expanded gallery and inspection contain focus, then return to ordinary homepage links', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();
  const viewport = await page.locator('#rail').boundingBox();
  await page.mouse.move(viewport.width / 2, viewport.y + viewport.height / 2);
  await page.mouse.wheel(0, 800);
  await expect(page.locator('#position')).not.toHaveText(positionText(0));
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#gallery'))).toBe(true);
  }
  await page.locator('#inspect').click();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#viewer'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#rail')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pile')).toBeFocused();
  await page.getByRole('link', { name: 'Books', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Elsewhere', exact: true })).toBeFocused();
});
