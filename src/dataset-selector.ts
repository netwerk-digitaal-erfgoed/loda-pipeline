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
const REGISTRY_ENDPOINT = new URL(
  'https://triplestore.netwerkdigitaalerfgoed.nl/repositories/registry'
);

export async function createDatasetSelector(
  datasetIri: URL,
  pipelineDir: string
): Promise<DatasetSelector> {
  // Check for a dataset.ttl with supplemental distributions (e.g. nafotos).
  const ttlPath = path.join(pipelineDir, 'dataset.ttl');
  const distributions = await readLocalDistributions(ttlPath);

  if (distributions.length > 0) {
    return new ManualDatasetSelection([
      new Dataset({iri: datasetIri, distributions}),
    ]);
  }

  // Registry-backed dataset: use RegistrySelector filtered to this IRI.
  return new RegistrySelector({
    registry: new Client(REGISTRY_ENDPOINT),
    criteria: {
      $id: datasetIri.toString(),
      distribution: {
        accessURL: {$filter: '!CONTAINS(STR(?value), "edm")'},
      },
    },
  });
}

async function readLocalDistributions(
  ttlPath: string
): Promise<Distribution[]> {
  let ttl: string;
  try {
    ttl = await readFile(ttlPath, 'utf-8');
  } catch {
    return [];
  }

  const store = new Store(new Parser().parse(ttl));
  return store
    .getQuads(null, DCAT + 'distribution', null, null)
    .flatMap(distQuad =>
      store
        .getQuads(distQuad.object, DCAT + 'accessURL', null, null)
        .map(urlQuad => new Distribution(new URL(urlQuad.object.value)))
    );
}
