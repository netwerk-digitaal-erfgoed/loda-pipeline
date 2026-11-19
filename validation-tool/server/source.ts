import {access, readFile} from 'node:fs/promises';
import {extname, join} from 'node:path';
import filenamifyUrl from 'filenamify-url';
import {Parser} from 'n3';
import {readableFormat} from './rdf.ts';

const DCAT = 'http://www.w3.org/ns/dcat#';

/**
 * The dump the pipeline downloaded for a dataset: the file in the import
 * directory that the downloader named after one of the dataset's access URLs,
 * in a format the tool reads. The access URLs come from the pipeline's
 * dataset file, or else from the dataset registry.
 */
export async function findSourceDump(
  importDir: string,
  datasetUri: string,
  registryEndpoint: string,
  datasetFile?: string,
): Promise<string | undefined> {
  const accessUrls = datasetFile
    ? await accessUrlsFromFile(datasetFile)
    : await accessUrlsFromRegistry(registryEndpoint, datasetUri);

  for (const url of accessUrls) {
    const path = join(importDir, filenamifyUrl(url));
    if (!readableFormat(path)) continue;
    try {
      await access(path);
      return path;
    } catch {
      // Not downloaded: the downloader picked another distribution.
    }
  }
  return undefined;
}

async function accessUrlsFromFile(path: string): Promise<string[]> {
  return new Parser()
    .parse(await readFile(path, 'utf8'))
    .filter(quad => quad.predicate.value === `${DCAT}accessURL`)
    .map(quad => quad.object.value);
}

async function accessUrlsFromRegistry(endpoint: string, datasetUri: string): Promise<string[]> {
  const query = `SELECT ?url WHERE { GRAPH ?g { <${datasetUri}> <${DCAT}distribution>/<${DCAT}accessURL> ?url } }`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
    },
    body: new URLSearchParams({query}),
  });
  if (!response.ok) {
    throw new Error(`The dataset registry answered ${response.status} for ${datasetUri}`);
  }
  const results = (await response.json()) as {
    results: {bindings: {url: {value: string}}[]};
  };
  return results.results.bindings
    .map(binding => binding.url.value)
    .sort((a, b) => Number(extname(a) === '.gz') - Number(extname(b) === '.gz'));
}
