import {mkdir} from 'node:fs/promises';
import {basename, resolve} from 'node:path';
import {
  Pipeline,
  Stage,
  SparqlItemSelector,
  ImportResolver,
  SparqlDistributionResolver,
  FileWriter,
  readQueryFile,
  SparqlConstructReader,
} from '@lde/pipeline';
import {createQlever} from '@lde/sparql-qlever';
import {ConsoleReporter} from '@lde/pipeline-console-reporter';
import {ShaclValidator} from '@lde/pipeline-shacl-validator';
import {scanStages} from './scan-stages.js';
import {createDatasetSelector} from './dataset-selector.js';

async function createDistributionResolver() {
  // Set up QLever for importing data.
  const importsDir = resolve('imports');
  await mkdir(importsDir, {recursive: true});
  const qlever = createQlever({
    mode: 'docker',
    image: 'adfreiburg/qlever',
    containerName: 'loda-qlever',
    dataDir: importsDir,
    serverOptions: {'memory-max-size': '8G'},
  });

  // Always import data dumps into QLever rather than using remote SPARQL endpoints.
  return new ImportResolver(
    new SparqlDistributionResolver(),
    {importer: qlever.importer, server: qlever.server, strategy: 'import'}
  );
}

export async function buildPipeline(datasetIri: URL, pipelineDir: string) {
  const absoluteDir = resolve(pipelineDir);

  // Resolve dataset.
  const datasetSelector = await createDatasetSelector(datasetIri, absoluteDir);

  // Set up SHACL validation.
  const validator = new ShaclValidator({
    shapesFile: resolve('pipelines/generic/edm_ext_shacl_shapes.ttl'),
    reportWriters: [new FileWriter({ outputDir: './output/validation' })],
  });

  // Scan .rq files and build stages in parallel.
  const stageDefs = await scanStages(absoluteDir);
  const stages = await Promise.all(
    stageDefs.map(async def => {
      const [selectorQuery, readers] = await Promise.all([
        readQueryFile(def.selectorFile),
        Promise.all(
          def.executorFiles.map(f => SparqlConstructReader.fromFile(f, {lineBuffer: true})),
        ),
      ]);

      return new Stage({
        name: `Stage ${def.stageNumber}`,
        readers,
        itemSelector: new SparqlItemSelector({query: selectorQuery}),
        batchSize: 2000,
        maxConcurrency: 30,
        validation: {validator, onInvalid: 'write'},
      });
    })
  );

  const  distributionResolver = await createDistributionResolver()

  const pipeline = new Pipeline({
    name: basename(absoluteDir),
    datasetSelector,
    distributionResolver,
    stages,
    writers: new FileWriter({outputDir: './output'}),
    reporter: new ConsoleReporter(),
  });

  return {pipeline, distributionResolver};
}
