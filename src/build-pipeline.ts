import {mkdir} from 'node:fs/promises';
import {basename, resolve} from 'node:path';
import {
  Pipeline,
  Stage,
  SparqlConstructExecutor,
  SparqlItemSelector,
  ImportResolver,
  SparqlDistributionResolver,
  FileWriter,
  readQueryFile,
} from '@lde/pipeline';
import {createQlever} from '@lde/sparql-qlever';
import {ConsoleReporter} from '@lde/pipeline-console-reporter';
import {ShaclValidator} from '@lde/pipeline-shacl-validator';
import {scanStages} from './scan-stages.js';
import {createDatasetSelector} from './dataset-selector.js';

export async function buildPipeline(datasetIri: URL, pipelineDir: string) {
  const absoluteDir = resolve(pipelineDir);

  // Set up QLever for importing data.
  const importsDir = resolve('imports');
  await mkdir(importsDir, {recursive: true});
  const qlever = createQlever({
    mode: 'docker',
    image: 'adfreiburg/qlever',
    mountDir: importsDir,
  });

  // Always import data dumps into QLever rather than using remote SPARQL endpoints.
  const distributionResolver = new ImportResolver(
    new SparqlDistributionResolver(),
    {importer: qlever.importer, server: qlever.server, strategy: 'import'}
  );

  // Resolve dataset.
  const datasetSelector = await createDatasetSelector(datasetIri, absoluteDir);

  // Set up SHACL validation.
  const validator = new ShaclValidator({
    shapesFile: resolve('pipelines/generic/edm_ext_shacl_shapes.ttl'),
    reportDir: './output/validation',
  });

  // Scan .rq files and build stages in parallel.
  const stageDefs = await scanStages(absoluteDir);
  const stages = await Promise.all(
    stageDefs.map(async def => {
      const [selectorQuery, executors] = await Promise.all([
        readQueryFile(def.selectorFile),
        Promise.all(
          def.executorFiles.map(f => SparqlConstructExecutor.fromFile(f))
        ),
      ]);

      return new Stage({
        name: `Stage ${def.stageNumber}`,
        executors,
        itemSelector: new SparqlItemSelector({query: selectorQuery}),
        batchSize: 2000,
        maxConcurrency: 30,
        validation: {validator, onInvalid: 'write'},
      });
    })
  );

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
