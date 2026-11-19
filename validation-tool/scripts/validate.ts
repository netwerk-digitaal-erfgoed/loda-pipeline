/**
 * Validate an RDF file against SHACL shapes with shacl-engine. Writes the
 * validation report as N-Triples to <report-file>, and the file's class and
 * property counts to <report-file>.summary.json.
 *
 * The whole file is loaded into memory.
 *
 * Usage: npm run validate -- <data-file> <shapes-file> <report-file>
 */
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {Writer} from 'n3';
import rdf from 'rdf-ext';
import Validator from 'shacl-engine/Validator.js';
import {CountsCollector, readQuads} from '../server/rdf.ts';

const {positionals} = parseArgs({allowPositionals: true});
if (positionals.length !== 3) {
  console.error('Usage: npm run validate -- <data-file> <shapes-file> <report-file>');
  process.exit(1);
}
const [dataFile, shapesFile, reportFile] = positionals;

const shapes = rdf.dataset();
for await (const quad of readQuads(shapesFile)) shapes.add(quad);

const data = rdf.dataset();
const counts = new CountsCollector();
for await (const quad of readQuads(dataFile)) {
  data.add(quad);
  counts.add(quad);
}
console.log(`Loaded ${counts.result.triples} triples from ${dataFile}`);

const report = await new Validator(shapes, {factory: rdf}).validate({dataset: data});
console.log(`conforms: ${report.conforms}, results: ${report.results.length}`);

await mkdir(dirname(reportFile), {recursive: true});
await writeFile(reportFile, new Writer({format: 'N-Triples'}).quadsToString([...report.dataset]));
await writeFile(
  `${reportFile}.summary.json`,
  JSON.stringify(
    {
      dataFile: resolve(dataFile),
      shapesFile: resolve(shapesFile),
      validatedAt: new Date().toISOString(),
      ...counts.result,
    },
    null,
    2,
  ),
);
console.log(`Wrote ${reportFile}`);
