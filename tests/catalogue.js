import { readFile } from 'node:fs/promises';
const manifest = await readFile(new URL('../works.js', import.meta.url), 'utf8');
export const catalogue = JSON.parse(manifest.match(/const WORKS = ([\s\S]*);/)[1]);
export const series = JSON.parse(await readFile(new URL('../series.json', import.meta.url), 'utf8'));
export const worksFor = item => catalogue.filter(work => work.series === item.title);
