import { test, expect } from '@playwright/test';

test('clicking artwork, including repeated copies, never opens a viewer or navigates', async ({ page }) => {
  await page.goto('/alexythimia.html');
  const track = page.locator('#series-track');
  await track.scrollIntoViewIfNeeded();
  const url = page.url();
  for (const position of [70, 190, 300]) {
    const box = await track.boundingBox();
    await page.mouse.click(box.x + Math.min(position, box.width - 10), box.y + box.height / 2);
    expect(page.url()).toBe(url);
    await expect(page.locator('dialog, [data-focus], #series-track a')).toHaveCount(0);
  }
});

test('wheel scrolling loops endlessly in both directions without growing the ribbon DOM', async ({ page }) => {
  await page.goto('/alexythimia.html');
  const track = page.locator('#series-track');
  await expect(track).toHaveAttribute('data-loop-ready', 'true');
  await track.scrollIntoViewIfNeeded();
  const count = await page.locator('.series-work').count();
  expect(count).toBeLessThanOrEqual(60);
  await expect(page.locator('.series-work[data-original]')).toHaveCount(3);
  const box = await track.boundingBox();
  await page.mouse.move(box.x + Math.min(100, box.width / 2), box.y + box.height / 2);
  for (const direction of [1, -1]) {
    for (let i = 0; i < 18; i++) await page.mouse.wheel(0, direction * 950);
    const state = await track.evaluate(track => ({ left: track.scrollLeft, cycle: Number(track.dataset.cycleWidth), max: track.scrollWidth - track.clientWidth }));
    expect(state.left).toBeGreaterThan(state.cycle * .5 - 2);
    expect(state.left).toBeLessThan(state.cycle * 1.5 + 2);
    expect(state.left).toBeGreaterThan(0);
    expect(state.left).toBeLessThan(state.max);
    expect(await page.locator('.series-work').count()).toBe(count);
  }
  await page.mouse.click(box.x + Math.min(100, box.width / 2), box.y + box.height / 2);
  await expect(page.locator('dialog')).toHaveCount(0);
});

test('dragging the ribbon moves artwork without opening anything', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Fine-pointer drag');
  await page.goto('/a-face-in-the-crowd.html');
  const track = page.locator('#series-track');
  const box = await track.boundingBox();
  const before = await track.evaluate(track => track.scrollLeft);
  await page.mouse.move(box.x + 240, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('dialog')).toHaveCount(0);
  expect(Math.abs(await track.evaluate(track => track.scrollLeft) - before)).toBeGreaterThan(100);
  await expect(track).not.toHaveClass(/is-dragging/);
});

test('an interrupted drag releases capture and leaves the ribbon usable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Fine-pointer drag');
  await page.goto('/alexythimia.html');
  const track = page.locator('#series-track');
  await track.scrollIntoViewIfNeeded();
  const box = await track.boundingBox();
  await page.mouse.move(box.x + 240, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 8 });
  await expect(track).toHaveClass(/is-dragging/);
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  await expect(track).not.toHaveClass(/is-dragging/);
  await page.mouse.up();
  const before = await track.evaluate(element => element.scrollLeft);
  await page.mouse.wheel(0, 240);
  await expect.poll(async () => Math.abs(await track.evaluate(element => element.scrollLeft) - before)).toBeGreaterThan(50);
});

test('keyboard scrolling has no autoplay and resize keeps images spanning the ribbon', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/alexythimia.html');
  const track = page.locator('#series-track');
  const before = await track.evaluate(track => track.scrollLeft);
  await track.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Math.abs(await track.evaluate(track => track.scrollLeft) - before)).toBeGreaterThan(100);
  const settled = await track.evaluate(track => track.scrollLeft);
  await page.waitForTimeout(500);
  expect(await track.evaluate(track => track.scrollLeft)).toBeCloseTo(settled, 0);
  for (const width of [1920, 390, 844, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => track.evaluate(track => track.scrollLeft > 0 && track.scrollLeft < track.scrollWidth - track.clientWidth)).toBe(true);
    await expect(page.locator('.series-work[data-original]')).toHaveCount(3);
    expect(await page.locator('.series-work').count()).toBeLessThanOrEqual(60);
  }
});

test('visual repetitions have no duplicate IDs, links or individual keyboard stops', async ({ page }) => {
  await page.goto('/alexythimia.html');
  const copies = page.locator('.series-work:not([data-original])');
  expect(await copies.count()).toBeGreaterThan(0);
  for (const copy of await copies.all()) {
    await expect(copy).toHaveAttribute('aria-hidden', 'true');
    await expect(copy).not.toHaveAttribute('id');
    await expect(copy.locator('a, button, [tabindex], [id]')).toHaveCount(0);
  }
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(element => element.id));
  expect(new Set(ids).size).toBe(ids.length);
  await expect(page.locator('#series-track')).toHaveAttribute('tabindex', '0');
});

test('a failed artwork request preserves its text alternative and a usable scroll region', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/res/previews/01-large.webp*', route => route.abort());
  await page.goto('/a-face-in-the-crowd.html');
  await expect(page.locator('.series-work[data-original] img').first()).toHaveAttribute('alt', 'Self-portrait 5');
  const track = page.locator('#series-track');
  await expect(track).toHaveAttribute('data-loop-ready', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await track.focus();
  const before = await track.evaluate(track => track.scrollLeft);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Math.abs(await track.evaluate(track => track.scrollLeft) - before)).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});
