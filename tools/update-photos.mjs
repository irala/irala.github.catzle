#!/usr/bin/env node
/* Regenera assets/cats/photos.json con los nombres de las fotos de la carpeta.
   Útil para publicar el juego en un sitio estático sin listado de directorios.
   Uso, desde la carpeta del proyecto:  node tools/update-photos.mjs */

import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('assets/cats');
const imageExt = /\.(jpe?g|png|webp|gif|avif)$/i;

const files = (await readdir(dir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && imageExt.test(entry.name))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, 'es'));

const target = path.join(dir, 'photos.json');
await writeFile(target, `${JSON.stringify(files, null, 2)}\n`, 'utf8');

console.log(`photos.json actualizado: ${files.length} foto(s).`);
for (const file of files) console.log(`  · ${file}`);
