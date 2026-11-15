import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { catalogue, series, worksFor } from './catalogue.js';

test('selection contains 24 archive images, all three Alexythimia works, and neither removed legacy work', async () => {
  const metadata = JSON.parse(await readFile('artwork-metadata.json', 'utf8'));
  expect(Object.keys(metadata)).toHaveLength(24);
  expect(Object.keys(metadata).every(file => file.startsWith('archive/'))).toBe(true);
  expect(catalogue.some(work => ['the lake', 'waves w'].includes(work.title))).toBe(false);
  expect(worksFor({ title: 'Alexythimia' }).map(work => work.title)).toEqual(['Alexythimia I', 'Alexythimia II', 'Alexythimia III']);
  expect(series).toHaveLength(3);
  expect(catalogue).toHaveLength(24);
  expect(catalogue.slice(0, 6).every(work => work.series === 'A Face in the Crowd')).toBe(true);
  for (const credit of Object.values(metadata)) {
    expect(catalogue).toContainEqual(expect.objectContaining({ ...credit, year: credit.year == null ? null : String(credit.year) }));
  }
  for (const work of catalogue) {
    const image = await sharp(work.detail).metadata();
    expect(image.width / image.height).toBeCloseTo(work.width / work.height, 2);
  }
});

test('private source originals match the catalogue when available locally', async () => {
  test.skip(!existsSync('res/works/archive'), 'Private originals are intentionally absent from public checkouts and CI');
  const metadata = JSON.parse(await readFile('artwork-metadata.json', 'utf8'));
  const archiveFiles = (await readdir('res/works/archive')).sort();
  expect(Object.keys(metadata).sort()).toEqual(archiveFiles.map(file => `archive/${file}`));
  for (const [file, credit] of Object.entries(metadata)) {
    const { autoOrient: { width, height } } = await sharp(`res/works/${file}`).metadata();
    expect(catalogue).toContainEqual(expect.objectContaining({ ...credit, year: String(credit.year), width, height }));
  }
  const original = await sharp('res/works/archive/11-04 The Light 6 — 2025.jpg').metadata();
  expect(original.orientation).toBe(6);
});

test('The Light 6 before Michelle follows its source orientation and stays vertical in both previews', async () => {
  const index = catalogue.findIndex(work => work.title === 'Michelle');
  const work = catalogue[index - 1];
  expect(work.title).toBe('The Light 6');
  expect(work.width).toBeLessThan(work.height);
  expect({ width: work.width, height: work.height }).toEqual({ width: 2248, height: 4000 });
  for (const file of [work.preview, work.detail]) {
    const image = await sharp(file).metadata();
    expect(image.width).toBeLessThan(image.height);
    expect(image.width / image.height).toBeCloseTo(work.width / work.height, 2);
    expect(image.orientation).toBeUndefined();
    expect(image.exif).toBeUndefined();
  }
});

test('each series page has exactly its original project paragraphs, references and all its selected works', async ({ page }) => {
  for (const item of series) {
    await page.goto(`/${item.slug}.html`);
    await expect(page.locator('h1')).toHaveText(item.title);
    expect(await page.locator('.series-description p').allTextContents()).toEqual(item.description);
    expect(await page.locator('.series-references p').allTextContents()).toEqual(item.references);
    await expect(page.locator('.series-work[data-original]')).toHaveCount(worksFor(item).length);
    expect(await page.locator('.series-work[data-original] figcaption').evaluateAll(captions => captions.map(caption => caption.firstChild.textContent))).toEqual(worksFor(item).map(work => work.title));
    if (!item.description.length) await expect(page.locator('.series-description')).toBeHidden();
  }
});

test('every selected work loads its larger derivative directly in the ribbon with the correct credit', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [], originals = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/res\/(works|publications)\//.test(request.url())) originals.push(request.url()); });
  for (const item of series) {
    await page.goto(`/${item.slug}.html`);
    for (const [index, work] of worksFor(item).entries()) {
      const figure = page.locator('.series-work[data-original]').nth(index);
      const image = figure.locator('img');
      await figure.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center' }));
      await image.evaluate(image => image.decode());
      await expect(image).toHaveAttribute('alt', work.title);
      await expect(image).toHaveAttribute('src', new RegExp(work.detail));
      await expect(figure.locator('figcaption')).toContainText(`${work.medium} · ${work.year || 'n.d.'}`);
      expect(await image.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await expect(page.locator('dialog, #series-track a, [data-focus]')).toHaveCount(0);
    }
  }
  expect(errors).toEqual([]);
  expect(originals).toEqual([]);
});

test('only display derivatives and allowlisted pages are published, never originals or private archive files', async ({ request }) => {
  const files = await readdir('dist/res/previews');
  expect(files).toHaveLength(catalogue.length * 2);
  for (const file of files) {
    const metadata = await sharp(`dist/res/previews/${file}`).metadata();
    expect(Math.max(metadata.width, metadata.height)).toBeLessThanOrEqual(file.endsWith('-small.webp') ? 960 : 1440);
    expect(metadata.exif).toBeUndefined();
  }
  for (const file of ['res/works/various/lakebw.webp', 'res/works/archive/02-01 Self-portrait 5 — 2022.jpg', 'res/publications/crepuscolo.jpg', '.git/config', 'series.json', 'artwork-metadata.json', 'series-template.html', 'scripts/build.mjs', 'metadata/source-nodes.json', 'birth.html', 'various.html']) {
    expect((await request.get(`/${file}`)).status()).toBe(404);
  }
  expect((await request.get('/mobile-gallery.js')).status()).toBe(404);
  const home = await (await request.get('/')).text();
  expect(home).not.toContain('the-lake.webp');
  expect((await request.get('/res/background/the-lake.webp')).status()).toBe(404);
  expect(home).toMatch(/main\.css\?v=[a-f0-9]{12}/);
});
