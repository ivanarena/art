import { test, expect } from '@playwright/test';

test('every page uses black surfaces, white text and the licensed self-hosted Helvetica font', async ({ page, request }) => {
  const fontRequests = [];
  page.on('request', request => { if (request.resourceType() === 'font') fontRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('.home-background')).toHaveCount(0);
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(255, 255, 255)');
  expect(await page.locator('body').evaluate(body => getComputedStyle(body, '::before').content)).toBe('none');
  await page.evaluate(() => document.fonts.ready);
  const sources = await page.evaluate(() => [...document.styleSheets].flatMap(sheet => [...sheet.cssRules]).filter(rule => rule.type === CSSRule.FONT_FACE_RULE).map(rule => rule.style.getPropertyValue('src')));
  expect(sources).toHaveLength(1);
  expect(sources[0]).not.toContain('local(');
  expect(sources[0]).toMatch(/HelveticaNeue-Bold\.woff2\?v=[a-f0-9]{12}/);
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveAttribute('href', /HelveticaNeue-Bold\.woff2\?v=[a-f0-9]{12}/);
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  const { root } = await client.send('DOM.getDocument');
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.intro-copy' });
  const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
  expect(fonts.some(font => font.isCustomFont && font.postScriptName === 'HelveticaNeue-Bold')).toBe(true);
  await client.detach();
  for (const path of ['/', '/gallery.html', '/a-face-in-the-crowd.html', '/books.html', '/elsewhere.html']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('body')).toHaveCSS('font-family', /Helvetica Neue/);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.locator('.site-nav')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.locator('.site-nav')).toHaveCSS('background-image', 'none');
    await expect(page.locator('h1')).toHaveCSS('font-weight', '700');
    await expect(page.locator('.copyright')).toHaveCSS('color', 'rgb(255, 255, 255)');
  }
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(new Set(fontRequests).size).toBe(1);
  for (const url of fontRequests) {
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);
    expect(new URL(url).pathname).toBe('/res/fonts/HelveticaNeue-Bold.woff2');
  }
  expect((await request.get('/res/fonts/HelveticaNeue-Bold.woff2')).status()).toBe(200);
  for (const path of ['/res/fonts/HelveticaNeue-Bold.ttf', '/res/fonts/InterVariable.woff2']) expect((await request.get(path)).status()).toBe(404);
});

test('series names reveal only their own preview on hover and keyboard focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop hover preview');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/gallery.html');
  const entries = page.locator('.series-entry');
  await entries.nth(0).locator('.series-name').hover();
  await expect(entries.nth(0).locator('.series-preview')).toBeVisible();
  await expect(entries.nth(1).locator('.series-preview')).toBeHidden();
  await page.mouse.move(5, 5);
  await expect(entries.nth(0).locator('.series-preview')).toBeHidden();
  await entries.nth(0).locator('.series-name').focus();
  await page.keyboard.press('Tab');
  await expect(entries.nth(1).locator('.series-name')).toBeFocused();
  await expect(entries.nth(1).locator('.series-preview')).toBeVisible();
  await expect(entries.nth(1).locator('img')).toHaveCount(3);
  await expect(entries.nth(0).locator('.series-preview')).toBeHidden();
  await expect(entries.nth(1).locator('.series-preview')).toHaveCSS('transition-duration', '0s');
});

