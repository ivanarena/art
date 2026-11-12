// Public cover derivatives for the separate books page. Originals stay private.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const titles = ['the_second_thought', 'and_then_we_walk_out', 'crepuscolo', 'versi_liberi'];
await mkdir('res/book-covers', { recursive: true });
for (const title of titles) {
  await sharp(`res/publications/${title}.jpg`)
    .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(`res/book-covers/${title}.webp`);
}
console.log(`Prepared ${titles.length} book covers for the separate books page.`);
