import { test, expect } from '@playwright/test';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { catalogue, series } from './catalogue.js';

const root = process.cwd();
const books = JSON.parse(await readFile('books.json', 'utf8'));
const staticFiles = ['index.html', 'gallery.html', 'books.html', 'elsewhere.html', 'main.css', 'main.js', 'books.css', 'books.js', 'elsewhere.css', 'site.js', 'res/favicon.ico'];
const images = ['res/portraits/ivan.webp', ...catalogue.flatMap(work => [work.preview, work.detail]), ...books.map(book => book.cover)];
const expected = ['.nojekyll', ...staticFiles, ...images, ...series.map(item => `${item.slug}.html`)].sort();

async function filesIn(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const lists = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]));
  return lists.flat().sort();
}

test('production output contains exactly the public allowlist, without unused catalogues or source data', async () => {
  expect(await filesIn('dist')).toEqual(expected);
});

test('stray files and private data beside public derivatives cannot enter a build', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'art-build-audit-'));
  try {
    const inputs = [...staticFiles, ...images, 'works.js', 'books.json', 'series.json', 'series-template.html', 'scripts/build.mjs'];
    for (const file of inputs) {
      await mkdir(path.dirname(path.join(fixture, file)), { recursive: true });
      await cp(path.join(root, file), path.join(fixture, file));
    }
    await writeFile(path.join(fixture, 'res/previews/stale-large.webp'), 'PRIVATE_TEST_NOTE');
    await writeFile(path.join(fixture, 'res/portraits/private-original.jpg'), 'PRIVATE_TEST_NOTE');
    await writeFile(path.join(fixture, 'books.json'), JSON.stringify(books.map(book => ({ ...book, privateNote: 'PRIVATE_TEST_NOTE' }))));
    await promisify(execFile)(process.execPath, [path.join(fixture, 'scripts/build.mjs')], { cwd: fixture });
    const output = path.join(fixture, 'dist');
    expect(await filesIn(output)).toEqual(expected);
    expect(await readFile(path.join(output, 'books.html'), 'utf8')).not.toContain('PRIVATE_TEST_NOTE');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