for (const reducedMotion of ['reduce', 'no-preference']) {
  test(`Back navigation and restored focus never stack previews (${reducedMotion})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop previews');
    await page.emulateMedia({ reducedMotion });
    await page.goto('/gallery.html');
    const names = page.locator('.series-name');
    const previews = page.locator('.series-preview');
    for (let index = 0; index < 3; index++) {
      await names.nth(index).click();
      await page.goBack();
      await expect(page).toHaveURL(/\/gallery\.html$/);
      // Exercise the focus state restored by browsers even when the test
      // context reloads the document rather than restoring it from BFCache.
      await names.nth(index).focus();
      const hovered = (index + 1) % 3;
      await names.nth(hovered).hover();
      expect(await page.locator('.series-preview:visible').count()).toBe(1);
      await expect(previews.nth(hovered)).toBeVisible();
      await expect(previews.nth(index)).toBeHidden();
      await expect(names.nth(index)).toBeFocused();
      await page.goForward();
      await page.goBack();
      await names.nth(hovered).hover();
      expect(await page.locator('.series-preview:visible').count()).toBe(1);
    }
    await page.mouse.move(5, 5);
    await names.first().focus();
    await page.keyboard.press('Tab');
    await expect(names.nth(1)).toBeFocused();
    await expect(previews.nth(1)).toBeVisible();
    await names.nth(2).hover();
    expect(await page.locator('.series-preview:visible').count()).toBe(1);
    await expect(previews.nth(2)).toBeVisible();
    await expect(names.nth(1)).toBeFocused();
    await page.mouse.move(5, 5);
    await expect(previews.nth(1)).toBeVisible();
    await expect(previews.nth(2)).toBeHidden();
  });
}

test('paragraphs, titles, links, metadata and references share one type size across every page', async ({ page }) => {
  const type = locator => locator.evaluate(element => {
    const css = getComputedStyle(element);
    return { family: css.fontFamily, size: css.fontSize, weight: css.fontWeight, color: css.color, leading: css.lineHeight, tracking: css.letterSpacing };
  });
  const seriesCopy = '.series-title, .series-description, .series-credit, .series-references, .series-references h2';
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/gallery.html');
    const reference = await type(page.locator('.series-name').first());
    for (const [url, selector] of [
      ['/', '.intro-copy'], ['/gallery.html', '.series-name, .books-link'],
      ['/a-face-in-the-crowd.html', seriesCopy], ['/alexythimia.html', seriesCopy], ['/for-now-we-see-through-a-glass-darkly.html', seriesCopy],
      ['/books.html', '.book-name, #book-title, #book-meta, #book-description, #book-purchase'], ['/elsewhere.html', '.writing-entry h2, .writing-outlet, .writing-entry time'],
    ]) {
      await page.goto(url);
      for (const target of await page.locator(selector).all()) expect(await type(target)).toEqual(reference);
    }
  }
});

test('hover previews show every work in a single tightly packed row, clipped with frosted edges', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop hover');
  await page.goto('/gallery.html');
  const entry = page.locator('.series-entry').first();
  await entry.locator('.series-name').hover();
  const preview = entry.locator('.series-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveCSS('overflow-x', 'hidden');
  await expect(entry.locator('.preview-track')).toHaveCSS('column-gap', '6px');
  const rectangles = await preview.locator('img').evaluateAll(images => images.map(image => image.getBoundingClientRect().toJSON()));
  expect(Math.max(...rectangles.map(box => box.y)) - Math.min(...rectangles.map(box => box.y))).toBeLessThan(1);
  expect(Math.max(...rectangles.map(box => box.height)) - Math.min(...rectangles.map(box => box.height))).toBeLessThan(1);
  expect(await preview.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  const edge = await preview.evaluate(element => ({ filter: getComputedStyle(element, '::after').backdropFilter, mask: getComputedStyle(element, '::after').maskImage }));
  expect(edge.filter).toBe('blur(8px)');
  expect(edge.mask).toContain('linear-gradient');
});

test('artwork has no links, focus controls or modal; only the ribbon is keyboard-focusable', async ({ page }) => {
  await page.goto('/a-face-in-the-crowd.html');
  const track = page.locator('#series-track');
  const image = page.locator('.series-work[data-original] img').first();
  await expect(page.locator('dialog, [data-focus], #series-track a, #series-track button, .carousel-controls, .series-pagination')).toHaveCount(0);
  await expect(track).toHaveAttribute('tabindex', '0');
  await expect(image).toHaveAttribute('draggable', 'false');
  await expect(image).toHaveCSS('object-fit', 'contain');
  const url = page.url();
  await image.click();
  expect(page.url()).toBe(url);
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(image).not.toBeFocused();
  await track.focus();
  await expect(track).toBeFocused();
});
