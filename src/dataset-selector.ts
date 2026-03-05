import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {Dataset, Distribution} from '@lde/dataset';
import {Client} from '@lde/dataset-registry-client';
import {
  type DatasetSelector,
  ManualDatasetSelection,
  RegistrySelector,
} from '@lde/pipeline';
import {Parser, Store} from 'n3';

const DCAT = 'http://www.w3.org/ns/dcat#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const REGISTRY_ENDPOINT = new URL(
  'https://triplestore.netwerkdigitaalerfgoed.nl/repositories/registry'
);

export async function createDatasetSelector(
  pipelineDir: string
): Promise<DatasetSelector> {
  const ttlPath = path.join(pipelineDir, 'dataset.ttl');
  const ttl = await readFile(ttlPath, 'utf-8');
  const store = new Store(new Parser().parse(ttl));

  const datasetQuads = store.getQuads(null, RDF_TYPE, DCAT + 'Dataset', null);
  if (datasetQuads.length === 0) {
    throw new Error(`No dcat:Dataset found in ${ttlPath}`);
  }

  const datasetSubject = datasetQuads[0].subject;
  const datasetIri = datasetSubject.value;

  // Check for local distributions (e.g. nafotos with download URLs not in the registry).
  const distQuads = store.getQuads(datasetSubject, DCAT + 'distribution', null, null);
  if (distQuads.length > 0) {
    const distributions = distQuads.flatMap(distQuad =>
      store
        .getQuads(distQuad.object, DCAT + 'accessURL', null, null)
        .map(urlQuad => new Distribution(new URL(urlQuad.object.value)))
    );
    return new ManualDatasetSelection([
      new Dataset({iri: new URL(datasetIri), distributions}),
    ]);
  }

  // Registry-backed dataset: use RegistrySelector filtered to this IRI.
  return new RegistrySelector({
    registry: new Client(REGISTRY_ENDPOINT),
    criteria: {where: {$id: datasetIri}},
  });
}
