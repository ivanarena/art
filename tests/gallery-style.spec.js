import { test, expect } from '@playwright/test';
import sharp from 'sharp';

const ink = 'rgb(28, 27, 25)';
const mutedInk = 'rgb(106, 103, 98)';

test('natural-case Afacad typography and white backgrounds are shared by every page and gallery layer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of ['/', '/gallery.html', '/books.html', '/elsewhere.html']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('body')).toHaveCSS('font-family', /Afacad/);
    await expect(page.locator('body')).toHaveCSS('text-transform', 'none');
    if (path === '/books.html') await expect(page.locator('.book-spine').first()).toHaveCSS('text-transform', 'none');
    expect(await page.locator('body').evaluate(body => getComputedStyle(body, '::before').backgroundImage)).toBe('none');
    await expect(page.locator('header')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('html')).toHaveCSS('color', ink);
    await expect(page.locator('.intro-copy')).toHaveCSS('color', ink);
    await expect(page.locator('.copyright')).toHaveCSS('color', mutedInk);
    await expect(page.locator('.contact-links a').first()).toHaveCSS('color', ink);
    if (path === '/books.html') await expect(page.locator('.book-details p')).toHaveCSS('color', mutedInk);
    if (path === '/elsewhere.html') await expect(page.locator('.writing-outlet').first()).toHaveCSS('color', mutedInk);
  }
  await page.goto('/');
  await page.locator('#pile').click();
  await expect(page.locator('#gallery')).toHaveCSS('background-image', 'none');
  expect(await page.locator('#gallery').evaluate(dialog => getComputedStyle(dialog, '::backdrop').backgroundImage)).toBe('none');
  await expect(page.locator('#close-gallery')).toHaveCSS('color', ink);
  await expect(page.locator('#gallery-work-title')).toHaveCSS('color', ink);
  await expect(page.locator('#gallery-medium')).toHaveCSS('color', mutedInk);
  await page.locator('#inspect').click();
  await expect(page.locator('#viewer')).toHaveCSS('background-image', 'none');
  expect(await page.locator('#viewer').evaluate(dialog => getComputedStyle(dialog, '::backdrop').backgroundImage)).toBe('none');
  for (const selector of ['#gallery', '#viewer']) {
    await expect(page.locator(`${selector} .chrome`).first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    expect(await page.locator(`${selector} .gallery-edge`).first().evaluate(edge => getComputedStyle(edge, '::after').backgroundImage)).toBe('none');
  }
  await expect(page.locator('#work-title')).toHaveCSS('color', ink);
  await expect(page.locator('#detail-medium')).toHaveCSS('color', mutedInk);
});

test('progressive edge blur follows the gallery axis without covering focused art or intercepting input', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();
  for (const dialog of ['#gallery', '#viewer']) {
    if (dialog === '#viewer') await page.locator('#inspect').click();
    const edges = page.locator(`${dialog} > .gallery-edge`);
    await expect(edges).toHaveCount(2);
    const vertical = await page.locator('#rail').getAttribute('data-axis') === 'vertical';
    for (const edge of await edges.all()) {
      await expect(edge).toHaveAttribute('aria-hidden', 'true');
      await expect(edge).toHaveCSS('pointer-events', 'none');
      const filters = await edge.locator('span').evaluateAll(elements => elements.map(element => ({
        blur: getComputedStyle(element).backdropFilter,
        mask: getComputedStyle(element).maskImage,
      })));
      expect(filters.map(filter => filter.blur)).toEqual(['blur(2px)', 'blur(6px)', 'blur(14px)']);
      expect(filters.every(filter => filter.mask.includes('linear-gradient'))).toBe(true);
      expect(await edge.evaluate(element => {
        const box = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(false);
    }
    const first = await edges.first().boundingBox();
    const last = await edges.last().boundingBox();
    const focused = await page.locator(dialog === '#viewer' ? '#inspection' : '.gallery-card[data-slot="0"]').boundingBox();
    if (vertical) {
      expect(first.y + first.height).toBeLessThanOrEqual(focused.y);
      expect(last.y).toBeGreaterThanOrEqual(focused.y + focused.height);
    } else {
      expect(first.x + first.width).toBeLessThanOrEqual(focused.x);
      expect(last.x).toBeGreaterThanOrEqual(focused.x + focused.width);
    }
    await expect(page.locator(`${dialog} .chrome`).first()).toHaveCSS('z-index', '5');
    await expect(page.locator(dialog === '#viewer' ? '#detail-image' : '.gallery-card[data-slot="0"] img')).toHaveCSS('filter', 'none');
  }
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('#viewer > .gallery-edge').first()).toBeHidden();
});

test('edge blur changes rendered pixels but leaves the central photograph unchanged', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#pile').click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const rail = document.getElementById('rail').getBoundingClientRect();
    return [...document.querySelectorAll('.gallery-card img')].filter(image => {
      const box = image.getBoundingClientRect();
      return box.bottom > rail.top && box.top < rail.bottom && box.right > rail.left && box.left < rail.right;
    }).every(image => image.complete && image.naturalWidth);
  });
  const box = await page.locator('.gallery-card[data-slot="0"]').boundingBox();
  const crop = { left: Math.round(box.x + box.width / 2 - 24), top: Math.round(box.y + box.height / 2 - 24), width: 48, height: 48 };
  const frosted = await page.screenshot({ path: `test-results/blurred-gallery-${test.info().project.name}.png`, scale: 'css' });
  await page.addStyleTag({ content: '.gallery-edge { visibility: hidden !important; }' });
  const plain = await page.screenshot({ scale: 'css' });
  const frostedCentre = await sharp(frosted).extract(crop).raw().toBuffer();
  const plainCentre = await sharp(plain).extract(crop).raw().toBuffer();
  expect(frostedCentre.equals(plainCentre)).toBe(true);
  expect(frosted.equals(plain)).toBe(false);
});
