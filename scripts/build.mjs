// An explicit allowlist keeps original artwork and repository files unpublished.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'res'), { recursive: true });

for (const file of ['index.html', 'gallery.html', 'books.html', 'elsewhere.html', 'main.css', 'main.js', 'mobile-gallery.js', 'books.css', 'books.js', 'elsewhere.css', 'site.js', 'works.js', 'res/favicon.ico']) {
  await cp(path.join(root, file), path.join(output, file));
}
for (const directory of ['res/previews', 'res/book-covers', 'res/fonts']) {
  await cp(path.join(root, directory), path.join(output, directory), { recursive: true });
}
// Content-version local assets so an already-open phone never mixes old cached
// gallery code or images with a newly built page. Navigation URLs stay clean.
const versions = new Map();
async function versioned(asset) {
  if (!versions.has(asset)) {
    const bytes = await readFile(path.join(output, asset));
    versions.set(asset, createHash('sha256').update(bytes).digest('hex').slice(0, 12));
  }
  return `${asset}?v=${versions.get(asset)}`;
}
const manifest = await readFile(path.join(output, 'works.js'), 'utf8');
const works = JSON.parse(manifest.match(/const WORKS = ([\s\S]*);/)[1]);
for (const work of works) {
  work.preview = await versioned(work.preview);
  work.detail = await versioned(work.detail);
}
await writeFile(path.join(output, 'works.js'), `// Generated display-only catalogue.\nconst WORKS = ${JSON.stringify(works, null, 2)};\n`);
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const fallback = works.map(work => `<img src="${escapeHTML(work.preview)}" alt="${escapeHTML(work.title)}" width="${work.width}" height="${work.height}" loading="lazy" draggable="false" />`).join('\n');
for (const file of ['index.html', 'gallery.html', 'books.html', 'elsewhere.html']) {
  let html = await readFile(path.join(output, file), 'utf8');
  if (file === 'index.html') html = html.replace('<div class="static-gallery" id="fallback-images"></div>', `<div class="static-gallery" id="fallback-images">${fallback}</div>`);
  const assets = [...html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css|webp|ico))"/g)].map(match => match[1]);
  for (const asset of new Set(assets)) html = html.replaceAll(`"${asset}"`, `"${await versioned(asset)}"`);
  await writeFile(path.join(output, file), html);
}
console.log('Built dist/ — versioned display assets only; originals excluded.');
