import { test, expect } from '@playwright/test';

const publications = [
  ['the idiot', 'Panel Online', '2026-10-26', 'https://panel-magazine.com/the-idiot/'],
  ['insignificance', 'Wayfarer Magazine', '2026-10-16', 'https://wayfarermagazine.substack.com/p/insignificance'],
  ['to catch a butterfly', 'Wayfarer Magazine', '2026-10-15', 'https://wayfarermagazine.substack.com/p/to-catch-a-butterfly'],
];

test('Elsewhere lists only the three verified publications with direct links and dates', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  await page.goto('/');
  await page.getByRole('link', { name: 'Elsewhere', exact: true }).click();
  await expect(page).toHaveURL(/\/elsewhere\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Elsewhere');
  await expect(page.locator('.writing-entry')).toHaveCount(publications.length);
  for (const entry of await page.locator('.writing-entry').all()) await expect(entry).toHaveCSS('border-top-width', '0px');
  for (const [i, [title, outlet, date, url]] of publications.entries()) {
    const entry = page.locator('.writing-entry').nth(i);
    await expect(entry.locator('h2')).toHaveText(title);
    await expect(entry.locator('.writing-outlet')).toHaveText(outlet);
    await expect(entry.locator('time')).toHaveAttribute('datetime', date);
    await expect(entry.locator('a')).toHaveAttribute('href', url);
    await expect(entry.locator('a')).toHaveAttribute('target', '_blank');
    await expect(entry.locator('a')).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(page.locator('body')).toHaveCSS('font-family', /Helvetica Neue/);
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('.copyright')).toContainText(new Date().getFullYear().toString());
  await page.screenshot({ path: `test-results/elsewhere-${test.info().project.name}.png`, fullPage: true });
  for (const privateFile of ['submission-status.md', 'bios.md', 'WAYFARER-ACCEPTANCE-2026-10-09.md', 'docs/published-writing.md']) {
    expect((await request.get('/' + privateFile)).status()).toBe(404);
  }
  expect(errors).toEqual([]);
});

test('writing, books and photographs link to one another', async ({ page }) => {
  await page.goto('/elsewhere.html');
  await expect(page.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute('href', 'https://www.instagram.com/ivanknowswhat/');
  await expect(page.getByRole('link', { name: 'Email', exact: true })).toHaveAttribute('href', 'mailto:parlementmgmt@gmail.com');
  await page.getByRole('link', { name: 'Selected works', exact: true }).click();
  await page.getByRole('link', { name: 'Books', exact: true }).click();
  await expect(page).toHaveURL(/\/books\.html$/);
  await page.getByRole('link', { name: 'Elsewhere', exact: true }).click();
  await expect(page.locator('.writing-list')).toBeVisible();
  await page.getByRole('link', { name: 'Selected works', exact: true }).click();
  await expect(page.locator('.series-name')).toHaveCount(3);
});

test('published writing and navigation fit narrow and landscape screens', async ({ page }) => {
  await page.goto('/elsewhere.html');
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [768, 1024], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const entry of await page.locator('.writing-entry a').all()) {
      const box = await entry.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  }
});
