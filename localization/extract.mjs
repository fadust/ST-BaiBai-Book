import fs from 'node:fs';
import { files, segments } from './transform.mjs';
const catalog = fs.existsSync('localization/en.json') ? JSON.parse(fs.readFileSync('localization/en.json', 'utf8')) : {};
const references = {};
for (const file of files()) {
  const source = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  for (const segment of segments(source, file)) {
    catalog[segment.text] ??= '';
    (references[segment.text] ??= []).push(`${file}:${source.slice(0, segment.start).split('\n').length}`);
  }
}
fs.writeFileSync('localization/en.json', JSON.stringify(catalog, null, 2) + '\n');
fs.writeFileSync('localization/references.json', JSON.stringify(references, null, 2) + '\n');
console.log(`${Object.keys(catalog).length} distinct text segments`);
