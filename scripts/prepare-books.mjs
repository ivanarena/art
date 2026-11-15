// Public cover derivatives for the separate books page. Originals stay private.
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const books = JSON.parse(await readFile('books.json', 'utf8'));
await mkdir('res/book-covers', { recursive: true });
for (const book of books) {
  const title = path.basename(book.cover, '.webp');
  await sharp(`res/publications/${title}.jpg`)
    .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(book.cover);
}
console.log(`Prepared ${books.length} book covers for the separate books page.`);
