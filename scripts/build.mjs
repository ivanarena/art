// Export static gallery/series pages, public credits and display derivatives only.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const manifest = await readFile(path.join(root, 'works.js'), 'utf8');
const works = JSON.parse(manifest.match(/const WORKS = ([\s\S]*);/)[1]).map(({ title, series, medium, year, width, height, preview, detail }) => ({ title, series, medium, year, width, height, preview, detail }));
const books = JSON.parse(await readFile(path.join(root, 'books.json'), 'utf8'));
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'res'), { recursive: true });
await writeFile(path.join(output, '.nojekyll'), '');
const pages = ['index.html', 'gallery.html', 'books.html', 'elsewhere.html'];
for (const file of [...pages, 'main.css', 'main.js', 'books.css', 'books.js', 'elsewhere.css', 'site.js', 'res/favicon.ico']) {
  await cp(path.join(root, file), path.join(output, file));
}
// Copy referenced public derivatives, never entire directories: stray originals,
// notes or stale images must not become public just by sitting beside a preview.
const publicAssets = new Set(['res/portraits/ivan.webp', ...works.flatMap(work => [work.preview, work.detail]), ...books.map(book => book.cover)]);
for (const asset of publicAssets) {
  if (!/^res\/(?:previews|portraits|book-covers)\/[a-z0-9_-]+\.webp$/i.test(asset)) throw new Error(`Invalid public asset: ${asset}`);
  await mkdir(path.dirname(path.join(output, asset)), { recursive: true });
  await cp(path.join(root, asset), path.join(output, asset));
}
const versions = new Map();
async function versioned(asset) {
  if (!versions.has(asset)) {
    const bytes = await readFile(path.join(output, asset));
    versions.set(asset, createHash('sha256').update(bytes).digest('hex').slice(0, 12));
  }
  return `${asset}?v=${versions.get(asset)}`;
}
for (const work of works) {
  work.preview = await versioned(work.preview);
  work.detail = await versioned(work.detail);
}
const series = JSON.parse(await readFile(path.join(root, 'series.json'), 'utf8'));
for (const item of series) {
  if (!/^[a-z0-9-]+$/.test(item.slug)) throw new Error(`Invalid series slug: ${item.slug}`);
  item.works = works.filter(work => work.series === item.title);
}
if (new Set(series.map(item => item.slug)).size !== series.length) throw new Error('Duplicate series slug');
for (const work of works) {
  if (series.filter(item => item.title === work.series).length !== 1) throw new Error(`Missing or duplicate series: ${work.series}`);
}
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
if (new Set(books.map(book => book.id)).size !== books.length || books.some(book => !/^[a-z0-9-]+$/.test(book.id))) throw new Error('Invalid or duplicate book ID');
const bookParagraphs = book => book.description.map(text => `<p>${escapeHTML(text)}</p>`).join('');
const bookReplacements = {
  'BOOK-NAMES': books.map(book => `<button class="book-name" type="button" data-book="${book.id}" aria-expanded="false" aria-controls="book-details">${escapeHTML(book.title)}</button>`).join('\n'),
  'BOOK-PREVIEWS': books.map((book, index) => `<button class="book" type="button" data-book="${book.id}" aria-expanded="false" aria-controls="book-details" aria-label="Show description for ${escapeHTML(book.title)}" style="--cover-ratio: ${escapeHTML(book.ratio)}; --spine-color: ${escapeHTML(book.spineColor)}; --spine-ink: ${escapeHTML(book.spineInk)}">
  <span class="book-object" aria-hidden="true">
    <span class="book-back"></span><span class="book-pages"></span><span class="book-top"></span>
    <span class="book-spine"><span>${escapeHTML(book.title)}</span><span class="spine-author">Ivan Arena</span></span>
    <span class="book-front"><img src="${book.cover}" alt="" width="${escapeHTML(book.width)}" height="${escapeHTML(book.height)}" draggable="false"${index === 0 ? ' fetchpriority="high"' : ''} /></span>
  </span>
</button>`).join('\n'),
  'BOOK-FALLBACK': books.map(book => `<article lang="${escapeHTML(book.language)}"><h2>${escapeHTML(book.title)}</h2><p>${escapeHTML(book.meta)}</p>${bookParagraphs(book)}<a href="${escapeHTML(book.url)}" target="_blank" rel="noopener noreferrer">Get the book ↗</a></article>`).join('\n'),
  'BOOK-DATA': JSON.stringify(books.map(({ id, title, meta, language, description, url }) => ({ id, title, meta, language, description, url }))).replaceAll('<', '\\u003c'),
};
let booksHTML = await readFile(path.join(output, 'books.html'), 'utf8');
for (const [key, value] of Object.entries(bookReplacements)) booksHTML = booksHTML.replace(`<!-- ${key} -->`, value);
await writeFile(path.join(output, 'books.html'), booksHTML);
const credit = work => `${work.medium} · ${work.year || 'n.d.'}`;
const image = (work, eager = false, decorative = false, large = false) => `<img src="${escapeHTML(large ? work.detail : work.preview)}" alt="${decorative ? '' : escapeHTML(work.title)}" width="${work.width}" height="${work.height}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" draggable="false" />`;
const gallery = series.filter(item => item.works.length).map(item => `
<li class="series-entry">
  <a class="series-name" href="${item.slug}.html">${escapeHTML(item.title)}</a>
  <div class="series-preview" aria-hidden="true"><div class="preview-track">${item.works.map(work => image(work, true, true)).join('\n')}</div></div>
</li>`).join('\n');
const galleryHTML = await readFile(path.join(output, 'gallery.html'), 'utf8');
await writeFile(path.join(output, 'gallery.html'), galleryHTML.replace('<!-- GALLERY-SERIES -->', gallery));
const template = await readFile(path.join(root, 'series-template.html'), 'utf8');
const activeSeries = series.filter(item => item.works.length);
for (const item of activeSeries) {
  const replacements = {
    'SERIES-TITLE': escapeHTML(item.title),
    'SERIES-META': escapeHTML(`${item.title} — photographs and project text by Ivan Arena.`),
    'SERIES-CREDIT': escapeHTML(item.credit),
    'SERIES-DESCRIPTION': item.description.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('\n'),
    'SERIES-REFERENCES': item.references.length ? `<h2>References</h2>${item.references.map(text => `<p>${escapeHTML(text)}</p>`).join('\n')}` : '',
    'SERIES-WORKS': item.works.map((work, i) => `<figure class="series-work" id="work-${i + 1}" data-original style="--work-ratio: ${work.width / work.height}" role="group" aria-label="${escapeHTML(work.title)}">
${image(work, i < 3, false, true)}
<figcaption class="sr-only">${escapeHTML(work.title)}<span>${escapeHTML(credit(work))}</span></figcaption></figure>`).join('\n'),
  };
  let html = template;
  for (const [key, value] of Object.entries(replacements)) html = html.replaceAll(`<!-- ${key} -->`, value);
  const file = `${item.slug}.html`;
  await writeFile(path.join(output, file), html);
  pages.push(file);
}
const navigation = file => `<nav class="site-nav" aria-label="Primary">
  <a href="index.html"${file === 'index.html' ? ' aria-current="page"' : ''}>Home</a>
  <a href="gallery.html"${file === 'gallery.html' ? ' aria-current="page"' : ''}>Selected works</a>
  <a href="elsewhere.html"${file === 'elsewhere.html' ? ' aria-current="page"' : ''}>Elsewhere</a>
  <a href="https://www.instagram.com/ivanknowswhat/" target="_blank" rel="noopener noreferrer">Instagram</a>
  <a href="mailto:parlementmgmt@gmail.com">Email</a>
</nav>`;
for (const file of pages) {
  let html = await readFile(path.join(output, file), 'utf8');
  html = html.replace('<!-- SITE-NAV -->', navigation(file));
  const assets = [...html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css|webp|ico))"/g)].map(match => match[1]);
  for (const asset of new Set(assets)) html = html.replaceAll(`"${asset}"`, `"${await versioned(asset)}"`);
  await writeFile(path.join(output, file), html);
}
console.log(`Built dist/: solid-colour homepage, selected works, ${activeSeries.length} series pages and ${works.length} works. Originals excluded.`);
